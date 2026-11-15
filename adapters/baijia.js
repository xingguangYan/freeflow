'use strict';
const base = require('./base');
module.exports = {
  id: 'baijia', name: '百家号', hostText: 'baijiahao.baidu.com',
  titleSelectors: ['[data-testid="news-title-input"] [data-lexical-editor="true"]', '.client_components_titleInput [contenteditable="true"]', '.client_pages_edit_components_titleInput [contenteditable="true"]', 'div[contenteditable="true"][data-placeholder*="标题"]'],
  contentSelectors: ['iframe#ueditor_0', 'body.view', 'body[contenteditable="true"]', '.edui-body-container', '.editor-content [contenteditable="true"]'],
  coverSelectors: ['input[type="file"][accept*="image"]', '.cover-upload input[type="file"]', 'input[type="file"]'],
  tagSelectors: ['input[placeholder*="标签"]', '.tag-input input'],
  publishSelectors: ['button:has-text("发布文章")'],
  publishTexts: ['发布文章', '发布'],
  dialogTexts: ['确定', '我知道了', '继续发布', '原创'],
  async fillTitle(page, text, log) {
    const loc = page.locator('[data-testid="news-title-input"] [data-lexical-editor="true"]').first();
    if (!(await loc.count().catch(() => 0))) { log('百家号 Lexical 标题框未找到'); return false; }
    const ok = await base.replaceText(page, loc, text, log);
    if (ok) log('百家号 Lexical 标题注入成功');
    return ok;
  },
  async fillContent(page, ctx, log) {
    const ok = await base.fillIframeEditor(page, 'iframe#ueditor_0', ['body.view', 'body[contenteditable="true"]'], ctx.html, log);
    if (!ok) log('百家号 UEditor iframe 注入失败，将回退通用逻辑');
    return ok;
  },
  async afterFill(page, log) { log('百家号 Lexical 标题/UEditor 正文注入完成'); },
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log, ctx) { return base.defaultPreflight(page, this, log, ctx); }
};
