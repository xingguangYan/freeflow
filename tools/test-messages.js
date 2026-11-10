// 消息中心离线测试：分类/草稿存储/页面抓取，不依赖平台登录
process.env.FREEFLOW_DATA = require('os').tmpdir() + '/freeflow_msg_test';
const fs = require('fs');
const { chromium } = require('playwright');
const messages = require('../messages');
let pass = 0, fail = 0;
const check = (n, c) => { c ? pass++ : fail++; console.log((c ? 'PASS  ' : 'FAIL  ') + n); };

(async () => {
  // 1. 分类
  check('classify comment', messages.classify('用户A', '评论了你的文章《XX》') === 'comment');
  check('classify notice', messages.classify('用户B', '赞同了你的回答') === 'notice');
  check('classify dm', messages.classify('张三', '在吗？想请教一下') === 'dm');

  // 2. 存储 / 草稿
  messages.store({ accountId: 'a1', platformId: 'zhihu', platformName: '知乎', supported: true, logged: true, items: [{ id: 'm1', from: '张三', snippet: '在吗', time: '12:30', type: 'dm', unread: true }] });
  check('store & listAll', Object.keys(messages.listAll()).length === 1 && messages.listAll().a1.items[0].from === '张三');
  messages.saveDraft('a1', '张三', '草稿内容');
  check('draft saved', messages.drafts()['a1|张三'].text === '草稿内容');
  messages.dropDraft('a1', '张三');
  check('draft dropped', !messages.drafts()['a1|张三']);

  // 3. 页面抓取：模拟一个会话列表
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(`
    <ul class="chat-list">
      <li class="chat-item"><div class="name">张三</div><div class="snippet">你好，在吗？</div><div class="time">12:30</div><span class="unread-dot">未读</span></li>
      <li class="chat-item"><div class="name">李四</div><div class="snippet">评论了你的文章：写得好</div><div class="time">昨天</div></li>
      <li class="chat-item"><div class="name">王五</div><div class="snippet">这条没有时间不收录</div></li>
    </ul>`);
  const items = await messages.scrapeItems(page);
  check('scrape 2 items (no-time dropped)', items.length === 2);
  check('scrape from/snippet', items[0].from === '张三' && items[0].snippet.includes('你好'));
  check('scrape unread flag', items[0].unread === true && items[1].unread === false);

  // 4. 回复边界：未接入平台
  let err = '';
  try { await messages.reply({ platformId: 'medium', name: 'x' }, '张三', 'hi'); } catch (e) { err = e.message; }
  check('unsupported platform reply rejected', /暂未接入/.test(err));
  let err2 = '';
  try { await messages.reply({ platformId: 'juejin', name: 'x' }, '张三', 'hi'); } catch (e) { err2 = e.message; }
  check('non-replyable platform rejected', /无法稳定定位|暂未接入/.test(err2));
  let err3 = '';
  try { await messages.reply({ platformId: 'zhihu', name: 'x' }, '张三', ''); } catch (e) { err3 = e.message; }
  check('empty reply rejected', /不能为空/.test(err3));

  await browser.close();
  // 清理临时数据
  try { fs.rmSync(process.env.FREEFLOW_DATA, { recursive: true, force: true }); } catch { /* */ }
  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常:', e); process.exit(1); });
