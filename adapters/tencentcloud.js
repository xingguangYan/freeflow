'use strict';
const base = require('./base');
const fs = require('fs');
const path = require('path');
 
 const CFG = base.loadPlatformConfig('tencentcloud');

// 腾讯云开发者社区：编辑器内核是 Monaco / CodeMirror 6，正文区为 div.cm-content（不是 textarea）。
// element.value 对 Monaco 无效，必须走 CDP 剪贴板真实粘贴（写入 text/html 后 Ctrl+V）。
// EdgeOne 反爬：禁止直接 requests 调 API，必须走真实浏览器上下文。
module.exports = {
  id: 'tencentcloud', name: '腾讯云开发者社区', hostText: 'cloud.tencent.com',
  editorKernel: 'monaco-codemirror6',
  titleSelectors: CFG.titleSelectors || ['textarea[placeholder="请输入标题"]', 'textarea[placeholder*="标题"]', 'input[name="title"]'],
  contentSelectors: CFG.contentSelectors || ['div.cm-content', '.cm-editor .cm-content', '.CodeMirror-code', '[contenteditable="true"]'],
  coverSelectors: CFG.coverSelectors || ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: CFG.tagSelectors || ['input[placeholder*="标签"]', 'input[placeholder*="添加标签"]'],
  publishSelectors: CFG.publishSelectors || ['button:has-text("提交")'],
  publishTexts: CFG.publishTexts || ['发布', '提交'],
  dialogTexts: CFG.dialogTexts || ['确定', '继续发布'],
  loginSuccessSelectors: CFG.loginSuccessSelectors || ['textarea[placeholder="请输入标题"]', 'button:has-text("写博客")', 'button:has-text("发表")'],
  noDirectApi: true,

  async fillTitle(page, text, log) {
    const sel = 'textarea[placeholder="请输入标题"]';
    const loc = page.locator(sel).first();
    if (!(await loc.count().catch(() => 0))) {
      // 降级：通用标题选择器
      for (const s of this.titleSelectors.slice(1)) {
        const alt = page.locator(s).first();
        if (await alt.count().catch(() => 0)) { return base.replaceText(page, alt, text, log); }
      }
      log('腾讯云标题框未找到'); return false;
    }
    log('已定位标题框：' + sel);
    return base.replaceText(page, loc, text, log);
  },

  async fillContent(page, ctx, log) {
    // Monaco / CodeMirror6：必须用 CDP 剪贴板粘贴，不能用 element.value
    const contentSel = 'div.cm-content';
    const loc = page.locator(contentSel).first();
    if (await loc.count().catch(() => 0)) {
      log('已定位 Monaco 正文区：' + contentSel);
      const ok = await base.pasteClipboardHtml(page, loc, ctx.html, ctx.probe, log);
      if (ok) return true;
      log('CDP 剪贴板粘贴失败，尝试 replaceText 降级');
      const ok2 = await base.replaceText(page, loc, ctx.html, log);
      if (ok2) return true;
    }
    // 降级：通用 contenteditable / textarea
    for (const s of this.contentSelectors.slice(2)) {
      const alt = page.locator(s).first();
      if (await alt.count().catch(() => 0)) {
        log('降级使用选择器：' + s);
        const ok = await base.replaceText(page, alt, ctx.md || ctx.html, log);
        if (ok) return true;
      }
    }
    log('腾讯云正文注入失败'); return false;
  },

  async afterFill(page, log) { log('腾讯云标题/Monaco 正文填充完成（CDP 剪贴板模式）'); },
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log, ctx) { return base.defaultPreflight(page, this, log, ctx); }
};
