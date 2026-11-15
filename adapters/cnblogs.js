'use strict';
const base = require('./base');
module.exports = {
  id: 'cnblogs', name: '博客园', hostText: 'i.cnblogs.com',
  titleSelectors: ['input#post-title', 'input[placeholder*="标题"]', 'input[name="title"]'],
  contentSelectors: ['iframe[id$="_ifr"]', 'body#tinymce', 'body[contenteditable="true"]', '.CodeMirror', '[contenteditable="true"]'],
  coverSelectors: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: ['#post-tags', 'input[placeholder*="标签"]', 'input[name="tags"]'],
  publishSelectors: ['#btn-publish'],
  publishTexts: ['发布', '发布博客'],
  dialogTexts: ['确定', '继续发布'],
  async fillContent(page, ctx, log) {
    const ok = await base.fillIframeEditor(page, 'iframe[id$="_ifr"]', ['body#tinymce', 'body[contenteditable="true"]'], ctx.html, log);
    if (!ok) log('博客园 TinyMCE iframe 注入失败，将回退通用逻辑');
    return ok;
  },
  async afterFill(page, log) { log('博客园标题/TinyMCE 正文/标签填充完成'); },
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log, ctx) { return base.defaultPreflight(page, this, log, ctx); }
};
