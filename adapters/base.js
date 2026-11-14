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
async function defaultPreflight(page, adapter, log) {
  const issues = [];
  const title = await findInFrames(page, adapter.titleSelectors || [], null);
  if (title) {
    const v = await title.loc.evaluate(el => (el.value !== undefined ? el.value : el.innerText || '').trim()).catch(() => '');
    if (!v) issues.push('标题为空');
    else if (log) log('发布前检查：标题已填写');
  } else issues.push('未找到标题框');
  const body = await findInFrames(page, adapter.contentSelectors || [], null);
  if (body) {
    const v = await body.loc.evaluate(el => (el.value !== undefined ? el.value : el.innerText || '').trim()).catch(() => '');
    if (!v) issues.push('正文为空'); else if (log) log('发布前检查：正文已填写');
  } else issues.push('未找到正文编辑器');
  if (adapter.requiredCover) {
    const cover = await findInFrames(page, adapter.coverSelectors || [], null);
    if (!cover) issues.push('未找到封面上传控件');
  }
  return { ok: issues.length === 0, issues };
}
module.exports = { logger, uniq, findInFrames, clickByTexts, defaultPreflight };
