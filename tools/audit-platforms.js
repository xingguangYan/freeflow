'use strict';
// 53 平台发布入口真实审计：逐平台打开编辑器 URL，记录重定向/登录墙/验证码/编辑器特征并截图。
// 用法：node tools/audit-platforms.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const platforms = require('../platforms.js');

const OUT = path.join(__dirname, 'platform-audit');
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const LOGIN_URL_RE = /(signin|login|passport|account\.|accounts\.|\/auth|sso|visitor|verify|captcha|challenge)/i;
const LOGIN_TEXT_RE = /(登录|扫码|登入|sign in|log in|password|验证码|滑块|安全验证)/i;

async function auditOne(browser, p) {
  const entry = (p.editorUrls && p.editorUrls[0]) || p.loginUrl;
  const types = [];
  if (p.mode === 'video' || p.group === '视频' || p.group === '图文/视频') types.push('video');
  if (p.group === '图文' || p.group === '图文/笔记' || p.group === '图文/视频' || p.mode === 'both') { if (!types.includes('article')) types.push('article'); }
  if (p.id === 'xiaohongshu') types.push('image');
  const rec = { id: p.id, name: p.name, group: p.group, types, entry, finalUrl: '', httpStatus: null, title: '', loginWall: false, captcha: false, editorSignals: {}, shots: [], error: '' };
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36' });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 120)); });
  try {
    const resp = await page.goto(entry, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => null);
    rec.httpStatus = resp ? resp.status() : null;
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2500);
    rec.finalUrl = page.url();
    rec.title = (await page.title().catch(() => '')) || '';
    const bodyText = await page.evaluate(() => (document.body && document.body.innerText || '').slice(0, 6000)).catch(() => '');
    rec.loginWall = LOGIN_URL_RE.test(rec.finalUrl) || /(扫码登录|账号登录|密码登录|sign in to continue|log in to continue)/i.test(bodyText);
    rec.captcha = /(验证码|captcha|滑块|人机验证|安全验证)/i.test(bodyText);
    rec.editorSignals = await page.evaluate(() => ({
      contenteditable: document.querySelectorAll('[contenteditable="true"]').length,
      textarea: document.querySelectorAll('textarea').length,
      fileInput: document.querySelectorAll('input[type="file"]').length,
      titleLike: document.querySelectorAll('input[placeholder*="标题"],input[name*="title"],input[id*="title"]').length,
      proseMirror: document.querySelectorAll('.ProseMirror').length,
      quill: document.querySelectorAll('.ql-editor').length,
      codeMirror: document.querySelectorAll('.CodeMirror,.cm-editor').length,
      tinyMCE: document.querySelectorAll('.tox-edit-area,.mce-content-body').length,
      ueditor: document.querySelectorAll('#ueditor_0,.edui-body-container').length,
      iframes: document.querySelectorAll('iframe').length
    })).catch(() => ({}));
    const shot = path.join(SHOTS, p.id + '.jpg');
    await page.screenshot({ path: shot, type: 'jpeg', quality: 45 }).catch(() => {});
    rec.shots.push(path.relative(OUT, shot).replace(/\\/g, '/'));
    if (consoleErrors.length) rec.consoleErrors = consoleErrors.slice(0, 3);
  } catch (e) {
    rec.error = e.message.split('\n')[0];
  } finally {
    await context.close().catch(() => {});
  }
  return rec;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const startedAt = new Date().toISOString();
  for (const p of platforms) {
    process.stdout.write(p.id + ' ... ');
    const rec = await auditOne(browser, p);
    results.push(rec);
    console.log((rec.error ? 'ERR ' + rec.error : (rec.loginWall ? 'LOGIN-WALL' : (rec.captcha ? 'CAPTCHA' : (rec.editorSignals.contenteditable || rec.editorSignals.textarea ? 'EDITOR-SIGNAL' : 'UNKNOWN')))) + ' -> ' + rec.finalUrl.slice(0, 90));
  }
  await browser.close();
  const out = { startedAt, finishedAt: new Date().toISOString(), total: results.length, results };
  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(out, null, 2));
  console.log('\nwritten ' + path.join(OUT, 'audit.json'));
})().catch(e => { console.error('audit crashed:', e.message); process.exit(1); });
