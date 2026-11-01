'use strict';
// 调试工具：用真实文章内容填充指定平台编辑器，不点发布。
// 用法: node tools/fillarticle.js <profileDir> <platformId> <url> <articleId>
const { chromium } = require('playwright');
const path = require('path');
const auto = require('../automation');
const platforms = require('../platforms');

(async () => {
  const [profile, platformId, url, articleId] = process.argv.slice(2);
  const p = platforms.find(x => x.id === platformId);
  if (!p) { console.error('unknown platform', platformId); process.exit(1); }
  const arts = await (await fetch('http://127.0.0.1:8917/api/articles')).json();
  const art = arts.find(a => a.id === articleId);
  if (!art) { console.error('article not found'); process.exit(1); }
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false, channel: 'chrome', viewport: { width: 1400, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
    args: ['--disable-blink-features=AutomationControlled']
  });
  let page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => console.log('GOTO_ERR', e.message.split('\n')[0]));
  if (p.newDraftFirst && p.preClickText) {
    const clicked = await auto.clickIfAny(page, p.preClickText, 3000);
    console.log('new draft click:', clicked);
    await page.waitForTimeout(1500);
  }
  if (!p.newDraftFirst && !p.newNoteUrl && p.preClickText) {
    const popupP = ctx.waitForEvent('page', { timeout: 6000 }).catch(() => null);
    const clicked = await auto.clickIfAny(page, p.preClickText, 4000);
    console.log('preClick:', clicked);
    const popup = await popupP;
    if (popup) { await popup.waitForLoadState('domcontentloaded').catch(() => {}); page = popup; console.log('switched to popup'); }
  }
  if (p.newNoteUrl) {
    for (let i = 0; i < 12 && !/notebooks\/\d+/.test(page.url()); i++) await page.waitForTimeout(800);
    const nu = p.newNoteUrl(page.url());
    console.log('new note url:', nu);
    if (nu) { await page.goto(nu, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {}); await page.waitForTimeout(2500); }
  }
  if (p.editorUrlFrom) {
    for (let i = 0; i < 12 && !/token=/.test(page.url()); i++) await page.waitForTimeout(800);
    const eu = p.editorUrlFrom(page.url());
    console.log('editor url from token:', eu);
    if (eu) { await page.goto(eu, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {}); await page.waitForTimeout(2500); }
  }
  if (p.mediaFirst && art.cover) {
    const matDir = path.join(path.dirname(path.dirname(profile)), 'materials');
    const coverPath = path.join(matDir, art.cover);
    const ok = await auto.uploadCover(page, p, coverPath);
    console.log('cover upload:', ok, coverPath);
    await page.waitForTimeout(4000);
  }
  const ready = await auto.waitForEditor(page, p, 25000);
  console.log('editor ready:', JSON.stringify(ready), 'url:', page.url());
  const ft = await auto.fillTitle(page, p, art.title);
  const fc = await auto.fillContent(page, p, auto.inlineLocalImages(art.content));
  console.log('fillTitle=', ft, 'fillContent=', fc);
  await page.waitForTimeout(1500);
  const dump = await page.evaluate(() => ({
    values: [...document.querySelectorAll('input,textarea')].map(e => e.value).filter(Boolean).slice(0, 3),
    bodies: [...document.querySelectorAll('[contenteditable="true"],.ProseMirror,.CodeMirror')].map(e => (e.innerText || '').slice(0, 100)).filter(Boolean).slice(0, 3)
  }));
  console.log(JSON.stringify(dump, null, 2));
  await ctx.close().catch(() => {});
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
