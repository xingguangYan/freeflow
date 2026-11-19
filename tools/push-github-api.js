'use strict';
// 通过 GitHub REST API 推送（用于 github.com 的 git 主机被网络阻断、但 api.github.com 可达的环境）。
// 用法：GITHUB_TOKEN=<pat> node tools/push-github-api.js owner/repo branch tag
// 按本地提交顺序，依次还原 blob→tree→commit→PATCH ref，保留提交历史与文件内容。
const https = require('https');
const { execSync } = require('child_process');

const [ , , repo, branch, tag ] = process.argv;
const token = process.env.GITHUB_TOKEN;
if (!token || !repo || !branch) {
  console.error('usage: GITHUB_TOKEN=<pat> node tools/push-github-api.js owner/repo branch [tag]');
  process.exit(2);
}
const api = 'https://api.github.com';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request({
      host: 'api.github.com', path, method,
      timeout: 120000,
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'freeflow-api-push',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, resp => { let d = ''; resp.on('data', c => d += c); resp.on('end', () => resolve({ s: resp.statusCode, b: d })); });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error(path + ' timeout')); });
    if (payload) r.write(payload);
    r.end();
  });
}
function git(...args) { return execSync('git ' + args.join(' '), { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }).trim(); }

(async () => {
  // 1) 远端当前引用
  const refResp = await req('GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  if (refResp.s === 404) { console.error('远端分支不存在：' + refResp.b); process.exit(1); }
  if (refResp.s >= 400) { console.error('获取远端引用失败：' + refResp.s + ' ' + refResp.b.slice(0, 300)); process.exit(1); }
  const remoteSha = JSON.parse(refResp.b).object.sha;
  console.log('远端分支：' + branch + ' @ ' + remoteSha);

  // 2) 本地需要推送的提交（从远端之后到 HEAD，逆序不需要，正序逐个还原）
  const revList = git('rev-list', '--reverse', remoteSha + '..HEAD').split('\n').filter(Boolean);
  if (!revList.length) { console.log('本地与远端一致，无需推送'); process.exit(0); }
  console.log('本地需推送提交数：' + revList.length);

  // 3) 逐个提交还原
  let parentSha = remoteSha;
  for (const sha of revList) {
    const treeSha = git('show', '-s', '--format=%T', sha);
    const msg = git('log', '-1', '--pretty=%B', sha);
    const changed = git('diff-tree', '--no-commit-id', '--name-only', '-r', sha).split('\n').filter(Boolean);

    // 上传本次提交变更的所有文件为 blob（base_tree 为父树，未变更文件自动复用）
    const treeItems = [];
    for (const f of changed) {
      const ls = git('ls-tree', '-r', treeSha, '--', f);
      if (!ls) { console.warn('跳过（未在 tree 中）：' + f); continue; }
      const [ mode, type, blobSha, path ] = ls.split(/\s+/);
      if (type === 'blob') {
        const content = git('show', sha + ':' + path);
        const blobResp = await req('POST', `/repos/${repo}/git/blobs`, { content: Buffer.from(content, 'utf8').toString('base64'), encoding: 'base64' });
        if (blobResp.s >= 400) { console.error('上传 blob 失败 ' + path + ': ' + blobResp.s + ' ' + blobResp.b.slice(0, 200)); process.exit(1); }
        treeItems.push({ path, mode, type: 'blob', sha: JSON.parse(blobResp.b).sha });
        console.log('   blob ' + path + ' -> ' + JSON.parse(blobResp.b).sha.slice(0, 8));
      } else {
        console.warn('未处理类型 ' + type + '：' + path);
      }
    }

    const treeResp = await req('POST', `/repos/${repo}/git/trees`, { base_tree: parentSha === remoteSha ? git('show', '-s', '--format=%T', remoteSha) : parentTreeSha, tree: treeItems });
    if (treeResp.s >= 400) { console.error('建树失败：' + treeResp.s + ' ' + treeResp.b.slice(0, 300)); process.exit(1); }
    const newTreeSha = JSON.parse(treeResp.b).sha;
    parentTreeSha = newTreeSha; // 后续提交以本树为 base_tree

    const commitResp = await req('POST', `/repos/${repo}/git/commits`, { message: msg, tree: newTreeSha, parents: [parentSha] });
    if (commitResp.s >= 400) { console.error('建提交失败：' + commitResp.s + ' ' + commitResp.b.slice(0, 300)); process.exit(1); }
    parentSha = JSON.parse(commitResp.b).sha;
    console.log('   commit ' + parentSha.slice(0, 8) + ' : ' + msg.split('\n')[0]);
  }

  // 4) 更新引用
  const patchResp = await req('PATCH', `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { sha: parentSha, force: false });
  if (patchResp.s >= 400) { console.error('更新分支引用失败：' + patchResp.s + ' ' + patchResp.b.slice(0, 300)); process.exit(1); }
  console.log('分支 ' + branch + ' 已推送到 ' + parentSha);

  // 5) 标签
  if (tag) {
    const tagResp = await req('POST', `/repos/${repo}/git/refs`, { ref: 'refs/tags/' + tag, sha: parentSha });
    if (tagResp.s >= 400) console.warn('标签推送（可能已存在）：' + tagResp.s + ' ' + tagResp.b.slice(0, 200));
    else console.log('标签 ' + tag + ' 已创建');
  }
  console.log('DONE: ' + parentSha);
})().catch(e => { console.error('致命错误：' + e.message); process.exit(1); });
