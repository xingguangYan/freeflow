'use strict';
// 调试：填充后测试发布按钮识别。用法: node tools/clicktest.js <profileDir> <platformId> <url>
const { chromium } = require('playwright');
const auto = require('../automation');
const platforms = require('../platforms');

(async () => {
  const [profile, platformId, url] = process.argv.slice(2);
  const P = platforms.find(x => x.id === platformId);
  const arts = await (await fetch('http://127.0.0.1:8917/api/articles')).json();
  const art = arts.find(a => a.id === 'art_mvxlblxyta1edi');
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false, channel: 'chrome', viewport: { width: 1400, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'], args: ['--disable-blink-features=AutomationControlled']
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(6000);
  await auto.fillTitle(page, P, art.title);
  await auto.fillContent(page, P, art.content);
  await page.waitForTimeout(2000);
  console.log('clickPublish ->', await auto.clickPublish(page));
  console.log('exact ->', await page.locator('button:text-is("预览并发布")').count());
  await ctx.close().catch(() => {});
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
