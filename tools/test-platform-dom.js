'use strict';
// 针对真实抓取到的 DOM 结构做回归：CSDN CKEditor+摘要陷阱 / 博客园 TinyMCE / 百家号 Lexical+UEditor / 掘金 CodeMirror
const { chromium } = require('playwright');
const adapters = require('../adapters');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name + (detail ? ' -> ' + detail : '')); } };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const log = m => console.log('   [adapter]', m);

  // CSDN：标题 #txtTitle，可见摘要框，正文必须在 CKEditor iframe 内
  {
    const page = await browser.newPage();
    await page.setContent(`<textarea id="txtTitle"></textarea>
      <textarea id="summary" placeholder="摘要：会在推荐、列表等场景外露"></textarea>
      <iframe class="cke_wysiwyg_frame" srcdoc="<body class='cke_editable' contenteditable='true'></body>"></iframe>`);
    await page.waitForTimeout(400);
    const ad = adapters.get('csdn');
    const okTitle = await ad.fillTitle ? true : await require('../automation').fillTitle(page, { id: 'csdn', titleSelectors: ['#txtTitle'], titleMax: 0 }, 'CSDN 标题');
    const okBody = await ad.fillContent(page, { html: '<p>这是CSDN正文内容</p>', md: '这是CSDN正文内容' }, log);
    const summary = await page.inputValue('#summary');
    check('csdn title filled', okTitle && (await page.inputValue('#txtTitle')) === 'CSDN 标题');
    check('csdn body into CKEditor iframe', okBody === true);
    check('csdn summary untouched', summary === '', JSON.stringify(summary));
    await page.close();
  }

  // 博客园：TinyMCE iframe body#tinymce
  {
    const page = await browser.newPage();
    await page.setContent(`<input id="post-title"><iframe id="Editor_Edit_EditorBody_ifr" srcdoc="<body id='tinymce' contenteditable='true'></body>"></iframe>`);
    await page.waitForTimeout(400);
    const ad = adapters.get('cnblogs');
    const ok = await ad.fillContent(page, { html: '<p>博客园正文内容</p>', md: '博客园正文内容' }, log);
    check('cnblogs body into TinyMCE iframe', ok === true);
    await page.close();
  }

  // 百家号：Lexical 标题 + UEditor iframe 正文
  {
    const page = await browser.newPage();
    await page.setContent(`<div class="client_components_titleInput"><div data-testid="news-title-input"><div data-lexical-editor="true" contenteditable="true"></div></div></div>
      <div class="edui-editor"><iframe id="ueditor_0" srcdoc="<body class='view' contenteditable='true'></body>"></iframe></div>
      <div data-lexical-editor="true" contenteditable="true" id="ai-trap"></div>`);
    await page.waitForTimeout(400);
    const ad = adapters.get('baijia');
    const t = await ad.fillTitle(page, '百家号标题', log);
    const b = await ad.fillContent(page, { html: '<p>百家号正文</p>', md: '百家号正文' }, log);
    const trap = await page.locator('#ai-trap').innerText();
    check('baijia Lexical title', t === true && (await page.locator('[data-testid="news-title-input"] [data-lexical-editor="true"]').innerText()).includes('百家号标题'));
    check('baijia body into UEditor iframe', b === true);
    check('baijia AI editor untouched', trap.trim() === '', JSON.stringify(trap));
    await page.close();
  }

  // 掘金：CodeMirror5 textarea + Markdown
  {
    const page = await browser.newPage();
    await page.setContent(`<input class="title-input" placeholder="输入文章标题..."><div class="CodeMirror"><textarea></textarea></div>`);
    await page.waitForTimeout(200);
    const ad = adapters.get('juejin');
    const b = await ad.fillContent(page, { html: '<h2>标题</h2><p>掘金正文</p>', md: '## 标题\n\n掘金正文' }, log);
    const v = await page.inputValue('.CodeMirror textarea');
    check('juejin markdown injected', b === true && /## 标题/.test(v), JSON.stringify(v.slice(0, 40)));
    await page.close();
  }

  await browser.close();
  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常:', e.message); process.exit(1); });
