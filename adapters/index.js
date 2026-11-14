'use strict';
// 平台适配器注册表：每个平台一个独立文件，缺失则回落到 platforms.js 配置
const cache = new Map();
const FILES = {
  csdn: './csdn', baijia: './baijia', juejin: './juejin', cnblogs: './cnblogs', wechat: './wechat',
  zhihu: './zhihu', jianshu: './jianshu', segmentfault: './segmentfault',
  huaweicloud: './huaweicloud', tencentcloud: './tencentcloud', aliyun: './aliyun',
  c51cto: './c51cto', oschina: './oschina', infoq: './infoq'
};
function get(id) {
  if (!id || !FILES[id]) return null;
  if (!cache.has(id)) {
    try { cache.set(id, require(FILES[id])); }
    catch (e) { console.warn('[adapter] load failed for ' + id + ': ' + e.message); cache.set(id, null); }
  }
  return cache.get(id);
}
function ids() { return Object.keys(FILES); }
module.exports = { get, ids };
