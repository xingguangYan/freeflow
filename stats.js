'use strict';
// 平台后台数据采集：打开账号后台首页，从页面文字里提取常见指标。
// 说明：各平台页面结构不同，这里用「关键词 + 数字」的启发式解析，属于估算值。
const platforms = require('./platforms');
const auto = require('./automation');
const { load, save } = require('./store');

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
  const ctx = await auto.launch(account.id);
  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(p.loginUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(7000);
    const logged = await auto.checkLoggedIn(ctx, p, page);
    const text = await page.evaluate(() => (document.body && document.body.innerText || '').slice(0, 20000)).catch(() => '');
    const metrics = extract(text);
    return {
      accountId: account.id, platformId: account.platformId, platformName: p.name,
      ts: Date.now(), logged, metrics, url: page.url(),
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
