'use strict';
// 平台适配层。
// 设计原则：所有选择器都是「候选数组」，前面的失效会自动尝试后面的；
// 实在全部失效时，填充引擎还会用通用启发式（找 placeholder 含"标题"的输入框、
// contenteditable 正文区、文本为"发布/发表/提交"的按钮），最后降级为
//「打开编辑页 + 内容复制到剪贴板」的手动模式。平台改版不会让整个工具不可用。

module.exports = [
  {
    id: 'wechat', name: '微信公众号', group: '图文', color: '#07c160',
    loginUrl: 'https://mp.weixin.qq.com/',
    loggedInUrl: /mp\.weixin\.qq\.com\/cgi-bin\/(home|appmsg|appmsgpublish|message|profile)/,
    editorUrls: ['https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_list&action=list&type=77&lang=zh_CN'],
    preClickText: ['新建图文', '图文消息', '写新图文'],
    titleSelectors: ['#title', 'input[placeholder*="标题"]', '.cmp-title-input input', 'textarea[placeholder*="标题"]'],
    contentSelectors: ['#ueditor_0 .view', '.edui-body-container', '[contenteditable="true"]'],
    contentType: 'richtext', semi: true,
    note: '微信群发必须管理员扫码确认，所以固定为「自动填好 + 你手动点发表并扫码」。'
  },
  {
    id: 'toutiao', name: '头条号', group: '图文', color: '#f04142',
    loginUrl: 'https://mp.toutiao.com/profile_v4/index',
    loggedInUrl: /mp\.toutiao\.com\/profile_v4\/(index|graphic|manage|analysis)/,
    editorUrls: ['https://mp.toutiao.com/profile_v4/graphic/articles', 'https://mp.toutiao.com/profile_v4/graphic/publish?type=news'],
    preClickText: ['发布文章', '写文章', '新文章'],
    titleSelectors: ['input[placeholder*="标题"]', '.article-title input', 'input[name="title"]'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]'],
    contentType: 'richtext',
    coverInput: 'input[type="file"]'
  },
  {
    id: 'baijia', name: '百家号', group: '图文', color: '#306cff',
    loginUrl: 'https://baijiahao.baidu.com/builder/rc/home',
    loggedInUrl: /baijiahao\.baidu\.com\/builder\/rc\/(home|edit|analysiscontent|manage)/,
    editorUrls: ['https://baijiahao.baidu.com/builder/rc/edit?type=news', 'https://baijiahao.baidu.com/builder/rc/home'],
    preClickText: ['发布文章', '写文章'],
    titleSelectors: ['input[placeholder*="标题"]', '.editor-title input', 'textarea[placeholder*="标题"]'],
    contentSelectors: ['.editor-content', '[contenteditable="true"]'],
    contentType: 'richtext',
    coverInput: 'input[type="file"]'
  },
  {
    id: 'zhihu', name: '知乎', group: '图文', color: '#0084ff',
    loginUrl: 'https://www.zhihu.com/signin',
    loggedInUrl: /zhihu\.com\/(people|creator|zhuanlan|settings)/,
    editorUrls: ['https://zhuanlan.zhihu.com/write'],
    titleSelectors: ['input[placeholder*="标题"]', '.WriteIndex-titleInput input', 'textarea[placeholder*="标题"]'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]'],
    contentType: 'richtext',
    coverInput: 'input[type="file"]'
  },
  {
    id: 'xiaohongshu', name: '小红书', group: '图文/笔记', color: '#ff2442',
    mode: 'both',
    loginUrl: 'https://creator.xiaohongshu.com/login',
    loggedInUrl: /creator\.xiaohongshu\.com\/(publish|home|creator\/)/,
    editorUrls: ['https://creator.xiaohongshu.com/publish/publish'],
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.d-title input'],
    contentSelectors: ['textarea[placeholder*="正文"]', '#description', '[contenteditable="true"]'],
    contentType: 'richtext',
    coverInput: 'input[type="file"]',
    note: '小红书笔记必须带图：请先上传至少一张图片（用文章封面或素材库图片）再发布。'
  },
  {
    id: 'bilibili', name: 'B站专栏', group: '图文', color: '#fb7299',
    loginUrl: 'https://passport.bilibili.com/login',
    loggedInUrl: /(member\.bilibili\.com|bilibili\.com\/(home|v|read))/,
    editorUrls: ['https://member.bilibili.com/article-text/home?not_checkout=1', 'https://member.bilibili.com/article-text/home'],
    titleSelectors: ['.article-title input', 'input[placeholder*="标题"]', 'input[name="title"]'],
    contentSelectors: ['.ql-editor', '#textarea', '[contenteditable="true"]', 'textarea'],
    contentType: 'markdown',
    note: 'B站专栏编辑器是 Markdown，内容会自动转成 Markdown 再填入。'
  },
  {
    id: 'jianshu', name: '简书', group: '图文', color: '#ea6f5a',
    loginUrl: 'https://www.jianshu.com/sign_in',
    loggedInUrl: /jianshu\.com\/(writer|u\/|admin)/,
    editorUrls: ['https://www.jianshu.com/writer/'],
    preClickText: ['新建文章', '写文章'],
    titleSelectors: ['input[placeholder*="标题"]', '.ant-input', '#title'],
    contentSelectors: ['.CodeMirror', '.ace_editor', 'textarea', '[contenteditable="true"]'],
    contentType: 'markdown'
  },
  {
    id: 'csdn', name: 'CSDN', group: '图文', color: '#fc5531',
    loginUrl: 'https://passport.csdn.net/login',
    loggedInUrl: /(csdn\.net\/(u|home|blog|user)|editor\.csdn\.net|blog\.csdn\.net\/)/,
    editorUrls: ['https://editor.csdn.net/md?not_checkout=1', 'https://editor.csdn.net/md'],
    titleSelectors: ['.article-title input', 'input[placeholder*="标题"]', '#articleTitle'],
    contentSelectors: ['.v-note-edit textarea', 'textarea', '[contenteditable="true"]'],
    contentType: 'markdown',
    note: 'CSDN 是 Markdown 编辑器，内容自动转 Markdown。'
  },
  {
    id: 'weibo', name: '微博', group: '图文', color: '#e6162d', experimental: true,
    loginUrl: 'https://weibo.com/',
    loggedInUrl: /weibo\.com\/(u\/|home|mybar)/,
    editorUrls: ['https://weibo.com/ttarticle/publish', 'https://weibo.com/'],
    preClickText: ['写文章', '头条文章'],
    titleSelectors: ['input[placeholder*="标题"]', '.title input', '#title'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]', 'textarea'],
    contentType: 'markdown',
    note: '实验性支持：微博页面变动频繁，失败时自动切手动模式。'
  },
  {
    id: 'sohu', name: '搜狐号', group: '图文', color: '#dd2c2c', experimental: true,
    loginUrl: 'https://mp.sohu.com/mpfe/v3/main/index/index',
    loggedInUrl: /mp\.sohu\.com\/mpfe\/(v3|v4)/,
    editorUrls: ['https://mp.sohu.com/mpfe/v3/main/issue/article', 'https://mp.sohu.com/mpfe/v3/main/index/index'],
    preClickText: ['写文章', '发布文章'],
    titleSelectors: ['input[placeholder*="标题"]', '.article-title input', '#title'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'wangyi', name: '网易号', group: '图文', color: '#d63b32', experimental: true,
    loginUrl: 'http://mp.163.com/index.html',
    loggedInUrl: /mp\.163\.com\/(index|article)/,
    editorUrls: ['http://mp.163.com/index.html#/article-publish/publish'],
    preClickText: ['写文章', '发布文章'],
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.title input'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  }
  ,
  // ---------- 视频平台 ----------
  {
    id: 'douyin', name: '抖音', group: '视频', color: '#161823', mode: 'video',
    loginUrl: 'https://creator.douyin.com/creator-micro/home',
    loggedInUrl: /creator\.douyin\.com\/(creator-micro\/(content|home|data|interact)|publish)/,
    editorUrls: ['https://creator.douyin.com/creator-micro/content/upload?default=1'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="文案"]', 'div[contenteditable="true"]'],
    tagSelectors: ['input[placeholder*="话题"]'],
    contentType: 'richtext'
  },
  {
    id: 'kuaishou', name: '快手', group: '视频', color: '#ff5000', mode: 'video',
    loginUrl: 'https://cp.kuaishou.com/article/publish/video',
    loggedInUrl: /cp\.kuaishou\.com\/(article|page)\//,
    editorUrls: ['https://cp.kuaishou.com/article/publish/video'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea[placeholder*="简介"]', 'textarea'],
    tagSelectors: ['input[placeholder*="标签"]', 'input[placeholder*="话题"]'],
    contentType: 'richtext'
  },
  {
    id: 'bilibili_video', name: 'B站视频', group: '视频', color: '#fb7299', mode: 'video',
    loginUrl: 'https://passport.bilibili.com/login',
    loggedInUrl: /member\.bilibili\.com/,
    editorUrls: ['https://member.bilibili.com/platform/upload/video/frame'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]', '.input-title input'],
    descSelectors: ['textarea[placeholder*="简介"]', 'textarea[placeholder*="描述"]', 'textarea'],
    tagSelectors: ['input[placeholder*="标签"]', 'input[placeholder*="话题"]'],
    contentType: 'markdown'
  },
  {
    id: 'xigua', name: '西瓜视频', group: '视频', color: '#ff4040', mode: 'video', experimental: true,
    loginUrl: 'https://studio.ixigua.com/',
    loggedInUrl: /studio\.ixigua\.com\/(upload|home|content)/,
    editorUrls: ['https://studio.ixigua.com/upload'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持：西瓜上传入口已并入抖音体系，失败时自动切手动模式。'
  },
  {
    id: 'haokan', name: '好看视频', group: '视频', color: '#2b5cff', mode: 'video', experimental: true,
    loginUrl: 'https://haokan.baidu.com/videoui/page/pc/ucenter',
    loggedInUrl: /haokan\.baidu\.com\/videoui\/page\/pc\/ucenter/,
    editorUrls: ['https://haokan.baidu.com/videoui/page/pc/ucenter#/upload/video'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'shipinhao', name: '微信视频号', group: '视频', color: '#07c160', mode: 'video', semi: true,
    loginUrl: 'https://channels.weixin.qq.com/platform/home',
    loggedInUrl: /channels\.weixin\.qq\.com\/platform\/(home|upload|content|comment)/,
    editorUrls: ['https://channels.weixin.qq.com/platform/upload'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea'],
    contentType: 'richtext',
    note: '视频号需扫码登录，工具上传视频并填好标题描述后，请你手动点「发表」并确认。'
  },
  {
    id: 'zhihu_video', name: '知乎视频', group: '视频', color: '#0084ff', mode: 'video', experimental: true,
    loginUrl: 'https://www.zhihu.com/signin',
    loggedInUrl: /zhihu\.com\/(creator|videos|people)/,
    editorUrls: ['https://www.zhihu.com/creator'],
    preClickText: ['发布视频', '上传视频', '发视频'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea[placeholder*="简介"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'iqiyi', name: '爱奇艺号', group: '视频', color: '#00be06', mode: 'video', experimental: true,
    loginUrl: 'https://mp.iqiyi.com/',
    loggedInUrl: /mp\.iqiyi\.com\/(index|video|wemedia|finance|comments)/,
    editorUrls: ['https://mp.iqiyi.com/video/publish'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'qie', name: '企鹅号(腾讯视频)', group: '视频', color: '#12b7f6', mode: 'video', experimental: true,
    loginUrl: 'https://om.qq.com/',
    loggedInUrl: /om\.qq\.com\/main/,
    editorUrls: ['https://om.qq.com/main/content/publish/video'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea[placeholder*="简介"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'sohu_video', name: '搜狐号视频', group: '视频', color: '#dd2c2c', mode: 'video', experimental: true,
    loginUrl: 'https://mp.sohu.com/mpfe/v3/main/index/index',
    loggedInUrl: /mp\.sohu\.com\/mpfe\/(v3|v4)/,
    editorUrls: ['https://mp.sohu.com/mpfe/v4/main/issue/video'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'acfun', name: 'AcFun', group: '视频', color: '#fd4c5d', mode: 'video', experimental: true,
    loginUrl: 'https://www.acfun.cn/login',
    loggedInUrl: /acfun\.cn\/(member|upload)/,
    editorUrls: ['https://www.acfun.cn/upload'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]', 'input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea'],
    tagSelectors: ['input[placeholder*="标签"]'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'youku', name: '优酷', group: '视频', color: '#1e9be8', mode: 'video', experimental: true,
    loginUrl: 'https://creator.youku.com/',
    loggedInUrl: /creator\.youku\.com/,
    editorUrls: ['https://creator.youku.com/upload'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'weibo_video', name: '微博视频', group: '视频', color: '#e6162d', mode: 'video', experimental: true,
    loginUrl: 'https://weibo.com/',
    loggedInUrl: /weibo\.com\/(u\/|home|mybar)/,
    editorUrls: ['https://weibo.com/'],
    preClickText: ['视频', '发微博'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea', '[contenteditable="true"]'],
    contentType: 'richtext',
    note: '实验性支持：微博视频需在发布框上传，失败时自动切手动模式。'
  }
];
