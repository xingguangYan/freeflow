'use strict';
// 通过 GitHub REST API 推送（用于 github.com 的 git 主机被网络阻断、但 api.github.com 可达的环境）。
// 用法：GITHUB_TOKEN=<pat> node tools/push-github-api.js owner/repo branch [tag ...]
// 按本地提交顺序，依次还原 blob→tree→commit→PATCH ref，保留提交历史、作者与提交时间。
// 二进制安全：blob 内容按字节读取再 base64；被删除的文件以 sha:null 写入 tree。
const https = require('https');
const { execSync } = require('child_process');

const [ , , repo, branch, ...tags ] = process.argv;
const token = process.env.GITHUB_TOKEN;
if (!token || !repo || !branch) {
  console.error('usage: GITHUB_TOKEN=<pat> node tools/push-github-api.js owner/repo branch [tag ...]');
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
function git(...args) { return execSync('git ' + args.join(' '), { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 }).trim(); }
function gitBin(...args) { return execSync('git ' + args.join(' '), { maxBuffer: 1024 * 1024 * 1024 }); }

(async () => {
  // 1) 远端当前引用
  const refResp = await req('GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  if (refResp.s === 404) { console.error('远端分支不存在：' + refResp.b); process.exit(1); }
  if (refResp.s >= 400) { console.error('获取远端引用失败：' + refResp.s + ' ' + refResp.b.slice(0, 300)); process.exit(1); }
  const remoteSha = JSON.parse(refResp.b).object.sha;
  console.log('远端分支：' + branch + ' @ ' + remoteSha);

  // 2) 本地需要推送的提交（正序逐个还原）
  const revList = git('rev-list', '--reverse', remoteSha + '..HEAD').split('\n').filter(Boolean);
  if (!revList.length) { console.log('本地与远端一致，无需推送'); process.exit(0); }
  console.log('本地需推送提交数：' + revList.length);

  const shaMap = {}; // 原始 sha -> 重建 sha（供标签对齐用）
  let parentSha = remoteSha;
  let parentTreeSha = git('show', '-s', '--format=%T', remoteSha);

  for (const sha of revList) {
    const treeSha = git('show', '-s', '--format=%T', sha);
    const msg = git('log', '-1', '--pretty=%B', sha);
    const changed = git('diff-tree', '--no-commit-id', '--name-only', '-r', sha).split('\n').filter(Boolean);

    const treeItems = [];
    for (const f of changed) {
      const ls = git('ls-tree', '-r', treeSha, '--', f);
      if (!ls) {
        // 提交触及但新树中不存在 = 该提交删除了此文件
        treeItems.push({ path: f, mode: '100644', type: 'blob', sha: null });
        console.log('   del  ' + f);
        continue;
      }
      const [ meta, ...rest ] = ls.split('\t');
      const p = rest.join('\t');
      const [ mode, type, objSha ] = meta.split(/\s+/);
      if (type !== 'blob') { console.warn('未处理类型 ' + type + '：' + p); continue; }
      const content = gitBin('show', sha + ':' + p);
      const blobResp = await req('POST', `/repos/${repo}/git/blobs`, { content: content.toString('base64'), encoding: 'base64' });
      if (blobResp.s >= 400) { console.error('上传 blob 失败 ' + p + ': ' + blobResp.s + ' ' + blobResp.b.slice(0, 200)); process.exit(1); }
      treeItems.push({ path: p, mode, type: 'blob', sha: JSON.parse(blobResp.b).sha });
      console.log('   blob ' + p);
    }

    const treeResp = await req('POST', `/repos/${repo}/git/trees`, { base_tree: parentTreeSha, tree: treeItems });
    if (treeResp.s >= 400) { console.error('建树失败：' + treeResp.s + ' ' + treeResp.b.slice(0, 300)); process.exit(1); }
    parentTreeSha = JSON.parse(treeResp.b).sha;

    const commitResp = await req('POST', `/repos/${repo}/git/commits`, {
      message: msg,
      tree: parentTreeSha,
      parents: [parentSha],
      author: { name: git('log', '-1', '--pretty=%an', sha), email: git('log', '-1', '--pretty=%ae', sha), date: git('log', '-1', '--pretty=%aI', sha) },
      committer: { name: git('log', '-1', '--pretty=%cn', sha), email: git('log', '-1', '--pretty=%ce', sha), date: git('log', '-1', '--pretty=%cI', sha) }
    });
    if (commitResp.s >= 400) { console.error('建提交失败：' + commitResp.s + ' ' + commitResp.b.slice(0, 300)); process.exit(1); }
    parentSha = JSON.parse(commitResp.b).sha;
    shaMap[sha] = parentSha;
    console.log('   commit ' + sha.slice(0, 8) + ' -> ' + parentSha.slice(0, 8) + ' : ' + msg.split('\n')[0]);
  }

  // 3) 更新分支引用
  const patchResp = await req('PATCH', `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { sha: parentSha, force: false });
  if (patchResp.s >= 400) { console.error('更新分支引用失败：' + patchResp.s + ' ' + patchResp.b.slice(0, 300)); process.exit(1); }
  console.log('分支 ' + branch + ' 已推送到 ' + parentSha);

  // 4) 标签：对齐到重建后的等价提交
  for (const tag of tags) {
    const tagSha = git('rev-parse', '-q', '--verify', 'refs/tags/' + tag);
    const target = shaMap[tagSha] || shaMap[git('rev-list', '-1', tag)];
    if (!target) { console.warn('标签 ' + tag + ' 不在本次推送范围，跳过'); continue; }
    let r = await req('POST', `/repos/${repo}/git/refs`, { ref: 'refs/tags/' + tag, sha: target });
    if (r.s === 422) { // 标签已存在 → 强制对齐
      r = await req('PATCH', `/repos/${repo}/git/refs/tags/${encodeURIComponent(tag)}`, { sha: target, force: true });
    }
    if (r.s >= 400) console.warn('标签 ' + tag + ' 失败：' + r.s + ' ' + r.b.slice(0, 200));
    else console.log('标签 ' + tag + ' -> ' + target.slice(0, 8));
  }
  console.log('DONE: ' + parentSha);
})().catch(e => { console.error('致命错误：' + e.message); process.exit(1); });
