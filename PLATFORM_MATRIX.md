# 53 平台发布入口验证矩阵

- 审计时间：2026-11-12T08:36:09.520Z ~ 2026-11-12T08:44:00.344Z
- 方法：Playwright 真实访问每个平台配置的编辑入口（`platforms.js` → `editorUrls[0]`），记录最终 URL、登录墙/验证码、编辑器指纹与截图。
- 说明：标记「登录墙」表示入口可达且正确重定向到登录页，登录后才会渲染编辑器；标记「编辑控件可见」表示未登录也渲染了编辑器壳（仍需登录才能发布）。
- 自动填写/发布验证需要已登录账号；本机当前无已登录账号，未做虚假标记。

| # | 平台 id | 名称 | 类型 | 发布入口 | 最终 URL | HTTP | 判定 | 编辑器特征 | 截图 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `wechat` | 微信公众号 | article | https://mp.weixin.qq.com/ | https://mp.weixin.qq.com/ | 200 | 登录墙（需登录态） | iframe×2 | [wechat.jpg](tools/platform-audit/shots/wechat.jpg) |
| 2 | `toutiao` | 头条号 | article | https://mp.toutiao.com/profile_v4/graphic/publish?type=news | https://mp.toutiao.com/auth/page/login?redirect_url=JTJGcHJvZmlsZV92NCUyRmdyYXBoaWMlMkZwdWJsaXNoJTNGdHlwZSUzRG5ld3M= | 200 | 登录墙（需登录态） | - | [toutiao.jpg](tools/platform-audit/shots/toutiao.jpg) |
| 3 | `baijia` | 百家号 | article | https://baijiahao.baidu.com/builder/rc/edit?type=news | https://baijiahao.baidu.com/builder/theme/bjh/login | 200 | 登录墙（需登录态） | iframe×1 | [baijia.jpg](tools/platform-audit/shots/baijia.jpg) |
| 4 | `zhihu` | 知乎 | article | https://zhuanlan.zhihu.com/write | https://www.zhihu.com/signin?next=http%3A%2F%2Fzhuanlan.zhihu.com%2Fwrite | 200 | 登录墙（需登录态） | - | [zhihu.jpg](tools/platform-audit/shots/zhihu.jpg) |
| 5 | `xiaohongshu` | 小红书 | article/image | https://creator.xiaohongshu.com/publish/publish | https://creator.xiaohongshu.com/login?source=&redirectReason=401&lastUrl=%252Fpublish%252Fpublish | 200 | 登录墙（需登录态） | iframe×1 | [xiaohongshu.jpg](tools/platform-audit/shots/xiaohongshu.jpg) |
| 6 | `bilibili` | B站专栏 | article | https://member.bilibili.com/york/read-editor?not_checkout=1 | https://member.bilibili.com/york/read-editor?not_checkout=1 | 200 | 编辑控件可见（仍需登录发布） | textarea×1 | [bilibili.jpg](tools/platform-audit/shots/bilibili.jpg) |
| 7 | `jianshu` | 简书 | article | https://www.jianshu.com/writer/ | https://www.jianshu.com/sign_in | 200 | 未识别到编辑控件（SPA/需登录交互） | - | [jianshu.jpg](tools/platform-audit/shots/jianshu.jpg) |
| 8 | `csdn` | CSDN | article | https://mp.csdn.net/mp_blog/creation/editor | https://mp.csdn.net/mp_blog/creation/editor | 200 | 编辑控件可见（仍需登录发布） | textarea×1, file×1, iframe×1 | [csdn.jpg](tools/platform-audit/shots/csdn.jpg) |
| 9 | `weibo` | 微博 | article | https://weibo.com/ttarticle/publish | https://weibo.com/ttarticle/publish | 200 | 未识别到编辑控件（SPA/需登录交互） | - | [weibo.jpg](tools/platform-audit/shots/weibo.jpg) |
| 10 | `sohu` | 搜狐号 | article | https://mp.sohu.com/mpfe/v3/main/issue/article | https://mp.sohu.com/ | 200 | 未识别到编辑控件（SPA/需登录交互） | - | [sohu.jpg](tools/platform-audit/shots/sohu.jpg) |
| 11 | `wangyi` | 网易号 | article | http://mp.163.com/index.html#/article-publish/publish | https://mp.163.com/login.html?url=http%3A%2F%2Fmp.163.com%2Findex.html%23%2Farticle-publish%2Fpublish#/ | 200 | 登录墙（需登录态） | iframe×1 | [wangyi.jpg](tools/platform-audit/shots/wangyi.jpg) |
| 12 | `dayu` | 大鱼号 | article | https://mp.dayu.com/editor?from=dashboard | https://mp.dayu.com/404.html?url=/editor?from=dashboard | 200 | 未识别到编辑控件（SPA/需登录交互） | - | [dayu.jpg](tools/platform-audit/shots/dayu.jpg) |
| 13 | `yidian` | 一点资讯 | article | https://mp.yidianzixun.com/main/article/ | https://mp.yidianzixun.com/main/article/ | 200 | 未识别到编辑控件（SPA/需登录交互） | - | [yidian.jpg](tools/platform-audit/shots/yidian.jpg) |
| 14 | `sina` | 新浪看点 | article | https://mp.sina.com.cn/newmp/articles/add | https://mp.sina.com.cn/?http=fromhttp | 200 | 未识别到编辑控件（SPA/需登录交互） | - | [sina.jpg](tools/platform-audit/shots/sina.jpg) |
| 15 | `kuaichuan` | 快传号 | article | https://kuaichuan.360.cn/ucweb/article/edit | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [kuaichuan.jpg](tools/platform-audit/shots/kuaichuan.jpg) |
| 16 | `dongfang` | 东方号 | article | https://mp.eastday.com/uc/wemedia/article/publish | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [dongfang.jpg](tools/platform-audit/shots/dongfang.jpg) |
| 17 | `ifeng` | 凤凰号 | article | https://mp.ifeng.com/main/publish | https://mp.ifeng.com/main/publish | 200 | 未识别到编辑控件（SPA/需登录交互） | - | [ifeng.jpg](tools/platform-audit/shots/ifeng.jpg) |
| 18 | `meipian` | 美篇 | article | https://www.meipian.cn/html/newarticle/ | https://www.meipian.cn/html/newarticle/ | 200 | 未识别到编辑控件（SPA/需登录交互） | - | [meipian.jpg](tools/platform-audit/shots/meipian.jpg) |
| 19 | `chejiahao` | 车家号 | article | https://chejiahao.autohome.com.cn/publish | https://chejiahao.autohome.com.cn/publish | 404 | 未识别到编辑控件（SPA/需登录交互） | - | [chejiahao.jpg](tools/platform-audit/shots/chejiahao.jpg) |
| 20 | `cnblogs` | 博客园 | article | https://i.cnblogs.com/posts/edit | https://account.cnblogs.com/signin?returnUrl=https:%2F%2Fi.cnblogs.com%2Fposts%2Fedit | 200 | 登录墙（需登录态） | textarea×2, iframe×5 | [cnblogs.jpg](tools/platform-audit/shots/cnblogs.jpg) |
| 21 | `juejin` | 掘金 | article | https://juejin.cn/editor/drafts/new | https://juejin.cn/login?to=https%3A%2F%2Fjuejin.cn%2Feditor%2Fdrafts%2Fnew | 200 | 登录墙（需登录态） | - | [juejin.jpg](tools/platform-audit/shots/juejin.jpg) |
| 22 | `segmentfault` | SegmentFault | article | https://segmentfault.com/write | https://segmentfault.com/user/login | 200 | 登录墙（需登录态） | iframe×1 | [segmentfault.jpg](tools/platform-audit/shots/segmentfault.jpg) |
| 23 | `tieba` | 百度贴吧 | article | https://tieba.baidu.com/ | https://tieba.baidu.com/ | 403 | 验证码/风控 | - | [tieba.jpg](tools/platform-audit/shots/tieba.jpg) |
| 24 | `xueqiu` | 雪球 | article | https://xueqiu.com/ | https://www.xueqiu.com/ | 200 | 登录墙（需登录态） | - | [xueqiu.jpg](tools/platform-audit/shots/xueqiu.jpg) |
| 25 | `douban` | 豆瓣 | article | https://www.douban.com/note/create/ | https://www.douban.com/note/create | 403 | 未识别到编辑控件（SPA/需登录交互） | - | [douban.jpg](tools/platform-audit/shots/douban.jpg) |
| 26 | `douyin` | 抖音 | video | https://creator.douyin.com/creator-micro/content/upload?default=1 | https://creator.douyin.com/creator-micro/content/upload?default=1 | 200 | 登录墙（需登录态） | iframe×5 | [douyin.jpg](tools/platform-audit/shots/douyin.jpg) |
| 27 | `kuaishou` | 快手 | video | https://cp.kuaishou.com/article/publish/video | https://cp.kuaishou.com/article/publish/video | 200 | 未识别到编辑控件（SPA/需登录交互） | - | [kuaishou.jpg](tools/platform-audit/shots/kuaishou.jpg) |
| 28 | `bilibili_video` | B站视频 | video | https://member.bilibili.com/platform/upload/video/frame | https://passport.bilibili.com/login?gourl=https%3A%2F%2Fmember.bilibili.com%2F | 200 | 登录墙（需登录态） | iframe×1 | [bilibili_video.jpg](tools/platform-audit/shots/bilibili_video.jpg) |
| 29 | `xigua` | 西瓜视频 | video | https://studio.ixigua.com/upload | https://creator.douyin.com/ | 200 | 登录墙（需登录态） | iframe×5 | [xigua.jpg](tools/platform-audit/shots/xigua.jpg) |
| 30 | `haokan` | 好看视频 | video | https://haokan.baidu.com/videoui/page/pc/ucenter#/upload/video | https://haokan.baidu.com/#/upload/video | 200 | 未识别到编辑控件（SPA/需登录交互） | iframe×6 | [haokan.jpg](tools/platform-audit/shots/haokan.jpg) |
| 31 | `shipinhao` | 微信视频号 | video | https://channels.weixin.qq.com/platform/upload | https://channels.weixin.qq.com/login.html | 200 | 登录墙（需登录态） | iframe×1 | [shipinhao.jpg](tools/platform-audit/shots/shipinhao.jpg) |
| 32 | `zhihu_video` | 知乎视频 | video | https://www.zhihu.com/creator | https://www.zhihu.com/signin?next=%2Fcreator | 200 | 登录墙（需登录态） | - | [zhihu_video.jpg](tools/platform-audit/shots/zhihu_video.jpg) |
| 33 | `iqiyi` | 爱奇艺号 | video | https://mp.iqiyi.com/video/publish | https://creator.iqiyi.com/ | 200 | 登录墙（需登录态） | - | [iqiyi.jpg](tools/platform-audit/shots/iqiyi.jpg) |
| 34 | `qie` | 企鹅号(腾讯视频) | video | https://om.qq.com/main/content/publish/video | https://om.qq.com/userAuth/index | 200 | 登录墙（需登录态） | iframe×2 | [qie.jpg](tools/platform-audit/shots/qie.jpg) |
| 35 | `sohu_video` | 搜狐号视频 | video | https://mp.sohu.com/mpfe/v4/main/issue/video | https://mp.sohu.com/ | 200 | 未识别到编辑控件（SPA/需登录交互） | - | [sohu_video.jpg](tools/platform-audit/shots/sohu_video.jpg) |
| 36 | `acfun` | AcFun | video | https://www.acfun.cn/upload | https://www.acfun.cn/upload | 502 | 未识别到编辑控件（SPA/需登录交互） | - | [acfun.jpg](tools/platform-audit/shots/acfun.jpg) |
| 37 | `youku` | 优酷 | video | https://creator.youku.com/upload | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [youku.jpg](tools/platform-audit/shots/youku.jpg) |
| 38 | `weibo_video` | 微博视频 | video | https://weibo.com/ | https://weibo.com/newlogin?tabtype=weibo&gid=102803&openLoginLayer=0&url=https://weibo.com/ | 200 | 登录墙（需登录态） | - | [weibo_video.jpg](tools/platform-audit/shots/weibo_video.jpg) |
| 39 | `medium` | Medium | article | https://medium.com/new-story | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [medium.jpg](tools/platform-audit/shots/medium.jpg) |
| 40 | `devto` | Dev.to | article | https://dev.to/new | https://dev.to/new | 200 | 未识别到编辑控件（SPA/需登录交互） | - | [devto.jpg](tools/platform-audit/shots/devto.jpg) |
| 41 | `linkedin` | LinkedIn 领英 | article | https://www.linkedin.com/post/new | https://www.linkedin.cn/incareer/home | 451 | 未识别到编辑控件（SPA/需登录交互） | - | [linkedin.jpg](tools/platform-audit/shots/linkedin.jpg) |
| 42 | `reddit` | Reddit | article | https://www.reddit.com/submit | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [reddit.jpg](tools/platform-audit/shots/reddit.jpg) |
| 43 | `hashnode` | Hashnode | article | https://hashnode.com/new/draft | https://hashnode.com/new/draft | 404 | 未识别到编辑控件（SPA/需登录交互） | - | [hashnode.jpg](tools/platform-audit/shots/hashnode.jpg) |
| 44 | `substack` | Substack | article | https://substack.com/publish/post | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [substack.jpg](tools/platform-audit/shots/substack.jpg) |
| 45 | `tumblr` | Tumblr | article | https://www.tumblr.com/new/text | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [tumblr.jpg](tools/platform-audit/shots/tumblr.jpg) |
| 46 | `pinterest` | Pinterest | article | https://www.pinterest.com/pin-builder/ | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [pinterest.jpg](tools/platform-audit/shots/pinterest.jpg) |
| 47 | `x` | X (Twitter) | article | https://x.com/compose/post | about:blank | - | 空白页（可能被拦截） | - | [x.jpg](tools/platform-audit/shots/x.jpg) |
| 48 | `facebook` | Facebook | article | https://www.facebook.com/ | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [facebook.jpg](tools/platform-audit/shots/facebook.jpg) |
| 49 | `youtube` | YouTube | video | https://studio.youtube.com/ | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [youtube.jpg](tools/platform-audit/shots/youtube.jpg) |
| 50 | `tiktok` | TikTok | video | https://www.tiktok.com/upload?lang=zh-Hans | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [tiktok.jpg](tools/platform-audit/shots/tiktok.jpg) |
| 51 | `vimeo` | Vimeo | video | https://vimeo.com/upload | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [vimeo.jpg](tools/platform-audit/shots/vimeo.jpg) |
| 52 | `dailymotion` | Dailymotion | video | https://www.dailymotion.com/partner | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [dailymotion.jpg](tools/platform-audit/shots/dailymotion.jpg) |
| 53 | `instagram` | Instagram | video | https://www.instagram.com/ | chrome-error://chromewebdata/ | - | 入口不可达（浏览器错误/网络阻断） | - | [instagram.jpg](tools/platform-audit/shots/instagram.jpg) |

## 降级策略

1. 登录墙：程序自动打开登录页，扫码后从断点继续（`automation.js` 三级容灾）。
2. 编辑器结构变化：平台专属选择器 → 通用启发式 → 剪贴板手动模式，并明确提示失败原因。
3. 入口失效（404/DNS）：任务结果标记失败并保留内容，不静默跳过。