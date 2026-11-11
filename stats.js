'use strict';
// 平台后台数据采集：优先解析页面自身发出的 JSON 接口（真实数据），DOM 文本启发式兜底并合并。
// 说明：接口字段各平台不统一，这里按字段名族（fans/view/like/...）映射；属于估算值，仅供趋势参考。
const platforms = require('./platforms');
const auto = require('./automation');
const { load, save } = require('./store');

// 各平台「个人主页 / 创作数据中心」地址（loginUrl 只是登录入口，上面没有数据）
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

// 接口字段名族 → 指标 key（命中靠字段名，不靠具体接口地址，平台改版也能兼容大部分情况）
const JSON_METRIC_KEYS = [
  { key: 'fans', re: /^(fans|fanscount|fans_count|follower|followers|subscriber|subscribers|followcnt|follow_count|关注数|粉丝数)/i, bad: /rate|percent|ratio|change/i },
  { key: 'read', re: /(view|views|viewcount|visit|visits|visited|read|reads|readcount|play|plays|playcount|browse|浏览|阅读|播放)/i, bad: /rate|percent|ratio|avg|average|time|duration/i },
  { key: 'like', re: /(like|likes|likecount|upvote|upvotes|praise|点赞|获赞)/i, bad: /rate|percent|ratio/i },
  { key: 'comment', re: /(comment|comments|commentcount|评论)/i, bad: /rate|percent|ratio/i },
  { key: 'share', re: /(share|shares|sharecount|forward|forwardcount|repost|转发|分享)/i, bad: /rate|percent|ratio/i }
];

function parseNum(s) {
  if (s === null || s === undefined) return null;
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

// 递归扫描 JSON 里的数值字段；同一指标取最大值（后台汇总数通常大于明细单条）
function scanObject(obj, depth, out) {
  if (depth > 7 || obj === null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const it of obj.slice(0, 80)) scanObject(it, depth + 1, out);
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' || (typeof v === 'string' && /^[\d.,]+\s*[万wWkK]?$/.test(v))) {
      const n = parseNum(v);
      if (n !== null && n >= 0 && n < 1e10) {
        for (const m of JSON_METRIC_KEYS) {
          if (m.re.test(k) && !(m.bad && m.bad.test(k))) {
            if (out[m.key] === undefined || n > out[m.key]) out[m.key] = n;
            break;
          }
        }
      }
    }
    if (v && typeof v === 'object') scanObject(v, depth + 1, out);
  }
}

// 从抓到的接口响应里提取指标（纯函数，可单元测试）
function extractFromJson(entries) {
  const out = {};
  for (const e of entries || []) {
    try { scanObject(e && e.json, 0, out); } catch { /* 忽略异常结构 */ }
  }
  return out;
}

// 抓页面自身的 JSON 响应（真实接口；未登录时平台多返回 401/未登录 JSON）
async function captureJson(page) {
  const entries = [];
  const onResponse = async (res) => {
    try {
      if (entries.length >= 40) return;
      const rt = res.request().resourceType();
      if (rt !== 'xhr' && rt !== 'fetch') return;
      const ct = String((res.headers() || {})['content-type'] || '').toLowerCase();
      if (!ct.includes('json')) return;
      const body = await res.text();
      if (!body || body.length > 1500000) return;
      entries.push({ url: res.url(), json: JSON.parse(body) });
    } catch { /* 中断/非 JSON 忽略 */ }
  };
  page.on('response', onResponse);
  return { entries, stop: () => { try { page.off('response', onResponse); } catch { /* */ } } };
}

async function bodyText(page) {
  let text = '';
  try { text = await page.evaluate(() => (document.body && document.body.innerText || '').slice(0, 30000)); } catch { /* */ }
  for (const f of page.frames()) {
    if (f === page.mainFrame()) continue;
    try { text += '\n' + await f.evaluate(() => (document.body && document.body.innerText || '').slice(0, 20000)); } catch { /* 跨域 */ }
  }
  return text;
}

async function collect(account) {
  const p = platforms.find(x => x.id === account.platformId);
  if (!p) throw new Error('未知平台');
  const target = DATA_CENTERS[p.id] || p.loginUrl;
  const ctx = await auto.launch(account.id);
  let cap = null;
  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    cap = await captureJson(page); // 先挂监听再导航，才能拿到后台首屏接口
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(5000);
    cap.stop();
    const apiMetrics = extractFromJson(cap.entries);
    const text = await bodyText(page);
    const domMetrics = extract(text);
    const metrics = { ...domMetrics, ...apiMetrics }; // 接口值优先，DOM 补缺
    const checked = await auto.checkLoggedIn(ctx, p, page);
    const logged = Object.keys(metrics).length > 0 ? true : checked;
    return {
      accountId: account.id, platformId: account.platformId, platformName: p.name,
      ts: Date.now(), logged, metrics, url: page.url(), source: target,
      sourceType: Object.keys(apiMetrics).length ? 'api+dom' : (Object.keys(domMetrics).length ? 'dom' : 'none'),
      note: Object.keys(metrics).length ? '' : (logged ? '页面未找到可识别指标（可能后台改版或在 iframe 内）' : '未登录或登录已过期，请先在「账号」页重新登录')
    };
  } finally {
    if (cap) { try { cap.stop(); } catch { /* */ } }
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

module.exports = { collect, list, append, extract, extractFromJson, parseNum, METRICS };
