'use strict';
// 发布任务运行器 + 定时调度。单任务串行执行（一次只开一个浏览器实例，最稳）。
const fs = require('fs');
const path = require('path');
const { load, save, uid, DATA } = require('./store');
const platforms = require('./platforms');
const auto = require('./automation');

const LOGS_MAX = 500;

function getLogs() { return load('logs.json', []); }
function log(taskId, accountId, level, msg) {
  const logs = getLogs();
  logs.push({ ts: Date.now(), taskId, accountId, level, msg });
  while (logs.length > LOGS_MAX) logs.shift();
  save('logs.json', logs);
}

function loggedInUrl(platform, url) {
  try { return platform.loggedInUrl ? platform.loggedInUrl.test(url) : false; } catch { return false; }
}

// 撞到登录墙时，直接在浏览器里打开登录页，等用户扫码/登录完成（最多 minutes 分钟）。
async function waitForLogin(ctx, page, platform, accountId, minutes = 5) {
  log('', accountId, 'warn', `检测到未登录，已打开 ${platform.name} 登录页，请在浏览器中完成登录（最多等 ${minutes} 分钟）`);
  await page.goto(platform.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  const started = Date.now();
  while (Date.now() - started < minutes * 60 * 1000) {
    if (await auto.checkLoggedIn(ctx, platform, page)) return true;
    await page.waitForTimeout(2500).catch(() => {});
  }
  return false;
}

// 发布一个账号。返回 {status:'ok'|'manual'|'failed', message}
async function publishToAccount(account, article, coverPath) {
  const platform = platforms.find(p => p.id === account.platformId);
  if (!platform) throw new Error('未知平台: ' + account.platformId);
  log('', account.id, 'info', `开始发布「${article.title}」-> ${platform.name}(${account.name})`);

  const ctx = await auto.launch(account.id);
  ctx.on('dialog', d => d.accept().catch(() => {}));
  const page = ctx.pages()[0] || await ctx.newPage();
  let cur = page;
  let gotoOk = false;
  for (const u of platforms.editorUrlsFor(platform, article)) {
    try {
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      gotoOk = true; break;
    } catch (e) { log('', account.id, 'warn', `编辑器入口失败 ${u}: ${e.message}`); }
  }
  if (!gotoOk) {
    await auto.closeCtx(ctx);
    return { status: 'failed', message: '编辑器页面打不开（可能登录已过期）' };
  }
  // 简书这类平台：先取当前文集 ID，再跳到「新建笔记」空白页，避免覆盖旧草稿
  if (platform.newNoteUrl) {
    for (let i = 0; i < 12 && !/notebooks\/\d+/.test(page.url()); i++) await page.waitForTimeout(800);
    const nu = platform.newNoteUrl(page.url());
    if (nu) {
      await page.goto(nu, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(2500);
      log('', account.id, 'info', '已打开新建草稿页');
    }
  }
  // 公众号编辑器 URL 需要动态 token：先打开首页，再拼出编辑页
  if (platform.editorUrlFrom) {
    for (let i = 0; i < 12 && !/token=/.test(page.url()); i++) await page.waitForTimeout(800);
    const eu = platform.editorUrlFrom(page.url());
    if (eu) {
      await page.goto(eu, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(2500);
      log('', account.id, 'info', '已进入编辑器');
    }
  }
  // 登录态检查：撞到登录墙就打开登录页等用户登录，登完自动重进编辑器继续发
  if (await auto.hitLoginWall(ctx, platform, page)) {
    const loggedIn = await waitForLogin(ctx, page, platform, account.id, 5);
    if (!loggedIn) {
      await auto.closeCtx(ctx);
      log('', account.id, 'error', '登录已过期，请重新登录');
      return { status: 'failed', message: '登录已过期，请重新登录' };
    }
    log('', account.id, 'info', '登录成功，继续发布');
    let reopened = false;
    for (const u of platforms.editorUrlsFor(platform, article)) {
      try {
        await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1500);
        reopened = true; break;
      } catch (e) { log('', account.id, 'warn', `重进编辑器失败 ${u}: ${e.message}`); }
    }
    if (!reopened) {
      await auto.closeCtx(ctx);
      return { status: 'failed', message: '登录后编辑器页面仍打不开' };
    }
  }
  // 必须在已有草稿里新建的平台（如简书）先点「新建文章」
  if (platform.newDraftFirst && platform.preClickText && platform.preClickText.length) {
    const clicked = await auto.clickIfAny(cur, platform.preClickText, 3000);
    if (clicked) {
      log('', account.id, 'info', `点击入口「${clicked}」创建新草稿`);
      await cur.waitForTimeout(1500);
    }
  }
  // 等编辑器渲染；公众号这类列表页需要先点「新建图文」，会弹新标签页
  let ready = await auto.waitForEditor(cur, platform, 8000);
  if (!ready && platform.preClickText && platform.preClickText.length) {
    const clicked = await auto.clickIfAny(page, platform.preClickText, 3000);
    if (clicked) {
      log('', account.id, 'info', `点击入口「${clicked}」`);
      const popup = await auto.waitForPopup(ctx, page, 5000);
      if (popup !== page) { cur = popup; log('', account.id, 'info', '已切换到新打开的编辑页'); }
      ready = await auto.waitForEditor(cur, platform, 25000);
    }
  }
  // 小红书这类必须先传图才会出现编辑区的平台
  let coverOk = false;
  if (platform.mediaFirst && coverPath && fs.existsSync(coverPath)) {
    coverOk = await auto.uploadCover(cur, platform, coverPath);
    if (coverOk) {
      log('', account.id, 'info', '封面图已上传，等待编辑器生成');
      await cur.waitForTimeout(4000);
      ready = await auto.waitForEditor(cur, platform, 25000);
    }
  }
  if (!ready) ready = await auto.waitForEditor(cur, platform, 12000);
  if (!ready) log('', account.id, 'warn', '编辑器识别较慢，仍尝试填充');
  const accName = account.name, pName = platform.name;
  let filledTitle = false, filledContent = false;
 let contentHtml = '';
  try {
    const artMode = article.mode || 'richtext';
   contentHtml = artMode === 'markdown' ? auto.mdToHtml(article.content) : article.content;
    contentHtml = auto.inlineLocalImages(contentHtml);
    filledTitle = await auto.fillTitle(cur, platform, article.title);
    filledContent = await auto.fillContent(cur, platform, contentHtml);
    if (!platform.noCoverUpload && coverPath && fs.existsSync(coverPath)) coverOk = await auto.uploadCover(cur, platform, coverPath);
  } catch (e) {
    log('', account.id, 'error', '填充异常: ' + e.message);
  }
  log('', account.id, filledTitle && filledContent ? 'info' : 'warn',
    `填充结果 标题:${filledTitle ? '成功' : '失败'} 正文:${filledContent ? '成功' : '失败'}（正文约 ${auto.htmlToText(article.content || '').replace(/\s+/g, '').length} 字）`);
  // 平台适配器钩子：填充后处理弹窗（原创声明/同步等），并输出分步日志
  const ad = auto.adapterOf(platform);
  const adlog = auto.adapterLog(platform);
  if (ad) {
    adlog('适配器已加载：' + (ad.name || platform.name) + '（标题选择器 ' + ((ad.titleSelectors || []).length) + ' 个 / 正文 ' + ((ad.contentSelectors || []).length) + ' 个）');
    if (ad.afterFill) { try { await ad.afterFill(cur, adlog); } catch (e) { adlog('afterFill 异常：' + e.message); } }
    if (ad.handleDialogs) { try { await ad.handleDialogs(cur, adlog); } catch (e) { adlog('弹窗处理异常：' + e.message); } }
  }

  // 半自动平台（如微信）：不点发布，留给用户手动确认
  if (platform.semi) {
    log('', account.id, 'info', `已填好(标题:${filledTitle ? '成功' : '失败'} 正文:${filledContent ? '成功' : '失败'})，请在浏览器手动点「发表」`);
    return { status: 'manual', message: '已填好内容，请在浏览器手动发表', keepCtx: ctx, page: cur };
  }

  if (!filledTitle || !filledContent) {
    // 手动降级：内容进剪贴板
    const text = article.title + '\n\n' + (platform.contentType === 'markdown' ? auto.htmlToMd(article.content) : auto.htmlToText(article.content));
    try {
      await cur.evaluate(t => navigator.clipboard.writeText(t), text);
    } catch { /* 剪贴板被拒就只能手抄了 */ }
    log('', account.id, 'warn', '自动填充失败，已降级手动模式（标题正文已复制到剪贴板）');
    return { status: 'manual', message: '自动填充未成功，请手动粘贴发布（内容已复制）', keepCtx: ctx, page: cur };
  }

  // 发布前排版检查：富文本平台里不能残留 Markdown 符号、图片不能丢
  if (filledTitle && filledContent) {
    const fmt = await auto.checkEditorFormatting(cur, platform, contentHtml);
    if (fmt.level === 'bad') {
      log('', account.id, 'error', '排版检查未通过：' + fmt.issues.join('；') + '，已停止自动发布');
      return { status: 'manual', message: '排版异常：' + fmt.issues.join('；') + '（窗口已保留，请检查后手动发布）', keepCtx: ctx, page: cur };
    }
    if (fmt.issues.length) log('', account.id, 'warn', '排版提醒：' + fmt.issues.join('；'));
  }

  // 发布前必填项检查（适配器声明）：封面/标题/正文未就绪时不盲目提交
  if (ad && ad.preflight) {
    const pre = await ad.preflight(cur, adlog).catch(e => ({ ok: false, issues: [e.message] }));
    if (!pre.ok) {
      log('', account.id, 'error', '发布前检查未通过：' + pre.issues.join('；'));
      return { status: 'manual', message: '发布前检查未通过：' + pre.issues.join('；') + '（窗口已保留，请补全后手动发布）', keepCtx: ctx, page: cur };
    }
    adlog('发布前检查通过（标题/正文/必填项就绪）');
  }

  await cur.waitForTimeout(1500);
  const startUrl = cur.url();
  const btn = platform.previewThenPublish
    ? await auto.clickPreviewThenPublish(cur)
    : await auto.clickPublishRetry(cur, 15000, platform);
  let ok = false, detail = '已点击「' + (btn || '?') + '」';
  if (btn) {
    // 等待发布结果：成功提示 / 跳到后台页 / 发布中继续等
    let res = await auto.waitForPublishSuccess(cur, startUrl, 10000);
    if (!res.ok) {
      const cbtn = await auto.clickConfirm(cur, platform);
      if (cbtn) {
        detail += `，已确认「${cbtn}」`;
        res = await auto.waitForPublishSuccess(cur, startUrl, 15000);
      }
    }
    ok = res.ok;
    if (!ok) detail += res.how === 'closed' ? '；页面已关闭' : '；未检测到发布成功提示';
  } else {
    detail = '没找到发布按钮，可能需要手动点';
  }
  log('', account.id, ok ? 'info' : 'warn', `${pName}(${accName}) ${ok ? '发布成功' : detail}`);
  if (ok) {
    await auto.closeCtx(ctx);
    return { status: 'ok', message: '发布成功' };
  }
  // 发布未确认：保留浏览器窗口，让用户核对/手动补发，确认发出后再手动关闭
  return { status: 'manual', message: detail + '，请在浏览器核对并手动完成（窗口已保留）', keepCtx: ctx, page: cur };
}

// 媒体发布流程（视频 / 音频）
async function publishMediaToAccount(account, article, mediaPath) {
  const platform = platforms.find(p => p.id === account.platformId);
  if (!platform) throw new Error('未知平台: ' + account.platformId);
  const kind = article.type === 'audio' ? '音频' : '视频';
  const kindEn = article.type === 'audio' ? 'audio' : 'video';
  log('', account.id, 'info', `开始发布${kind}「${article.title}」-> ${platform.name}(${account.name})`);

  const ctx = await auto.launch(account.id);
  ctx.on('dialog', d => d.accept().catch(() => {}));
  const page = ctx.pages()[0] || await ctx.newPage();
  let cur = page;
  let gotoOk = false;
  for (const u of platforms.editorUrlsFor(platform, article)) {
    try {
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      gotoOk = true; break;
    } catch (e) { log('', account.id, 'warn', `上传页入口失败 ${u}: ${e.message}`); }
  }
  if (!gotoOk) {
    await auto.closeCtx(ctx);
    return { status: 'failed', message: kind + '上传页打不开（可能登录已过期）' };
  }
  if (await auto.hitLoginWall(ctx, platform, page)) {
    const loggedIn = await waitForLogin(ctx, page, platform, account.id, 5);
    if (!loggedIn) {
      await auto.closeCtx(ctx);
      log('', account.id, 'error', '登录已过期，请重新登录');
      return { status: 'failed', message: '登录已过期，请重新登录' };
    }
    log('', account.id, 'info', `登录成功，继续发布${kind}`);
    let reopened = false;
    for (const u of platforms.editorUrlsFor(platform, article)) {
      try {
        await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1500);
        reopened = true; break;
      } catch (e) { log('', account.id, 'warn', `重进上传页失败 ${u}: ${e.message}`); }
    }
    if (!reopened) {
      await auto.closeCtx(ctx);
      return { status: 'failed', message: `登录后${kind}上传页仍打不开` };
    }
  }
  const fileInput = platform.uploadInput || (kindEn === 'audio' ? 'input[accept*="audio"], input[type="file"]' : 'input[type="file"]');
  let uploadReady = await auto.pickVisibleIn(cur, [fileInput]);
  if (!uploadReady && platform.preClickText && platform.preClickText.length) {
    const clicked = await auto.clickIfAny(page, platform.preClickText, 3000);
    if (clicked) {
      log('', account.id, 'info', `点击入口「${clicked}」`);
      const popup = await auto.waitForPopup(ctx, page, 5000);
      if (popup !== page) { cur = popup; log('', account.id, 'info', '已切换到新打开的上传页'); }
      uploadReady = await auto.pickVisibleIn(cur, [fileInput]);
    }
  }

  const upOk = await auto.uploadMedia(cur, platform, mediaPath, kindEn);
  if (!upOk) {
    log('', account.id, 'warn', `没找到${kind}上传入口，已降级手动模式`);
    return { status: 'manual', message: `未找到上传入口，请手动上传${kind}后发布`, keepCtx: ctx, page: cur };
  }
  log('', account.id, 'info', `${kind}已选中，等待上传处理（最多 5 分钟）…`);

  // 等到标题/描述框出现，说明上传处理完成
  const started = Date.now();
  while (Date.now() - started < 5 * 60 * 1000) {
    const hasDesc = await auto.pickVisible(cur, [...(platform.descSelectors || []), ...auto.GENERIC_DESC]);
    const hasTitle = await auto.pickVisible(cur, [...(platform.titleSelectors || []), ...auto.GENERIC_TITLE]);
    if (hasDesc || hasTitle) break;
    await page.waitForTimeout(3000);
  }
  await cur.waitForTimeout(1500);

  let t = false, d = false;
  try {
    t = await auto.fillTitle(cur, platform, article.title);
    d = await auto.fillDesc(cur, platform, article.mode === 'markdown' ? article.content : auto.htmlToText(article.content));
    if (article.tags) await auto.fillTags(cur, platform, article.tags);
  } catch (e) { log('', account.id, 'error', '填写异常: ' + e.message); }

  if (platform.semi) {
    log('', account.id, 'info', `${kind}已上传并填好(标题:${t ? '成功' : '失败'} 描述:${d ? '成功' : '失败'})，请手动点「发表」`);
    return { status: 'manual', message: `${kind}已上传并填好，请手动发表`, keepCtx: ctx, page: cur };
  }
  if (!t && !d) {
    const text = article.title + '\n\n' + auto.htmlToText(article.content);
    try { await cur.evaluate(v => navigator.clipboard.writeText(v), text); } catch { /* */ }
    log('', account.id, 'warn', `${kind}填写失败，已降级手动模式（内容已复制到剪贴板）`);
    return { status: 'manual', message: '自动填写未成功，请手动完成（内容已复制）', keepCtx: ctx, page: cur };
  }
  await cur.waitForTimeout(1500);
  const startUrl = cur.url();
 const btn = await auto.clickPublishRetry(cur, 15000, platform);
  let ok = false, detail = '已点击「' + (btn || '?') + '」';
  if (btn) {
    let res = await auto.waitForPublishSuccess(cur, startUrl, 10000);
    if (!res.ok) {
     const cbtn = await auto.clickConfirm(cur, platform);
      if (cbtn) {
        detail += `，已确认「${cbtn}」`;
        res = await auto.waitForPublishSuccess(cur, startUrl, 15000);
      }
    }
    ok = res.ok;
    if (!ok) detail += res.how === 'closed' ? '；页面已关闭' : '；未检测到发布成功提示';
  } else { detail = '没找到发布按钮，可能需要手动点'; }
  log('', account.id, ok ? 'info' : 'warn', `${platform.name}(${account.name}) ${kind}${ok ? '发布成功' : detail}`);
  if (ok) {
    await auto.closeCtx(ctx);
    return { status: 'ok', message: '发布成功' };
  }
  return { status: 'manual', message: detail + '，请在浏览器核对并手动完成（窗口已保留）', keepCtx: ctx, page: cur };
}

// 执行一个任务（可能包含多账号）
async function runTask(taskId) {
  const tasks = load('tasks.json', []);
  const task = tasks.find(t => t.id === taskId);
  if (!task || task.status === 'running' || task.status === 'done') return;
  const accounts = load('accounts.json', []);
  const articles = load('articles.json', []);
  const article = articles.find(a => a.id === task.articleId);
  if (!article) { task.status = 'failed'; task.error = '文章不存在'; save('tasks.json', accounts2tasks(tasks)); return; }
  task.status = 'running'; task.startedAt = Date.now(); task.results = task.results || {};
  save('tasks.json', tasks);

  // 媒体任务（视频/音频）：解析媒体文件并做存在性校验
  let mediaPath = null;
  const isMedia = article.type === 'video' || article.type === 'audio';
  if (isMedia) {
    const subdir = article.type === 'video' ? 'videos' : 'audios';
    const fileKey = article.type === 'video' ? 'videoFile' : 'audioFile';
    const pathKey = article.type === 'video' ? 'videoPath' : 'audioPath';
    mediaPath = article[fileKey] ? path.join(DATA, subdir, article[fileKey]) : (article[pathKey] || null);
    if (!mediaPath || !fs.existsSync(mediaPath)) {
      task.status = 'failed'; task.error = (article.type === 'video' ? '视频' : '音频') + '文件不存在：' + (article[fileKey] || article[pathKey] || '（未设置文件）');
      save('tasks.json', tasks); return;
    }
  }

  const keepWindows = [];
  let okCount = 0;
  let total = 0;
  for (const accId of task.accountIds) {
    const acc = accounts.find(a => a.id === accId);
    if (!acc) { task.results[accId] = { status: 'failed', message: '账号不存在' }; continue; }
    // 平台类型支持检查
    const plat = platforms.find(p => p.id === acc.platformId);
    const need = article.type === 'video' ? 'video' : (article.type === 'audio' ? 'audio' : 'article');
    let skipReason = null;
    if (plat) {
      if (need === 'audio' && !plat.audio) skipReason = '音频';
      else if (need !== 'audio' && plat.mode && plat.mode !== 'both' && plat.mode !== need) skipReason = need === 'video' ? '视频' : '图文';
    }
    if (skipReason) {
      task.results[accId] = { status: 'skipped', message: `${plat.name} 不支持${skipReason}发布`, at: Date.now() };
      continue;
    }
    total++;
    let coverPath = null;
    if (article.cover) {
      const p = path.join(DATA, 'materials', article.cover);
      if (fs.existsSync(p)) coverPath = p;
    }
    try {
      const r = isMedia
        ? await publishMediaToAccount(acc, article, mediaPath)
        : await publishToAccount(acc, article, coverPath);
      task.results[accId] = { status: r.status, message: r.message, at: Date.now() };
      if (r.status === 'ok') okCount++;
      if (r.keepCtx) keepWindows.push(r);
    } catch (e) {
      task.results[accId] = { status: 'failed', message: e.message, at: Date.now() };
      log(taskId, accId, 'error', '发布异常: ' + e.message);
    }
  }
  task.status = okCount === total ? 'done' : (okCount > 0 ? 'partial' : 'failed');
  task.finishedAt = Date.now();
  save('tasks.json', tasks);
  log(taskId, '', 'info', `任务结束：成功 ${okCount}/${total}（半自动/手动的窗口保持打开，请手动完成后关闭）`);
  return keepWindows;
}
function accounts2tasks(tasks) { return tasks; }

// 定时调度器：每 10 秒扫一次，到点就跑
function startScheduler() {
  setInterval(() => {
    const tasks = load('tasks.json', []);
    const due = tasks.find(t => t.status === 'scheduled' && t.scheduledAt && t.scheduledAt <= Date.now());
    if (due) runTask(due.id).catch(e => log(due.id, '', 'error', '调度执行失败: ' + e.message));
  }, 10000);
}

function createTask(articleId, accountIds, scheduledAt) {
  const tasks = load('tasks.json', []);
  const task = {
    id: uid('task'), articleId, accountIds,
    status: scheduledAt && scheduledAt > Date.now() ? 'scheduled' : 'pending',
    scheduledAt: scheduledAt || null, createdAt: Date.now(), results: {}
  };
  tasks.push(task);
  save('tasks.json', tasks);
  if (task.status === 'pending') {
    runTask(task.id).catch(e => log(task.id, '', 'error', '执行失败: ' + e.message));
  }
  return task;
}

module.exports = { createTask, runTask, startScheduler, log, getLogs };
