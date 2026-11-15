'use strict';
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8918/', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  let pass = true;
  const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : ' -> ' + detail)); if (!ok) pass = false; };

  check('article tabs exist', await page.locator('#artTabs button').count() === 3);
  check('publish tabs exist', await page.locator('#pubTabs button').count() === 3);
  check('account tabs exist', await page.locator('#accTabs button').count() === 3);

  // 视频 Tab 新建 -> 类型必须是 video
  await page.click('#artTabs button[data-ct="video"]');
  await page.waitForTimeout(300);
  await page.click('#btnNewArticle');
  await page.waitForTimeout(600);
  const id = await page.evaluate(() => S.current.id);
  const type = await page.evaluate(() => S.current.type);
  check('new article uses video tab type', type === 'video', type);
  const listTypes = await page.evaluate(() => [...document.querySelectorAll('#articleList li')].length);
  check('article list filtered (>=1 video item)', listTypes >= 1, String(listTypes));

  // 账号 Tab -> 视频平台过滤（开发库只有 CSDN 图文账号 -> 空）
  await page.click('[data-view="accounts"]');
  await page.waitForTimeout(300);
  await page.click('#accTabs button[data-ct="video"]');
  await page.waitForTimeout(300);
  const accEmpty = await page.locator('#accountGrid .empty').count();
  check('accounts filtered by video capability', accEmpty >= 1 || (await page.locator('#accountGrid .acc-card').count()) === 0);

  // 发布 Tab -> 内容下拉只含 video
  await page.click('[data-view="publish"]');
  await page.waitForTimeout(400);
  await page.click('#pubTabs button[data-ct="video"]');
  await page.waitForTimeout(300);
  const selText = await page.locator('#pubArticle').innerText().catch(() => '');
  check('publish dropdown filtered to video', /视频|没有内容/.test(selText), selText);

  await page.evaluate(async (i) => { await fetch('/api/articles/' + i, { method: 'DELETE' }); }, id);
  console.log('page errors:', errors.length ? errors.join('; ') : '(none)');
  if (errors.length) pass = false;
  console.log(pass ? 'TABS_PASS' : 'TABS_FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
