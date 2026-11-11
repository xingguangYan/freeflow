'use strict';
// 编辑器基础交互回归：空格不乱复制、撤销/重做正常、跨文章历史隔离、撤销后光标位置正确
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8918/';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const created = [];
  let pass = true;
  const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  -> ' + detail)); if (!ok) pass = false; };

  try {
    // 1) 空格输入不复制上一行
    await page.click('#btnNewArticle');
    await page.waitForTimeout(500);
    created.push(await page.evaluate(() => S.current.id));
    const ed = page.locator('#artContent');
    await ed.click();
    await page.keyboard.type('first line');
    await page.keyboard.press('Enter');
    await page.keyboard.type('second line');
    await page.keyboard.press('Space');
    await page.keyboard.type('tail');
    await page.waitForTimeout(900);
    let text = await ed.innerText();
    check('空格正常输入且不复制上一行', text === 'first line\nsecond line tail', JSON.stringify(text));
    check('内容中没有重复的第一行', (text.match(/first line/g) || []).length === 1, JSON.stringify(text));

    // 2) 撤销/重做
    await page.keyboard.type(' MORE');
    await page.waitForTimeout(900);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    text = await ed.innerText();
    check('Ctrl+Z 撤销最近的输入', !/ MORE/.test(text) && text.includes('second line tail'), JSON.stringify(text));
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(300);
    text = await ed.innerText();
    check('Ctrl+Y 重做', / MORE/.test(text), JSON.stringify(text));

    // 3) 跨文章历史隔离：B 里撤销绝不能出现 A 的内容
    await page.click('#btnNewArticle');
    await page.waitForTimeout(600);
    created.push(await page.evaluate(() => S.current.id));
    await page.locator('#artContent').click();
    await page.keyboard.type('B only content');
    await page.waitForTimeout(900);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    text = await page.locator('#artContent').innerText();
    check('切换文章后撤销不串入上一篇内容', !/first line|second line/.test(text), JSON.stringify(text));

    // 4) 撤销后光标仍在末尾：敲空格 + X 不跑到行首、不复制内容
    await page.locator('#artContent').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('after undo');
    await page.waitForTimeout(300);
    text = await page.locator('#artContent').innerText();
    check('撤销后继续输入位置正确', text === 'after undo' || /^B only content\safter undo$/.test(text), JSON.stringify(text));

    // 5) 快速连续保存：以最后一次输入为准
    await page.locator('#artTitle').fill('保存竞态测试');
    await page.locator('#artContent').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' final');
    await page.click('#btnSaveArticle');
    await page.waitForTimeout(120);
    await page.click('#btnSaveArticle');
    await page.waitForTimeout(1500);
    const saved = await page.evaluate(async (id) => (await (await fetch('/api/articles')).json()).find(a => a.id === id), created[1]);
    check('连续保存不覆盖最新内容', !!saved && /final/.test(saved.title || '') === false && /final/.test((saved.content || '').replace(/<[^>]+>/g, ' ')), JSON.stringify(saved && { title: saved.title, content: (saved.content || '').slice(-60) }));
  } finally {
    for (const id of created) await page.evaluate(async (i) => { await fetch('/api/articles/' + i, { method: 'DELETE' }).catch(() => {}); }, id);
    console.log('page errors:', errors.length ? errors.join('; ') : '(none)');
    if (errors.length) pass = false;
    console.log(pass ? 'EDITOR_TEST_PASS' : 'EDITOR_TEST_FAIL');
    await browser.close();
    process.exit(pass ? 0 : 1);
  }
})().catch(e => { console.error('test crashed:', e.message); process.exit(1); });
