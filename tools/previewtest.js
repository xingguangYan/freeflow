'use strict';
// 调试：头条点击「预览并发布」后，打印新页面/弹窗里的按钮。
const { chromium } = require('playwright');
const auto = require('../automation');
const platforms = require('../platforms');

(async () => {
  const [profile] = process.argv.slice(2);
  const P = platforms.find(x => x.id === 'toutiao');
  const arts = await (await fetch('http://127.0.0.1:8917/api/articles')).json();
  const art = arts.find(a => a.id === 'art_mvxlblxyta1edi');
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false, channel: 'chrome', viewport: { width: 1280, height: 880 },
    permissions: ['clipboard-read', 'clipboard-write'], args: ['--disable-blink-features=AutomationControlled']
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://mp.toutiao.com/profile_v4/graphic/publish?type=news', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  await auto.waitForEditor(page, P, 25000);
  await page.waitForTimeout(3000);
  await auto.fillTitle(page, P, art.title);
  await auto.fillContent(page, P, art.content);
  await page.waitForTimeout(2000);
  const rb = page.getByRole('button', { name: '预览', exact: true }).first();
  await rb.scrollIntoViewIfNeeded().catch(() => {});
  const box = await rb.boundingBox();
  console.log('box', JSON.stringify(box));
  if (box) {
    await rb.evaluate(el => {
      const r = el.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0 };
      el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, isPrimary: true }));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, isPrimary: true }));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
    });
    console.log('pointer sequence done');
  }
  await page.waitForTimeout(4000);
  console.log('pages:', ctx.pages().map(p => p.url()));
  for (const p of ctx.pages()) {
    const info = await p.evaluate(() => ({
      text: (document.body.innerText || '').slice(0, 400),
      btns: [...document.querySelectorAll('button')].filter(b => b.offsetWidth || b.offsetHeight).map(b => ({ t: b.innerText.trim(), dis: b.disabled, cls: String(b.className).slice(0, 50) })).filter(x => x.t).slice(0, 20),
      toasts: [...document.querySelectorAll('[class*=toast],[class*=message],[class*=tip]')].map(e => (e.innerText || '').trim()).filter(Boolean).slice(0, 8),
      dialogs: [...document.querySelectorAll('[role=dialog],.byte-modal,.modal,.semi-modal')].map(d => (d.innerText || '').slice(0, 300))
    })).catch(() => null);
    console.log('PAGE', p.url(), JSON.stringify(info).slice(0, 1200));
  }
  await ctx.close().catch(() => {});
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
