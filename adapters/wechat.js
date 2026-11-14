'use strict';
const base = require('./base');
module.exports = {
  id: 'wechat', name: '微信公众号', hostText: 'mp.weixin.qq.com',
  semi: true,
  frameTitle: true,
  titleSelectors: ['#title', 'input#title', 'input[placeholder*="标题"]', '.js_title input', 'textarea[placeholder*="标题"]'],
  contentSelectors: ['#ueditor_0', '.edui-body-container', 'iframe#ueditor_0', '[contenteditable="true"]'],
  coverSelectors: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: ['input[placeholder*="标签"]'],
  publishSelectors: ['button:has-text("群发")', 'button:has-text("发表")'],
  publishTexts: ['群发', '发表', '保存并群发'],
  dialogTexts: ['确定', '继续', '原创声明', '群发'],
  async afterFill(page, log) {
    // 公众号正文在 #ueditor_0 iframe 内，标题在主文档；两次填充分别校验
    const hit = await base.findInFrames(page, this.contentSelectors, null);
    log(hit ? '公众号 UEditor iframe 正文已定位（' + hit.selector + '）' : '公众号正文未定位，可能需手动确认');
  },
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log) { return base.defaultPreflight(page, this, log); }
};
