'use strict';
// 登录检测回归：验证云平台「登录页尚未登完即误判成功」的 bug 已修复
// 场景：登录页 / 未登录首页 / 已登录编辑页 / cookie 兜底 / 登录墙
const { chromium } = require('playwright');
const platforms = require('../platforms');
const auto = require('../automation');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name + (detail ? ' -> ' + detail : '')); } };
const byId = id => platforms.find(p => p.id === id);
const mockCtx = cookieNames => ({ cookies: async () => cookieNames.map(n => ({ name: n })) });
const pageFixture = (url, html) => `<!DOCTYPE html><html><body>${html}</body></html>`;
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const probe = async (url, html, ctx, platform) => {
    await page.setContent(pageFixture(url, html));
    page._ff_url = url;
    const orig = page.url.bind(page);
    page.url = () => page._ff_url;
    const r = await auto.checkLoggedIn(ctx, platform, page);
    page.url = orig;
    return r;
  };
  const tc = byId('tencentcloud'), hw = byId('huaweicloud'), al = byId('aliyun'), ct = byId('c51cto'), wx = byId('wechat');
  // 1) 腾讯云登录页
  check('tencentcloud login page not logged in', await probe('https://cloud.tencent.com/login', '<div>扫码登录</div>', mockCtx([]), tc) === false);
  // 2) 腾讯云开发者首页未登录：loggedInUrl 命中但有「登录」按钮 —— 回归核心
  check('tencentcloud developer home logged-out not logged in', await probe('https://cloud.tencent.com/developer', '<button>登录</button><button>注册</button>', mockCtx([]), tc) === false);
  // 3) 腾讯云登录后进入编辑页：标题框出现
  check('tencentcloud editor logged in', await probe('https://cloud.tencent.com/developer/article/write', '<textarea placeholder="请输入标题"></textarea>', mockCtx([]), tc) === true);
  // 4) 华为云 /blogs 未登录（WAF cookie 存在但有「登录」按钮）
  check('huaweicloud blogs logged-out not logged in', await probe('https://bbs.huaweicloud.com/blogs', '<button>登录</button>', mockCtx(['HWWAFSESID']), hw) === false);
  // 5) 华为云登录后出现「写博客」
  check('huaweicloud logged in via write button', await probe('https://bbs.huaweicloud.com/blogs', '<button>写博客</button>', mockCtx(['hwssotoken', 'HWWAFSESID']), hw) === true);
  // 6) 阿里云登录页
  check('aliyun login page not logged in', await probe('https://account.aliyun.com/login/login.htm', '<div>密码登录</div>', mockCtx([]), al) === false);
  // 7) 51CTO 登录页
  check('51cto login page not logged in', await probe('https://blog.51cto.com/login', '<div>登录</div>', mockCtx([]), ct) === false);
  // 8) cookie 全在 → 已登录（严格模式；页面无关键元素，纯考 cookie 兜底）
  check('51cto all login cookies -> logged in', await probe('https://blog.51cto.com/blogger/publish', '<div>正文区</div>', mockCtx(['_51cto_sso', '51cto_sso']), ct) === true);
  // 9) hasLoginCookies 严格模式：任一声明 cookie 缺失即为未登录（防 WAF cookie 误判）
  check('hasLoginCookies strict: full set -> true', await auto.hasLoginCookies(mockCtx(['_51cto_sso', '51cto_sso']), ct) === true);
  check('hasLoginCookies strict: partial set -> false', await auto.hasLoginCookies(mockCtx(['51cto_sso']), ct) === false);
  check('hasLoginCookies strict: single-declared platform -> true', await auto.hasLoginCookies(mockCtx(['sessionid']), byId('toutiao')) === true);
  // 10) 微信公众号后台已登录
  check('wechat backend logged in', await probe('https://mp.weixin.qq.com/cgi-bin/home', '<div>新建图文</div>', mockCtx(['slave_sid', 'master_sid']), wx) === true);
  // 11) 登录墙文案 → 未登录
  check('login wall not logged in', await probe('https://mp.weixin.qq.com/cgi-bin/home', '<div>登录已失效，请重新登录</div>', mockCtx([]), wx) === false);
  await browser.close();
  console.log(`结果：${pass} 通过，${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
