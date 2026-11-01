'use strict';
// 浏览器自动化引擎。
// - 每个账号一个独立 user-data-dir（profiles/<accountId>），登录态存本地磁盘。
// - 发布固定为「有头」模式：平台随时可能弹验证码/确认，人可以接管。
// - 填充策略：平台专属候选 -> 通用启发式 -> 手动模式（内容已进剪贴板）。
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
const { DATA, MATERIALS } = require('./store');

const PROFILES = path.join(DATA, 'profiles');
fs.mkdirSync(PROFILES, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';

function profileDir(accountId) { return path.join(PROFILES, accountId); }

// 只杀命令行里带着该 profile 目录的残留 Chrome，不影响用户自己开的窗口。
function killLingerChrome(dir) {
  let killed = 0;
  try {
    const psCmd = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${dir.replace(/'/g, "''")}*' } | Select-Object -ExpandProperty ProcessId`;
    const out = execSync(`powershell -NoProfile -Command "${psCmd}"`, { encoding: 'utf8', timeout: 10000, windowsHide: true });
    for (const pid of out.split(/\s+/).map(Number).filter(Number.isInteger)) {
      try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', windowsHide: true }); killed++; } catch { /* 进程可能已退出 */ }
    }
  } catch { /* 没有 PowerShell 或没有残留进程 */ }
  return killed;
}
// 删掉 POSIX 风格的 profile 锁文件（Windows 上一般不需要，但留着无害）。
function clearProfileLock(dir) {
  for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'Singleton']) {
    try { fs.rmSync(path.join(dir, f), { force: true }); } catch { /* */ }
  }
}

async function launch(accountId) {
  const opts = {
    headless: false,
    viewport: { width: 1280, height: 880 },
    userAgent: UA,
    args: ['--disable-blink-features=AutomationControlled']
  };
  const dir = profileDir(accountId);
  let lastErr = null;
  // 启动失败最常见的原因是：上一次的 Chrome 没退干净，profile 目录被锁。清残留后重试。
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // 优先用系统已装的 Chrome（自带 VC++ 运行环境，也更不容易被识别为自动化浏览器）；
      // 装了 FREEFLOW_BROWSER=chromium 或系统没有 Chrome 时回退到 Playwright 自带内核。
      if (process.env.FREEFLOW_BROWSER !== 'chromium') {
        return await chromium.launchPersistentContext(dir, { ...opts, channel: 'chrome' });
      }
      return await chromium.launchPersistentContext(dir, opts);
    } catch (e) {
      lastErr = e;
      const n = killLingerChrome(dir);
      clearProfileLock(dir);
      console.warn(`[launch] 第 ${attempt + 1} 次启动失败（${String(e.message).split('\n')[0]}），清理残留 Chrome ${n} 个后重试`);
      await new Promise(r => setTimeout(r, 1200));
    }
  }
  throw lastErr || new Error('浏览器启动失败');
}

// 关闭 context，带超时保护，防止 close 卡住下一次启动。
async function closeCtx(ctx) {
  if (!ctx) return;
  try {
    await Promise.race([
      new Promise(resolve => { ctx.close().then(resolve).catch(resolve); }),
      new Promise(r => setTimeout(r, 4000))
    ]);
  } catch { /* */ }
}

// ---------- 登录态判断 ----------
// cookie 是最可靠的信号：profile 里的登录 cookie 只有真登上才会有。
async function hasLoginCookies(ctx, platform) {
  try {
    const need = platform.loginCookies || [];
    if (!need.length) return false;
    const cookies = await ctx.cookies();
    const names = new Set(cookies.map(c => c.name));
    return need.some(n => names.has(n));
  } catch { return false; }
}
async function looksLoggedIn(ctx, platform, url) {
  try { if (platform.loggedInUrl && platform.loggedInUrl.test(url || '')) return true; } catch { /* 正则异常 */ }
  return await hasLoginCookies(ctx, platform);
}
// 发布时判断是否撞登录墙：本地没有登录 cookie，且当前页明显是登录页。
async function hitLoginWall(ctx, platform, page) {
  if (await hasLoginCookies(ctx, platform)) return false;
  const url = page.url();
  try { if (platform.loggedInUrl && platform.loggedInUrl.test(url)) return false; } catch { /* */ }
  return /login|signin|sign[-_]?in|passport/i.test(url);
}

// 正文里的本地图片（/materials/xxx）平台不认，转成 base64 内联进 HTML。
function inlineLocalImages(html) {
  return String(html || '').replace(/src="(\/materials\/[^"]+)"/g, (m, url) => {
    try {
      const file = path.join(MATERIALS, path.basename(url));
      const buf = fs.readFileSync(file);
      let ext = path.extname(file).slice(1).toLowerCase();
      if (ext === 'jpeg') ext = 'jpg';
      const mime = ext === 'jpg' ? 'jpeg' : (ext === 'svg' ? 'svg+xml' : ext);
      return `src="data:image/${mime};base64,${buf.toString('base64')}"`;
    } catch { return m; }
  });
}

async function clickIfAny(page, texts, timeout = 4000) {
  for (const t of texts) {
    try {
      const loc = page.locator(`button:has-text("${t}"), a:has-text("${t}"), .btn:has-text("${t}")`).first();
      await loc.waitFor({ state: 'visible', timeout: 1500 });
      await loc.click({ timeout });
      return t;
    } catch { /* 试下一个候选 */ }
  }
  return null;
}

async function waitForPopup(ctx, page, timeout = 5000) {
  try {
    const popup = await ctx.waitForEvent('page', { timeout });
    await popup.waitForLoadState('domcontentloaded').catch(() => {});
    return popup;
  } catch { return page; }
}

// ---------- HTML <-> 文本/Markdown ----------
function htmlToText(html) {
  return String(html || '')
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr)>/gi, '\n')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n').trim();
}
function htmlToMd(html) {
  let s = String(html || '');
  s = s.replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (m, n, t) => '\n' + '#'.repeat(+n) + ' ' + htmlToText(t) + '\n');
  s = s.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**');
  s = s.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*');
  s = s.replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, (m, src) => `\n![](${src})\n`);
  s = s.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  return htmlToText(s).replace(/\n{3,}/g, '\n\n').trim();
}

// ---------- 填充 ----------
async function pickVisible(page, selectors) {
  for (const s of selectors) {
    try {
      const loc = page.locator(s).first();
      if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) return loc;
    } catch { /* 继续候选 */ }
  }
  return null;
}
const GENERIC_TITLE = [
  'input[name="title"]', '#title', '.article-title input',
  'input[placeholder*="标题"]', 'textarea[placeholder*="标题"]',
  'input[placeholder*="题目"]', 'input[aria-label*="标题"]', '.title-input'
];
const GENERIC_CONTENT = [
  '[contenteditable="true"]', '.ProseMirror', '.ql-editor', '.edui-body-container',
  'textarea[placeholder*="正文"]', 'textarea[placeholder*="内容"]', 'textarea'
];

async function fillTitle(page, platform, title) {
  const loc = await pickVisible(page, [...(platform.titleSelectors || []), ...GENERIC_TITLE]);
  if (!loc) return false;
  const tag = await loc.evaluate(el => el.tagName).catch(() => 'INPUT');
  if (tag === 'TEXTAREA' || tag === 'INPUT') {
    await loc.click({ timeout: 3000 }).catch(() => {});
    await loc.fill(title, { timeout: 5000 }).catch(async () => {
      await loc.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, title);
    });
  } else {
    await loc.evaluate((el, v) => { el.textContent = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, title);
  }
  return true;
}

async function fillContent(page, platform, html) {
  const isMd = platform.contentType === 'markdown';
  const payload = isMd ? htmlToMd(html) : html;
  const loc = await pickVisible(page, [...(platform.contentSelectors || []), ...GENERIC_CONTENT]);
  if (!loc) return false;
  const tag = await loc.evaluate(el => el.tagName).catch(() => 'DIV');
  if (tag === 'TEXTAREA' || tag === 'INPUT') {
    await loc.evaluate((el, v) => {
      const proto = Object.getPrototypeOf(el);
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, payload);
  } else {
    if (isMd) {
      await loc.evaluate(el => { el.focus(); });
      await page.keyboard.insertText(payload).catch(() => {});
    } else {
      await loc.evaluate((el, h) => {
        el.focus();
        document.execCommand('selectAll', false);
        document.execCommand('delete', false);
        document.execCommand('insertHTML', false, h);
      }, payload);
    }
  }
  return true;
}

async function uploadCover(page, platform, coverPath) {
  const sel = platform.coverInput || 'input[type="file"]';
  try {
    const loc = page.locator(sel).first();
    if (await loc.count() > 0) { await loc.setInputFiles(coverPath); return true; }
  } catch { /* 无图位就算了 */ }
  return false;
}

async function clickPublish(page) {
  for (const t of ['发表', '发布', '发布文章', '发布作品', '发布视频', '立即投稿', '提交', '发布笔记']) {
    try {
      const loc = page.locator(`button:has-text("${t}"), .btn:has-text("${t}"), a:has-text("${t}")`).first();
      if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
        await loc.click({ timeout: 5000 });
        return t;
      }
    } catch { /* 继续候选 */ }
  }
  return null;
}

// ---------- 视频 ----------
async function uploadVideo(page, platform, videoPath) {
  const sel = platform.uploadInput || 'input[type="file"]';
  try {
    const loc = page.locator(sel).first();
    if (await loc.count() > 0) { await loc.setInputFiles(videoPath); return true; }
  } catch { /* 无上传位 */ }
  return false;
}
const GENERIC_DESC = [
  'textarea[placeholder*="描述"]', 'textarea[placeholder*="简介"]', 'textarea[placeholder*="文案"]',
  'textarea[placeholder*="说明"]', 'div[contenteditable="true"]', 'textarea'
];
async function fillDesc(page, platform, text) {
  const loc = await pickVisible(page, [...(platform.descSelectors || []), ...GENERIC_DESC]);
  if (!loc) return false;
  const tag = await loc.evaluate(el => el.tagName).catch(() => 'TEXTAREA');
  if (tag === 'TEXTAREA' || tag === 'INPUT') {
    await loc.evaluate((el, v) => {
      const proto = Object.getPrototypeOf(el);
      const setter = (Object.getOwnPropertyDescriptor(proto, 'value') || {}).set;
      if (setter) setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, text);
  } else {
    await loc.evaluate((el, v) => {
      el.focus();
      document.execCommand('selectAll', false);
      document.execCommand('delete', false);
      document.execCommand('insertText', false, v);
    }, text);
  }
  return true;
}
const GENERIC_TAGS = ['input[placeholder*="标签"]', 'input[placeholder*="话题"]', 'input[placeholder*="标签/话题"]'];
async function fillTags(page, platform, tags) {
  if (!tags) return false;
  const loc = await pickVisible(page, [...(platform.tagSelectors || []), ...GENERIC_TAGS]);
  if (!loc) return false;
  await loc.fill(tags, { timeout: 4000 }).catch(async () => {
    await loc.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, tags);
  });
  await page.keyboard.press('Enter').catch(() => {});
  return true;
}

module.exports = {
  launch, profileDir, clickIfAny, waitForPopup, pickVisible, closeCtx,
  hasLoginCookies, looksLoggedIn, hitLoginWall, inlineLocalImages,
  htmlToText, htmlToMd, fillTitle, fillContent, uploadCover, clickPublish,
  uploadVideo, fillDesc, fillTags, GENERIC_DESC, GENERIC_TAGS,
  GENERIC_TITLE, GENERIC_CONTENT
};
