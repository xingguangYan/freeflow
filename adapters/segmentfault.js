'use strict';
const base = require('./base');
module.exports = {
  id: 'segmentfault', name: 'SegmentFault', hostText: 'segmentfault.com',
  titleSelectors: ['input[placeholder*="标题"]', 'input[name="title"]', '.title input'],
  contentSelectors: ['.CodeMirror', '.cm-content', '[contenteditable="true"]', 'textarea'],
  coverSelectors: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: ['input[placeholder*="标签"]', 'input[placeholder*="添加标签"]'],
  publishSelectors: ['button:has-text("发布")'],
  publishTexts: ['发布'],
  dialogTexts: ['确定'],
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log) { return base.defaultPreflight(page, this, log); }
};
