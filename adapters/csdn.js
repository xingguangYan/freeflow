'use strict';
const base = require('./base');
module.exports = {
  id: 'csdn', name: 'CSDN', hostText: 'mp.csdn.net',
  titleSelectors: ['input[placeholder*="文章标题"]', 'input.article-title', '.article-bar input[placeholder*="标题"]', 'input[name="title"]'],
  contentSelectors: ['#ueditor_0', '.edui-body-container', '.editor-content', '[contenteditable="true"]', 'textarea'],
  coverSelectors: ['input[type="file"][accept*="image"]', '.cover-upload input[type="file"]', 'input[type="file"]'],
  tagSelectors: ['input[placeholder*="标签"]', '.mark_selection_tag input', '.tag-input input'],
  publishSelectors: ['button:has-text("发布文章")'],
  publishTexts: ['发布文章', '发布'],
  dialogTexts: ['确定', '我知道了', '继续发布'],
  async afterFill(page, log) { log('CSDN 标题/正文/UEditor 注入完成'); },
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log) { return base.defaultPreflight(page, this, log); }
};
