'use strict';
// 由 audit.json 生成 53 平台验证矩阵（PLATFORM_MATRIX.md）
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'platform-audit');
const audit = JSON.parse(fs.readFileSync(path.join(OUT, 'audit.json'), 'utf8'));

function verdict(r) {
  if (r.error) return '入口不可达（' + r.error.slice(0, 40) + '）';
  if (/^chrome-error:/.test(r.finalUrl || '')) return '入口不可达（浏览器错误/网络阻断）';
  if (/^about:blank/.test(r.finalUrl || '')) return '空白页（可能被拦截）';
  if (r.loginWall) return '登录墙（需登录态）';
  if (r.captcha) return '验证码/风控';
  const s = r.editorSignals || {};
  if ((s.contenteditable || 0) + (s.textarea || 0) + (s.fileInput || 0) > 0) return '编辑控件可见（仍需登录发布）';
  return '未识别到编辑控件（SPA/需登录交互）';
}
function editors(s) {
  const names = [];
  if (s.proseMirror) names.push('ProseMirror');
  if (s.quill) names.push('Quill');
  if (s.codeMirror) names.push('CodeMirror');
  if (s.tinyMCE) names.push('TinyMCE');
  if (s.ueditor) names.push('UEditor');
  if (s.contenteditable) names.push('contenteditable×' + s.contenteditable);
  if (s.textarea) names.push('textarea×' + s.textarea);
  if (s.fileInput) names.push('file×' + s.fileInput);
  if (s.iframes) names.push('iframe×' + s.iframes);
  return names.length ? names.join(', ') : '-';
}
const rows = audit.results.map((r, i) => {
  const shot = r.shots && r.shots[0] ? '[' + r.id + '.jpg](' + 'tools/platform-audit/' + r.shots[0] + ')' : '-';
  return '| ' + (i + 1) + ' | `' + r.id + '` | ' + r.name + ' | ' + r.types.join('/') + ' | ' + r.entry + ' | ' + (r.finalUrl || '-') + ' | ' + (r.httpStatus === null ? '-' : r.httpStatus) + ' | ' + verdict(r) + ' | ' + editors(r.editorSignals || {}) + ' | ' + shot + ' |';
});
const md = [
  '# 53 平台发布入口验证矩阵',
  '',
  '- 审计时间：' + audit.startedAt + ' ~ ' + audit.finishedAt,
  '- 方法：Playwright 真实访问每个平台配置的编辑入口（`platforms.js` → `editorUrls[0]`），记录最终 URL、登录墙/验证码、编辑器指纹与截图。',
  '- 说明：标记「登录墙」表示入口可达且正确重定向到登录页，登录后才会渲染编辑器；标记「编辑控件可见」表示未登录也渲染了编辑器壳（仍需登录才能发布）。',
  '- 自动填写/发布验证需要已登录账号；本机当前无已登录账号，未做虚假标记。',
  '',
  '| # | 平台 id | 名称 | 类型 | 发布入口 | 最终 URL | HTTP | 判定 | 编辑器特征 | 截图 |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows,
  '',
  '## 降级策略',
  '',
  '1. 登录墙：程序自动打开登录页，扫码后从断点继续（`automation.js` 三级容灾）。',
  '2. 编辑器结构变化：平台专属选择器 → 通用启发式 → 剪贴板手动模式，并明确提示失败原因。',
  '3. 入口失效（404/DNS）：任务结果标记失败并保留内容，不静默跳过。'
].join('\n');
fs.writeFileSync(path.join(__dirname, '..', 'PLATFORM_MATRIX.md'), md);
console.log('matrix written: ' + rows.length + ' platforms');
