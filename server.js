'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const { load, save, uid, DATA, MATERIALS } = require('./store');
const platforms = require('./platforms');
const auto = require('./automation');
const { createTask, startScheduler, log } = require('./runner');

const PORT = process.env.FREEFLOW_PORT || 8917;
const app = express();
// 允许手机版（同局域网内的 APK）跨域调用接口；桌面端同源请求不受影响
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '600mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/materials', express.static(MATERIALS));

const sessions = new Map();

function accounts() { return load('accounts.json', []); }
function saveAccounts(a) { save('accounts.json', a); }
function touchAccount(id, patch) {
  const a = accounts();
  const i = a.findIndex(x => x.id === id);
  if (i !== -1) { a[i] = { ...a[i], ...patch }; saveAccounts(a); return a[i]; }
  return null;
}

// ---------- 平台 ----------
app.get('/api/platforms', (req, res) => {
  res.json(platforms.map(p => ({
    id: p.id, name: p.name, group: p.group, color: p.color,
    experimental: p.experimental, semi: p.semi, note: p.note, contentType: p.contentType,
    region: p.region || 'cn', mode: p.mode || 'article'
  })));
});

// ---------- 账号 ----------
app.get('/api/accounts', (req, res) => res.json(accounts()));
app.post('/api/accounts', (req, res) => {
  const { platformId, name } = req.body;
  if (!platforms.find(p => p.id === platformId)) return res.status(400).json({ error: '未知平台' });
  const a = accounts();
  const acc = { id: uid('acc'), platformId, name: name || ('账号' + (a.length + 1)), status: 'pending', createdAt: Date.now() };
  a.push(acc); saveAccounts(a);
  log('', acc.id, 'info', `新增账号 ${acc.name}`);
  res.json(acc);
});
app.delete('/api/accounts/:id', (req, res) => {
  const acc = accounts().find(a => a.id === req.params.id);
  if (acc) {
    fs.rmSync(auto.profileDir(acc.id), { recursive: true, force: true });
    saveAccounts(accounts().filter(a => a.id !== req.params.id));
    log('', req.params.id, 'info', '账号已删除（登录态清除）');
  }
  res.json({ ok: true });
});

// ---------- 登录会话 ----------
app.post('/api/accounts/:id/login', async (req, res) => {
  const acc = accounts().find(a => a.id === req.params.id);
  if (!acc) return res.status(404).json({ error: '账号不存在' });
  const p = platforms.find(x => x.id === acc.platformId);
  try {
    const ctx = await auto.launch(acc.id);
    ctx.on('dialog', d => d.accept().catch(() => {}));
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(p.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => log('', acc.id, 'warn', '打开登录页较慢: ' + e.message));
    const sid = uid('sess');
    const session = { sid, accountId: acc.id, platformId: acc.platformId, ctx, page, detected: false, closed: false, manual: false };
    sessions.set(sid, session);
    touchAccount(acc.id, { status: 'waiting', loginSession: sid });
    let timer = null;
    // 用户手动关掉浏览器窗口：结束会话但不清登录态（cookie 已经落盘，可点「检测登录」确认）
    try {
      ctx.browser() && ctx.browser().on('disconnected', () => {
        if (session.detected || session.closed) return;
        session.closed = true;
        if (timer) clearInterval(timer);
        touchAccount(acc.id, { status: 'pending', loginSession: null });
        log('', acc.id, 'warn', '登录窗口被关闭，可点「检测登录」确认登录态，或重新登录');
      });
    } catch { /* */ }
    // 后台轮询登录态，最多等 8 分钟
    const started = Date.now();
    timer = setInterval(async () => {
      if (session.closed || session.detected) { clearInterval(timer); return; }
      try {
        if (await auto.checkLoggedIn(ctx, p, page)) {
          session.detected = true; clearInterval(timer);
          await sleep(2000); // 多等几秒让 cookie 落盘
          await auto.closeCtx(ctx);
          session.closed = true;
          touchAccount(acc.id, { status: 'loggedIn', lastLoginAt: Date.now(), loginSession: null });
          log('', acc.id, 'info', `${p.name} 登录成功（自动检测）`);
        } else if (Date.now() - started > 8 * 60 * 1000) {
          clearInterval(timer);
          if (!session.manual) {
            // 超时前做一次 cookie 兜底：很多时候其实已经登上了，只是网址没匹配上
            if (await auto.checkLoggedIn(ctx, p, page)) {
              session.detected = true;
              await auto.closeCtx(ctx);
              session.closed = true;
              touchAccount(acc.id, { status: 'loggedIn', lastLoginAt: Date.now(), loginSession: null });
              log('', acc.id, 'info', `${p.name} 登录成功（cookie 检测）`);
            } else {
              await auto.closeCtx(ctx);
              session.closed = true;
              touchAccount(acc.id, { status: 'expired', loginSession: null });
              log('', acc.id, 'warn', '登录等待超时（8分钟），可再次发起登录');
            }
          }
        }
      } catch { /* 轮询不打断流程 */ }
    }, 2000);
    res.json({ sid, loginUrl: p.loginUrl });
  } catch (e) {
    log('', acc.id, 'error', '启动登录窗口失败: ' + e.message);
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/login-sessions/:sid', (req, res) => {
  const s = sessions.get(req.params.sid);
  if (!s) return res.status(404).json({ error: '会话不存在' });
  res.json({ detected: s.detected, closed: s.closed, platformId: s.platformId });
});
app.post('/api/login-sessions/:sid/done', async (req, res) => {
  const s = sessions.get(req.params.sid);
  if (!s) return res.status(404).json({ error: '会话不存在' });
  s.manual = true;
  await auto.closeCtx(s.ctx);
  s.closed = true;
  touchAccount(s.accountId, { status: 'loggedIn', lastLoginAt: Date.now(), loginSession: null });
  log('', s.accountId, 'info', '登录完成（手动确认）');
  res.json({ ok: true });
});
// 重新检测某个账号的登录态：打开一次浏览器读 cookie，不要求重新扫码
app.post('/api/accounts/:id/check', async (req, res) => {
  const acc = accounts().find(a => a.id === req.params.id);
  if (!acc) return res.status(404).json({ error: '账号不存在' });
  const p = platforms.find(x => x.id === acc.platformId);
  try {
    const ctx = await auto.launch(acc.id);
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(p.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500).catch(() => {});
    const ok = await auto.checkLoggedIn(ctx, p, page);
    await auto.closeCtx(ctx);
    touchAccount(acc.id, ok
      ? { status: 'loggedIn', lastLoginAt: Date.now(), loginSession: null }
      : { status: 'expired', loginSession: null });
    log('', acc.id, ok ? 'info' : 'warn', `${p.name} 登录态检测：${ok ? '已登录' : '未登录'}`);
    res.json({ loggedIn: ok });
  } catch (e) {
    log('', acc.id, 'error', '登录态检测失败: ' + e.message);
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/accounts/:id/recheck', async (req, res) => {
  const acc = accounts().find(a => a.id === req.params.id);
  if (!acc) return res.status(404).json({ error: '账号不存在' });
  touchAccount(acc.id, { status: 'loggedIn', lastLoginAt: Date.now() });
  res.json({ ok: true });
});
// 一键检测登录态：逐个打开浏览器读 cookie，不要求重新扫码。body.accountIds 可选，默认全部账号
app.post('/api/accounts/check-all', async (req, res) => {
  const ids = Array.isArray(req.body && req.body.accountIds) && req.body.accountIds.length
    ? req.body.accountIds
    : accounts().map(a => a.id);
  const results = {};
  for (const id of ids) {
    const acc = accounts().find(a => a.id === id);
    if (!acc) { results[id] = { loggedIn: false, error: '账号不存在' }; continue; }
    const p = platforms.find(x => x.id === acc.platformId);
    if (!p) { results[id] = { loggedIn: false, error: '平台不存在' }; continue; }
    try {
      const ctx = await auto.launch(acc.id);
      const page = ctx.pages()[0] || await ctx.newPage();
      await page.goto(p.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1500).catch(() => {});
      const ok = await auto.checkLoggedIn(ctx, p, page);
      await auto.closeCtx(ctx);
      touchAccount(acc.id, ok ? { status: 'loggedIn', lastLoginAt: Date.now(), loginSession: null } : { status: 'expired', loginSession: null });
      log('', acc.id, ok ? 'info' : 'warn', `${p.name} 登录态检测：${ok ? '已登录' : '未登录'}`);
      results[id] = { loggedIn: ok };
    } catch (e) {
      log('', acc.id, 'error', '登录态检测失败: ' + e.message);
      results[id] = { loggedIn: false, error: e.message };
    }
  }
  res.json({ results });
});

// ---------- 文章 ----------
app.get('/api/articles', (req, res) => res.json(load('articles.json', [])));
app.post('/api/articles', (req, res) => {
  const { id, title, content, cover, summary, type, tags, videoFile, videoPath, audioFile, audioPath, mode } = req.body;
  const a = load('articles.json', []);
  if (id) {
    const i = a.findIndex(x => x.id === id);
    if (i !== -1) {
      a[i] = { ...a[i], title, content, cover, summary, type: type || a[i].type, tags, videoFile, videoPath, audioFile, audioPath, mode: mode || a[i].mode || 'richtext', updatedAt: Date.now() };
      save('articles.json', a); return res.json(a[i]);
    }
  }
  const art = { id: uid('art'), type: type || 'article', mode: mode || 'richtext', title: title || '未命名', content: content || '', cover: cover || null, summary: summary || '', tags: tags || '', videoFile: videoFile || null, videoPath: videoPath || null, audioFile: audioFile || null, audioPath: audioPath || null, createdAt: Date.now(), updatedAt: Date.now() };
  a.push(art); save('articles.json', a);
  res.json(art);
});
app.delete('/api/articles/:id', (req, res) => {
  save('articles.json', load('articles.json', []).filter(a => a.id !== req.params.id));
  res.json({ ok: true });
});
app.post('/api/articles/:id/duplicate', (req, res) => {
  const a = load('articles.json', []);
  const src = a.find(x => x.id === req.params.id);
  if (!src) return res.status(404).json({ error: '文章不存在' });
  const copy = { ...src, id: uid('art'), title: src.title + '（副本）', createdAt: Date.now(), updatedAt: Date.now() };
  a.push(copy); save('articles.json', a);
  res.json(copy);
});

// ---------- 素材库 ----------
app.get('/api/materials', (req, res) => res.json(load('materials.json', [])));
app.post('/api/materials', (req, res) => {
  const { name, base64 } = req.body;
  if (!base64) return res.status(400).json({ error: '缺少 base64' });
  const m = base64.match(/^data:image\/(\w+);base64,(.*)$/s);
  if (!m) return res.status(400).json({ error: '仅支持图片 data URI' });
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const buf = Buffer.from(m[2], 'base64');
  const fileName = uid('img') + '.' + ext;
  fs.writeFileSync(path.join(MATERIALS, fileName), buf);
  const list = load('materials.json', []);
  const item = { id: fileName, name: name || fileName, url: '/materials/' + fileName, size: buf.length, ts: Date.now() };
  list.push(item); save('materials.json', list);
  res.json(item);
});
app.delete('/api/materials/:id', (req, res) => {
 const fileName = req.params.id;
  fs.rmSync(path.join(MATERIALS, fileName), { force: true });
  save('materials.json', load('materials.json', []).filter(m => m.id !== fileName));
  res.json({ ok: true });
});
// 直接把网页上的图片 URL 下载进素材库（解决跨域图片粘贴）
app.post('/api/materials/from-url', async (req, res) => {
  const url = req.body && req.body.url;
  if (!/^https?:\/\//i.test(url || '')) return res.status(400).json({ error: '仅支持 http/https 图片地址' });
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/156 Safari/537.36' } });
    if (!r.ok) return res.status(400).json({ error: '图片下载失败 HTTP ' + r.status });
    const ct = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ct.startsWith('image/')) return res.status(400).json({ error: '该地址不是图片' });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 25 * 1024 * 1024) return res.status(400).json({ error: '图片超过 25MB' });
    const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
    const ext = extMap[ct] || 'png';
    const fileName = uid('img') + '.' + ext;
    fs.writeFileSync(path.join(MATERIALS, fileName), buf);
    const list = load('materials.json', []);
    const item = { id: fileName, name: req.body.name || ('网页图片.' + ext), url: '/materials/' + fileName, size: buf.length, ts: Date.now(), source: url };
    list.push(item); save('materials.json', list);
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: '下载失败: ' + e.message });
  }
});

// ---------- 视频文件 ----------
const VIDEOS = path.join(DATA, 'videos');
fs.mkdirSync(VIDEOS, { recursive: true });
app.get('/api/videos', (req, res) => res.json(load('videos.json', [])));
app.post('/api/videos', (req, res) => {
  const { name, base64 } = req.body;
  if (!base64) return res.status(400).json({ error: '缺少 base64' });
  const m = /^data:video\/(\w+);base64,(.*)$/s.exec(base64);
  if (!m) return res.status(400).json({ error: '仅支持视频 data URI' });
  const ext = m[1] === 'quicktime' ? 'mov' : m[1];
  const buf = Buffer.from(m[2], 'base64');
  const fileName = uid('vid') + '.' + ext;
  fs.writeFileSync(path.join(VIDEOS, fileName), buf);
  const list = load('videos.json', []);
  const item = { file: fileName, name: name || fileName, size: buf.length, ts: Date.now() };
  list.push(item); save('videos.json', list);
  log('', '', 'info', `视频已入库 ${item.name} ${(buf.length / 1048576).toFixed(1)}MB`);
  res.json(item);
});
app.post('/api/videos/path', (req, res) => {
  const p = req.body && req.body.path;
  if (!p || !fs.existsSync(p)) return res.status(400).json({ error: '文件不存在，请检查路径' });
  const ext = path.extname(p).slice(1).toLowerCase() || 'mp4';
  const fileName = uid('vid') + '.' + ext;
  fs.copyFileSync(p, path.join(VIDEOS, fileName));
  const list = load('videos.json', []);
  const item = { file: fileName, name: path.basename(p), size: fs.statSync(p).size, ts: Date.now() };
  list.push(item); save('videos.json', list);
  log('', '', 'info', `视频已登记 ${item.name} ${(item.size / 1048576).toFixed(1)}MB`);
  res.json(item);
});

// ---------- 音频（小红书等平台的音频发布） ----------
const AUDIOS = path.join(DATA, 'audios');
fs.mkdirSync(AUDIOS, { recursive: true });
app.get('/api/audios', (req, res) => res.json(load('audios.json', [])));
app.post('/api/audios', (req, res) => {
  const { name, base64 } = req.body;
  if (!base64) return res.status(400).json({ error: '缺少 base64' });
  const m = /^data:audio\/(\w+);base64,(.*)$/s.exec(base64);
  if (!m) return res.status(400).json({ error: '仅支持音频 data URI' });
  const ext = ({ mp3: 'mp3', mpeg: 'mp3', wav: 'wav', wave: 'wav', xwav: 'wav', ogg: 'ogg', m4a: 'm4a', mp4: 'm4a', aac: 'aac', flac: 'flac', xflac: 'flac' })[m[1]] || m[1];
  const buf = Buffer.from(m[2], 'base64');
  const fileName = uid('aud') + '.' + ext;
  fs.writeFileSync(path.join(AUDIOS, fileName), buf);
  const list = load('audios.json', []);
  const item = { file: fileName, name: name || fileName, size: buf.length, ts: Date.now() };
  list.push(item); save('audios.json', list);
  log('', '', 'info', `音频已入库 ${item.name} ${(buf.length / 1048576).toFixed(1)}MB`);
  res.json(item);
});
app.post('/api/audios/path', (req, res) => {
  const p = req.body && req.body.path;
  if (!p || !fs.existsSync(p)) return res.status(400).json({ error: '文件不存在，请检查路径' });
  const ext = path.extname(p).slice(1).toLowerCase() || 'mp3';
  const fileName = uid('aud') + '.' + ext;
  fs.copyFileSync(p, path.join(AUDIOS, fileName));
  const list = load('audios.json', []);
  const item = { file: fileName, name: path.basename(p), size: fs.statSync(p).size, ts: Date.now() };
  list.push(item); save('audios.json', list);
  log('', '', 'info', `音频已登记 ${item.name} ${(item.size / 1048576).toFixed(1)}MB`);
  res.json(item);
});

// ---------- 违禁词 ----------
app.post('/api/sensitive/scan', (req, res) => {
  const { title, content } = req.body;
  const { scan } = require('./sensitive');
  const plain = (title || '') + ' ' + auto.htmlToText(content || '');
  res.json({ hits: scan(plain), length: plain.length });
});

// ---------- 任务 ----------
app.get('/api/tasks', (req, res) => res.json(load('tasks.json', [])));
app.post('/api/tasks', (req, res) => {
  const { articleId, accountIds, scheduledAt } = req.body;
  if (!articleId || !Array.isArray(accountIds) || !accountIds.length) return res.status(400).json({ error: '参数不完整' });
  const task = createTask(articleId, accountIds, scheduledAt ? new Date(scheduledAt).getTime() : null);
  res.json(task);
});
app.delete('/api/tasks/:id', (req, res) => {
  save('tasks.json', load('tasks.json', []).filter(t => t.id !== req.params.id));
  res.json({ ok: true });
});
app.delete('/api/tasks', (req, res) => {
  const keep = load('tasks.json', []).filter(t => t.status === 'running' || t.status === 'pending');
  save('tasks.json', keep);
  res.json({ ok: true, kept: keep.length });
});
app.post('/api/tasks/:id/retry', (req, res) => {
  const t = load('tasks.json', []).find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: '任务不存在' });
  const task = createTask(t.articleId, t.accountIds || [], null);
  res.json(task);
});

// ---------- 日志 ----------
app.get('/api/logs', (req, res) => res.json(load('logs.json', [])));
app.delete('/api/logs', (req, res) => { save('logs.json', []); res.json({ ok: true }); });

// ---------- 平台数据 ----------
const stats = require('./stats');
// ---------- 浏览器内核 ----------
// macOS 没装系统 Chrome 时，一键下载 Playwright chromium 内核（约 150MB，只需一次）。
app.post('/api/browser/install-chromium', async (req, res) => {
  let done = false;
  const fail = (msg) => { if (!done) { done = true; log('', '', 'error', '浏览器内核下载失败: ' + msg); res.status(500).json({ error: msg }); } };
  try {
    const { spawn } = require('child_process');
    const cli = path.join(__dirname, 'node_modules', 'playwright', 'cli.js');
    if (!fs.existsSync(cli)) return fail('找不到 playwright CLI');
    log('', '', 'info', '开始下载浏览器内核（约 150MB），请稍候…');
    // Electron 打包后 process.execPath 是程序本体；加 ELECTRON_RUN_AS_NODE=1 让它当普通 Node 跑 CLI
    const child = spawn(process.execPath, [cli, 'install', 'chromium'], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', d => log('', '', 'info', '内核下载: ' + String(d).trim()));
    child.on('error', fail);
    child.on('exit', code => {
      if (done) return;
      done = true;
      if (code === 0) { log('', '', 'info', '浏览器内核下载完成'); res.json({ ok: true }); }
      else res.status(500).json({ error: '下载进程退出 code=' + code });
    });
  } catch (e) {
    fail(e.message);
  }
});
app.get('/api/stats', (req, res) => res.json(stats.list()));

// ---------- 统一消息中心 ----------
const messages = require('./messages');
app.get('/api/messages', (req, res) => res.json(messages.listAll()));
app.get('/api/messages/drafts', (req, res) => res.json(messages.drafts()));
app.post('/api/messages/collect', async (req, res) => {
  try {
    const ids = (req.body && req.body.accountIds) || [];
    const accs = load('accounts.json', []).filter(a => !ids.length || ids.includes(a.id));
    const results = {};
    for (const acc of accs) {
      try { results[acc.id] = messages.store(await messages.collect(acc)); }
      catch (e) { results[acc.id] = { platformId: acc.platformId, error: e.message }; }
    }
    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/messages/reply', async (req, res) => {
  const { accountId, from, text, draftOnly } = req.body || {};
  if (!accountId || !from) return res.status(400).json({ error: '缺少账号或回复对象' });
  const acc = load('accounts.json', []).find(a => a.id === accountId);
  if (!acc) return res.status(404).json({ error: '账号不存在' });
  if (draftOnly) { messages.saveDraft(accountId, from, text); return res.json({ ok: true, draft: true }); }
  log('', acc.id, 'info', '私信回复: -> ' + from);
  try {
    const r = await messages.reply(acc, from, text);
    messages.dropDraft(accountId, from);
    res.json(r);
  } catch (e) {
    messages.saveDraft(accountId, from, text); // 失败留草稿，可重试
    log('', acc.id, 'error', '私信回复失败: ' + e.message);
    res.status(500).json({ error: e.message, draft: true });
  }
});
app.post('/api/stats/collect', async (req, res) => {
  const acc = accounts().find(a => a.id === (req.body && req.body.accountId));
  if (!acc) return res.status(404).json({ error: '账号不存在' });
  try {
    const snap = await stats.collect(acc);
    if (snap.logged) stats.append(snap);
    log('', acc.id, snap.logged ? 'info' : 'warn', `${acc.name} 数据采集：${snap.logged ? '成功' : '未登录'} ${JSON.stringify(snap.metrics)}`);
    res.json(snap);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- 我的大模型（导入自己的 LLM + 本地素材 + 生成草稿） ----------
const llm = require('./llm');
// 回传给前端时 Key 永远打码，日志里也不许出现完整 Key
function llmSafe(m) { return llm.modelForClient(m); }
app.get('/api/llm', (req, res) => {
  const c = llm.cfg();
  res.json({ models: c.models.map(llmSafe), materials: c.materials, txtExt: llm.TXT_EXT });
});
app.post('/api/llm/models', (req, res) => {
  const { name, provider, endpoint, apiKey, model, enabled, temperature, maxTokens, systemPrompt } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: '请填写服务地址' });
  const c = llm.cfg();
  const m = { id: uid('llm'), name: name || '我的模型', provider: provider || '', endpoint, apiKey: apiKey || '', model: model || '', enabled: enabled !== false, temperature: typeof temperature === 'number' ? temperature : 0.7, maxTokens: maxTokens > 0 ? Math.min(maxTokens, 32000) : 3000, systemPrompt: String(systemPrompt || ''), createdAt: Date.now() };
  c.models.unshift(m); llm.saveCfg(c);
  res.json(llmSafe(m));
});
app.put('/api/llm/models/:id', (req, res) => {
  const c = llm.cfg();
  const m = c.models.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: '模型不存在' });
  const { name, provider, endpoint, apiKey, model, enabled, temperature, maxTokens, systemPrompt } = req.body || {};
  if (name !== undefined) m.name = name;
  if (provider !== undefined) m.provider = provider;
  if (endpoint !== undefined) m.endpoint = endpoint;
  if (apiKey !== undefined && apiKey !== '') m.apiKey = apiKey; // 空串 = 保持原 Key（编辑时不明文回传）
  if (model !== undefined) m.model = model;
  if (enabled !== undefined) m.enabled = enabled;
  if (temperature !== undefined && !isNaN(temperature)) m.temperature = Math.max(0, Math.min(2, temperature));
  if (maxTokens !== undefined && maxTokens > 0) m.maxTokens = Math.min(maxTokens, 32000);
  if (systemPrompt !== undefined) m.systemPrompt = String(systemPrompt).slice(0, 4000);
  llm.saveCfg(c);
  res.json(llmSafe(m));
});
app.delete('/api/llm/models/:id', (req, res) => {
  const c = llm.cfg();
  c.models = c.models.filter(x => x.id !== req.params.id);
  llm.saveCfg(c);
  res.json({ ok: true });
});
// 连通性测试：用「当前表单内容」（可含未保存的 Key）；给 modelId 且未填 Key 时沿用已存配置
app.post('/api/llm/models/test', async (req, res) => {
  try {
    let entry = req.body || {};
    if (entry.modelId && !entry.apiKey) {
      const c = llm.cfg();
      const saved = c.models.find(x => x.id === entry.modelId);
      if (saved) entry = { ...saved, ...entry };
    }
    const r = await llm.testModel(entry);
    log('', '', r.ok ? 'info' : 'warn', '大模型连通测试：' + (r.ok ? `成功（${r.latencyMs}ms，回复 ${r.reply}）` : '失败 ' + r.error));
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/llm/providers', (req, res) => { res.json({ providers: llm.getProviders() }); });
// 还没保存配置时，用当前填的地址/Key 直接拉模型列表
app.post('/api/llm/models/list-anonymous', async (req, res) => {
  try { res.json(await llm.listModels(req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/llm/models/:id/list-models', async (req, res) => {
  const c = llm.cfg();
  const m = c.models.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: '模型不存在' });
  try { res.json(await llm.listModels(m)); } catch (e) { res.status(500).json({ error: e.message }); }
});
// 本地素材：只接受文本文件，内容由前端读取后传入（不主动扫描磁盘）
app.post('/api/llm/materials', (req, res) => {
  const r = llm.addMaterial(req.body && req.body.name, req.body && req.body.text);
  if (r.error) return res.status(400).json({ error: r.error });
  res.json(r.material);
});
app.delete('/api/llm/materials/:id', (req, res) => { llm.removeMaterial(req.params.id); res.json({ ok: true }); });
app.get('/api/llm/materials/:id', (req, res) => {
  const m = llm.readMaterial(req.params.id);
  if (!m) return res.status(404).json({ error: '素材不存在' });
  res.json(m);
});
// 生成文章（会话隔离：按选中的模型 + 素材发请求）
app.post('/api/llm/generate', async (req, res) => {
  const { modelId, prompt, materialIds } = req.body || {};
  if (!modelId) return res.status(400).json({ error: '请选择模型' });
  if (!String(prompt || '').trim()) return res.status(400).json({ error: '请填写写作主题/要求' });
  try {
    const r = await llm.generate(modelId, prompt, materialIds);
    res.json(r);
  } catch (e) {
    log('', '', 'error', '大模型生成失败: ' + e.message);
    res.status(500).json({ error: e.message });
  }
});
// 生成的结果保存进草稿箱（articles 里标 status=draft）
app.post('/api/llm/to-draft', (req, res) => {
  const { title, content } = req.body || {};
  if (!String(title || '').trim() && !String(content || '').trim()) return res.status(400).json({ error: '内容为空' });
  const a = load('articles.json', []);
  const art = { id: uid('art'), title: String(title || 'AI 生成草稿').slice(0, 100), content: String(content || ''), mode: 'richtext', type: 'article', status: 'draft', cover: '', summary: '', tags: '', createdAt: Date.now() };
  a.unshift(art); save('articles.json', a);
  res.json(art);
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

startScheduler();
app.listen(PORT, () => {
  console.log('自由发已启动: http://127.0.0.1:' + PORT);
  const { exec } = require('child_process');
  if (process.env.FREEFLOW_ELECTRON === '1') return;
  // 纯网页模式（非 Electron）启动后自动用系统默认浏览器打开
  const openCmd = process.platform === 'win32' ? `start "" http://127.0.0.1:${PORT}` : `open http://127.0.0.1:${PORT}`;
  setTimeout(() => exec(openCmd), 500);
});

process.on('SIGINT', () => { for (const s of sessions.values()) s.ctx.close().catch(() => {}); process.exit(0); });
