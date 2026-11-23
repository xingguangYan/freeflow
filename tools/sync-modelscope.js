'use strict';
// 一键部署网页版到 ModelScope 创空间（免费公网镜像）。
// 用法：node tools/sync-modelscope.js
// 凭证读取 .modelscope.local.json（已 gitignore，不入库）：
//   { "namespace": "xg346049806", "name": "freeflow", "token": "ms-xxxx" }
// 流程：同步 modelspace/ 到 .ms-studio 工作副本 → 提交推送 →
//       调 /api/v1/studio/{ns}/{name}/rebuild 触发重建 → 轮询直到 Running/Failed。
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('https');

const ROOT = path.resolve(__dirname, '..');
const STUDIO_DIR = path.join(ROOT, '.ms-studio');
const SRC = path.join(ROOT, 'modelspace');
const CFG_FILE = path.join(ROOT, '.modelscope.local.json');

const sh = cmd => execSync(cmd, { stdio: 'pipe', cwd: ROOT }).toString().trim();

function api(method, urlPath, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        method,
        host: 'modelscope.cn',
        path: urlPath,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
        timeout: 40000,
      },
      res => {
        let raw = '';
        res.on('data', c => (raw += c));
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch (e) { reject(new Error('非 JSON 响应: ' + raw.slice(0, 200))); }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('请求超时')));
    if (data) req.write(data);
    req.end();
  });
}

function syncDir(src, dst) {
  // 递归拷贝 src -> dst（覆盖同名文件）
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) syncDir(s, d);
 else fs.copyFileSync(s, d);
  }
}

(async () => {
  if (!fs.existsSync(CFG_FILE)) {
    console.log('缺少 .modelscope.local.json（namespace/name/token），跳过 ModelScope 部署');
    console.log('示例: {"namespace":"xg346049806","name":"freeflow","token":"ms-xxxx"}');
    process.exitCode = 1;
    return;
  }
  const { namespace, name, token } = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
  const repo = `https://oauth2:${token}@www.modelscope.cn/studios/${namespace}/${name}.git`;
  const base = `/api/v1/studio/${namespace}/${name}`;

  // 1. 准备工作副本
  console.log('=> 同步 modelspace/ 到 .ms-studio/');
  if (!fs.existsSync(STUDIO_DIR)) {
    execSync(`git clone --depth 1 ${repo} .ms-studio`, { stdio: 'pipe', cwd: ROOT });
  }
  syncDir(path.join(SRC, 'web'), path.join(STUDIO_DIR, 'web'));
  for (const f of ['app.py', 'requirements.txt', 'README.md']) {
    fs.copyFileSync(path.join(SRC, f), path.join(STUDIO_DIR, f));
  }

  // 2. 提交并推送
  console.log('=> 提交并推送到 Space 仓库');
  execSync('git add -A', { stdio: 'pipe', cwd: STUDIO_DIR });
  let changed = true;
  try {
    execSync('git diff --cached --quiet', { stdio: 'pipe', cwd: STUDIO_DIR });
    changed = false;
  } catch (e) { /* 有暂存差异，changed=true */ }
  if (changed) {
    execSync('git -c user.name="xingguangYan" -c user.email="xingguangyan0703@gmail.com" commit -m "deploy: 同步网页版"', { stdio: 'pipe', cwd: STUDIO_DIR });
    execSync('git push origin master', { stdio: 'pipe', cwd: STUDIO_DIR });
    console.log('  已推送');
  } else {
    console.log('  无变更，跳过推送');
  }

  // 3. 触发重建
  console.log('=> 触发重建');
  const rb = await api('PUT', base + '/rebuild', token, {});
  if (rb.Code !== 200) throw new Error('rebuild 失败: ' + JSON.stringify(rb));
  console.log('  rebuild 已提交');

  // 4. 轮询状态（镜像构建约 3~7 分钟）
  console.log('=> 等待构建（最多 10 分钟）');
  const deadline = Date.now() + 10 * 60 * 1000;
  let status = '';
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 20000));
    const st = await api('GET', base, token, null);
    status = (st.Data && st.Data.Status) || 'Unknown';
    const err = (st.Data && st.Data.FailedMessage) || '';
    process.stdout.write(`  状态: ${status}${err ? ' (' + err + ')' : ''}\n`);
    if (status === 'Running') break;
    if (status === 'Failed') throw new Error('Space 启动失败: ' + err);
  }
  if (status !== 'Running') throw new Error('构建超时，最后状态: ' + status);

  console.log('=> 部署完成');
  console.log('  Space:  https://modelscope.cn/studios/' + namespace + '/' + name);
  console.log('  直连:   https://' + namespace + '-' + name + '.ms.show');
})().catch(e => {
  console.error('ModelScope 部署出错: ' + (e.message || e));
  process.exitCode = 1;
});
