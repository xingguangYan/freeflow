'use strict';
const base = require('./base');
// InfoQ 写作平台仅对认证作者开放（实验性）
module.exports = {
  id: 'infoq', name: 'InfoQ', hostText: 'infoq.cn',
  experimental: true,
  titleSelectors: ['input[placeholder*="标题"]', 'textarea[placeholder*="标题"]', 'input[name="title"]'],
  contentSelectors: ['.ProseMirror', '.ql-editor', '.CodeMirror', '[contenteditable="true"]', 'textarea'],
  coverSelectors: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: ['input[placeholder*="标签"]'],
  publishSelectors: ['button:has-text("提交")'],
  publishTexts: ['发布', '提交'],
  dialogTexts: ['确定'],
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log) { return base.defaultPreflight(page, this, log); }
};
