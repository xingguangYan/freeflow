'use strict';
// 一键镜像部署到 GitCode（中文 README 为主）。
// 用法：node tools/sync-gitcode.js
// 流程：基于本地 main 建/重置 gitcode 分支 → README.md(EN) 改名 README_EN.md、
//       README_CN.md(ZH) 改名 README.md 并修正互链 → 提交 → 强推到 gitcode 的 main → 推 tags。
const { execSync } = require('child_process');
const fs = require('fs');

const sh = cmd => execSync(cmd, { stdio: 'pipe' }).toString().trim();
const nl = f => fs.readFileSync(f, 'utf8').includes('\r\n') ? '\r\n' : '\n';

console.log('=> 基于 main 重置 gitcode 分支');
sh('git checkout -B gitcode main');

console.log('=> 交换 README：中文为主');
if (!fs.existsSync('README_CN.md')) throw new Error('README_CN.md 不存在');
fs.renameSync('README.md', 'README_EN.md');
fs.renameSync('README_CN.md', 'README.md');

// 修正语言互链（英文文件现在叫 README_EN.md，中文文件现在叫 README.md）
const fix = (file, from, to) => {
  const E = nl(file);
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.includes(from)) { console.log('  跳过（未找到 ' + from + '）'); return; }
  fs.writeFileSync(file, raw.split(from).join(to));
};
fix('README.md', '**[English](README.md)**', '**[English](README_EN.md)**');
fix('README_EN.md', '**[中文文档](README_CN.md)**', '**[中文文档](README.md)**');
// 目录/正文中对 README_CN.md 的其它引用
fix('README_EN.md', 'README_CN.md', 'README.md');

sh('git rm -f --quiet README_CN.md');
sh('git add README.md README_EN.md');
execSync('git commit -m "docs: gitcode 镜像——中文 README 为主"', { stdio: 'pipe' });

console.log('=> 推送到 gitcode（需要凭证：用户名 + 访问令牌）');
process.env.GIT_TERMINAL_PROMPT = 0;
process.env.GCM_INTERACTIVE = 'never';
try {
  sh('git push gitcode gitcode:main --force');
  console.log('main 已推送到 gitcode');
} catch (e) {
  console.log('推送失败（可能缺凭证）：' + String(e.message).split('\n')[0]);
  console.log('请配置 gitcode 访问令牌后重跑本脚本，或手动执行：');
  console.log('  git credential approve 写入凭证（host=gitcode.com）后重跑本脚本');
  process.exitCode = 1;
}

try {
  sh('git push gitcode --tags');
  console.log('tags 已推送到 gitcode');
} catch (e) {
  console.log('tags 推送失败：' + String(e.message).split('\n')[0]);
}

sh('git checkout main');
console.log('done');
