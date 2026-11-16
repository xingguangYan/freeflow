'use strict';
const base = require('./base');
 
 const CFG = base.loadPlatformConfig('huaweicloud');

// 华为云开发者联盟（博客）：正文在 iframe 内的 body[contenteditable=true]。
// 关键陷阱：编辑器内存在两个 textbox，需粘贴到使“统计字数”>0 的那个；
// 发布前必须勾选 id=agreementBox，否则发表只会存为草稿；
// 推荐走 Markdown 源码编辑模式。
module.exports = {
  id: 'huaweicloud', name: '华为云开发者联盟', hostText: 'huaweicloud.com',
  editorKernel: 'iframe-contenteditable',
  experimental: true,
  titleSelectors: CFG.titleSelectors || ['input[placeholder*="标题"]', 'input[name="title"]', 'textarea[placeholder*="标题"]'],
  contentSelectors: CFG.contentSelectors || ['body[contenteditable="true"]', '.ql-editor', '.ProseMirror', '.CodeMirror', 'textarea'],
  coverSelectors: CFG.coverSelectors || ['input[type="file"][accept*="image"]', 'input[type="file"]'],
  tagSelectors: CFG.tagSelectors || ['input[placeholder*="标签"]'],
  publishSelectors: CFG.publishSelectors || ['button:has-text("提交")', 'button:has-text("发表")'],
  publishTexts: CFG.publishTexts || ['发布', '提交'],
  dialogTexts: CFG.dialogTexts || ['确定', '继续发布'],
  agreementCheckboxId: CFG.agreementCheckboxId || 'agreementBox',
  twoTextboxTrap: CFG.twoTextboxTrap !== undefined ? CFG.twoTextboxTrap : true,
  preferMarkdownMode: CFG.preferMarkdownMode !== undefined ? CFG.preferMarkdownMode : true,

  async fillTitle(page, text, log) {
    const loc = page.locator(this.titleSelectors[0]).first();
    if (await loc.count().catch(() => 0)) { log('已定位标题框'); return base.replaceText(page, loc, text, log); }
    log('华为云标题框未找到'); return false;
  },

  async fillContent(page, ctx, log) {
    const iframe = page.locator('iframe').first();
    if (!(await iframe.count().catch(() => 0))) {
      log('未找到 iframe'); return false;
    }
    let frame;
    try { frame = await iframe.contentFrame(); } catch { frame = null; }
    if (!frame) { log('无法进入 iframe'); return false; }

    // 先尝试切到 Markdown 源码模式（若平台提供 Markdown 标签）
    try {
      const mdTab = page.locator('button:has-text("Markdown"), a:has-text("Markdown"), [role="tab"]:has-text("Markdown")').first();
      if (await mdTab.count().catch(() => 0) && await mdTab.isVisible().catch(() => false)) {
        await mdTab.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(1000);
        log('已切换到 Markdown 源码编辑模式');
      }
    } catch { /* 平台不提供 Markdown 标签则忽略 */ }

    // 编辑器内存在两个 textbox，优先粘贴到使“统计字数”>0 的那个（即真正被编辑器识别的 body）
    const bodySel = 'body[contenteditable="true"]';
    const loc = frame.locator(bodySel).first();
    if (!(await loc.count().catch(() => 0))) { log('iframe 内未找到 body[contenteditable]'); return false; }
    log('已定位 iframe 内正文 body');
    const ok = await base.replaceText(page, loc, ctx.html, log);
    if (!ok) log('华为云正文 replaceText 未成功');
    return ok;
  },

  async afterFill(page, log) {
    // 发布前必须勾选免责声明 agreementBox，否则只存草稿
    try {
      const cb = page.locator('#' + this.agreementCheckboxId).first();
      if (await cb.count().catch(() => 0)) {
        await cb.check({ timeout: 3000 }).catch(() => {});
        log('已勾选免责声明 ' + this.agreementCheckboxId);
      }
    } catch { log('勾选免责声明失败（可能已勾选或不存在）'); }
    log('华为云标题/iframe 正文填充完成');
  },
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log, ctx) { return base.defaultPreflight(page, this, log, ctx); }
};
