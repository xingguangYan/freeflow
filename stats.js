'use strict';
// 平台后台数据采集：打开账号后台首页，从页面文字里提取常见指标。
// 说明：各平台页面结构不同，这里用「关键词 + 数字」的启发式解析，属于估算值。
const platforms = require('./platforms');
const auto = require('./automation');
const { load, save } = require('./store');

// 各平台「个人主页 / 创作数据中心」地址（采集数据用；loginUrl 只是登录入口，上面没有数据）
// 未列出的平台沿用 loginUrl（多数平台登录后本身就是后台首页）
const DATA_CENTERS = {
  zhihu: 'https://www.zhihu.com/creator/analytics/content',
  zhihu_video: 'https://www.zhihu.com/creator/analytics/content',
  csdn: 'https://mp.csdn.net/mp_blog/manage/article',
  bilibili: 'https://member.bilibili.com/platform/upload-manager/article',
  bilibili_video: 'https://member.bilibili.com/platform/upload-manager/video',
  weibo: 'https://weibo.com/',
  jianshu: 'https://www.jianshu.com/',
  juejin: 'https://juejin.cn/',
  cnblogs: 'https://www.cnblogs.com/',
  douban: 'https://www.douban.com/',
  segmentfault: 'https://segmentfault.com/',
  xueqiu: 'https://xueqiu.com/',
  tieba: 'https://tieba.baidu.com/index.html',
  xiaohongshu: 'https://creator.xiaohongshu.com/creator/notes',
  wechat: 'https://mp.weixin.qq.com/'
};

const METRICS = [
  { key: 'fans', label: '粉丝', re: /(?:粉丝|关注者|关注人数|总用户数|用户数)(?:数|人数)?(?:[（(][^）)]*[）)])?\s*[:：]?\s*([\d.,万wWkK+]+)/ },
  { key: 'read', label: '阅读/播放', re: /(?:阅读|播放|浏览)(?:量|数)?(?:[（(][^）)]*[）)])?\s*[:：]?\s*([\d.,万wWkK+]+)/ },
  { key: 'like', label: '点赞', re: /(?:点赞|获赞)(?:数|量)?(?:[（(][^）)]*[）)])?\s*[:：]?\s*([\d.,万wWkK+]+)/ },
  { key: 'comment', label: '评论', re: /评论(?:数|量)?(?:[（(][^）)]*[）)])?\s*[:：]?\s*([\d.,万wWkK+]+)/ },
  { key: 'share', label: '分享', re: /(?:分享|转发)(?:数|量)?(?:[（(][^）)]*[）)])?\s*[:：]?\s*([\d.,万wWkK+]+)/ }
];

function parseNum(s) {
  if (!s) return null;
  const x = String(s).replace(/[,，\s+]/g, '');
  const m = /^(\d+(?:\.\d+)?)(万|w|W|k|K)?$/.exec(x);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] || '').toLowerCase();
  if (unit === '万' || unit === 'w') n *= 10000;
  if (unit === 'k') n *= 1000;
  return Math.round(n);
}

function extract(text) {
  const out = {};
  for (const m of METRICS) {
    const re = new RegExp(m.re.source, 'g');
    let hit;
    while ((hit = re.exec(text))) {
      const n = parseNum(hit[1]);
      if (n !== null) { out[m.key] = n; break; }
      if (re.lastIndex === hit.index) re.lastIndex++;
    }
  }
  return out;
}

async function collect(account) {
  const p = platforms.find(x => x.id === account.platformId);
  if (!p) throw new Error('未知平台');
  const target = DATA_CENTERS[p.id] || p.loginUrl;
  const ctx = await auto.launch(account.id);
  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    // 创作中心多为 SPA，等动画/接口：先等网络空闲，再保底等几秒
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(5000);
    const logged = await auto.checkLoggedIn(ctx, p, page);
    const text = await page.evaluate(() => (document.body && document.body.innerText || '').slice(0, 20000)).catch(() => '');
    const metrics = extract(text);
    return {
      accountId: account.id, platformId: account.platformId, platformName: p.name,
      ts: Date.now(), logged, metrics, url: page.url(), source: target,
      note: Object.keys(metrics).length ? '' : '页面未找到可识别指标'
    };
  } finally {
    await auto.closeCtx(ctx);
  }
}

function list() { return load('stats.json', []); }
function append(snap) {
  const all = list();
  all.push(snap);
  while (all.length > 3000) all.shift();
  save('stats.json', all);
  return snap;
}

module.exports = { collect, list, append, extract, parseNum, METRICS };
