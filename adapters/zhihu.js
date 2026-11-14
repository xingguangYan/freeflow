'use strict';
const base = require('./base');
module.exports = {
  id: 'zhihu', name: '知乎', hostText: 'zhihu.com',
  titleSelectors: ['input[placeholder*="请输入标题"]', 'textarea[placeholder*="标题"]', '.WriteIndex-titleInput input'],
  contentSelectors: ['.ProseMirror', '.public-DraftEditor-content', '[contenteditable="true"]'],
  coverSelectors: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: ['input[placeholder*="添加话题"]', 'input[placeholder*="话题"]'],
  publishSelectors: ['button:has-text("发布")'],
  publishTexts: ['发布'],
  dialogTexts: ['确定', '发布'],
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log) { return base.defaultPreflight(page, this, log); }
};
