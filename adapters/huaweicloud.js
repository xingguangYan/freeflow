'use strict';
const base = require('./base');
// 华为云开发者联盟（博客）——入口与选择器需登录后二次验证（实验性）
module.exports = {
  id: 'huaweicloud', name: '华为云开发者联盟', hostText: 'huaweicloud.com',
  experimental: true,
  titleSelectors: ['input[placeholder*="标题"]', 'input[name="title"]', 'textarea[placeholder*="标题"]'],
  contentSelectors: ['[contenteditable="true"]', '.ql-editor', '.ProseMirror', '.CodeMirror', 'textarea'],
  coverSelectors: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: ['input[placeholder*="标签"]'],
  publishSelectors: ['button:has-text("提交")'],
  publishTexts: ['发布', '提交'],
  dialogTexts: ['确定', '继续发布'],
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log) { return base.defaultPreflight(page, this, log); }
};
