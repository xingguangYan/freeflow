'use strict';
const base = require('./base');
module.exports = {
  id: 'baijia', name: '百家号', hostText: 'baijiahao.baidu.com',
  titleSelectors: ['div[contenteditable="true"][data-placeholder*="标题"]', '.editor-title [contenteditable="true"]', 'input[placeholder*="标题"]', 'textarea[placeholder*="标题"]'],
  contentSelectors: ['.editor-content [contenteditable="true"]', '.ProseMirror', '.ql-editor', '[contenteditable="true"]'],
  coverSelectors: ['input[type="file"][accept*="image"]', '.cover-upload input[type="file"]', 'input[type="file"]'],
  tagSelectors: ['input[placeholder*="标签"]', '.tag-input input'],
  publishSelectors: ['button:has-text("发布文章")'],
  publishTexts: ['发布文章', '发布'],
  dialogTexts: ['确定', '我知道了', '继续发布', '原创'],
  async afterFill(page, log) { log('百家号标题/正文分区填充完成'); },
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log) { return base.defaultPreflight(page, this, log); }
};
