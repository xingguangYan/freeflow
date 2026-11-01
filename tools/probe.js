'use strict';
// 调试工具：打开某个账号的编辑器页面，打印可用的输入框/编辑区/发布按钮。
// 用法: node tools/probe.js <profileDir> <url>
const { chromium } = require('playwright');

(async () => {
  const [profile, url] = process.argv.slice(2);
  if (!profile || !url) { console.error('usage: node tools/probe.js <profileDir> <url>'); process.exit(1); }
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false, channel: 'chrome', viewport: { width: 1400, height: 900 },
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => console.log('GOTO_ERR', e.message.split('\n')[0]));
  await page.waitForTimeout(8000);
  const info = await page.evaluate(() => {
    const vis = el => {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const desc = el => ({
      tag: el.tagName.toLowerCase(), type: el.type || '', name: el.name || '', id: el.id || '',
      cls: String(el.className || '').slice(0, 120), ph: el.getAttribute('placeholder') || '',
      aria: el.getAttribute('aria-label') || '', ce: el.getAttribute('contenteditable') || '',
      visible: vis(el), text: (el.innerText || '').slice(0, 60)
    });
    return {
      url: location.href, title: document.title,
      iframes: [...document.querySelectorAll('iframe')].map(f => ({ src: f.src, id: f.id, cls: f.className })),
      inputs: [...document.querySelectorAll('input,textarea')].filter(vis).map(desc),
      editables: [...document.querySelectorAll('[contenteditable="true"],[contenteditable=""],.ProseMirror,.ql-editor,.CodeMirror,.bytemd')].filter(vis).map(desc),
      buttons: [...document.querySelectorAll('button,.btn,[role="button"],a')].filter(vis).map(desc)
        .filter(x => /发布|发表|提交|保存|上传|Publish|Send|Post/i.test(x.text)).slice(0, 25)
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await ctx.close().catch(() => {});
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
