// 退出确认弹窗的前端测试（模拟 Electron preload 注入的 window.freeflow）。
// 用法：先启动服务（FREEFLOW_PORT=8918 node server.js），再 node tools/test-exit.js
'use strict';
const { chromium } = require('playwright');
const PORT = process.env.FF_PORT || 8918;
let pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? 'PASS  ' : 'FAIL  ') + name); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const replies = [];
  await page.addInitScript(() => {
    window.__bridge = { onAskExit: null, exitReply: null };
    window.freeflow = {
      onAskExit: cb => { window.__bridge.onAskExit = cb; return () => {}; },
      exitReply: ok => { window.__bridge.exitReply = ok; }
    };
  });
  await page.goto('http://127.0.0.1:' + PORT, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  // 1. 主进程发起询问 -> 弹窗出现
  await page.evaluate(() => window.__bridge.onAskExit && window.__bridge.onAskExit());
  await page.waitForTimeout(300);
  check('exit modal shown', await page.locator('#exitModal').isVisible());
  // 2. 取消 -> 弹窗关闭，回复 false（应用不退出）
  await page.click('#exitCancel');
  await page.waitForTimeout(200);
  check('cancel closes modal', !(await page.locator('#exitModal').isVisible()));
  check('cancel replies false', await page.evaluate(() => window.__bridge.exitReply === false));
  // 3. 再次询问 -> 确认退出
  await page.evaluate(() => window.__bridge.onAskExit && window.__bridge.onAskExit());
  await page.waitForTimeout(300);
  check('modal shown again', await page.locator('#exitModal').isVisible());
  await page.click('#exitConfirm');
  await page.waitForTimeout(200);
  check('confirm replies true', await page.evaluate(() => window.__bridge.exitReply === true));
  // 4. 重复询问不会弹第二个窗
  await page.evaluate(() => { window.__bridge.onAskExit(); window.__bridge.onAskExit(); });
  await page.waitForTimeout(200);
  const n = await page.locator('#exitModal').count();
  check('no duplicate dialogs', n === 1);
  await browser.close();
  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常:', e); process.exit(1); });
