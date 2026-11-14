'use strict';
const base = require('./base');
module.exports = {
  id: 'jianshu', name: '简书', hostText: 'jianshu.com',
  titleSelectors: ['input[placeholder*="标题"]', '.title input', 'input[name="title"]'],
  contentSelectors: ['.ql-editor', '#arthur-editor', '[contenteditable="true"]'],
  coverSelectors: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: ['input[placeholder*="添加标签"]', 'input[placeholder*="标签"]'],
  publishSelectors: ['button:has-text("发布")'],
  publishTexts: ['发布'],
  dialogTexts: ['确定'],
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log) { return base.defaultPreflight(page, this, log); }
};
