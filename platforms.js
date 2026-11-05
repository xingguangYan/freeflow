'use strict';
// 平台适配层。
// 设计原则：所有选择器都是「候选数组」，前面的失效会自动尝试后面的；
// 实在全部失效时，填充引擎还会用通用启发式（找 placeholder 含"标题"的输入框、
// contenteditable 正文区、文本为"发布/发表/提交"的按钮），最后降级为
//「打开编辑页 + 内容复制到剪贴板」的手动模式。平台改版不会让整个工具不可用。
//
// region: 'cn' 国内 / 'global' 海外
// loginCookies: 登录后才出现的 cookie 名，用来做登录态兜底判断

module.exports = [
  // ==================== 国内 · 图文 ====================
  {
    id: 'wechat', name: '微信公众号', region: 'cn', group: '图文', color: '#07c160',
    loginUrl: 'https://mp.weixin.qq.com/',
    loggedInUrl: /mp\.weixin\.qq\.com\/cgi-bin\/(home|appmsg|appmsgpublish|message|profile)/,
    loginCookies: ['slave_sid', 'master_sid'],
    editorUrls: ['https://mp.weixin.qq.com/'],
    noCoverUpload: true,
    editorUrlFrom: url => {
      try {
        const token = new URL(url).searchParams.get('token');
        return token ? `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&token=${token}&lang=zh_CN` : null;
      } catch { return null; }
    },
    preClickText: ['新建图文', '图文消息', '写新图文'],
    titleSelectors: ['#title', 'input[placeholder*="标题"]', '.cmp-title-input input', 'textarea[placeholder*="标题"]'],
    contentSelectors: ['#ueditor_0 .view', '.edui-body-container', '[contenteditable="true"]'],
    contentType: 'richtext', semi: true,
    note: '微信群发必须管理员扫码确认，所以固定为「自动填好 + 你手动点发表并扫码」。'
  },
  {
    id: 'toutiao', name: '头条号', region: 'cn', group: '图文', color: '#f04142',
    loginUrl: 'https://mp.toutiao.com/profile_v4/index',
    loggedInUrl: /mp\.toutiao\.com\/profile_v4\/(index|graphic|manage|analysis)/,
    loginCookies: ['sessionid'],
    editorUrls: ['https://mp.toutiao.com/profile_v4/graphic/publish?type=news', 'https://mp.toutiao.com/profile_v4/graphic/articles'],
    preClickText: ['发布文章', '写文章', '新文章'],
    noCoverUpload: true,
    previewThenPublish: true,
    titleSelectors: ['input[placeholder*="标题"]', '.article-title input', 'input[name="title"]'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]'],
    contentType: 'richtext',
    coverInput: 'input[type="file"]'
  },
  {
    id: 'baijia', name: '百家号', region: 'cn', group: '图文', color: '#306cff',
    loginUrl: 'https://baijiahao.baidu.com/builder/rc/home',
    loggedInUrl: /baijiahao\.baidu\.com\/builder\/rc\/(home|edit|analysiscontent|manage)/,
    loginCookies: ['BDUSS'],
    editorUrls: ['https://baijiahao.baidu.com/builder/rc/edit?type=news', 'https://baijiahao.baidu.com/builder/rc/home'],
    preClickText: ['发布文章', '写文章'],
    titleSelectors: ['input[placeholder*="标题"]', '.editor-title input', 'textarea[placeholder*="标题"]'],
    contentSelectors: ['.editor-content', '[contenteditable="true"]'],
    contentType: 'richtext',
    coverInput: 'input[type="file"]'
  },
  {
    id: 'zhihu', name: '知乎', region: 'cn', group: '图文', color: '#0084ff',
    loginUrl: 'https://www.zhihu.com/signin',
    loggedInUrl: /zhihu\.com\/(people|creator|zhuanlan|settings)/,
    loginCookies: ['z_c0'],
    editorUrls: ['https://zhuanlan.zhihu.com/write'],
    titleSelectors: ['input[placeholder*="标题"]', '.WriteIndex-titleInput input', 'textarea[placeholder*="标题"]'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]'],
    contentType: 'richtext',
    coverInput: 'input[type="file"]'
  },
  {
    id: 'xiaohongshu', name: '小红书', region: 'cn', group: '图文/笔记', color: '#ff2442',
    mode: 'both',
    audio: true,
    loginUrl: 'https://creator.xiaohongshu.com/login',
    loggedInUrl: /creator\.xiaohongshu\.com\/(publish|home|creator\/|user\/)/,
    loginCookies: ['web_session', 'customer-sso-sid', 'galaxy_creator_session_id'],
    // 小红书发布入口按内容类型分流：图文笔记 / 长文章 / 视频 / 音频
    editorUrls: ['https://creator.xiaohongshu.com/publish/publish'],
    editorUrlsFor: a => {
      const base = 'https://creator.xiaohongshu.com/publish/publish?from=tab_switch&target=';
      if (a.type === 'video') return [base + 'video'];
      if (a.type === 'audio') return [base + 'audio'];
      // 没封面的长内容走「长文章」入口（不强制配图）；有封面走「图文笔记」先传图
      return a.cover ? [base + 'image', base + 'article'] : [base + 'article', base + 'image'];
    },
    mediaFirst: true,
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.d-title input'],
    contentSelectors: ['textarea[placeholder*="正文"]', '#description', '[contenteditable="true"]'],
    contentType: 'richtext',
    coverInput: 'input[type="file"]',
    note: '小红书按内容自动选择入口：有封面走图文笔记（先传图），纯文字走长文章，视频/音频走对应入口。'
  },
  {
    id: 'bilibili', name: 'B站专栏', region: 'cn', group: '图文', color: '#fb7299',
    loginUrl: 'https://passport.bilibili.com/login',
    loggedInUrl: /(member\.bilibili\.com|bilibili\.com\/(home|v|read))/,
    loginCookies: ['SESSDATA'],
    editorUrls: ['https://member.bilibili.com/york/read-editor?not_checkout=1', 'https://member.bilibili.com/york/read-editor'],
    titleSelectors: ['.article-title input', 'input[placeholder*="标题"]', 'input[name="title"]'],
    contentSelectors: ['.ql-editor', '#textarea', '[contenteditable="true"]', 'textarea'],
    contentType: 'richtext',
    note: 'B站专栏是富文本编辑器（Quill），内容以富文本粘贴，保留格式且不显示 Markdown 符号。'
  },
  {
    id: 'jianshu', name: '简书', region: 'cn', group: '图文', color: '#ea6f5a',
    loginUrl: 'https://www.jianshu.com/sign_in',
    loggedInUrl: /jianshu\.com\/(writer|u\/|admin)/,
    loginCookies: ['read_auth_token', 'remember_me_token', 'remember_user_token'],
    editorUrls: ['https://www.jianshu.com/writer/'],
    preClickText: ['新建文章', '写文章'],
    newNoteUrl: url => {
      const m = /notebooks\/(\d+)/.exec(url || '');
      return m ? 'https://www.jianshu.com/writer#/notebooks/' + m[1] + '/notes/new' : null;
    },
    titleSelectors: ['input[placeholder*="标题"]', '.ant-input', '#title'],
    contentSelectors: ['.CodeMirror', '.ace_editor', 'textarea', '[contenteditable="true"]'],
    contentType: 'markdown'
  },
  {
    id: 'csdn', name: 'CSDN', region: 'cn', group: '图文', color: '#fc5531',
    loginUrl: 'https://passport.csdn.net/login',
    loggedInUrl: /(csdn\.net\/(u|home|blog|user)|editor\.csdn\.net|blog\.csdn\.net\/)/,
    loginCookies: ['UserName', 'UserToken'],
    editorUrls: ['https://editor.csdn.net/md?not_checkout=1', 'https://editor.csdn.net/md'],
    titleSelectors: ['.article-title input', 'input[placeholder*="标题"]', '#articleTitle'],
    contentSelectors: ['.v-note-edit textarea', '.cm-editor .cm-content', '#editor .cm-content', '.ql-editor', '[contenteditable="true"]', 'textarea'],
    contentType: 'markdown',
    note: 'CSDN 是 Markdown 编辑器，内容自动转 Markdown。'
  },
  {
    id: 'weibo', name: '微博', region: 'cn', group: '图文', color: '#e6162d', experimental: true,
    loginUrl: 'https://weibo.com/',
    loggedInUrl: /weibo\.com\/(u\/|home|mybar)/,
    loginCookies: ['SUB'],
    editorUrls: ['https://weibo.com/ttarticle/publish', 'https://weibo.com/'],
    preClickText: ['写文章', '头条文章'],
    titleSelectors: ['input[placeholder*="标题"]', '.title input', '#title'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]', 'textarea'],
    contentType: 'markdown',
    note: '实验性支持：微博页面变动频繁，失败时自动切手动模式。'
  },
  {
    id: 'sohu', name: '搜狐号', region: 'cn', group: '图文', color: '#dd2c2c', experimental: true,
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
    id: 'wangyi', name: '网易号', region: 'cn', group: '图文', color: '#d63b32', experimental: true,
    loginUrl: 'http://mp.163.com/index.html',
    loggedInUrl: /mp\.163\.com\/(index|article)/,
    loginCookies: ['NTES_SESS'],
    editorUrls: ['http://mp.163.com/index.html#/article-publish/publish'],
    preClickText: ['写文章', '发布文章'],
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.title input'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'dayu', name: '大鱼号', region: 'cn', group: '图文', color: '#ff6a00', experimental: true,
    loginUrl: 'https://mp.dayu.com/',
    loggedInUrl: /mp\.dayu\.com\/(dashboard|editor|article|home)/,
    editorUrls: ['https://mp.dayu.com/editor?from=dashboard', 'https://mp.dayu.com/dashboard'],
    preClickText: ['写文章', '发布文章'],
    titleSelectors: ['input[placeholder*="标题"]', '.title input', '#title'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'yidian', name: '一点资讯', region: 'cn', group: '图文', color: '#c62f2f', experimental: true,
    loginUrl: 'https://mp.yidianzixun.com/',
    loggedInUrl: /mp\.yidianzixun\.com\/(main|home)/,
    editorUrls: ['https://mp.yidianzixun.com/main/article/', 'https://mp.yidianzixun.com/'],
    preClickText: ['发布文章', '写文章'],
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.title input'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'sina', name: '新浪看点', region: 'cn', group: '图文', color: '#e00000', experimental: true,
    loginUrl: 'https://mp.sina.com.cn/',
    loggedInUrl: /mp\.sina\.com\.cn/,
    editorUrls: ['https://mp.sina.com.cn/newmp/articles/add', 'https://mp.sina.com.cn/'],
    preClickText: ['写文章', '发布文章'],
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.title input'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'kuaichuan', name: '快传号', region: 'cn', group: '图文', color: '#2f9bff', experimental: true,
    loginUrl: 'https://kuaichuan.360.cn/',
    loggedInUrl: /kuaichuan\.360\.cn/,
    editorUrls: ['https://kuaichuan.360.cn/ucweb/article/edit', 'https://kuaichuan.360.cn/'],
    preClickText: ['发布文章', '写文章'],
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.title input'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'dongfang', name: '东方号', region: 'cn', group: '图文', color: '#e62919', experimental: true,
    loginUrl: 'https://mp.eastday.com/',
    loggedInUrl: /mp\.eastday\.com/,
    editorUrls: ['https://mp.eastday.com/uc/wemedia/article/publish', 'https://mp.eastday.com/'],
    preClickText: ['写文章', '发布文章'],
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.title input'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'ifeng', name: '凤凰号', region: 'cn', group: '图文', color: '#d5262c', experimental: true,
    loginUrl: 'https://mp.ifeng.com/',
    loggedInUrl: /mp\.ifeng\.com/,
    editorUrls: ['https://mp.ifeng.com/main/publish', 'https://mp.ifeng.com/'],
    preClickText: ['发布文章', '写文章'],
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.title input'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'meipian', name: '美篇', region: 'cn', group: '图文', color: '#ff7a3d', experimental: true,
    loginUrl: 'https://www.meipian.cn/',
    loggedInUrl: /meipian\.cn\/(html|newhtml|user)/,
    editorUrls: ['https://www.meipian.cn/html/newarticle/', 'https://www.meipian.cn/'],
    preClickText: ['写文章', '创作'],
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.title input'],
    contentSelectors: ['[contenteditable="true"]', '.ProseMirror', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'chejiahao', name: '车家号', region: 'cn', group: '图文', color: '#ff7900', experimental: true,
    loginUrl: 'https://chejiahao.autohome.com.cn/',
    loggedInUrl: /chejiahao\.autohome\.com\.cn/,
    editorUrls: ['https://chejiahao.autohome.com.cn/publish', 'https://chejiahao.autohome.com.cn/'],
    preClickText: ['发布文章', '写文章'],
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.title input'],
    contentSelectors: ['.ProseMirror', '[contenteditable="true"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'cnblogs', name: '博客园', region: 'cn', group: '图文', color: '#1780d0',
    loginUrl: 'https://account.cnblogs.com/signin',
    loggedInUrl: /i\.cnblogs\.com/,
    loginCookies: ['.Cnblogs.AspNetCore.Cookies'],
    editorUrls: ['https://i.cnblogs.com/posts/edit'],
    titleSelectors: ['input[placeholder*="标题"]', '#post-title', '.post-title input'],
    contentSelectors: ['.CodeMirror', '.editor', '[contenteditable="true"]', 'textarea'],
    contentType: 'markdown',
    note: '博客园使用 Markdown 编辑器，内容会自动转换。'
  },
  {
    id: 'juejin', name: '掘金', region: 'cn', group: '图文', color: '#1e80ff',
    loginUrl: 'https://juejin.cn/login',
    loggedInUrl: /juejin\.cn\/(editor|user|write)/,
    loginCookies: ['sessionid'],
    editorUrls: ['https://juejin.cn/editor/drafts/new'],
    titleSelectors: ['input[placeholder*="标题"]', '.title-input', 'input[name="title"]'],
    contentSelectors: ['.CodeMirror', '.bytemd', '[contenteditable="true"]', 'textarea'],
    contentType: 'markdown',
    note: '掘金使用 Markdown 编辑器，内容会自动转换。'
  },
  {
    id: 'segmentfault', name: 'SegmentFault', region: 'cn', group: '图文', color: '#009a61',
    loginUrl: 'https://segmentfault.com/user/login',
    loggedInUrl: /segmentfault\.com\/(write|u\/|user)/,
    editorUrls: ['https://segmentfault.com/write'],
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.title input'],
    contentSelectors: ['.CodeMirror', '.editor', '[contenteditable="true"]', 'textarea'],
    contentType: 'markdown',
    note: 'SegmentFault 使用 Markdown 编辑器。'
  },
  {
    id: 'tieba', name: '百度贴吧', region: 'cn', group: '图文', color: '#2d64b3', experimental: true,
    loginUrl: 'https://tieba.baidu.com/index.html',
    loggedInUrl: /tieba\.baidu\.com\/(index|f)/,
    loginCookies: ['BDUSS'],
    editorUrls: ['https://tieba.baidu.com/'],
    preClickText: ['发帖', '发表'],
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.title input'],
    contentSelectors: ['[contenteditable="true"]', 'textarea', '.ProseMirror'],
    contentType: 'richtext',
    note: '实验性支持：贴吧需要先进入具体吧再发帖，失败时自动切手动模式。'
  },
  {
    id: 'xueqiu', name: '雪球', region: 'cn', group: '图文', color: '#0a6cff', experimental: true,
    loginUrl: 'https://xueqiu.com/',
    loggedInUrl: /xueqiu\.com\/(user|post)/,
    editorUrls: ['https://xueqiu.com/'],
    preClickText: ['发帖', '写文章'],
    titleSelectors: ['input[placeholder*="标题"]', '#title', '.title input'],
    contentSelectors: ['[contenteditable="true"]', 'textarea', '.ProseMirror'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'douban', name: '豆瓣', region: 'cn', group: '图文', color: '#2e963d', experimental: true,
    loginUrl: 'https://accounts.douban.com/passport/login',
    loggedInUrl: /douban\.com\/(note|mine|people)/,
    editorUrls: ['https://www.douban.com/note/create/'],
    titleSelectors: ['input[placeholder*="标题"]', '#note-title', '.title input'],
    contentSelectors: ['[contenteditable="true"]', 'textarea', '.ProseMirror'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },

  // ==================== 国内 · 视频 ====================
  {
    id: 'douyin', name: '抖音', region: 'cn', group: '视频', color: '#161823', mode: 'video',
    loginUrl: 'https://creator.douyin.com/creator-micro/home',
    loggedInUrl: /creator\.douyin\.com\/(creator-micro\/(content|home|data|interact)|publish)/,
    loginCookies: ['sessionid'],
    editorUrls: ['https://creator.douyin.com/creator-micro/content/upload?default=1'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="文案"]', 'div[contenteditable="true"]'],
    tagSelectors: ['input[placeholder*="话题"]'],
    contentType: 'richtext'
  },
  {
    id: 'kuaishou', name: '快手', region: 'cn', group: '视频', color: '#ff5000', mode: 'video',
    loginUrl: 'https://cp.kuaishou.com/article/publish/video',
    loggedInUrl: /cp\.kuaishou\.com\/(article|page)\//,
    loginCookies: ['userId'],
    editorUrls: ['https://cp.kuaishou.com/article/publish/video'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea[placeholder*="简介"]', 'textarea'],
    tagSelectors: ['input[placeholder*="标签"]', 'input[placeholder*="话题"]'],
    contentType: 'richtext'
  },
  {
    id: 'bilibili_video', name: 'B站视频', region: 'cn', group: '视频', color: '#fb7299', mode: 'video',
    loginUrl: 'https://passport.bilibili.com/login',
    loggedInUrl: /member\.bilibili\.com/,
    loginCookies: ['SESSDATA'],
    editorUrls: ['https://member.bilibili.com/platform/upload/video/frame'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]', '.input-title input'],
    descSelectors: ['textarea[placeholder*="简介"]', 'textarea[placeholder*="描述"]', 'textarea'],
    tagSelectors: ['input[placeholder*="标签"]', 'input[placeholder*="话题"]'],
    contentType: 'markdown'
  },
  {
    id: 'xigua', name: '西瓜视频', region: 'cn', group: '视频', color: '#ff4040', mode: 'video', experimental: true,
    loginUrl: 'https://studio.ixigua.com/',
    loggedInUrl: /studio\.ixigua\.com\/(upload|home|content)/,
    loginCookies: ['sessionid'],
    editorUrls: ['https://studio.ixigua.com/upload'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持：西瓜上传入口已并入抖音体系，失败时自动切手动模式。'
  },
  {
    id: 'haokan', name: '好看视频', region: 'cn', group: '视频', color: '#2b5cff', mode: 'video', experimental: true,
    loginUrl: 'https://haokan.baidu.com/videoui/page/pc/ucenter',
    loggedInUrl: /haokan\.baidu\.com\/videoui\/page\/pc\/ucenter/,
    loginCookies: ['BDUSS'],
    editorUrls: ['https://haokan.baidu.com/videoui/page/pc/ucenter#/upload/video'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'shipinhao', name: '微信视频号', region: 'cn', group: '视频', color: '#07c160', mode: 'video', semi: true,
    loginUrl: 'https://channels.weixin.qq.com/platform/home',
    loggedInUrl: /channels\.weixin\.qq\.com\/platform\/(home|upload|content|comment)/,
    loginCookies: ['sessionid', 'wxuin'],
    editorUrls: ['https://channels.weixin.qq.com/platform/upload'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea'],
    contentType: 'richtext',
    note: '视频号需扫码登录，工具上传视频并填好标题描述后，请你手动点「发表」并确认。'
  },
  {
    id: 'zhihu_video', name: '知乎视频', region: 'cn', group: '视频', color: '#0084ff', mode: 'video', experimental: true,
    loginUrl: 'https://www.zhihu.com/signin',
    loggedInUrl: /zhihu\.com\/(creator|videos|people)/,
    loginCookies: ['z_c0'],
    editorUrls: ['https://www.zhihu.com/creator'],
    preClickText: ['发布视频', '上传视频', '发视频'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea[placeholder*="简介"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'iqiyi', name: '爱奇艺号', region: 'cn', group: '视频', color: '#00be06', mode: 'video', experimental: true,
    loginUrl: 'https://mp.iqiyi.com/',
    loggedInUrl: /mp\.iqiyi\.com\/(index|video|wemedia|finance|comments)/,
    loginCookies: ['P00001'],
    editorUrls: ['https://mp.iqiyi.com/video/publish'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'qie', name: '企鹅号(腾讯视频)', region: 'cn', group: '视频', color: '#12b7f6', mode: 'video', experimental: true,
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
    id: 'sohu_video', name: '搜狐号视频', region: 'cn', group: '视频', color: '#dd2c2c', mode: 'video', experimental: true,
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
    id: 'acfun', name: 'AcFun', region: 'cn', group: '视频', color: '#fd4c5d', mode: 'video', experimental: true,
    loginUrl: 'https://www.acfun.cn/login',
    loggedInUrl: /acfun\.cn\/(member|upload)/,
    loginCookies: ['acPasstoken'],
    editorUrls: ['https://www.acfun.cn/upload'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea'],
    tagSelectors: ['input[placeholder*="标签"]'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'youku', name: '优酷', region: 'cn', group: '视频', color: '#1e9be8', mode: 'video', experimental: true,
    loginUrl: 'https://creator.youku.com/',
    loggedInUrl: /creator\.youku\.com/,
    loginCookies: ['P_ck_ctl'],
    editorUrls: ['https://creator.youku.com/upload'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'weibo_video', name: '微博视频', region: 'cn', group: '视频', color: '#e6162d', mode: 'video', experimental: true,
    loginUrl: 'https://weibo.com/',
    loggedInUrl: /weibo\.com\/(u\/|home|mybar)/,
    loginCookies: ['SUB'],
    editorUrls: ['https://weibo.com/'],
    preClickText: ['视频', '发微博'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="标题"]'],
    descSelectors: ['textarea[placeholder*="描述"]', 'textarea', '[contenteditable="true"]'],
    contentType: 'richtext',
    note: '实验性支持：微博视频需在发布框上传，失败时自动切手动模式。'
  },

  // ==================== 海外 · 图文 ====================
  {
    id: 'medium', name: 'Medium', region: 'global', group: '图文', color: '#000000',
    loginUrl: 'https://medium.com/m/signin',
    loggedInUrl: /medium\.com\/(new-story|me|settings)/,
    loginCookies: ['sid', 'uid'],
    editorUrls: ['https://medium.com/new-story'],
    titleSelectors: ['h1[contenteditable="true"]', 'input[placeholder*="Title"]', 'textarea[placeholder*="Title"]'],
    contentSelectors: ['[contenteditable="true"]', '.ProseMirror', 'textarea'],
    contentType: 'richtext',
    note: 'Medium 编辑器支持富文本；失败时自动切手动模式。'
  },
  {
    id: 'devto', name: 'Dev.to', region: 'global', group: '图文', color: '#0a0a0a',
    loginUrl: 'https://dev.to/enter',
    loggedInUrl: /dev\.to\/(new|dashboard|settings|admin)/,
    loginCookies: ['remember_user_token'],
    editorUrls: ['https://dev.to/new'],
    titleSelectors: ['textarea[placeholder*="title"]', 'input[placeholder*="title"]', '#article-form-title'],
    contentSelectors: ['textarea#article_body_markdown', '.CodeMirror', 'textarea'],
    contentType: 'markdown',
    note: 'Dev.to 使用 Markdown 编辑器，内容会自动转换。'
  },
  {
    id: 'linkedin', name: 'LinkedIn 领英', region: 'global', group: '图文', color: '#0a66c2',
    loginUrl: 'https://www.linkedin.com/login',
    loggedInUrl: /linkedin\.com\/(feed|post|article|in\/|me)/,
    loginCookies: ['li_at'],
    editorUrls: ['https://www.linkedin.com/post/new', 'https://www.linkedin.com/feed/?shareActive=true'],
    titleSelectors: ['input[placeholder*="Title"]', 'textarea[placeholder*="Title"]', '.share-creation-state__text-editor'],
    contentSelectors: ['.ql-editor', '[contenteditable="true"]', 'textarea'],
    contentType: 'richtext',
    note: 'LinkedIn 动态/文章编辑器；失败时自动切手动模式。'
  },
  {
    id: 'reddit', name: 'Reddit', region: 'global', group: '图文', color: '#ff4500', experimental: true,
    loginUrl: 'https://www.reddit.com/login',
    loggedInUrl: /reddit\.com\/(submit|user|r\/)/,
    loginCookies: ['reddit_session'],
    editorUrls: ['https://www.reddit.com/submit'],
    titleSelectors: ['textarea[placeholder*="Title"]', 'input[placeholder*="Title"]', '#post-title'],
    contentSelectors: ['[contenteditable="true"]', 'textarea', '.ProseMirror'],
    contentType: 'richtext',
    note: '实验性支持：Reddit 需要选择版块（subreddit），失败时自动切手动模式。'
  },
  {
    id: 'hashnode', name: 'Hashnode', region: 'global', group: '图文', color: '#2962ff', experimental: true,
    loginUrl: 'https://hashnode.com/',
    loggedInUrl: /hashnode\.com\/(new|drafts|me|settings)/,
    editorUrls: ['https://hashnode.com/new/draft', 'https://hashnode.com/'],
    titleSelectors: ['input[placeholder*="Title"]', 'textarea[placeholder*="Title"]', '#title'],
    contentSelectors: ['[contenteditable="true"]', '.ProseMirror', 'textarea'],
    contentType: 'markdown',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'substack', name: 'Substack', region: 'global', group: '图文', color: '#ff6719', experimental: true,
    loginUrl: 'https://substack.com/sign-in',
    loggedInUrl: /substack\.com\/(publish|post|profile|home)/,
    editorUrls: ['https://substack.com/publish/post'],
    titleSelectors: ['input[placeholder*="Title"]', 'textarea[placeholder*="Title"]', '#title'],
    contentSelectors: ['[contenteditable="true"]', '.ProseMirror', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'tumblr', name: 'Tumblr', region: 'global', group: '图文', color: '#36465d', experimental: true,
    loginUrl: 'https://www.tumblr.com/login',
    loggedInUrl: /tumblr\.com\/(dashboard|new|blog)/,
    editorUrls: ['https://www.tumblr.com/new/text'],
    titleSelectors: ['input[placeholder*="Title"]', '#title'],
    contentSelectors: ['[contenteditable="true"]', '.ProseMirror', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'pinterest', name: 'Pinterest', region: 'global', group: '图文', color: '#e60023', experimental: true,
    loginUrl: 'https://www.pinterest.com/login',
    loggedInUrl: /pinterest\.com\/(pin-builder|business|feed|ideas)/,
    editorUrls: ['https://www.pinterest.com/pin-builder/'],
    titleSelectors: ['input[placeholder*="Title"]', '#title'],
    contentSelectors: ['[contenteditable="true"]', 'textarea', '.ProseMirror'],
    contentType: 'richtext',
    coverInput: 'input[type="file"]',
    note: '实验性支持：Pinterest 需要图片，失败时自动切手动模式。'
  },
  {
    id: 'x', name: 'X (Twitter)', region: 'global', group: '图文', color: '#000000', experimental: true,
    mode: 'both',
    loginUrl: 'https://x.com/i/flow/login',
    loggedInUrl: /x\.com\/(home|compose|message)/,
    loginCookies: ['auth_token'],
    editorUrls: ['https://x.com/compose/post'],
    titleSelectors: ['[data-testid="tweetTextarea_0"]', 'div[contenteditable="true"]'],
    contentSelectors: ['div[contenteditable="true"]', '[data-testid="tweetTextarea_0"]'],
    contentType: 'richtext',
    note: '实验性支持：X 的编辑框是富文本，失败时自动切手动模式。'
  },
  {
    id: 'facebook', name: 'Facebook', region: 'global', group: '图文', color: '#1877f2', experimental: true,
    mode: 'both',
    loginUrl: 'https://www.facebook.com/login',
    loggedInUrl: /facebook\.com\/(home|feed|profile|watch)/,
    loginCookies: ['c_user'],
    editorUrls: ['https://www.facebook.com/'],
    preClickText: ['发布', '创建帖子', 'Create post'],
    titleSelectors: ['input[placeholder*="Title"]', 'textarea[placeholder*="Title"]'],
    contentSelectors: ['[contenteditable="true"]', '.ProseMirror', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },

  // ==================== 海外 · 视频 ====================
  {
    id: 'youtube', name: 'YouTube', region: 'global', group: '视频', color: '#ff0000', mode: 'video', experimental: true,
    loginUrl: 'https://studio.youtube.com/',
    loggedInUrl: /studio\.youtube\.com/,
    loginCookies: ['SAPISID'],
    editorUrls: ['https://studio.youtube.com/'],
    preClickText: ['Upload video', '上传视频', 'Create'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['textarea[placeholder*="Title"]', 'input[placeholder*="Title"]', '#textbox'],
    descSelectors: ['textarea[placeholder*="Description"]', 'textarea'],
    tagSelectors: ['input[placeholder*="Tags"]', 'input[placeholder*="标签"]'],
    contentType: 'richtext',
    note: '实验性支持：YouTube 上传入口可能在频道内，失败时自动切手动模式。'
  },
  {
    id: 'tiktok', name: 'TikTok', region: 'global', group: '视频', color: '#000000', mode: 'video',
    loginUrl: 'https://www.tiktok.com/login',
    loggedInUrl: /tiktok\.com\/(upload|foryou|following|messages)/,
    loginCookies: ['sessionid'],
    editorUrls: ['https://www.tiktok.com/upload?lang=zh-Hans'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="Title"]', 'textarea[placeholder*="Title"]'],
    descSelectors: ['textarea[placeholder*="Description"]', 'textarea', '[contenteditable="true"]'],
    contentType: 'richtext',
    note: 'TikTok 上传页需要登录，失败时自动切手动模式。'
  },
  {
    id: 'vimeo', name: 'Vimeo', region: 'global', group: '视频', color: '#1ab7ea', mode: 'video',
    loginUrl: 'https://vimeo.com/log_in',
    loggedInUrl: /vimeo\.com\/(upload|manage|home|videos)/,
    editorUrls: ['https://vimeo.com/upload'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="Title"]', 'textarea[placeholder*="Title"]'],
    descSelectors: ['textarea[placeholder*="Description"]', 'textarea'],
    contentType: 'richtext',
    note: 'Vimeo 上传页需要登录，失败时自动切手动模式。'
  },
  {
    id: 'dailymotion', name: 'Dailymotion', region: 'global', group: '视频', color: '#0d0d0d', mode: 'video', experimental: true,
    loginUrl: 'https://www.dailymotion.com/login',
    loggedInUrl: /dailymotion\.com\/(partner|studio|upload)/,
    editorUrls: ['https://www.dailymotion.com/partner'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['input[placeholder*="Title"]', 'textarea[placeholder*="Title"]'],
    descSelectors: ['textarea[placeholder*="Description"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持，失败时自动切手动模式。'
  },
  {
    id: 'instagram', name: 'Instagram', region: 'global', group: '视频', color: '#e1306c', mode: 'video', experimental: true,
    loginUrl: 'https://www.instagram.com/accounts/login/',
    loggedInUrl: /instagram\.com\/(create|accounts\/edit|explore)/,
    loginCookies: ['sessionid'],
    editorUrls: ['https://www.instagram.com/'],
    preClickText: ['Create', '创建'],
    uploadInput: 'input[type="file"]',
    titleSelectors: ['textarea[placeholder*="Caption"]', 'textarea'],
    descSelectors: ['textarea[placeholder*="Caption"]', 'textarea'],
    contentType: 'richtext',
    note: '实验性支持：Instagram 网页版上传限制较多，失败时自动切手动模式。'
  }
];

// 按文章类型解析发布入口：平台可定义 editorUrlsFor(article) 做分流（如小红书）
function editorUrlsFor(platform, article) {
  try {
    if (typeof platform.editorUrlsFor === 'function') {
      const list = platform.editorUrlsFor(article || {});
      if (Array.isArray(list) && list.length) return list;
    }
  } catch { /* 回退默认入口 */ }
  return platform.editorUrls || [];
}
module.exports.editorUrlsFor = editorUrlsFor;
