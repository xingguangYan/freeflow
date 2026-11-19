'use strict';
const base = require('./base');
 
 const CFG = base.loadPlatformConfig('c51cto');

// 51CTO 博客：标题有稳定 id="title"；正文是普通 textarea（placeholder“请输入正文”），可直接 set_value。
// 带图片内容后会触发草稿保存与图片解析，需等“草稿已保存”或发布按钮可点再发布；
// 发表按钮用 pointer-events 模拟点击，避免直接 .click() 被拦截。
module.exports = {
  id: 'c51cto', name: '51CTO博客', hostText: '51cto.com',
  editorKernel: 'plain-textarea',
  titleSelectors: CFG.titleSelectors || ['#title', 'input[placeholder*="标题"]', 'textarea[placeholder*="标题"]', 'input[name="title"]'],
  contentSelectors: CFG.contentSelectors || ['textarea[placeholder="请输入正文"]', 'textarea[placeholder*="正文"]', 'textarea[placeholder*="内容"]', 'textarea'],
  coverSelectors: CFG.coverSelectors || ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: CFG.tagSelectors || ['input[placeholder*="标签"]', 'input[placeholder*="添加标签"]'],
  publishSelectors: CFG.publishSelectors || ['button:has-text("发表")'],
  publishTexts: CFG.publishTexts || ['发布', '发表'],
  dialogTexts: CFG.dialogTexts || ['确定', '继续发布'],
  draftSavedSignal: CFG.draftSavedSignal || '草稿已保存',
  publishClickMethod: CFG.publishClickMethod || 'pointer-events',

  async fillTitle(page, text, log) {
    // id="title" 优先，最稳定
    const loc = page.locator('#title').first();
    if (await loc.count().catch(() => 0)) {
      log('已定位标题框 #title');
      return base.replaceText(page, loc, text, log);
    }
    log('51CTO 标题框 #title 未找到'); return false;
  },

  async fillContent(page, ctx, log) {
    const ok = await this._fillBody(page, ctx, log);
    if (ok) await base.fixImageLinks(page);
    return ok;
  },
  async _fillBody(page, ctx, log) {
    const loc = page.locator('textarea[placeholder="请输入正文"]').first();
    let ok = false;
    if (await loc.count().catch(() => 0)) {
      log('已定位正文 textarea');
      ok = await base.replaceText(page, loc, ctx.md || ctx.html, log);
    }
    if (!ok) {
      // 降级：通用 textarea（排除标题）
      for (const s of ['textarea[placeholder*="正文"]', 'textarea[placeholder*="内容"]', 'textarea']) {
        const alt = page.locator(s).first();
        if (await alt.count().catch(() => 0)) {
          log('降级使用正文选择器：' + s);
          ok = await base.replaceText(page, alt, ctx.md || ctx.html, log);
          if (ok) break;
        }
      }
    }
    if (!ok) log('51CTO 正文注入失败');
    return ok;
  },

  async afterFill(page, log) { log('51CTO 标题/正文填充完成'); },
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log, ctx) { return base.defaultPreflight(page, this, log, ctx); }
};
