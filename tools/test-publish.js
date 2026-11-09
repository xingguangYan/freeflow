// 复现「不选择定时时一键发布报错」，抓 toast 与任务状态。
// 用法：FREEFLOW_PORT=8919 node tools/test-publish.js
'use strict';
const { chromium } = require('playwright');
const PORT = process.env.FF_PORT || 8919;
const API = 'http://127.0.0.1:' + PORT;

(async () => {
  // 干净起点
  for (const x of (await (await fetch(API + '/api/articles')).json())) await fetch(API + '/api/articles/' + x.id, { method: 'DELETE' });
  for (const x of (await (await fetch(API + '/api/tasks')).json())) await fetch(API + '/api/tasks/' + x.id, { method: 'DELETE' });
  let accs = await (await fetch(API + '/api/accounts')).json();
  if (!accs.length) {
    await fetch(API + '/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platformId: 'csdn', name: '发布测试号' }) });
    accs = await (await fetch(API + '/api/accounts')).json();
  }
  await fetch(API + '/api/articles', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '发布流程测试', content: '<p>测试正文内容。</p>', mode: 'richtext', type: 'article' })
  });
  const arts = await (await fetch(API + '/api/articles')).json();
  const acc = accs.find(a => a.platformId === 'csdn') || accs[0];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.accept(); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(API, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  // 到一键分发
  await page.click('[data-view="publish"]');
  await page.waitForTimeout(400);
  // 选文章与账号（用 select/checkbox）
  await page.selectOption('#pubArticle', arts[0].id).catch(() => {});
  await page.waitForTimeout(200);
  const boxes = await page.$$('#pubAccounts input[type="checkbox"]');
  for (const b of boxes) await b.check();
  // 不选定时，直接开始分发
  await page.click('#btnPublish');
  await page.waitForTimeout(600);
  // 预览弹窗里点确认（原生 confirm 会被上面 accept）
  if (await page.locator('#previewModal').isVisible().catch(() => false)) {
    await page.click('#previewConfirm').catch(() => {});
  }
  await page.waitForTimeout(2000);
  const toastText = await page.$eval('#toasts', el => el.innerText).catch(() => '');
  console.log('toasts:', JSON.stringify(toastText));
  const tasks = await (await fetch(API + '/api/tasks')).json();
  console.log('tasks:', JSON.stringify(tasks.map(t => ({ status: t.status, results: t.results })), null, 1).slice(0, 500));
  console.log('page/dialog errors:', errors.length ? errors.join('\n') : '无');
  await browser.close();
})().catch(e => { console.error('异常:', e); process.exit(1); });
