'use strict';
const base = require('./base');
module.exports = {
  id: 'cnblogs', name: '博客园', hostText: 'i.cnblogs.com',
  titleSelectors: ['input#post-title', 'input[placeholder*="标题"]', 'input[name="title"]'],
  contentSelectors: ['.CodeMirror', '.cm-content', '#cnblogs_post_body', 'textarea#post-body', '[contenteditable="true"]', 'textarea'],
  coverSelectors: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: ['#post-tags', 'input[placeholder*="标签"]', 'input[name="tags"]'],
  publishSelectors: ['#btn-publish'],
  publishTexts: ['发布', '发布博客'],
  dialogTexts: ['确定', '继续发布'],
  async afterFill(page, log) { log('博客园标题/正文/标签填充完成'); },
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log) { return base.defaultPreflight(page, this, log); }
};
