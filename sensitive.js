'use strict';
// 违禁词检测。内置一份常见的「营销/平台违规高风险词」基础库，
// 用户可以把 data/sensitive.txt 放成「一行一词」的私人词库自动并入扫描。
const fs = require('fs');
const path = require('path');
const { DATA } = require('./store');

const BUILTIN = [
  '加微信', '加我微信', '加v', '微信号', 'qq号', '加q群', '私聊我', '点此领取', '免费领取',
  '零风险', '稳赚', '日赚', '月入十万', '百分百赚钱', '兼职日结', '刷单', '代开发票',
  '出售微信号', '解封qq', '破解版', '代写论文', '办证', '刻章', '迷药', '赌博', '博彩',
  '私彩', '网赚', '色流', '一夜暴富', '无抵押贷款', '套现', '代购假货', '野外动物',
  '内部渠道', '机密资料', '翻墙', '科学上网', '代挂号', '黄牛', '办证学历'
];

function userWords() {
  const p = path.join(DATA, 'sensitive.txt');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function scan(text) {
  if (!text) return [];
  const words = [...new Set([...BUILTIN, ...userWords()])];
  const low = text.toLowerCase();
  const hits = [];
  for (const w of words) {
    const wl = w.toLowerCase();
    let i = low.indexOf(wl);
    if (i !== -1) hits.push({ word: w, count: low.split(wl).length - 1, at: i });
  }
  return hits.sort((a, b) => b.count - a.count);
}

module.exports = { scan, userWords, BUILTIN };
