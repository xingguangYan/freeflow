'use strict';
// 统一消息中心：优先解析平台页面自身发出的 JSON 接口响应（真实接口数据），DOM 抓取兜底。
// 原则：能力边界明确——平台不支持自动回复时如实提示，不伪造成功；回复失败保留草稿可重试。
const platforms = require('./platforms');
const auto = require('./automation');
const { load, save, uid } = require('./store');

// 各平台消息页地址与回复控件（无法可靠定位回复框的平台只做查看）
const MESSAGE_PAGES = {
  zhihu: { url: 'https://www.zhihu.com/messages', name: '知乎私信', replyable: true },
  csdn: { url: 'https://i.csdn.net/#/msg/index', name: 'CSDN 消息', replyable: true },
  bilibili: { url: 'https://message.bilibili.com/', name: 'B站消息', replyable: true },
  bilibili_video: { url: 'https://message.bilibili.com/', name: 'B站消息', replyable: true },
  weibo: { url: 'https://weibo.com/message', name: '微博私信', replyable: true },
  xiaohongshu: { url: 'https://creator.xiaohongshu.com/creator/interaction', name: '小红书互动消息', replyable: true },
  juejin: { url: 'https://juejin.cn/notification', name: '掘金通知', replyable: false },
  toutiao: { url: 'https://mp.toutiao.com/profile_v4/index', name: '头条号后台', replyable: false },
  jianshu: { url: 'https://www.jianshu.com/', name: '简书', replyable: false },
  cnblogs: { url: 'https://msg.cnblogs.com/', name: '园子消息', replyable: true },
  segmentfault: { url: 'https://segmentfault.com/note', name: 'SF 通知', replyable: false },
  douban: { url: 'https://www.douban.com/doumail/', name: '豆瓣豆邮', replyable: true }
};

const TEXT_KEYS = ['content', 'text', 'message', 'msg', 'body', 'summary', 'desc', 'description', 'abstract', 'title'];
const FROM_KEYS = ['from', 'sender', 'senderName', 'nickname', 'nick_name', 'showName', 'userName', 'username', 'uname', 'author', 'name'];
const TIME_KEYS = ['time', 'timestamp', 'ctime', 'createdAt', 'created_at', 'sendTime', 'send_time', 'msgTime', 'lastTime', 'date'];
const NESTED_SENDER = ['user', 'from', 'sender', 'senderInfo', 'author', 'account', 'lastSender', 'fromUser', 'account_info', 'talker_info', 'sender_info'];

function firstString(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}
function pickFrom(obj) {
  const direct = firstString(obj, FROM_KEYS);
  if (direct) return direct;
  for (const k of NESTED_SENDER) {
    const sub = obj[k];
    if (sub && typeof sub === 'object') {
      const s = firstString(sub, FROM_KEYS);
      if (s) return s;
    }
  }
  return '';
}
function pickTime(obj) {
  if (!obj || typeof obj !== 'object') return '';
  for (const k of TIME_KEYS) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '' && (typeof v === 'string' || typeof v === 'number')) return v;
  }
  for (const k of NESTED_SENDER.concat(['lastMsg', 'last_message', 'lastMessage', 'last_msg'])) {
    const sub = obj[k];
    if (sub && typeof sub === 'object') { const t = pickTime(sub); if (t !== '') return t; }
  }
  return '';
}
function fmtTime(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number' || /^\d{10,13}$/.test(String(v))) {
    let ms = Number(v);
    if (ms < 1e12) ms *= 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      const p = n => String(n).padStart(2, '0');
      return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
  }
  return String(v).slice(0, 24);
}
function isUnread(obj) {
  for (const k of ['unread', 'isUnread', 'hasUnread']) {
    if (obj[k] === true || obj[k] === 1) return true;
  }
  for (const k of ['unread_count', 'unreadCount', 'unreadNum']) {
    if (typeof obj[k] === 'number' && obj[k] > 0) return true;
  }
  for (const k of ['isRead', 'readStatus']) {
    if (obj[k] === false || obj[k] === 0) return true;
  }
  return false;
}
function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
// 会话列表的正文常见于 lastMsg / last_message / message 等嵌套对象，单独抽取一层
const TEXT_NESTED = ['lastMsg', 'last_message', 'lastMessage', 'last_msg', 'last', 'msg', 'message', 'contentObj'];
function pickText(obj) {
  const direct = firstString(obj, TEXT_KEYS);
  if (direct) return direct;
  for (const k of TEXT_NESTED) {
    const sub = obj[k];
    if (sub && typeof sub === 'object') {
      const s = firstString(sub, TEXT_KEYS) || firstString(sub, ['content', 'text', 'summary', 'title']);
      if (s) return s;
    }
  }
  return '';
}

// 递归收集 JSON 里所有对象数组（最多 60 个数组，防止超大响应卡死）
function collectArrays(node, depth, out) {
  if (depth > 7 || out.length >= 60 || node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    out.push(node);
    for (const it of node.slice(0, 5)) collectArrays(it, depth + 1, out);
    return;
  }
  for (const v of Object.values(node)) collectArrays(v, depth + 1, out);
}

// 从抓到的接口响应里解析消息条目（纯函数，可单元测试）
function parseMessageJson(entries, platformId) {
  const out = [];
  const seen = new Set();
  for (const entry of entries || []) {
    const arrays = [];
    collectArrays(entry && entry.json, 0, arrays);
    for (const arr of arrays) {
      for (const it of arr) {
        if (!it || typeof it !== 'object') continue;
        const snippet = stripHtml(pickText(it));
        if (!snippet || snippet.length > 300) continue;
        const from = pickFrom(it) || '未知来源';
        const time = fmtTime(pickTime(it));
        // 至少要像「消息」：有文本 + （时间或短文本）；文章列表大多带超长标题或没有时间
        if (!time && snippet.length > 140) continue;
        const key = from + '|' + snippet;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ from, snippet: snippet.slice(0, 160), time, type: classify(from, snippet, platformId), unread: isUnread(it) });
        if (out.length >= 60) return out;
      }
    }
  }
  return out;
}

// 抓取页面自身发出的 JSON 响应（真实接口数据；无登录态时平台多返回 401/未登录）
async function captureJson(page) {
  const entries = [];
  const onResponse = async (res) => {
    try {
      if (entries.length >= 40) return;
      const rt = res.request().resourceType();
      if (rt !== 'xhr' && rt !== 'fetch') return;
      const ct = String((res.headers() || {})['content-type'] || '').toLowerCase();
      if (!ct.includes('json')) return;
      const body = await res.text();
      if (!body || body.length > 1500000) return;
      entries.push({ url: res.url(), json: JSON.parse(body) });
    } catch { /* Aborting/非 JSON 响应忽略 */ }
  };
  page.on('response', onResponse);
  return { entries, stop: () => page.off('response', onResponse).catch?.(() => {}) };
}

// 短时间格式：12:30 / 昨天 / 11-08 / 2026-11-08
const TIME_RE = /(?:^\[?\]?$)|(\d{1,2}:\d{2}(?::\d{2})?$)|(昨天|前天$)|(\d{1,2}-\d{1,2}$)|(\d{4}-\d{1,2}-\d{1,2}$)/;

function pageSupports(platformId) { return !!MESSAGE_PAGES[platformId]; }
function supportedPlatforms() { return Object.keys(MESSAGE_PAGES); }

// DOM 兜底：列表项里同时出现「昵称、摘要、时间样文字」就算一条
async function scrapeItems(page) {
  return page.evaluate(() => {
    const TIME = /^(\d{1,2}:\d{2}(:\d{2})?|昨天|前天|\d{1,2}-\d{1,2}|\d{4}-\d{1,2}-\d{1,2})$/;
    const seen = new Set();
    const out = [];
    const cands = document.querySelectorAll(
      'li, .list-item, [class*="message"], [class*="chat-item"], [class*="conversation"], [class*="session"], [class*="notify"], [class*="msg"]'
    );
    for (const el of cands) {
      const r = el.getBoundingClientRect();
      if (r.width < 80 || r.height < 20) continue;
      const text = (el.innerText || '').trim();
      if (!text || text.length > 300) continue;
      const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
      if (lines.length < 2 || lines.length > 8) continue;
      const timeLine = lines.find(l => TIME.test(l));
      if (!timeLine) continue;
      const from = lines[0];
      const rest = lines.filter(l => l !== timeLine && l !== from);
      const snippet = rest.join(' ').slice(0, 120);
      if (!from || !snippet) continue;
      const unread = /未读|条新消息|\(\d+\)|badge/i.test(el.className) || !!el.querySelector('[class*="unread"],[class*="dot"],[class*="badge"]');
      const key = from + '|' + snippet;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ from, snippet, time: timeLine, unread });
    }
    return out.slice(0, 60);
  }).catch(() => []);
}

// 主文档 + 所有 iframe 的 DOM 抓取合并
async function scrapeItemsWithFrames(page) {
  const all = [];
  const seen = new Set();
  const add = (arr) => { for (const it of arr) { const k = it.from + '|' + it.snippet; if (!seen.has(k)) { seen.add(k); all.push(it); } } };
  add(await scrapeItems(page));
  for (const f of page.frames()) {
    if (f === page.mainFrame()) continue;
    try { add(await scrapeItems(f)); } catch { /* 跨域 frame 忽略 */ }
  }
  return all.slice(0, 60);
}

function classify(from, snippet, platformId) {
  const s = snippet + from;
  if (/评[论论]|comment|回复了我|comment(ed)?\b/i.test(s)) return 'comment';
  if (/关[注注]|点赞|赞同| like|like了|收藏/i.test(s)) return 'notice';
  return 'dm';
}

async function collect(account) {
  const p = platforms.find(x => x.id === account.platformId);
  if (!p) throw new Error('未知平台');
  const mp = MESSAGE_PAGES[account.platformId];
  if (!mp) return { accountId: account.id, platformId: account.platformId, platformName: p.name, supported: false, items: [], note: '该平台暂未接入消息页（可前往平台原站查看）' };
  const ctx = await auto.launch(account.id);
  let cap = null;
  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    cap = await captureJson(page); // 必须在 goto 之前挂监听，才能抓到页面自身请求
    await page.goto(mp.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(4000);
    cap.stop();
    let apiItems = parseMessageJson(cap.entries, account.platformId);
    let source = 'api';
    if (!apiItems.length) {
      const raw = await scrapeItemsWithFrames(page);
      apiItems = raw.map(r => ({ id: uid('msg'), from: r.from, snippet: r.snippet, time: r.time, type: classify(r.from, r.snippet, account.platformId), unread: !!r.unread }));
      source = 'dom';
    }
    const items = apiItems.map(r => ({ id: r.id || uid('msg'), from: r.from, snippet: r.snippet, time: r.time, type: r.type || classify(r.from, r.snippet, account.platformId), unread: !!r.unread }));
    // 抓到真实消息即视为已登录；否则再用 cookie/URL 判断
    const logged = items.length > 0 ? true : await auto.checkLoggedIn(ctx, p, page);
    return {
      accountId: account.id, platformId: account.platformId, platformName: p.name,
      supported: true, logged, items, source,
      note: logged ? (items.length ? '' : '页面没有识别到消息条目（可能确实没有新消息或页面改版）') : '未登录或登录已过期，请先在「账号」页重新登录',
      url: page.url()
    };
  } finally {
    if (cap) { try { cap.stop(); } catch { /* */ } }
    await auto.closeCtx(ctx);
  }
}

// 在消息页里找到目标会话并点开；返回是否点开
async function openConversation(page, fromName) {
  const tries = [
    () => page.getByText(fromName, { exact: true }).first(),
    () => page.locator('[class*="conversation"],[class*="session"],[class*="chat"],[class*="msg"],li').filter({ hasText: fromName }).first(),
    () => page.locator('text="' + fromName + '"').first()
  ];
  for (const t of tries) {
    const loc = await Promise.resolve().then(t).catch(() => null);
    if (!loc) continue;
    const n = await loc.count().catch(() => 0);
    if (!n) continue;
    if (!(await loc.isVisible().catch(() => false))) continue;
    await loc.click({ timeout: 5000 }).catch(() => {});
    return true;
  }
  return false;
}

// 找回复输入框：Skip 语义是「返回 true 就跳过」，这里只跳过搜索框，绝不能跳过带 回复/消息 占位的输入框
async function findReplyInput(page) {
  const sels = ['[contenteditable="true"]', 'textarea', 'input[type="text"]'];
  const isSearch = async loc => {
    try {
      const sig = [(await loc.getAttribute('placeholder') || ''), (await loc.getAttribute('aria-label') || ''), (await loc.getAttribute('data-placeholder') || '')].join(' ');
      return /搜索|search|查找|find/i.test(sig);
    } catch { return false; }
  };
  const found = await auto.pickVisibleIn(page, sels, isSearch);
  return found && found.loc;
}

// 回复：打开消息页 → 精确找到会话 → 填回复框 → 发送并校验，全程给出明确失败原因
async function reply(account, fromName, text) {
  const p = platforms.find(x => x.id === account.platformId);
  if (!p) throw new Error('未知平台');
  const mp = MESSAGE_PAGES[account.platformId];
  if (!mp) throw new Error('该平台暂未接入消息页，无法自动回复');
  if (!mp.replyable) throw new Error(p.name + ' 的回复入口无法稳定定位，请打开原网页手动回复');
  const body = String(text || '').trim();
  if (!body) throw new Error('回复内容不能为空');
  if (!fromName) throw new Error('请指定回复对象（会话昵称）');
  const ctx = await auto.launch(account.id);
  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(mp.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3500);
    const logged = await auto.checkLoggedIn(ctx, p, page);
    if (!logged) throw new Error(p.name + ' 未登录或登录已过期，请先在「账号」页重新登录');
    // 1. 找到目标会话（精确文本 → 列表项包含 → 子串）；找不到则滚动列表再试
    let opened = await openConversation(page, fromName);
    if (!opened) {
      await page.mouse.wheel(0, 800).catch(() => {});
      await page.waitForTimeout(1200);
      opened = await openConversation(page, fromName);
    }
    if (!opened) throw new Error('没找到与「' + fromName + '」的会话（列表可能未加载或会话已过期），请刷新消息列表后重试');
    await page.waitForTimeout(2500);
    // 2. 找回复输入框（主文档 + iframe；只跳过搜索框）
    const input = await findReplyInput(page);
    if (!input) throw new Error('没找到回复输入框（页面可能改版），请打开原网页手动回复');
    await input.click();
    await page.keyboard.type(body, { delay: 20 });
    // 3. 优先点发送按钮，找不到再回车；点完校验输入框/会话区
    let clicked = false;
    for (const t of ['发送', '发送消息', 'Send', '回复', '发送私信']) {
      const btn = page.locator('button:has-text("' + t + '"), a:has-text("' + t + '"), [class*="send"][role="button"]').first();
      if (await btn.count().catch(() => 0) && await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 4000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    // 4. 校验：输入框清空 或 会话区出现回复文本，任一成立即视为已发出
    const remains = await input.evaluate(el => (el.innerText || el.value || '').trim()).catch(() => '');
    const inputCleared = !remains.includes(body);
    let inThread = false;
    try {
      const txt = await page.evaluate(() => (document.body && document.body.innerText) || '');
      inThread = txt.includes(body);
    } catch { /* */ }
    if (!inputCleared && !inThread) throw new Error('发送后输入框内容未清空、会话里也没有出现回复，可能未发出，请到原网页确认');
    return { ok: true, verified: inThread ? 'thread' : 'input-cleared', url: page.url() };
  } finally {
    await auto.closeCtx(ctx);
  }
}

// 聚合存储（按账号最新一条快照）
function store(snap) {
  const all = load('messages.json', {});
  all[snap.accountId] = { ...snap, savedAt: Date.now() };
  if (!all[snap.accountId].items) all[snap.accountId].items = [];
  save('messages.json', all);
  return all[snap.accountId];
}
function listAll() { return load('messages.json', {}); }
function saveDraft(accountId, fromName, text) {
  const all = load('message_drafts.json', {});
  all[accountId + '|' + fromName] = { accountId, fromName, text, savedAt: Date.now() };
  save('message_drafts.json', all);
}
function drafts() { return load('message_drafts.json', {}); }
function dropDraft(accountId, fromName) {
  const all = load('message_drafts.json', {});
  delete all[accountId + '|' + fromName];
  save('message_drafts.json', all);
}

module.exports = {
  collect, reply, store, listAll, saveDraft, drafts, dropDraft,
  pageSupports, supportedPlatforms, scrapeItems, classify, parseMessageJson, captureJson, fmtTime
};
