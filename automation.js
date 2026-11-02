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

// 与当前系统一致的 UA，减少被平台识别为自动化浏览器的概率
const UA = process.platform === 'darwin'
  ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36'
  : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';
// macOS 上全选/粘贴是 ⌘（Meta），Windows/Linux 上是 Ctrl
const KMOD = process.platform === 'darwin' ? 'Meta' : 'Control';

function profileDir(accountId) { return path.join(PROFILES, accountId); }

// 只杀命令行里带着该 profile 目录的残留 Chrome，不影响用户自己开的窗口。
function killLingerChrome(dir) {
  let killed = 0;
  try {
    if (process.platform === 'win32') {
      const psCmd = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${dir.replace(/'/g, "''")}*' } | Select-Object -ExpandProperty ProcessId`;
      const out = execSync(`powershell -NoProfile -Command "${psCmd}"`, { encoding: 'utf8', timeout: 10000, windowsHide: true });
      for (const pid of out.split(/\s+/).map(Number).filter(Number.isInteger)) {
        try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', windowsHide: true }); killed++; } catch { /* 进程可能已退出 */ }
      }
    } else {
      // macOS/Linux：杀命令行含该 profile 的 Chrome/Chromium（不影响用户自己开的窗口）
      try { execSync(`pkill -f "Google Chrome.*${dir.replace(/[.*+?^${}()|[\\]/g, '\\\\$&')}"`, { stdio: 'ignore', timeout: 10000 }); } catch { /* */ }
      try { execSync(`pkill -f "Chromium.*${dir.replace(/[.*+?^${}()|[\\]/g, '\\\\$&')}"`, { stdio: 'ignore', timeout: 10000 }); } catch { /* */ }
      killed = 1; // pkill 不回数，保守视为已清理
    }
  } catch { /* 没有 PowerShell 或没有残留进程 */ }
  return killed;
}

// macOS 上判断系统 Chrome 是否存在（/Applications 或 ~/Applications）
function chromeInstalled() {
  const home = require('os').homedir();
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    path.join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];
  return paths.some(p => { try { return fs.existsSync(p); } catch { return false; } });
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
    permissions: ['clipboard-read', 'clipboard-write'],
    args: ['--disable-blink-features=AutomationControlled']
  };
  const dir = profileDir(accountId);
  let lastErr = null;
  // 启动失败最常见的原因是：上一次的 Chrome 没退干净，profile 目录被锁。清残留后重试。
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // 优先用系统已装的 Chrome（自带 VC++ 运行环境，也更不容易被识别为自动化浏览器）；
      // 装了 FREEFLOW_BROWSER=chromium 或系统没有 Chrome 时回退到 Playwright 自带内核。
      const wantBundled = process.env.FREEFLOW_BROWSER === 'chromium' || (process.platform === 'darwin' && !chromeInstalled());
      if (!wantBundled) {
        return await chromium.launchPersistentContext(dir, { ...opts, channel: 'chrome' });
      }
      // 剩下交给 playwright 自己解析注册表里已下载的 chromium；没下载会抛出带安装提示的错误
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
// 页面文字里的登录墙（cookie 可能还在，但服务端已让会话失效）
async function pageHasLoginWall(page) {
  try {
    const txt = await page.evaluate(() => ((document.body && document.body.innerText) || '').slice(0, 600));
    return /请重新登录|请先登录|扫码登录|登录已失效|登录失效|登录已过期|登录过期/.test(txt);
  } catch { return false; }
}
// 发布时判断是否撞登录墙：网址像登录页，或页面直接提示重新登录。
async function hitLoginWall(ctx, platform, page) {
  const url = page.url();
  if (/login|signin|sign[-_]?in|passport/i.test(url)) return true;
  return await pageHasLoginWall(page);
}
// 带页面上下文的登录判断：URL 命中后台优先，其次排除登录墙，最后才看 cookie。
async function checkLoggedIn(ctx, platform, page) {
  const url = page.url();
  try { if (platform.loggedInUrl && platform.loggedInUrl.test(url)) return true; } catch { /* */ }
  if (await pageHasLoginWall(page)) return false;
  return await hasLoginCookies(ctx, platform);
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
    try {
      // 有些平台的可点元素是 span/div，而不是 button/a
      const loc = page.getByText(t, { exact: true });
      const n = await loc.count();
      for (let i = 0; i < n; i++) {
        const el = loc.nth(i);
        const box = await el.boundingBox().catch(() => null);
        if (box && box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0) {
          await el.click({ timeout, force: true });
          return t;
        }
      }
    } catch { /* */ }
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
// Markdown -> HTML（用于「Markdown 文章发到富文本平台」）
function mdToHtml(md) {
  const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => s
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inCode = false, codeBuf = [], listType = null;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      if (!inCode) { inCode = true; codeBuf = []; closeList(); }
      else { inCode = false; out.push(`<pre><code>${escHtml(codeBuf.join('\n'))}</code></pre>`); }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    if (!line.trim()) { closeList(); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { closeList(); out.push(`<h${h[1].length}>${inline(escHtml(h[2]))}</h${h[1].length}>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { closeList(); out.push('<hr>'); continue; }
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const type = ul ? 'ul' : 'ol';
      if (listType !== type) { closeList(); out.push(`<${type}>`); listType = type; }
      out.push(`<li>${inline(escHtml((ul || ol)[1]))}</li>`);
      continue;
    }
    closeList();
    const bq = /^>\s?(.*)$/.exec(line);
    if (bq) { out.push(`<blockquote>${inline(escHtml(bq[1]))}</blockquote>`); continue; }
    out.push(`<p>${inline(escHtml(line))}</p>`);
  }
  if (inCode) out.push(`<pre><code>${escHtml(codeBuf.join('\n'))}</code></pre>`);
  closeList();
  return out.join('\n');
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
// 在主文档和所有 iframe 里找可见元素（公众号编辑器在 iframe 里）。
async function pickVisibleIn(page, selectors) {
  const scopes = [page];
  try {
    for (const f of page.frames()) if (f !== page.mainFrame()) scopes.push(f);
  } catch { /* */ }
  for (const scope of scopes) {
    try {
      const loc = await pickVisible(scope, selectors);
      if (loc) return { scope, loc };
    } catch { /* 跨域 iframe 可能读不到 */ }
  }
  return null;
}
// 等编辑器真正渲染出来，再开始填。返回 {title, content} 或 null。
async function waitForEditor(page, platform, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (page.isClosed && page.isClosed()) return null;
    const t = await pickVisibleIn(page, [...(platform.titleSelectors || []), ...GENERIC_TITLE]);
    const c = await pickVisibleIn(page, [...(platform.contentSelectors || []), ...GENERIC_CONTENT]);
    if (t || c) return { title: !!t, content: !!c };
    await page.waitForTimeout(1000).catch(() => {});
  }
  return null;
}
// 把 HTML 放进剪贴板再 Ctrl+V，ProseMirror / Draft.js / Quill 都能正确接收。
async function pasteHtml(page, html) {
  try {
    const text = htmlToText(html);
    await page.evaluate(async ({ html, text }) => {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      });
      await navigator.clipboard.write([item]);
    }, { html, text });
    return true;
  } catch { return false; }
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
  const hit = await pickVisibleIn(page, [...(platform.titleSelectors || []), ...GENERIC_TITLE]);
  if (!hit) {
    // 有的平台标题框是隐藏的真实输入框（如 CSDN），直接写值
    for (const s of [...(platform.titleSelectors || []), ...GENERIC_TITLE]) {
      try {
        const loc = page.locator(s).first();
        if (await loc.count() > 0) {
          await loc.evaluate((el, v) => {
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, title);
          return true;
        }
      } catch { /* 继续 */ }
    }
    return false;
  }
  const { loc } = hit;
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
  const hit = await pickVisibleIn(page, [...(platform.contentSelectors || []), ...GENERIC_CONTENT]);
  if (!hit) return false;
  const { loc } = hit;
  // 草稿保护：编辑器里已有无关内容时不覆盖，交给手动模式
  const before = await loc.evaluate(el => (el.innerText || el.value || '').trim()).catch(() => '');
  const probe = htmlToText(payload).replace(/\s+/g, '').slice(0, 10);
  const beforeNorm = before.replace(/\s+/g, '');
  if (beforeNorm.length > 20 && probe && !beforeNorm.includes(probe)) return false;
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
      await page.keyboard.press(KMOD + '+A').catch(() => {});
      await page.keyboard.press('Delete').catch(() => {});
      await page.keyboard.insertText(payload).catch(() => {});
    } else {
      await loc.evaluate(el => el.focus());
      await page.keyboard.press(KMOD + '+A').catch(() => {});
      await page.keyboard.press('Delete').catch(() => {});
      await page.waitForTimeout(150);
      let pasted = false;
      if (await pasteHtml(page, payload)) {
        await page.keyboard.press(KMOD + '+V').catch(() => {});
        pasted = true;
        await page.waitForTimeout(800);
      }
      const len = await loc.evaluate(el => (el.innerText || '').trim().length).catch(() => 0);
      if (!pasted || !len) {
        await loc.evaluate((el, h) => {
          el.focus();
          document.execCommand('selectAll', false);
          document.execCommand('delete', false);
          document.execCommand('insertHTML', false, h);
        }, payload);
      }
    }
  }
  return true;
}

async function uploadCover(page, platform, coverPath) {
  const sel = platform.coverInput || 'input[type="file"]';
  try {
    // 文件输入框通常是隐藏的，setInputFiles 不需要它可见
    const loc = page.locator(sel).first();
    if (await loc.count() > 0) { await loc.setInputFiles(coverPath); return true; }
  } catch { /* 再试 iframe */ }
  try {
    const hit = await pickVisibleIn(page, [sel]);
    if (hit) { await hit.loc.setInputFiles(coverPath); return true; }
  } catch { /* 无图位就算了 */ }
  return false;
}

async function clickPublish(page) {
  // 顺序很重要：先试更具体的文案，避免误点「发布设置」
  for (const t of ['预览并发布', '发布文章', '发布作品', '发布视频', '发布笔记', '立即投稿', '发表', '发布', '提交']) {
    try {
      // 角色+名称匹配，能正确处理按钮内嵌 span、空白和换行
      const rb = page.getByRole('button', { name: t, exact: true }).first();
      if (await rb.count() > 0 && await rb.isVisible().catch(() => false)) {
        try { await rb.evaluate(el => el.click()); return t; }
        catch { try { await rb.click({ timeout: 4000, force: true }); return t; } catch { /* 继续其他策略 */ } }
      }
      const exact = page.locator(`button:text-is("${t}"), a:text-is("${t}")`).first();
      if (await exact.count() > 0 && await exact.isVisible().catch(() => false)) {
        await exact.click({ timeout: 5000 });
        return t;
      }
      const loc = page.locator(`button:has-text("${t}"):not(:has-text("设置")):not(:has-text("草稿")), .btn:has-text("${t}"):not(:has-text("设置")), a:has-text("${t}"):not(:has-text("设置"))`).first();
      if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
        await loc.click({ timeout: 5000 });
        return t;
      }
      // 有些平台用 div/span 当按钮（如小红书「发布笔记」）
      const any = page.getByText(t, { exact: true });
      const n = await any.count();
      for (let i = 0; i < Math.min(n, 10); i++) {
        const el = any.nth(i);
        const box = await el.boundingBox().catch(() => null);
        if (!box || box.x < 0 || box.y < 0) continue;
        const clickable = await el.evaluate(e => {
          const s = String(e.className || '') + ' ' + String((e.parentElement && e.parentElement.className) || '');
          return /btn|publish|submit|button/i.test(s);
        }).catch(() => false);
        if (clickable) { await el.click({ timeout: 5000, force: true }); return t; }
      }
    } catch { /* 继续候选 */ }
  }
  return null;
}
// 按钮可能在上传/渲染后才出现，重试等待
async function clickPublishRetry(page, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const t = await clickPublish(page);
    if (t) return t;
    await page.waitForTimeout(1000).catch(() => {});
  }
  return null;
}
// 直接对按钮派发完整 pointer/mouse 事件（绕过浮层遮挡）
async function clickTextButton(page, text) {
  try {
    const rb = page.getByRole('button', { name: text, exact: true }).first();
    if (await rb.count() > 0 && await rb.isVisible().catch(() => false)) {
      await rb.scrollIntoViewIfNeeded().catch(() => {});
      await rb.evaluate(el => {
        const r = el.getBoundingClientRect();
        const opts = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0 };
        el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, isPrimary: true }));
        el.dispatchEvent(new MouseEvent('mousedown', opts));
        el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, isPrimary: true }));
        el.dispatchEvent(new MouseEvent('mouseup', opts));
        el.dispatchEvent(new MouseEvent('click', opts));
      });
      return true;
    }
  } catch { /* 继续 */ }
  return false;
}
// 头条：先「预览」，再在预览态点「发布」
async function clickPreviewThenPublish(page) {
  if (!(await clickTextButton(page, '预览'))) return null;
  await page.waitForTimeout(2500);
  if (await clickTextButton(page, '发布')) return '预览→发布';
  return '预览';
}
// 发布后的二次确认弹窗（B站/CSDN 常见）
async function clickConfirm(page) {
  // 优先在可见弹窗内点（CSDN 的确认按钮也叫「发布文章」）
  const dialogs = page.locator('[role="dialog"]:visible, .el-dialog:visible, .modal:visible, .ant-modal:visible');
  const dn = await dialogs.count().catch(() => 0);
  if (dn > 0) {
    const dlg = dialogs.nth(dn - 1);
    for (const t of ['发布文章', '发布', '发表', '确认发布', '确定发布', '仍要发布', '继续发布', '确定', '确认']) {
      try {
        const rb = dlg.getByRole('button', { name: t, exact: true }).first();
        if (await rb.count() > 0 && await rb.isVisible().catch(() => false)) {
          try { await rb.evaluate(el => el.click()); return t; }
          catch { try { await rb.click({ timeout: 4000, force: true }); return t; } catch { /* 继续 */ } }
        }
        const loc = dlg.locator(`button:text-is("${t}")`).first();
        if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
          await loc.click({ timeout: 5000 });
          return t;
        }
      } catch { /* 继续 */ }
    }
  }
  for (const t of ['确认发布', '确定发布', '仍要发布', '继续发布', '确定', '确认']) {
    try {
      const rb = page.getByRole('button', { name: t, exact: true }).first();
      if (await rb.count() > 0 && await rb.isVisible().catch(() => false)) {
        try { await rb.evaluate(el => el.click()); return t; }
        catch { try { await rb.click({ timeout: 4000, force: true }); return t; } catch { /* 继续 */ } }
      }
      const loc = page.locator(`button:text-is("${t}"), .btn:text-is("${t}")`).first();
      if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
        await loc.click({ timeout: 5000 });
        return t;
      }
    } catch { /* 继续 */ }
  }
  return null;
}

// ---------- 视频 ----------
async function uploadVideo(page, platform, videoPath) {
  const sel = platform.uploadInput || 'input[type="file"]';
  try {
    const loc = page.locator(sel).first();
    if (await loc.count() > 0) { await loc.setInputFiles(videoPath); return true; }
  } catch { /* 再试 iframe */ }
  try {
    const hit = await pickVisibleIn(page, [sel]);
    if (hit) { await hit.loc.setInputFiles(videoPath); return true; }
  } catch { /* 无上传位 */ }
  return false;
}
const GENERIC_DESC = [
  'textarea[placeholder*="描述"]', 'textarea[placeholder*="简介"]', 'textarea[placeholder*="文案"]',
  'textarea[placeholder*="说明"]', 'div[contenteditable="true"]', 'textarea'
];
async function fillDesc(page, platform, text) {
  const hit = await pickVisibleIn(page, [...(platform.descSelectors || []), ...GENERIC_DESC]);
  if (!hit) return false;
  const { loc } = hit;
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
  const hit = await pickVisibleIn(page, [...(platform.tagSelectors || []), ...GENERIC_TAGS]);
  if (!hit) return false;
  const { loc } = hit;
  await loc.fill(tags, { timeout: 4000 }).catch(async () => {
    await loc.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, tags);
  });
  await page.keyboard.press('Enter').catch(() => {});
  return true;
}

module.exports = {
  launch, profileDir, clickIfAny, waitForPopup, pickVisible, closeCtx,
  pickVisibleIn, waitForEditor, pasteHtml,
  hasLoginCookies, looksLoggedIn, hitLoginWall, checkLoggedIn, pageHasLoginWall, inlineLocalImages,
  htmlToText, htmlToMd, mdToHtml, fillTitle, fillContent, uploadCover, clickPublish, clickPublishRetry, clickConfirm,
  clickTextButton, clickPreviewThenPublish,
  uploadVideo, fillDesc, fillTags, GENERIC_DESC, GENERIC_TAGS,
  GENERIC_TITLE, GENERIC_CONTENT
};
