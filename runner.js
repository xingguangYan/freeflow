'use strict';
// 发布任务运行器 + 定时调度。单任务串行执行（一次只开一个浏览器实例，最稳）。
const fs = require('fs');
const path = require('path');
const { load, save, uid } = require('./store');
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
  for (const u of platform.editorUrls) {
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
    for (const u of platform.editorUrls) {
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
  try {
    const artMode = article.mode || 'richtext';
    let contentHtml = artMode === 'markdown' ? auto.mdToHtml(article.content) : article.content;
    contentHtml = auto.inlineLocalImages(contentHtml);
    filledTitle = await auto.fillTitle(cur, platform, article.title);
    filledContent = await auto.fillContent(cur, platform, contentHtml);
    if (!platform.noCoverUpload && coverPath && fs.existsSync(coverPath)) coverOk = await auto.uploadCover(cur, platform, coverPath);
  } catch (e) {
    log('', account.id, 'error', '填充异常: ' + e.message);
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

  await cur.waitForTimeout(1500);
  const btn = platform.previewThenPublish
    ? await auto.clickPreviewThenPublish(cur)
    : await auto.clickPublishRetry(cur, 15000);
  let ok = false, detail = '已点击「' + (btn || '?') + '」';
  if (btn) {
    // 等待发布成功：常见提示或地址栏变化
    let hit = await cur.waitForSelector('text=/发布成功|已发布|发布完成|提交成功/', { timeout: 12000 }).catch(() => null);
    if (!hit) {
      const cbtn = await auto.clickConfirm(cur);
      if (cbtn) {
        detail += `，已确认「${cbtn}」`;
        hit = await cur.waitForSelector('text=/发布成功|已发布|发布完成|提交成功/', { timeout: 15000 }).catch(() => null);
      }
    }
    ok = !!hit;
    if (!ok) ok = /success|published|manage|list|detail|articles|content/.test(cur.url());
    if (!ok) detail += '；未检测到明确成功提示，请到平台后台核对';
  } else {
    detail = '没找到发布按钮，可能需要手动点';
  }
  log('', account.id, ok ? 'info' : 'warn', `${pName}(${accName}) ${ok ? '发布成功' : detail}`);
  await auto.closeCtx(ctx);
  return { status: ok ? 'ok' : 'manual', message: ok ? '发布成功' : detail };
}

// 视频发布流程
async function publishVideoToAccount(account, article, videoPath) {
  const platform = platforms.find(p => p.id === account.platformId);
  if (!platform) throw new Error('未知平台: ' + account.platformId);
  log('', account.id, 'info', `开始发布视频「${article.title}」-> ${platform.name}(${account.name})`);

  const ctx = await auto.launch(account.id);
  ctx.on('dialog', d => d.accept().catch(() => {}));
  const page = ctx.pages()[0] || await ctx.newPage();
  let cur = page;
  let gotoOk = false;
  for (const u of platform.editorUrls) {
    try {
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      gotoOk = true; break;
    } catch (e) { log('', account.id, 'warn', `上传页入口失败 ${u}: ${e.message}`); }
  }
  if (!gotoOk) {
    await auto.closeCtx(ctx);
    return { status: 'failed', message: '上传页打不开（可能登录已过期）' };
  }
  if (await auto.hitLoginWall(ctx, platform, page)) {
    const loggedIn = await waitForLogin(ctx, page, platform, account.id, 5);
    if (!loggedIn) {
      await auto.closeCtx(ctx);
      log('', account.id, 'error', '登录已过期，请重新登录');
      return { status: 'failed', message: '登录已过期，请重新登录' };
    }
    log('', account.id, 'info', '登录成功，继续发布视频');
    let reopened = false;
    for (const u of platform.editorUrls) {
      try {
        await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1500);
        reopened = true; break;
      } catch (e) { log('', account.id, 'warn', `重进上传页失败 ${u}: ${e.message}`); }
    }
    if (!reopened) {
      await auto.closeCtx(ctx);
      return { status: 'failed', message: '登录后上传页仍打不开' };
    }
  }
  let uploadReady = await auto.pickVisibleIn(cur, [platform.uploadInput || 'input[type="file"]']);
  if (!uploadReady && platform.preClickText && platform.preClickText.length) {
    const clicked = await auto.clickIfAny(page, platform.preClickText, 3000);
    if (clicked) {
      log('', account.id, 'info', `点击入口「${clicked}」`);
      const popup = await auto.waitForPopup(ctx, page, 5000);
      if (popup !== page) { cur = popup; log('', account.id, 'info', '已切换到新打开的上传页'); }
      uploadReady = await auto.pickVisibleIn(cur, [platform.uploadInput || 'input[type="file"]']);
    }
  }

  const upOk = await auto.uploadVideo(cur, platform, videoPath);
  if (!upOk) {
    log('', account.id, 'warn', '没找到视频上传入口，已降级手动模式');
    return { status: 'manual', message: '未找到上传入口，请手动上传视频后发布', keepCtx: ctx, page: cur };
  }
  log('', account.id, 'info', '视频已选中，等待上传处理（最多 5 分钟）…');

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
    log('', account.id, 'info', `视频已上传并填好(标题:${t ? '成功' : '失败'} 描述:${d ? '成功' : '失败'})，请手动点「发表」`);
    return { status: 'manual', message: '视频已上传并填好，请手动发表', keepCtx: ctx, page: cur };
  }
  if (!t && !d) {
    const text = article.title + '\n\n' + auto.htmlToText(article.content);
    try { await cur.evaluate(v => navigator.clipboard.writeText(v), text); } catch { /* */ }
    log('', account.id, 'warn', '填写失败，已降级手动模式（内容已复制到剪贴板）');
    return { status: 'manual', message: '自动填写未成功，请手动完成（内容已复制）', keepCtx: ctx, page: cur };
  }
  await cur.waitForTimeout(1500);
  const btn = await auto.clickPublishRetry(cur, 15000);
  let ok = false, detail = '已点击「' + (btn || '?') + '」';
  if (btn) {
    let hit = await cur.waitForSelector('text=/发布成功|已发布|发布完成|投稿成功|提交成功/', { timeout: 12000 }).catch(() => null);
    if (!hit) {
      const cbtn = await auto.clickConfirm(cur);
      if (cbtn) {
        detail += `，已确认「${cbtn}」`;
        hit = await cur.waitForSelector('text=/发布成功|已发布|发布完成|投稿成功|提交成功/', { timeout: 15000 }).catch(() => null);
      }
    }
    ok = !!hit;
    if (!ok) ok = /success|published|manage|list|detail|content/.test(cur.url());
    if (!ok) detail += '；未检测到明确成功提示，请到平台后台核对';
  } else { detail = '没找到发布按钮，可能需要手动点'; }
  log('', account.id, ok ? 'info' : 'warn', `${platform.name}(${account.name}) 视频${ok ? '发布成功' : detail}`);
  await auto.closeCtx(ctx);
  return { status: ok ? 'ok' : 'manual', message: ok ? '发布成功' : detail };
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

  // 视频任务：解析视频文件并做存在性校验
  let videoPath = null;
  if (article.type === 'video') {
    videoPath = article.videoFile ? path.join(__dirname, 'data', 'videos', article.videoFile)
      : (article.videoPath || null);
    if (!videoPath || !fs.existsSync(videoPath)) {
      task.status = 'failed'; task.error = '视频文件不存在：' + (article.videoFile || article.videoPath || '（未设置视频文件）');
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
    const need = article.type === 'video' ? 'video' : 'article';
    if (plat && plat.mode && plat.mode !== 'both' && plat.mode !== need) {
      task.results[accId] = { status: 'skipped', message: `${plat.name} 不支持${need === 'video' ? '视频' : '图文'}发布`, at: Date.now() };
      continue;
    }
    total++;
    let coverPath = null;
    if (article.cover) {
      const p = path.join(__dirname, 'data', 'materials', article.cover);
      if (fs.existsSync(p)) coverPath = p;
    }
    try {
      const r = article.type === 'video'
        ? await publishVideoToAccount(acc, article, videoPath)
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
