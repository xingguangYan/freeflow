'use strict';
const base = require('./base');
module.exports = {
  id: 'c51cto', name: '51CTO博客', hostText: '51cto.com',
  titleSelectors: ['input[placeholder*="标题"]', 'textarea[placeholder*="标题"]', 'input[name="title"]'],
  contentSelectors: ['.CodeMirror', '.cm-content', '.ProseMirror', '[contenteditable="true"]', 'textarea'],
  coverSelectors: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: ['input[placeholder*="标签"]', 'input[placeholder*="添加标签"]'],
  publishSelectors: ['button:has-text("发表")'],
  publishTexts: ['发布', '发表'],
  dialogTexts: ['确定', '继续发布'],
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log) { return base.defaultPreflight(page, this, log); }
};
