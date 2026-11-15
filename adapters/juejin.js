'use strict';
const base = require('./base');
module.exports = {
  id: 'juejin', name: '掘金', hostText: 'juejin.cn',
  titleSelectors: ['input.title-input', 'input[placeholder*="文章标题"]', 'input[placeholder*="标题"]', 'textarea[placeholder*="标题"]'],
  contentSelectors: ['.CodeMirror textarea', '.CodeMirror-code', '.CodeMirror', '.cm-content', '.bytemd-body'],
  coverSelectors: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: ['input[placeholder*="标签"]', '.tag-input input', 'input[placeholder*="添加标签"]'],
  publishSelectors: ['button:has-text("发布文章")'],
  publishTexts: ['发布', '发布文章'],
  dialogTexts: ['确定', '继续发布', '发布'],
  async fillContent(page, ctx, log) {
    // 掘金 ByteMD 底层是 CodeMirror5 + Markdown：必须写入 Markdown 源码，不能粘贴 HTML
    for (const s of ['.CodeMirror textarea', '.CodeMirror-code', '.CodeMirror']) {
      const loc = page.locator(s).first();
      if (!(await loc.count().catch(() => 0))) continue;
      const ok = await base.replaceText(page, loc, ctx.md, log);
      if (ok) { log('掘金 Markdown 注入成功（' + s + '）'); return true; }
    }
    log('掘金 CodeMirror 注入失败');
    return false;
  },
  async afterFill(page, log) { log('掘金标题/ByteMD Markdown 填充完成'); },
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log, ctx) { return base.defaultPreflight(page, this, log, ctx); }
};
