// 让 iOS 端可以走明文 HTTP 连接局域网电脑引擎（如 http://192.168.1.10:8917）
// 用法: node tools/patch-info-plist.js ios/App/App/Info.plist
const fs = require('fs');
const file = process.argv[2];
if (!file || !fs.existsSync(file)) throw new Error('usage: node tools/patch-info-plist.js <Info.plist>');

let xml = fs.readFileSync(file, 'utf8');
if (!/<\/dict>\s*<\/plist>/.test(xml)) throw new Error('unexpected Info.plist shape');

if (!xml.includes('NSAppTransportSecurity')) {
  xml = xml.replace(
    /<\/dict>\s*<\/plist>/,
    '<key>NSAppTransportSecurity</key>\n\t<dict>\n\t\t<key>NSAllowsArbitraryLoads</key>\n\t\t<true/>\n\t</dict>\n</dict>\n</plist>'
  );
  fs.writeFileSync(file, xml);
}

if (!fs.readFileSync(file, 'utf8').includes('NSAppTransportSecurity')) {
  throw new Error('failed to insert NSAppTransportSecurity');
}
console.log('Info.plist patched: NSAllowsArbitraryLoads=true');
