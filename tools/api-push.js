'use strict';
// 通过 GitHub REST API 提交文件（当 github.com git 端口被阻断时的备用方案）。
// 用法: GITHUB_TOKEN=xxx node tools/api-push.js <owner/repo> <branch> <message> <file1> [file2...]
const fs = require('fs');
const path = require('path');

(async () => {
  const [repo, branch, message, ...files] = process.argv.slice(2);
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !branch || !message || !files.length || !token) {
    console.error('usage: GITHUB_TOKEN=... node tools/api-push.js owner/repo branch "message" file1 file2');
    process.exit(1);
  }
  const api = 'https://api.github.com';
  const headers = { Authorization: `token ${token}`, 'User-Agent': 'freeflow', Accept: 'application/vnd.github+json' };
  const j = async (url, opts = {}) => {
    const r = await fetch(api + url, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${opts.method || 'GET'} ${url} -> ${r.status} ${body.message || ''}`);
    return body;
  };
  const ref = await j(`/repos/${repo}/git/ref/heads/${branch}`);
  const baseSha = ref.object.sha;
  const baseCommit = await j(`/repos/${repo}/git/commits/${baseSha}`);
  const tree = [];
  for (const f of files) {
    const content = fs.readFileSync(f);
    const blob = await j(`/repos/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: content.toString('base64'), encoding: 'base64' })
    });
    tree.push({ path: f.split(path.sep).join('/'), mode: '100644', type: 'blob', sha: blob.sha });
    console.log('blob', f, blob.sha.slice(0, 8));
  }
  const newTree = await j(`/repos/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree })
  });
  const newCommit = await j(`/repos/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseSha] })
  });
  await j(`/repos/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommit.sha, force: false })
  });
  console.log('pushed', newCommit.sha);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
