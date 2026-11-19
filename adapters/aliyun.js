'use strict';
const base = require('./base');
 
 const CFG = base.loadPlatformConfig('aliyun');

// 阿里云开发者社区：优先 data-testid 定位；平台未提供时回退“稳定层级 + 文本内容”。
// 登录检测按“标题输入框或发表按钮出现”判断，不按登录弹窗消失判断。
module.exports = {
  id: 'aliyun', name: '阿里云开发者社区', hostText: 'developer.aliyun.com',
  editorKernel: 'richtext-unknown',
  titleSelectors: CFG.titleSelectors || ['input[data-testid="title-input"]', 'input[placeholder*="标题"]', 'input[name="title"]', 'textarea[placeholder*="标题"]'],
  contentSelectors: CFG.contentSelectors || ['[data-testid="content-editor"]', '[contenteditable="true"]', '.ProseMirror', '.ql-editor', '.CodeMirror', 'textarea'],
  coverSelectors: CFG.coverSelectors || ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: CFG.tagSelectors || ['input[placeholder*="标签"]', 'input[placeholder*="添加标签"]'],
  publishSelectors: CFG.publishSelectors || ['button:has-text("提交")', 'button:has-text("发布")'],
  publishTexts: CFG.publishTexts || ['发布', '提交'],
  dialogTexts: CFG.dialogTexts || ['确定', '继续发布'],
  preferDataTestid: CFG.preferDataTestid !== undefined ? CFG.preferDataTestid : true,

  async fillTitle(page, text, log) {
    // data-testid 优先，其次按“标题”label 对应的 input 层级回退
    for (const s of this.titleSelectors) {
      const loc = page.locator(s).first();
      if (await loc.count().catch(() => 0)) {
        log('已定位标题框：' + s);
        return base.replaceText(page, loc, text, log);
      }
    }
    // 回退：找包含“标题”文本的 label，取其关联的 input
    try {
      const ok = await page.evaluate((t) => {
        const label = [...document.querySelectorAll('label')].find(l => /标题/.test(l.innerText || ''));
        if (!label) return false;
        const id = label.getAttribute('for');
        if (id) { const el = document.getElementById(id); if (el) { el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); return true; } }
        const inp = label.querySelector('input') || label.parentElement.querySelector('input');
        if (inp) { inp.value = t; inp.dispatchEvent(new Event('input', { bubbles: true })); return true; }
        return false;
      }, text);
      if (ok) { log('按标题 label 层级回退定位标题成功'); return true; }
    } catch { /* 忽略 */ }
    log('阿里云标题框未找到'); return false;
  },

  async fillContent(page, ctx, log) {
    const ok = await this._fillBody(page, ctx, log);
    if (ok) await base.fixImageLinks(page);
    return ok;
  },
  async _fillBody(page, ctx, log) {
    // data-testid 优先，其次 contenteditable / ProseMirror 等通用
    for (const s of this.contentSelectors) {
      const loc = page.locator(s).first();
      if (await loc.count().catch(() => 0)) {
        log('已定位正文区：' + s);
        const ok = await base.replaceText(page, loc, ctx.html, log);
        if (ok) return true;
      }
    }
    log('阿里云正文注入失败'); return false;
  },

  async afterFill(page, log) { log('阿里云标题/正文填充完成'); },
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log, ctx) { return base.defaultPreflight(page, this, log, ctx); }
};
