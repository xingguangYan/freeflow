'use strict';
// 统一消息中心：打开各平台消息页，聚合私信/评论/通知；支持在平台允许时直接回复。
// 原则：能力边界明确——平台不支持自动回复时如实提示，不伪造成功；回复失败保留草稿可重试。
const platforms = require('./platforms');
const auto = require('./automation');
const { load, save, uid } = require('./store');

// 各平台消息页地址与回复控件（无法可靠定位回复框的平台只做查看）
const MESSAGE_PAGES = {
  zhihu: { url: 'https://www.zhihu.com/messages', name: '知乎私信', replyable: true },
  csdn: { url: 'https://msg.csdn.net/', name: 'CSDN 消息', replyable: true },
  bilibili: { url: 'https://message.bilibili.com/', name: 'B站消息', replyable: true },
  bilibili_video: { url: 'https://message.bilibili.com/', name: 'B站消息', replyable: true },
  weibo: { url: 'https://weibo.com/message', name: '微博私信', replyable: true },
  xiaohongshu: { url: 'https://creator.xiaohongshu.com/message', name: '小红书私信', replyable: true },
  juejin: { url: 'https://juejin.cn/notification', name: '掘金通知', replyable: false },
  toutiao: { url: 'https://mp.toutiao.com/profile_v4/index', name: '头条号后台', replyable: false },
  jianshu: { url: 'https://www.jianshu.com/', name: '简书', replyable: false },
  cnblogs: { url: 'https://msg.cnblogs.com/', name: '园子消息', replyable: true },
  segmentfault: { url: 'https://segmentfault.com/note', name: 'SF 通知', replyable: false },
  douban: { url: 'https://www.douban.com/doumail/', name: '豆瓣豆邮', replyable: true }
};

// 短时间格式：12:30 / 昨天 / 11-08 / 2026-11-08
const TIME_RE = /(?:^\[?\]?$)|(\d{1,2}:\d{2}(?::\d{2})?$)|(昨天|前天$)|(\d{1,2}-\d{1,2}$)|(\d{4}-\d{1,2}-\d{1,2}$)/;

function pageSupports(platformId) { return !!MESSAGE_PAGES[platformId]; }
function supportedPlatforms() { return Object.keys(MESSAGE_PAGES); }

// 启发式抓取消息条目：列表项里同时出现「昵称、摘要、时间样文字」就算一条
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

function classify(from, snippet, platformId) {
  const s = snippet + from;
  if (/评[论论]|comment|回复了我/i.test(s)) return 'comment';
  if (/关[注注]|点赞|赞同| like|like了|收藏/i.test(s)) return 'notice';
  return 'dm';
}

async function collect(account) {
  const p = platforms.find(x => x.id === account.platformId);
  if (!p) throw new Error('未知平台');
  const mp = MESSAGE_PAGES[account.platformId];
  if (!mp) return { accountId: account.id, platformId: account.platformId, platformName: p.name, supported: false, items: [], note: '该平台暂未接入消息页（可前往平台原站查看）' };
  const ctx = await auto.launch(account.id);
  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(mp.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const logged = await auto.checkLoggedIn(ctx, p, page);
    if (!logged) return { accountId: account.id, platformId: account.platformId, platformName: p.name, supported: true, logged: false, items: [], note: '未登录，请先在「账号」页登录' };
    const raw = await scrapeItems(page);
    const items = raw.map(r => ({
      id: uid('msg'), from: r.from, snippet: r.snippet, time: r.time,
      type: classify(r.from, r.snippet, account.platformId), unread: !!r.unread
    }));
    return { accountId: account.id, platformId: account.platformId, platformName: p.name, supported: true, logged: true, items, note: items.length ? '' : '页面没有识别到消息条目（可能是页面改版或无新消息）', url: page.url() };
  } finally {
    await auto.closeCtx(ctx);
  }
}

// 回复：打开消息页 → 按 from 找到会话并点开 → 填回复框 → 发送，全程校验
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
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(3000);
    // 1. 找到目标会话（精确匹配昵称）
    const conv = page.locator(`text="${fromName}"`).first();
    if (!(await conv.count())) throw new Error('没找到与「' + fromName + '」的会话，可能消息列表未加载或已过期，请重试或打开原网页');
    await conv.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2500);
    // 2. 找回复输入框
    const box = await auto.pickVisibleIn(page, ['[contenteditable="true"]', 'textarea', 'input[type="text"]'], async (loc) => {
      try {
        const ph = await loc.getAttribute('placeholder') || '';
        return /说点什么|回复|私信|消息|写评论/i.test(ph);
      } catch { return false; }
    });
    let input = box && box.loc;
    if (!input) {
      const any = await auto.pickVisibleIn(page, ['[contenteditable="true"]', 'textarea']);
      input = any && any.loc;
    }
    if (!input) throw new Error('没找到回复输入框（页面可能改版），请打开原网页手动回复');
    await input.click();
    await page.keyboard.type(body, { delay: 20 });
    // 3. 找发送按钮（先按文案，再回车兜底）
    let sent = false;
    for (const t of ['发送', '发送消息', 'Send', '发送私信']) {
      const btn = page.locator(`button:has-text("${t}"), a:has-text("${t}")`).first();
      if (await btn.count()) { await btn.click({ timeout: 4000 }).catch(() => {}); sent = true; break; }
    }
    if (!sent) { await page.keyboard.press('Enter'); sent = true; }
    await page.waitForTimeout(2500);
    // 4. 简单校验：输入框被清空视为发送成功；文本残留视为失败
    const remains = await input.evaluate(el => (el.innerText || el.value || '').trim()).catch(() => '');
    if (remains.includes(body)) throw new Error('发送后输入框内容未清空，可能未发出，请到原网页确认');
    return { ok: true, url: page.url() };
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
  pageSupports, supportedPlatforms, scrapeItems, classify
};
