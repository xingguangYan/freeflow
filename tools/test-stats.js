'use strict';
// 数据采集解析回归：接口字段映射 + 单位换算 + 干扰字段排除 + DOM 兜底
const stats = require('../stats.js');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name + (detail ? ' -> ' + detail : '')); } };

const api = stats.extractFromJson([
  { json: { code: 0, data: { statistics: { fans: 1234, visitedCount: '5.6万', likeCount: 88, followRate: 0.12, viewTime: 99 } } } },
  { json: { data: { list: [{ views: 500 }, { views: 8000 }] } } }
]);
check('api fans', api.fans === 1234, JSON.stringify(api));
check('api read with 万 unit', api.read === 56000, JSON.stringify(api));
check('api like', api.like === 88, JSON.stringify(api));
check('rate/time fields excluded', api.read === 56000, JSON.stringify(api));

const dom = stats.extract('粉丝 12万  阅读量 3456  点赞 78  评论 9  转发 3');
check('dom fans 万', dom.fans === 120000, JSON.stringify(dom));
check('dom read', dom.read === 3456, JSON.stringify(dom));
check('dom like/comment/share', dom.like === 78 && dom.comment === 9 && dom.share === 3, JSON.stringify(dom));

const merged = { ...dom, ...api };
check('merge prefers api', merged.fans === 1234 && merged.read === 56000, JSON.stringify(merged));
check('parseNum formats', stats.parseNum('1.2万') === 12000 && stats.parseNum('3k') === 3000 && stats.parseNum('7,890') === 7890);

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
