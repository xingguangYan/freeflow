'use strict';
// 模拟 runner 的完整填充+找发布按钮流程。用法: node tools/runnertest.js <profileDir> <platformId> <url>
const { chromium } = require('playwright');
const auto = require('../automation');
const platforms = require('../platforms');

(async () => {
  const [profile, platformId, url] = process.argv.slice(2);
  const P = platforms.find(x => x.id === platformId);
  const arts = await (await fetch('http://127.0.0.1:8917/api/articles')).json();
  const art = arts.find(a => a.id === 'art_mvxlblxyta1edi');
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false, channel: 'chrome', viewport: { width: 1280, height: 880 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
    permissions: ['clipboard-read', 'clipboard-write'], args: ['--disable-blink-features=AutomationControlled']
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  console.log('ready', JSON.stringify(await auto.waitForEditor(page, P, 25000)));
  await page.waitForTimeout(5000);
  console.log('fill', await auto.fillTitle(page, P, art.title), await auto.fillContent(page, P, auto.inlineLocalImages(art.content)));
  await page.waitForTimeout(1500);
  const dbg = await page.evaluate(() => ({
    titles: [...document.querySelectorAll('textarea,input')].map(e => ({ ph: e.placeholder || '', v: e.value })).filter(x => x.v),
    btns: [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean),
    body: ((document.querySelector('.ProseMirror') || {}).innerText || '').slice(0, 40)
  }));
  console.log('DEBUG', JSON.stringify(dbg).slice(0, 900));
  const s = {
    roleExact: await page.getByRole('button', { name: '预览并发布', exact: true }).count(),
    rolePartial: await page.getByRole('button', { name: /预览并发布/ }).count(),
    hasText: await page.locator('button', { hasText: '预览并发布' }).count(),
    getText: await page.getByText('预览并发布', { exact: true }).count()
  };
  console.log('LOCATORS', JSON.stringify(s));
  const rb = page.getByRole('button', { name: '预览并发布', exact: true }).first();
  console.log('VISIBLE', await rb.isVisible().catch(e => 'ERR:' + e.message), 'BOX', JSON.stringify(await rb.boundingBox().catch(() => null)));
  try { await rb.click({ timeout: 5000 }); console.log('DIRECT CLICK OK'); } catch (e) { console.log('DIRECT CLICK ERR', e.message.split('\n')[0]); }
  console.log('HTML', (await page.locator('button', { hasText: '预览并发布' }).first().evaluate(e => e.outerHTML).catch(() => 'none')).slice(0, 300));
  const count = await page.locator('button:text-is("预览并发布")').count();
  console.log('button count before retry', count);
  console.log('clickPublishRetry ->', await auto.clickPublishRetry(page, 15000));
  await ctx.close().catch(() => {});
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
