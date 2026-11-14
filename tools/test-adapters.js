'use strict';
// 适配器架构回归：注册表完整性、iframe 内标题注入（公众号场景）、发布前检查、弹窗处理
const { chromium } = require('playwright');
const adapters = require('../adapters');
const auto = require('../automation');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name + (detail ? ' -> ' + detail : '')); } };

(async () => {
  const ids = adapters.ids();
  check('adapter registry has 14 ids', ids.length === 14, ids.join(','));
  for (const id of ids) {
    const ad = adapters.get(id);
    check('adapter ' + id + ' complete', !!ad && ad.titleSelectors.length >= 2 && ad.contentSelectors.length >= 2 && Array.isArray(ad.publishSelectors));
  }
  const csdn = auto.adapterOf({ id: 'csdn' });
  const merged = auto.sel ? null : null;
  check('adapterOf(csdn) resolves', csdn && csdn.titleSelectors.includes('input[placeholder*="文章标题"]'));

  const browser = await chromium.launch({ headless: true });
  // 1) iframe 内标题（公众号编辑器常见结构）
  const page = await browser.newPage();
  await page.setContent(`<iframe id="f" srcdoc='<input id="title" placeholder="标题" />'></iframe>`);
  await page.waitForTimeout(500);
  const filled = await auto.fillTitle(page, { id: 'wechat', titleSelectors: ['#title'], titleMax: 0 }, '公众号 iframe 标题');
  await page.waitForTimeout(300);
  let val = '';
  for (const fr of page.frames()) {
    const loc = fr.locator('#title');
    if (await loc.count()) val = await loc.inputValue().catch(() => '');
  }
  check('wechat iframe title filled', filled && val === '公众号 iframe 标题', 'filled=' + filled + ' val=' + val);
  await page.close();

  // 2) 发布前检查：空 -> 不通过；填好 -> 通过
  const p2 = await browser.newPage();
  await p2.setContent('<input id="title"><div id="body" contenteditable="true"></div>');
  const ad = adapters.get('csdn');
  const fakeAd = { titleSelectors: ['#title'], contentSelectors: ['#body'] };
  const bad = await require('../adapters/base').defaultPreflight(p2, fakeAd, () => {});
  check('preflight blocks empty title/body', bad.ok === false && bad.issues.length >= 2, JSON.stringify(bad.issues));
  await p2.fill('#title', '标题');
  await p2.click('#body'); await p2.keyboard.type('正文');
  const good = await require('../adapters/base').defaultPreflight(p2, fakeAd, () => {});
  check('preflight passes when filled', good.ok === true, JSON.stringify(good.issues));
  await p2.close();

  // 3) 弹窗处理
  const p3 = await browser.newPage();
  await p3.setContent('<button id="ok" onclick="this.dataset.clicked=\'1\'">确定</button>');
  const handled = await require('../adapters/base').clickByTexts(p3, ['确定'], () => {});
  await p3.waitForTimeout(200);
  const clicked = await p3.locator('#ok').getAttribute('data-clicked');
  check('dialog button clicked', handled === true && clicked === '1');
  await p3.close();

  // 4) 标题长度截断
  const p4 = await browser.newPage();
  await p4.setContent('<input id="t">');
  await auto.fillTitle(p4, { id: 'toutiao', titleSelectors: ['#t'], titleMax: 10 }, '一二三四五六七八九十十一');
  const v4 = await p4.inputValue('#t');
  check('titleMax truncation', v4.length <= 10 && v4.endsWith('…'), v4);
  await p4.close();

  await browser.close();
  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常:', e.message); process.exit(1); });
