'use strict';
// 适配器公共能力：分步日志、iframe 查找、弹窗处理、发布前检查
function logger(id) {
  return (...args) => console.log('[adapter:' + id + ']', ...args);
}
function uniq(arr) { return [...new Set((arr || []).filter(Boolean))]; }
// 在主文档和所有 iframe 中查找第一个可见元素
async function findInFrames(page, selectors, skip) {
  const scopes = [page];
  try { for (const f of page.frames()) if (f !== page.mainFrame()) scopes.push(f); } catch { /* */ }
  for (const scope of scopes) {
    for (const s of selectors) {
      try {
        const loc = scope.locator(s).first();
        if (await loc.count() && await loc.isVisible().catch(() => false)) {
          if (skip && await skip(loc)) continue;
          return { scope, loc, selector: s };
        }
      } catch { /* 跨域 iframe */ }
    }
  }
  return null;
}
// 点击文案按钮（弹窗/声明/确认）
async function clickByTexts(page, texts, log) {
  for (const t of texts || []) {
    try {
      const loc = page.locator('button:has-text("' + t + '"), [role="button"]:has-text("' + t + '")').first();
      if (await loc.count() && await loc.isVisible().catch(() => false)) {
        await loc.click({ timeout: 3000 }).catch(() => {});
        if (log) log('点击弹窗按钮：' + t);
        return true;
      }
    } catch { /* 继续 */ }
  }
  return false;
}
// 默认发布前检查：标题与正文是否已有内容；封面是否必需由适配器声明
async function defaultPreflight(page, adapter, log, ctx) {
  const issues = [];
  const title = await findInFrames(page, adapter.titleSelectors || [], null);
  if (title) {
    const v = await title.loc.evaluate(el => (el.value !== undefined ? el.value : el.innerText || '').trim()).catch(() => '');
    if (!v) issues.push('标题为空');
    else if (log) log('发布前检查：标题已填写');
  } else issues.push('未找到标题框');
  // iframe 元素本身没有文本：正文必须进 frame 内查，或直接复用填充阶段的校验结果
  let bodyOk = !!(ctx && ctx.filledContent);
  if (bodyOk) { if (log) log('发布前检查：正文已由填充阶段验证'); }
  else {
    const scopes = [page];
    try { for (const f of page.frames()) if (f !== page.mainFrame()) scopes.push(f); } catch { /* */ }
    for (const scope of scopes) {
      try {
        const body = await scope.locator(adapter.contentSelectors && adapter.contentSelectors.length ? adapter.contentSelectors.join(',') : '[contenteditable="true"]').first();
        if (await body.count()) {
          const v = await body.evaluate(el => (el.value !== undefined ? el.value : el.innerText || '').trim()).catch(() => '');
          if (v) { bodyOk = true; break; }
        }
        const cm = scope.locator('.CodeMirror-code, .cm-content').first();
        if (await cm.count() && (await cm.innerText().catch(() => '')).trim()) { bodyOk = true; break; }
      } catch { /* 跨域 frame */ }
    }
    if (!bodyOk) issues.push('正文为空');
    else if (log) log('发布前检查：正文已填写（frame 扫描）');
  }
  if (adapter.requiredCover) {
    const cover = await findInFrames(page, adapter.coverSelectors || [], null);
    if (!cover) issues.push('未找到封面上传控件');
  }
  return { ok: issues.length === 0, issues };
}
module.exports = { logger, uniq, findInFrames, clickByTexts, defaultPreflight };

// 聚焦可编辑元素并整体替换文本（Lexical / CodeMirror / contenteditable 通用）
async function replaceText(page, loc, text, log) {
  try {
    await loc.click({ timeout: 4000 }).catch(() => {});
    await loc.evaluate(el => { el.focus(); }).catch(() => {});
    await page.keyboard.press('Control+A').catch(() => {});
    await page.keyboard.press('Delete').catch(() => {});
    await page.keyboard.insertText(text).catch(() => {});
    await page.waitForTimeout(400);
    if (log) log('已注入文本（' + text.length + ' 字）');
    const got = await loc.evaluate(el => (el.value !== undefined ? el.value : el.innerText || '')).catch(() => '');
    return got.replace(/\s+/g, '').includes(text.replace(/\s+/g, '').slice(0, 30));
  } catch { return false; }
}
// iframe 内富文本注入：先定位 iframe 的 contentFrame，再找内部 body
async function fillIframeEditor(page, iframeSelector, innerSelectors, html, log) {
  const iframe = page.locator(iframeSelector).first();
  if (!(await iframe.count().catch(() => 0))) { if (log) log('未找到 iframe: ' + iframeSelector); return false; }
  let frame = null;
  try { frame = await iframe.contentFrame(); } catch { frame = null; }
  if (!frame) { if (log) log('无法进入 iframe: ' + iframeSelector); return false; }
  for (const s of innerSelectors) {
    const loc = frame.locator(s).first();
    if (!(await loc.count().catch(() => 0))) continue;
    const ok = await replaceText(page, loc, html, log);
    if (ok) { if (log) log('iframe 注入成功: ' + iframeSelector + ' -> ' + s); return true; }
  }
  return false;
}
module.exports.replaceText = replaceText;
module.exports.fillIframeEditor = fillIframeEditor;

// 富文本粘贴：把 HTML 放进剪贴板后在目标编辑器内 Ctrl+V（CKEditor/TinyMCE/UEditor 都认）
async function pasteRich(page, loc, html, text, log) {
  try {
    await loc.click({ timeout: 4000 }).catch(() => {});
    await loc.evaluate(el => el.focus()).catch(() => {});
    await page.keyboard.press('Control+A').catch(() => {});
    await page.keyboard.press('Delete').catch(() => {});
    const okClip = await page.evaluate(async ({ html, text }) => {
      try {
        const item = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        });
        await navigator.clipboard.write([item]);
        return true;
      } catch { return false; }
    }, { html, text });
    if (!okClip) return false;
    await page.keyboard.press('Control+V').catch(() => {});
    await page.waitForTimeout(800);
    const got = await loc.evaluate(el => (el.innerText || el.value || '').replace(/\s+/g, '')).catch(() => '');
    const probe = String(text || '').replace(/\s+/g, '').slice(0, 24);
    if (log) log('富文本粘贴' + (got.includes(probe) ? '成功' : '后校验未通过'));
    return got.includes(probe);
  } catch { return false; }
}
module.exports.pasteRich = pasteRich;
