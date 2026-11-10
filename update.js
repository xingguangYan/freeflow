'use strict';
// 检查更新：对比 GitHub 最新 Release 与本地 package.json 版本。
// 只读取公开的 releases/latest 接口，不上传任何用户数据；结果缓存 10 分钟避免触发 GitHub 速率限制。
const https = require('https');
const pkg = require('./package.json');

const RELEASES_API = 'https://api.github.com/repos/xingguangYan/freeflow/releases/latest';
const TTL = 10 * 60 * 1000;

function parseVer(v) {
  return String(v || '').trim().replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0);
}

function isNewer(a, b) {
  const A = parseVer(a), B = parseVer(b), n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'freeflow-update-check', Accept: 'application/vnd.github+json' }, timeout: 15000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('响应解析失败')); } });
    });
    req.on('timeout', () => req.destroy(new Error('请求超时')));
    req.on('error', reject);
  });
}

let cache = null;

async function check(force) {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.data;
  const rel = await fetchJson(RELEASES_API);
  const latest = rel.tag_name || '';
  const data = {
    current: pkg.version,
    latest,
    hasUpdate: isNewer(latest, pkg.version),
    name: rel.name || latest,
    body: rel.body || '',
    url: rel.html_url || 'https://github.com/xingguangYan/freeflow/releases',
    publishedAt: rel.published_at || ''
  };
  cache = { at: Date.now(), data };
  return data;
}

module.exports = { check, isNewer, parseVer };
