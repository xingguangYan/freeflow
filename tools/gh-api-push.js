'use strict';
// GitHub 443/22 被网络阻断时的应急推送：通过 REST API 把单个提交的文件改动同步到 main。
// 用法：node tools/_gh_api_push.js <commit-sha>
const https = require('https');
const { execSync } = require('child_process');

const REPO = 'xingguangYan/freeflow';
const [ , , sha ] = process.argv;
if (!sha) { console.log('usage: node tools/_gh_api_push.js <commit-sha>'); process.exit(1); }

const token = execSync('git credential fill', { input: 'protocol=https\nhost=github.com\n\n' }).toString()
  .split('\n').find(l => l.startsWith('password=')).slice('password='.length).trim();

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      host: 'api.github.com', path: '/repos/' + REPO + path, method,
      headers: {
        Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json', 'User-Agent': 'freeflow-api-push',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        const j = d ? JSON.parse(d) : {};
        if (res.statusCode >= 400) return reject(new Error(res.statusCode + ': ' + (j.message || d.slice(0, 200))));
        resolve(j);
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  const files = execSync(`git diff-tree --no-commit-id --name-only -r ${sha}`).toString().trim().split('\n').filter(Boolean);
  const msg = execSync(`git log -1 --pretty=%B ${sha}`).toString().trim();
  const base = await api('GET', '/git/refs/heads/main');
  console.log('base main:', base.object.sha);
  const baseCommit = await api('GET', '/git/commits/' + base.object.sha);

  const treeItems = [];
  for (const f of files) {
    const buf = execSync(`git show ${sha}:${f.includes(' ') ? `"${f}"` : f}`);
    const blob = await api('POST', '/git/blobs', { content: buf.toString('base64'), encoding: 'base64' });
    treeItems.push({ path: f, mode: '100644', type: 'blob', sha: blob.sha });
    console.log('blob:', f, blob.sha.slice(0, 8));
  }
  const tree = await api('POST', '/git/trees', { base_tree: baseCommit.tree.sha, tree: treeItems });
  const commit = await api('POST', '/git/commits', { message: msg, tree: tree.sha, parents: [base.object.sha] });
  console.log('created commit:', commit.sha);
  await api('PATCH', '/git/refs/heads/main', { sha: commit.sha, force: false });
  console.log('main updated ->', commit.sha);
})().catch(e => { console.error('push failed:', e.message); process.exit(1); });
