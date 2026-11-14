'use strict';
const base = require('./base');
module.exports = {
  id: 'juejin', name: '掘金', hostText: 'juejin.cn',
  titleSelectors: ['input[placeholder*="请输入文章标题"]', 'textarea[placeholder*="标题"]', '.title-input input', 'input[name="title"]'],
  contentSelectors: ['.CodeMirror', '.cm-content', '.bytemd-body', '[contenteditable="true"]', 'textarea'],
  coverSelectors: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: ['input[placeholder*="标签"]', '.tag-input input', 'input[placeholder*="添加标签"]'],
  publishSelectors: ['button:has-text("发布文章")'],
  publishTexts: ['发布', '发布文章'],
  dialogTexts: ['确定', '继续发布', '发布'],
  async afterFill(page, log) { log('掘金 Markdown/编辑器填充完成'); },
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log) { return base.defaultPreflight(page, this, log); }
};
