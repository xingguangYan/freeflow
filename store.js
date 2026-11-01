'use strict';
// 本地 JSON 存储。所有数据都留在本机 data/ 目录，不经过任何第三方服务器。
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const MATERIALS = path.join(DATA, 'materials');
fs.mkdirSync(MATERIALS, { recursive: true });

function load(name, fallback) {
  const p = path.join(DATA, name);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function save(name, obj) {
  fs.writeFileSync(path.join(DATA, name), JSON.stringify(obj, null, 2), 'utf8');
}
function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function filesDir(name) {
  const d = path.join(DATA, name);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

module.exports = { load, save, uid, DATA, MATERIALS, filesDir };
