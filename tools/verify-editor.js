const { chromium } = require('playwright');
const PORT = process.env.FF_PORT || 8918;
(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('http://127.0.0.1:' + PORT + '', { waitUntil: 'load' });
  // 清掉历史残留，保证测试干净
  for (const x of (await page.evaluate(() => fetch('/api/articles').then(r => r.json())))) await page.evaluate(id => fetch('/api/articles/' + id, { method: 'DELETE' }), x.id);
  for (const x of (await page.evaluate(() => fetch('/api/accounts').then(r => r.json())))) await page.evaluate(id => fetch('/api/accounts/' + id, { method: 'DELETE' }), x.id);
  for (const x of (await page.evaluate(() => fetch('/api/materials').then(r => r.json())))) await page.evaluate(id => fetch('/api/materials/' + id, { method: 'DELETE' }), x.id);
  await page.waitForTimeout(700);

  // ---- 1. 无选中文章直接写内容保存 ----
  await page.click('#btnNewArticle');
  await page.waitForTimeout(300);
  await page.fill('#artTitle', '直接保存测试');
  await page.click('#artContent');
  await page.keyboard.type('这是不新建文章直接写的正文。');
  await page.waitForTimeout(300);
  await page.click('#btnSaveArticle');
  await page.waitForTimeout(500);
  let listText = await page.$eval('#articleList', el => el.innerText);
  console.log('1. save-without-select list contains:', listText.includes('直接保存测试') ? 'OK' : 'FAIL');
  const persisted = await page.evaluate(() => fetch('/api/articles').then(r => r.json()));
  console.log('1. persisted:', persisted.some(a => a.title === '直接保存测试') ? 'OK' : 'FAIL');

  // 2. 空内容保存提示
  const arts0 = await page.evaluate(() => fetch('/api/articles').then(r => r.json()));
  for (const a of arts0) await page.evaluate(x => fetch('/api/articles/' + x, { method: 'DELETE' }), a.id);
  await page.reload();
  await page.waitForTimeout(700);
  await page.fill('#artTitle', '');
  await page.click('#btnSaveArticle');
  await page.waitForTimeout(300);
  let toastText = await page.$eval('#toasts', el => el.innerText.trim());
  console.log('2. empty-save toast:', toastText.length > 0 ? 'OK (' + toastText.split('\n')[0].slice(0, 30) + ')' : 'FAIL');

  // ---- 3. 封面缩略图 ----
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const mat = await page.evaluate(b => fetch('/api/materials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'tiny.png', base64: ('data:' + 'image' + '/png;base64,' + b) }) }).then(r => r.json()), png);
  console.log('3. material uploaded:', mat && mat.id ? 'OK' : 'FAIL ' + JSON.stringify(mat).slice(0, 80));
  await page.reload();
  await page.waitForTimeout(700);
  await page.click('#btnNewArticle');
  await page.waitForTimeout(300);
  await page.fill('#artTitle', '封面测试');
  await page.click('#btnSaveArticle');
  await page.waitForTimeout(300);
  await page.selectOption('#artCover', mat.id);
  await page.waitForTimeout(300);
  const thumb = await page.$eval('#coverThumb img', el => ({ h: Math.round(el.getBoundingClientRect().height), w: Math.round(el.getBoundingClientRect().width) }));
  console.log('3. cover thumb size:', thumb.h >= 60 && thumb.w >= 90 ? 'OK' : 'FAIL', JSON.stringify(thumb));

  // ---- 4. 发布前预览 + 全选 ----
  const acc1 = await page.evaluate(() => fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platformId: 'csdn', name: '测试A' }) }).then(r => r.json()));
  const acc2 = await page.evaluate(() => fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platformId: 'jianshu', name: '测试B' }) }).then(r => r.json()));
  await page.reload();
  await page.waitForTimeout(800);
await page.click('.nav-item[data-view="publish"]');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const sel = document.querySelector('#pubArticle');
    const o = [...sel.options].find(o => o.text.includes('封面测试'));
    if (o) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(300);
  // 全选
  await page.click('#btnPubAll');
  await page.waitForTimeout(200);
  const checked = await page.$$eval('#pubAccounts input[type="checkbox"]', es => ({ total: es.length, on: es.filter(e => e.checked).length }));
  const btnLabel = await page.$eval('#btnPubAll', el => el.textContent);
  console.log('4. select-all:', checked.total > 0 && checked.on === checked.total ? 'OK' : 'FAIL', JSON.stringify(checked), '| btn:', btnLabel);
  await page.click('#btnPubAll');
  await page.waitForTimeout(200);
  const afterClear = await page.$$eval('#pubAccounts input[type="checkbox"]', es => es.filter(e => e.checked).length);
  console.log('4. clear-all:', afterClear === 0 ? 'OK' : 'FAIL (' + afterClear + ')');
  // 预览
  await page.click('#btnPubAll');
  await page.waitForTimeout(150);
  await page.click('#btnPublish');
  await page.waitForTimeout(300);
  const modalVisible = await page.$eval('#previewModal', el => getComputedStyle(el).display === 'flex');
  const pvTitle = await page.$eval('#previewBody', el => el.innerText.slice(0, 12));
  const targets = await page.$eval('#previewTargets', el => el.textContent.trim());
  console.log('4. preview modal:', modalVisible ? 'OK' : 'FAIL', '| title:', pvTitle);
  console.log('4. preview targets:', targets.slice(0, 60));
  await page.click('#previewCancel');
  await page.waitForTimeout(150);
  const closed = await page.$eval('#previewModal', el => getComputedStyle(el).display === 'none');
  console.log('4. cancel closes:', closed ? 'OK' : 'FAIL');
  await page.route('**/api/tasks', r => r.abort());
  page.on('dialog', d => d.accept());
  await page.click('#btnPublish');
  await page.waitForTimeout(300);
  await page.click('#previewConfirm');
  await page.waitForTimeout(300);
  await page.unroute('**/api/tasks');
  const tasks = await page.evaluate(() => fetch('/api/tasks').then(r => r.json()));
  console.log('4. blocked task creation leaves no task:', tasks.length === 0 ? 'OK' : 'FAIL (' + tasks.length + ')');


  // 清理
  for (const id of [acc1.id, acc2.id]) await page.evaluate(x => fetch('/api/accounts/' + x, { method: 'DELETE' }), id);
  const arts2 = await page.evaluate(() => fetch('/api/articles').then(r => r.json()));
  for (const a of arts2) await page.evaluate(x => fetch('/api/articles/' + x, { method: 'DELETE' }), a.id);
  const mats = await page.evaluate(() => fetch('/api/materials').then(r => r.json()));
  for (const m of mats) await page.evaluate(x => fetch('/api/materials/' + x, { method: 'DELETE' }), m.id);

  console.log('JS errors:', errors.length ? errors.join(' ;; ').slice(0, 300) : 'NONE');
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
