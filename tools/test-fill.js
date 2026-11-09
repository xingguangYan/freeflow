// 自动化填充/发布逻辑的本地回归测试（不需要平台登录）。
// 用法：node tools/test-fill.js
'use strict';
const { chromium } = require('playwright');
const auto = require('../automation');
const platforms = require('../platforms');

const HTML = '<h2>小标题</h2><p>第一段正文，<strong>加粗</strong>内容。</p><ul><li>条目一</li><li>条目二</li></ul><p>最后一段结尾文字。</p>';
const HTML_IMG = '<p>开头段落文字。</p><p><img src="data:image/png;base64,iVBORw0KGgo="></p><p>结尾段落文字。</p>';
let pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? 'PASS  ' : 'FAIL  ') + name); };

const csdn = platforms.find(p => p.id === 'csdn');
const jianshu = platforms.find(p => p.id === 'jianshu');
const xhs = platforms.find(p => p.id === 'xiaohongshu');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  try {
    // 1. 富文本 contenteditable（模拟 Quill / ProseMirror 类编辑器）
    {
      const page = await browser.newPage({ permissions: ['clipboard-read', 'clipboard-write'] });
      await page.setContent(`<input id="txtTitle"><div class="ql-editor" contenteditable="true"></div>`);
      await auto.fillTitle(page, csdn, 'CSDN 富文本填充测试标题');
      check('richtext title', await page.inputValue('#txtTitle') === 'CSDN 富文本填充测试标题');
      const ok = await auto.fillContent(page, csdn, HTML);
      const txt = await page.locator('.ql-editor').innerText();
      check('richtext content filled', ok && txt.includes('第一段正文') && txt.includes('最后一段结尾文字'));
      check('richtext keeps formatting', await page.locator('.ql-editor strong').count() > 0);
      check('richtext keeps list', await page.locator('.ql-editor li').count() >= 2);
      await page.close();
    }
    // 2. Markdown textarea（简书类）
    {
      const page = await browser.newPage();
      await page.setContent(`<textarea id="editor"></textarea>`);
      const ok = await auto.fillContent(page, jianshu, HTML);
      const v = await page.inputValue('#editor');
      check('markdown content filled', ok && v.includes('第一段正文') && v.includes('最后一段结尾文字'));
      await page.close();
    }
    // 3. UEditor 官方 API 通道（模拟 CSDN / 公众号的 UE 实例）
    {
      const page = await browser.newPage();
      await page.setContent(`
        <div id="ueditor_0"></div>
        <script>
          window.__body = document.getElementById('ueditor_0');
          window.__body.contentEditable = true;
          const inst = {
            setContent(html) { window.__body.innerHTML = html; this._done = true; },
            getContentTxt() { return window.__body.innerText; }
          };
          window.UE = { getEditor: () => inst, getEditors: () => ({ ueditor_0: inst }) };
        </script>`);
      const ok = await auto.fillContent(page, csdn, HTML);
      const txt = await page.locator('#ueditor_0').innerText();
      check('UEditor API fill', ok && txt.includes('第一段正文') && txt.includes('最后一段结尾文字'));
      // 验证确实走的 UE 通道：剪贴板没被写入
      const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => 'EMPTY')).catch(() => 'EMPTY');
      check('UEditor path skipped clipboard', clip === 'EMPTY' || !clip.includes('第一段正文'));
      await page.close();
    }
    // 4. 草稿保护：编辑器里已有无关内容时不覆盖
    {
      const page = await browser.newPage();
      await page.setContent(`<div class="ql-editor" contenteditable="true"><p>这是一篇已经存在的旧草稿，内容完全不同，请勿覆盖。</p></div>`);
      const ok = await auto.fillContent(page, csdn, HTML);
      const txt = await page.locator('.ql-editor').innerText();
      check('draft protection', ok === false && txt.includes('旧草稿'));
      await page.close();
    }
    // 5. 标题超长截断
    {
      const page = await browser.newPage();
      await page.setContent(`<input id="txtTitle">`);
      const longTitle = '一'.repeat(120);
      await auto.fillTitle(page, csdn, longTitle);
      const v = await page.inputValue('#txtTitle');
      check('title truncated to titleMax', v.length === 100 && v.endsWith('…'));
      await page.close();
    }
    // 6. 富文本平台 + textarea 编辑器：写入纯文本，不能带 HTML 标签
    {
      const page = await browser.newPage();
      await page.setContent(`<textarea placeholder="填写更多正文描述"></textarea>`);
      const ok = await auto.fillContent(page, xhs, HTML);
      const v = await page.inputValue('textarea');
      check('richtext->textarea plain text', ok && v.includes('第一段正文') && !v.includes('<p>') && !v.includes('<strong>'));
      await page.close();
    }
    // 7. 发布前排版检查：正常富文本 -> ok
    {
      const page = await browser.newPage({ permissions: ['clipboard-read', 'clipboard-write'] });
      await page.setContent(`<div class="ql-editor" contenteditable="true"></div>`);
      await auto.fillContent(page, csdn, HTML);
      const fmt = await auto.checkEditorFormatting(page, csdn, HTML);
      check('formatting ok', fmt.level === 'ok' && fmt.issues.length === 0);
      await page.close();
    }
    // 8. 发布前排版检查：编辑器里是 Markdown 源码 -> bad（停止自动发布）
    {
      const page = await browser.newPage();
      await page.setContent(`<textarea placeholder="填写正文"></textarea>`);
      // 手动把 textarea 填成 markdown 原文，模拟粘贴退化
      await page.fill('textarea', '# 小标题\n\n第一段正文，**加粗**内容。\n\n![图片](http://x.com/a.png)\n\n最后一段结尾文字。');
      const fmt = await auto.checkEditorFormatting(page, xhs, HTML);
      check('formatting bad on markdown leftover', fmt.level === 'bad' && fmt.issues.join('').includes('Markdown'));
      await page.close();
    }
    // 9. 发布前排版检查：文章有图但编辑器没图 -> warn
    {
      const page = await browser.newPage();
      await page.setContent(`<div class="ql-editor" contenteditable="true"><p>开头段落文字。</p><p>结尾段落文字。</p></div>`);
      const fmt = await auto.checkEditorFormatting(page, csdn, HTML_IMG);
      check('formatting warn on missing image', fmt.level === 'warn' && fmt.issues.join('').includes('图片'));
      await page.close();
    }
    // 10. clickPublish：平台专属文案优先
    {
      const page = await browser.newPage();
      await page.setContent(`<button>发布</button><button>发布文章</button>`);
      const t = await auto.clickPublish(page, csdn);
      check('clickPublish platform text first', t === '发布文章');
      await page.close();
    }
    // 11. clickPublish：英文按钮
    {
      const page = await browser.newPage();
      await page.setContent(`<button>Publish</button>`);
      const t = await auto.clickPublish(page, platforms.find(p => p.id === 'medium'));
      check('clickPublish english button', !!t);
      await page.close();
    }
    // 12. clickPublish：平台专属选择器
    {
      const page = await browser.newPage();
      await page.setContent(`<div class="toolbar"><a class="btn-send" href="#">发出去</a></div>`);
      const plat = { publishSelectors: ['.btn-send'] };
      const t = await auto.clickPublish(page, plat);
      check('clickPublish platform selector', t === '.btn-send');
      await page.close();
    }
    // 13. clickConfirm：弹窗内确认
    {
      const page = await browser.newPage();
      await page.setContent(`<div class="modal" style="display:block"><button>取消</button><button>发布文章</button></div>`);
      const t = await auto.clickConfirm(page, csdn);
      check('clickConfirm in dialog', t === '发布文章');
      await page.close();
    }
    // 14. waitForPublishSuccess：先「发布中」再「发布成功」
    {
      const page = await browser.newPage();
      await page.setContent(`<div id="tip">发布中…</div>`);
      const startUrl = page.url();
      const p = auto.waitForPublishSuccess(page, startUrl, 8000);
      await new Promise(r => setTimeout(r, 1200));
      await page.evaluate(() => { document.getElementById('tip').textContent = '发布成功'; });
      const res = await p;
      check('publish success detected', res.ok && res.how === 'success');
      await page.close();
    }
    // 15. waitForPublishSuccess：跳转到后台详情页
    {
      const page = await browser.newPage();
      await page.setContent(`<div>内容</div>`);
      const startUrl = page.url();
      const p = auto.waitForPublishSuccess(page, startUrl, 6000);
      await new Promise(r => setTimeout(r, 800));
      await page.goto('https://example.com/manage/articles');
      const res = await p;
      check('publish jump detected', res.ok && res.how === 'jump');
      await page.close();
    }
    // 16. waitForPublishSuccess：一直不成功 → 超时
    {
      const page = await browser.newPage();
      await page.setContent(`<div>编辑中</div>`);
      const res = await auto.waitForPublishSuccess(page, page.url(), 2500);
      check('publish timeout detected', !res.ok && res.how === 'timeout');
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常:', e); process.exit(1); });
