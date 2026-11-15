'use strict';
const base = require('./base');
module.exports = {
  id: 'csdn', name: 'CSDN', hostText: 'mp.csdn.net',
  titleSelectors: ['textarea#txtTitle', 'input[placeholder*="文章标题"]', 'div[data-testid="news-title-input"] [contenteditable="true"]'],
  contentSelectors: ['iframe.cke_wysiwyg_frame', 'body.cke_editable', 'body[contenteditable="true"]', '.editor-content', '[contenteditable="true"]'],
  coverSelectors: ['input[type="file"][accept*="image"]', '.cover-upload input[type="file"]', 'input[type="file"]'],
  tagSelectors: ['input[placeholder*="标签"]', '.mark_selection_tag input', '.tag-input input'],
  publishSelectors: ['button:has-text("发布文章")'],
  publishTexts: ['发布文章', '发布'],
  dialogTexts: ['确定', '我知道了', '继续发布'],

  async fillTags(page, tags, log) {
    try {
      for (const s of ['button:has-text("添加文章标签")', ':text("添加文章标签")', '[class*="tag"]:has-text("添加")']) {
        const op = page.locator(s).first();
        if (await op.count().catch(() => 0)) { await op.click({ timeout: 3000 }).catch(() => {}); break; }
      }
      await page.waitForTimeout(700);
      let input = page.locator('input[placeholder*="标签"]:visible, input[placeholder*="搜索"]:visible').first();
      if (!(await input.count().catch(() => 0))) input = page.locator('input[placeholder*="标签"], input[placeholder*="搜索"]').first();
      if (!(await input.count().catch(() => 0))) { log('CSDN 标签输入框未出现'); return false; }
      const list = String(tags).split(/[,，]/).map(x => x.trim()).filter(Boolean);
      for (const t of list) {
        await input.click({ timeout: 3000 }).catch(() => {});
        await input.fill(t).catch(() => {});
        await page.keyboard.press('Enter').catch(() => {});
        await page.waitForTimeout(500);
      }
      const val = await input.inputValue().catch(() => '');
      log('CSDN 标签已添加：' + list.join(' / ') + (val ? '（输入框仍有内容）' : ''));
      return list.length > 0;
    } catch { return false; }
  },
  async fillContent(page, ctx, log) {
    const ok = await base.fillIframeEditor(page, 'iframe.cke_wysiwyg_frame', ['body.cke_editable', 'body[contenteditable="true"]'], ctx.html, log);
    if (!ok) log('CSDN CKEditor iframe 注入失败，将回退通用逻辑');
    return ok;
  },
  async afterFill(page, log) { log('CSDN 标题/CKEditor 正文注入完成'); },
  async handleDialogs(page, log) { await base.clickByTexts(page, this.dialogTexts, log); },
  async preflight(page, log, ctx) { return base.defaultPreflight(page, this, log, ctx); }
};
