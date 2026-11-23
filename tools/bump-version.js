'use strict';
// 版本号同步：package.json / android build.gradle（web/index.html 手动）
const fs = require('fs');
const ver = process.argv[2];
if (!/^1\.\d+\.\d+$/.test(ver)) throw new Error('usage: node bump-version.js 1.9.8');
let pkg = fs.readFileSync('package.json', 'utf8');
pkg = pkg.replace(/"version": "\d+\.\d+\.\d+"/, '"version": "' + ver + '"');
fs.writeFileSync('package.json', pkg);
let grad = fs.readFileSync('android/app/build.gradle', 'utf8');
grad = grad.replace(/versionCode \d+/, m => 'versionCode ' + (parseInt(m.split(/\s+/)[1]) + 1));
grad = grad.replace(/versionName "[\d.]+"/, 'versionName "' + ver + '"');
fs.writeFileSync('android/app/build.gradle', grad);
const p = require('../package.json');
console.log('bumped to', p.version);
