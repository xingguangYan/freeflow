'use strict';
// 调试工具：打开编辑器，等待就绪后试用自动填充，并回读结果。不会点发布。
// 用法: node tools/filltest.js <profileDir> <platformId> <url>
const { chromium } = require('playwright');
const auto = require('../automation');
const platforms = require('../platforms');

(async () => {
  const [profile, platformId, url] = process.argv.slice(2);
  const p = platforms.find(x => x.id === platformId);
  if (!p) { console.error('unknown platform', platformId); process.exit(1); }
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false, channel: 'chrome', viewport: { width: 1400, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => console.log('GOTO_ERR', e.message.split('\n')[0]));
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const t = await auto.pickVisible(page, [...(p.titleSelectors || []), ...auto.GENERIC_TITLE]);
    const c = await auto.pickVisible(page, [...(p.contentSelectors || []), ...auto.GENERIC_CONTENT]);
    if (t || c) { ready = true; break; }
    await page.waitForTimeout(1000);
  }
  console.log('editor ready:', ready, 'url:', page.url());
  const ft = await auto.fillTitle(page, p, '自动化验证标题');
  const fc = await auto.fillContent(page, p, '<p>第一段测试内容</p><h2>小标题</h2><p>第二段测试内容</p>');
  console.log('fillTitle=', ft, 'fillContent=', fc);
  await page.waitForTimeout(1500);
  const dump = await page.evaluate(() => ({
    values: [...document.querySelectorAll('input,textarea')].filter(e => e.offsetParent).map(e => e.value).slice(0, 4),
    bodies: [...document.querySelectorAll('.ProseMirror,[contenteditable="true"]')].map(e => e.innerText.slice(0, 160))
  }));
  console.log(JSON.stringify(dump, null, 2));
  await ctx.close().catch(() => {});
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
