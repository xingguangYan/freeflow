'use strict';
// 中英文切换：页面加载时自动给静态中文元素/属性打标，切换语言时整体替换。
// 动态生成的文本用 t('中文') 包一层，未收录时原样返回中文。
const ZH = /[\u4e00-\u9fa5]/;
const EN = {
  // 顶栏 / 侧栏
  '自由发 · 自媒体多平台分发工具': 'Freeflow · Multi-platform Publishing Tool',
  '发': 'Post', '自由发': 'Freeflow', '多平台分发 · 本地免费': 'Multi-platform · Local · Free',
  '文章': 'Articles', '账号': 'Accounts', '一键发布': 'Publish All', '素材库': 'Assets',
  '消息中心': 'Messages', '数据': 'Stats', '我的大模型': 'My LLM', '违禁词': 'Word Check', '日志': 'Logs',
  '请作者喝杯咖啡': 'Buy me a coffee',
  '工具对你有帮助的话，扫码支持一下，这是我继续更新的动力 :)': 'If this tool helps you, scan to support the author — that keeps the updates coming :)',
  '所有数据保存在本机 data/ 目录，不经过任何第三方服务器。': 'All data is stored locally in the data/ folder. No third-party servers involved.',
  '本地服务运行中': 'Local service running',
  // 文章区
  '文章列表': 'Article list', '+ 新建': '+ New', '未选择文章': 'No article selected',
  '复制': 'Duplicate', '删除': 'Delete', '违禁词检查': 'Sensitive word check', '保存': 'Save',
  '图文': 'Article', '视频': 'Video', '音频': 'Audio', '编辑器': 'Editor', '富文本': 'Rich text',
  '视频文件': 'Video file', '或本地路径': 'or local path', '登记': 'Add', '音频文件': 'Audio file',
  '音频的「简介/文案」写在下方正文区；目前支持小红书音频笔记（发布时自动打开音频入口并上传本机音频文件）。': 'Write the audio description in the body below. Supported: Xiaohongshu audio notes — publishing opens the audio entry and uploads your local file.',
  '标签': 'Tags',
  '视频的「简介/文案」写在下方正文区，发布时会自动作为描述填入各平台。': 'Write the video description in the body below; it is filled in as the description on each platform.',
  // 编辑器工具栏
  '撤销': 'Undo', '重做': 'Redo', '正文': 'Body', '代码': 'Code', '列表': 'List', '序号': 'No.',
  '字号': 'Size', '字色': 'Color', '底色': 'Highlight', '行高': 'Spacing', '对齐': 'Align',
  '左对齐': 'Left', '居中': 'Center', '右对齐': 'Right', '两端对齐': 'Justify',
  '表格': 'Table', '分割线': 'Divider', '插入图片': 'Insert image', '清除格式': 'Clear format', '预览': 'Preview',
  '封面图：': 'Cover:', '（不设置）': '(none)',
  // 账号区
  '添加账号': 'Add account', '每个账号一个独立浏览器配置，登录后自动保存在本机': 'Each account uses its own browser profile; the login state is saved on this computer.',
  '添加': 'Add', '账号列表': 'Account list',
  '点「登录」会打开浏览器，扫码或输入账号密码后自动检测登录态': 'Click Login to open a browser; scan the QR code or sign in, and the login state is detected automatically.',
  '安装浏览器内核': 'Install browser core',
  // 发布区
  '发布设置': 'Publish settings', '模式': 'Mode', '全选': 'Select all', '一键检测登录': 'Check all logins',
  '定时': 'Schedule', '想定时才选时间，不选直接立即发布': 'Pick a time only for scheduled posts; otherwise it publishes right away.',
  '立即发布': 'Publish now', '定时发布': 'Schedule post',
  '任务记录': 'Task history', '清空历史': 'Clear history', '刷新': 'Refresh',
  // 消息中心
  '全部平台': 'All platforms', '全部类型': 'All types', '私信': 'DM', '评论': 'Comments', '通知': 'Notices',
  '只看未读': 'Unread only', '采集消息': 'Fetch messages', '回复': 'Reply', '内容': 'Content',
  '发送回复': 'Send reply', '存为草稿': 'Save draft', '取消': 'Cancel',
  '在各平台网页授权范围内读取消息列表；部分平台不支持自动回复时会明确提示，失败自动保留草稿可重试。数据只在本机。': 'Messages are read within each platform\'s own web session. Platforms without reliable reply support will say so; failed replies are kept as drafts for retry. All data stays local.',
  // 数据面板
  '平台数据看板': 'Platform stats', '采集选中账号': 'Fetch selected', '采集全部已登录': 'Fetch all logged-in',
  '指标趋势': 'Metric trends', '选择账号查看': 'Pick an account to view',
  '数据来自各平台后台页面公开显示的数字，按关键词自动识别，属于估算值，仅供趋势参考。': 'Numbers come from each platform\'s own dashboard and are matched by keywords; treat them as estimates for trend reference.',
  // 大模型
  '模型配置': 'Model configs', 'OpenAI 兼容接口或本地服务；Key 只存本机，不明文显示': 'OpenAI-compatible endpoints or local services; the key stays local and is masked.',
  '+ 新增模型': '+ Add model', '配置名称': 'Name', '服务商': 'Provider', '自定义（手填地址）': 'Custom (fill in the endpoint)',
  '服务地址': 'Endpoint', '模型': 'Model', '— 常用模型 —': '— Popular models —', '拉取列表': 'Fetch list',
  '高级设置（温度 / 长度 / 系统提示词）': 'Advanced (temperature / length / system prompt)',
  '温度': 'Temperature', '0=严谨，2=发散，写文章建议 0.7': '0 = precise, 2 = creative; 0.7 is recommended for articles.',
  '最大长度': 'Max length', '单次生成上限': 'Per-generation token cap', '系统提示词': 'System prompt',
  '连通性测试': 'Test connection', '保存配置': 'Save config',
  '创作素材（本地读取）': 'Writing materials (local files)', '只读取你选择的文件，删掉就不再参与生成': 'Only the files you pick are read; deleting one removes it from generation.',
  '点击选择本地 txt / md / json / csv 文本文件': 'Click to pick a local txt / md / json / csv file',
  '主题/要求': 'Topic / requirements', '用选中模型生成文章': 'Generate with the selected model',
  // 素材库
  '图片存在本机 data/materials/；正文插入图片时从这里选': 'Images are stored locally in data/materials/; pick from here when inserting into an article.',
  '点击或把图片拖到这里上传': 'Click or drag images here to upload',
  // 违禁词
  '违禁词 / 敏感词检测': 'Banned-word / sensitive-word check', '发布前自查，降低被平台限流风险': 'Self-check before publishing to lower the risk of being throttled.',
  '开始扫描': 'Start scan', '带入当前文章': 'Use current article',
  '内置常见营销违规词库；把': 'The built-in list covers common marketing violations; put',
  '改成「一行一词」可扩充自己的词库。': 'here as one word per line to extend your own list.',
  '运行日志': 'Logs', '清空日志': 'Clear logs',
  // 弹窗
  '选择要插入的图片': 'Pick an image to insert', '发布前预览': 'Pre-publish preview', '返回修改': 'Back to edit', '确认发布': 'Confirm publish',
  '退出自由发？': 'Quit Freeflow?',
  '未保存的修改请先保存；进行中的发布任务可稍后在任务页查看。': 'Save unsaved changes first; running publish tasks can be checked later in Task history.',
  '确认退出': 'Quit',
  // 手机遥控
  '连接电脑端': 'Connect to desktop',
  '手机与电脑连同一 WiFi，填电脑端地址（如 192.168.1.10:8917）即可遥控发布。留空 = 只编辑不发布。': 'With the phone and computer on the same Wi-Fi, fill in the desktop address (e.g. 192.168.1.10:8917) to publish remotely. Empty means edit only.',
  '保存并连接': 'Save & connect',
  // 属性类（placeholder / title / aria-label）
  '菜单': 'Menu', '切换界面配色': 'Switch theme color', '浅色': 'Light', '深色': 'Dark', '海蓝': 'Ocean', '森绿': 'Forest', '暖橙': 'Amber', '玫瑰': 'Rose',
  '点击设置电脑端地址（手机遥控用）': 'Set the desktop address (for the phone remote)',
  '搜索标题…': 'Search titles…', '文章标题（各平台共用）': 'Article title (shared across platforms)',
  '逗号分隔，如：数码,测评,开箱': 'Comma separated, e.g. tech,review,unboxing',
  '撤销（Ctrl+Z）': 'Undo (Ctrl+Z)', '重做（Ctrl+Y）': 'Redo (Ctrl+Y)',
  '加粗': 'Bold', '斜体': 'Italic', '下划线': 'Underline', '删除线': 'Strikethrough',
  '一级标题': 'Heading 1', '二级标题': 'Heading 2', '三级标题': 'Heading 3', '正文段落': 'Body paragraph',
  '引用': 'Quote', '代码块': 'Code block', '无序列表': 'Bulleted list', '有序列表': 'Numbered list',
  '文字颜色': 'Text color', '文字背景色': 'Text highlight',
  '插入 2×3 表格': 'Insert 2×3 table', '插入素材库图片': 'Insert from assets',
  '写正文，也可以直接从 Word / 网页粘贴（保留格式）。': 'Write the body here; you can also paste from Word or a webpage — formatting is preserved.',
  '用 Markdown 写作，例如：\n# 标题\n正文段落\n- 列表项\n![图片](https://...)': 'Write in Markdown, e.g.:\n# Title\nBody text\n- List item\n![image](https://...)',
  '账号备注名，如「大号」': 'Account nickname, e.g. main account',
  '勾选/取消全部平台账号': 'Select / unselect all platform accounts',
  '打开浏览器逐个检查勾选账号的登录态，不要求重新扫码': 'Opens browsers one by one to check the login state of the selected accounts; no re-scan needed.',
  '用上方选择的时间定时发布': 'Publish at the time chosen above',
  '输入回复内容…': 'Type your reply…',
  '如：我的 GPT / 本地 Ollama': 'e.g. My GPT / local Ollama',
  '本地服务可留空': 'Leave empty for local services',
  '模型名，如 gpt-4o-mini / qwen2.5:7b': 'Model name, e.g. gpt-4o-mini / qwen2.5:7b',
  '留空用默认写作助手人设；可写「你是 XX 领域博主，语气幽默」': 'Empty = the default writing-assistant persona; e.g. You are a witty tech blogger.',
  '如：用素材里的数据写一篇 800 字的 AI 工具评测，语气轻松': 'e.g. Write a casual 800-word AI tool review using the materials',
  '把标题 + 正文粘贴进来，或点「带入当前文章」': 'Paste the title and body here, or click Use current article.'
};

// ---------- 动态渲染文本的翻译（与静态 UI 合并生效） ----------
Object.assign(EN, {
  '已登录': 'Logged in', '等待登录…': 'Waiting for login…', '登录过期': 'Login expired', '未登录': 'Not logged in',
  '还没有文章 点右上「+ 新建」开始第一篇': 'No articles yet — click + New at the top right to start.',
  '· 有封面': ' · with cover', '· 视频': ' · video', '· 音频': ' · audio',
  '已选视频：': 'Selected video: ', '已选音频：': 'Selected audio: ',
  '写视频简介 / 文案…': 'Write the video description…', '写音频简介 / 文案…': 'Write the audio description…',
  '未命名文章': 'Untitled article', '已新建文章': 'New article created', '未命名': 'Untitled',
  '内容为空，先写标题或正文再保存': 'The content is empty — write a title or body before saving.',
  '已保存为新文章': 'Saved as a new article', '保存失败：': 'Save failed: ', '已保存': 'Saved',
  '先选择一篇文章': 'Select an article first', '未选择文章': 'No article selected',
  '已删除': 'Deleted', '已复制为新文章': 'Duplicated as a new article', '文章是空的': 'The article is empty',
  '违禁词': 'Banned words', '没有可撤销的步骤了': 'Nothing left to undo',
  '先在正文里选中要排版的文字': 'Select some text in the body first.',
  '先选中文字再设置字号 / 颜色 / 行高': 'Select text before setting size, color, or spacing.',
  '单元格 单元格 单元格': 'Cell Cell Cell',
  '先去素材库上传图片': 'Upload an image in Assets first.', '已插入图片：': 'Image inserted: ',
  '粘贴图片.png': 'Pasted image.png', '图片下载失败：': 'Image download failed: ',
  '图片已插入': 'Image inserted', '正在下载网页图片…': 'Downloading the web image…', '图片已插入正文': 'Image inserted into the body.',
  '先新建或选择一篇文章': 'Create or select an article first.',
  '视频已上传入库': 'Video added to the library.', '请填写视频文件的本地路径': 'Fill in the local path of the video file.', '视频已登记': 'Video registered.',
  '音频已上传入库': 'Audio added to the library.', '请填写音频文件的本地路径': 'Fill in the local path of the audio file.', '音频已登记': 'Audio registered.',
  '还没有账号 用上方表单添加第一个平台账号': 'No accounts yet — add your first platform account with the form above.',
  '上次登录': 'Last login ', '未登录过': 'Never logged in', '重新登录': 'Log in again', '登录': 'Log in',
  '删除账号会同时清掉它的本地登录态，确定？': 'Deleting the account also removes its local login state. Continue?',
  '已打开登录窗口，扫码或登录后这里会自动变成「已登录」': 'The login window is open — this becomes Logged in automatically after you scan or sign in.',
  '登录启动失败: ': 'Failed to open the login window: ', '已标记为登录完成': 'Marked as logged in',
  '正在检测登录态…': 'Checking login state…', '检测失败: ': 'Check failed: ',
  '已添加，点「登录」去扫码': 'Added — click Log in to scan the code.',
  '下载中…（约150MB）': 'Downloading… (about 150 MB)',
  '浏览器内核已就绪，可直接登录': 'The browser core is ready — you can log in now.',
  '浏览器内核下载完成，现在可以登录了': 'Browser core downloaded; you can log in now.',
  '内核下载失败: ': 'Browser core download failed: ',
  '（视频）': '(video)', '（音频）': '(audio)', '（没有文章）': '(no articles)', '· 海外': ' · overseas',
  '没有可发视频的账号：先去「账号」页添加抖音 / 快手 / B站视频等': 'No video-capable account — add Douyin, Kuaishou, or Bilibili Video in Accounts first.',
  '没有可发音频的账号：目前仅小红书支持音频笔记，先去「账号」页添加': 'No audio-capable account — only Xiaohongshu supports audio notes; add it in Accounts first.',
  '先去「账号」页添加并登录账号': 'Add and log in to an account in Accounts first.',
  '没有可选的账号，先去「账号」页添加': 'No accounts to select — add one in Accounts first.',
  '清空': 'Clear', '已取消全部勾选': 'All unchecked', '已全选': 'All selected', '个账号': ' account(s)',
  '没有可检测的账号，先去「账号」页添加': 'No accounts to check — add one in Accounts first.',
  '检测中…': 'Checking…', '登录检测完成：': 'Login check done: ', '个账号已登录': ' account(s) logged in',
  '，未登录的请点「登录」扫码': ' — the logged-out ones can be scanned via Log in.',
  '批量检测失败: ': 'Batch check failed: ', '(未命名)': '(untitled)',
  '· 约': ' · about ', '字 ·': ' chars · ', '将发布到': 'Will publish to', '个账号：': ' account(s):',
  '请先写一篇文章': 'Write an article first.', '至少勾选一个账号': 'Select at least one account.',
  '文章不存在，请重新选择': 'The article does not exist — pick again.',
  '请先选择定时发布的时间': 'Pick a time first for scheduling.',
  '定时时间必须晚于当前时间': 'The scheduled time must be in the future.',
  '确认发布到以上账号？': 'Publish to the accounts above?',
  '请重新选择文章与账号': 'Choose the article and accounts again.',
  '已加入定时队列': 'Added to the schedule queue.',
  '开始分发，浏览器会逐个打开平台编辑页': 'Publishing started — browsers will open each platform\'s editor in turn.',
  '创建发布任务失败：': 'Failed to create the publish task: ',
  '还没有任务 选好文章和账号后点「开始分发」': 'No tasks yet — pick an article and accounts, then start publishing.',
  '完成': 'Done', '部分完成': 'Partly done', '失败': 'Failed', '进行中': 'Running', '定时中': 'Scheduled',
  '排队中': 'Queued', '待发': 'To publish', '已发': 'Published', '待手动': 'Manual needed', '不支持': 'Unsupported',
  '已重新加入队列': 'Re-queued', '已删除任务记录': 'Task record deleted.',
  '还没有消息 点上方「采集消息」拉取各平台私信/评论/通知': 'No messages yet — click Fetch messages to pull DMs, comments, and notices.',
  '· 未接入消息页': ' · messages not supported', '· 未登录': ' · not logged in', '· 未读': ' · unread',
  '有草稿': 'Draft', '当前筛选下没有消息': 'No messages under these filters.',
  '账号不存在': 'The account does not exist.', '发到：': 'To: ',
  '已恢复上次失败的草稿': 'Restored the draft from the last failed attempt.',
  '内容为空': 'The content is empty.', '草稿已保存（仅本机）': 'Draft saved (local only).',
  '请输入回复内容': 'Type your reply first.',
  '发送中…（已打开平台页面，请勿关闭）': 'Sending… (the platform page is open — do not close it).',
  '✓ 已发送（以平台页面实际结果为准）': '✓ Sent (per the platform page).',
  '（草稿已保留，可点「发送回复」重试）': ' (draft kept — retry with Send reply).',
  '采集中…': 'Fetching…',
  '正在逐个打开平台消息页，请稍候（全自动，勿关闭弹出的浏览器）': 'Opening each platform\'s message page — fully automatic; do not close the browser windows.',
  '消息采集完成': 'Messages fetched.', '采集失败: ': 'Fetch failed: ',
  '还没有导入模型 点右上「+ 新增模型」，选厂商或手填服务地址': 'No models yet — click + Add model at the top right to pick a provider or fill in an endpoint.',
  '自定义': 'Custom', '启用中': 'Active', '已停用': 'Disabled', '停用': 'Disable', '启用': 'Enable',
  '（未填）': '(not set)', '（免密）': '(no key)', '已选为本次生成模型': 'Selected for this generation.',
  '删除这个模型配置？': 'Delete this model config?',
  '已保存（留空保持不变）': 'Saved (leave empty to keep).',
  '请填写配置名称': 'Fill in a name.', '请填写服务地址': 'Fill in the endpoint.', '模型配置已保存': 'Model config saved.',
  '测试中…': 'Testing…', '✓ 连通成功（': '✓ Connected (', 'ms，回复：': ' ms, reply: ',
  '拉取失败：': 'Fetch failed: ', '服务端没有返回模型列表': 'The server returned no model list.',
  '点选填入：': 'Click to fill in: ', '— 拉到的模型（': '— Fetched models (',
  '个，显示前 60）—': ' shown, first 60) —', '已拉取': 'Fetched ', '个可用模型': ' available models',
  '正在读取': 'Reading ', '素材已读取：': 'Material read: ', '字符）': ' chars)',
  '素材读取失败: ': 'Material read failed: ', '文件读取失败': 'File read failed.',
  '还没有素材。选择本地文本文件作为创作上下文。': 'No materials — pick a local text file to use as context.',
  '删掉这个素材？删掉后不再参与生成。': 'Delete this material? It will no longer be used for generation.',
  '请先选择（或新增）一个模型': 'Select (or add) a model first.', '请填写写作主题/要求': 'Fill in the topic / requirements.',
  '生成中…（最长两分钟）': 'Generating… (up to 2 minutes).',
  '生成完成，预览后可保存到草稿箱': 'Done — preview it, then save to drafts.',
  '生成失败: ': 'Generation failed: ',
  '已保存到草稿箱：': 'Saved to drafts: ',
  '已存为草稿并跳到发布页，请确认平台和账号': 'Saved as a draft and moved to the publish page — confirm the platform and accounts.',
  '清空所有历史任务记录？（正在运行的任务会保留）': 'Clear all task history? Running tasks are kept.',
  '历史记录已清空': 'History cleared.',
  '素材库是空的 把图片拖到上方区域即可上传': 'The asset library is empty — drag images into the area above to upload.',
  '链接已复制': 'Link copied.', '只支持图片': 'Only images are supported.', '已上传': 'Uploaded.',
  '先在「文章」页选一篇': 'Select an article on the Articles page first.',
  '请输入要检测的内容': 'Enter the content to check.', '命中': 'Hits: ', '共': ' total across ',
  '类命中词。发布前请改写或删除这些表述。': ' banned-word categories — rewrite or remove them before publishing.',
  '结果 未命中任何已知违禁词': 'No known banned words found.',
  '暂无日志': 'No logs yet.', '清空全部运行日志？': 'Clear all logs?', '日志已清空': 'Logs cleared.',
  '粉丝': 'Followers', '阅读/播放': 'Reads / Plays', '点赞': 'Likes', '分享': 'Shares',
  '无可识别指标': 'No readable metrics.',
  '还没有数据 点上方「采集选中账号 / 采集全部已登录」': 'No data yet — click Fetch selected or Fetch all logged-in above.',
  '（无数据）': '(no data)', '亿': 'B', '万': 'W',
  '暂无数据，先采集一次': 'No data — fetch once first.',
  '（全部账号汇总）': ' (all accounts)', '全部平台汇总': 'All platforms', '条采集记录）': ' records)',
  '先添加账号': 'Add an account first.', '正在打开平台后台采集，请稍候…': 'Opening the platform dashboard — please wait…',
  '没有已登录账号': 'No logged-in accounts.', '全部采集完成': 'All fetches done.',
  '国内 · 图文': 'CN · Articles', '国内 · 视频': 'CN · Video', '海外 · 图文': 'Overseas · Articles', '海外 · 视频': 'Overseas · Video',
  '（实验）': '(beta)', '已连接': 'Connected',
  '自由发已就绪：先添加账号并登录，再写文章一键分发': 'Freeflow is ready — add and log in to your accounts, write an article, then publish everywhere.',
  '服务连接失败': 'Service connection failed.', '启动失败: ': 'Start failed: ',
  '，请检查电脑端是否已启动': ' — check that the desktop app is running.'
});

let cur = 'zh';
try { cur = localStorage.getItem('ff_lang') || (/^zh/i.test(navigator.language || '') ? 'zh' : 'en'); } catch (e) { /* localStorage 不可用时兜底 */ }

function t(zh) { return (cur === 'en' && Object.prototype.hasOwnProperty.call(EN, zh)) ? EN[zh] : zh; }

// 收集页面内静态中文文本/属性，写入 data-ff-* 锚点，供整体切换
function autoTag(root) {
  const els = (root || document).querySelectorAll('*');
  for (const el of els) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'textarea' || tag === 'input') continue;
    if (!el.children.length && !el.hasAttribute('data-ff-zh')) {
      const txt = (el.textContent || '').trim();
      if (txt && ZH.test(txt)) el.setAttribute('data-ff-zh', txt);
    }
    const ph = el.getAttribute('placeholder');
    if (ph && ZH.test(ph) && !el.hasAttribute('data-ff-ph')) el.setAttribute('data-ff-ph', ph);
    const ti = el.getAttribute('title');
    if (ti && ZH.test(ti) && !el.hasAttribute('data-ff-title')) el.setAttribute('data-ff-title', ti);
    const al = el.getAttribute('aria-label');
    if (al && ZH.test(al) && !el.hasAttribute('data-ff-al')) el.setAttribute('data-ff-al', al);
  }
}

function applyLang(lang) {
  cur = lang;
  try { localStorage.setItem('ff_lang', lang); } catch (e) { /* */ }
  if (document.documentElement) document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  applyLangTo(document, lang);
  const btn = document.getElementById('btnLang');
  if (btn) btn.textContent = lang === 'en' ? '中文' : 'EN';
  document.dispatchEvent(new CustomEvent('ff:lang', { detail: lang }));
}

// 把某个根节点（document 或动态插入的元素）下的已标记文本切换到目标语言
function applyLangTo(root, lang) {
  const hit = (attr, apply) => {
    const out = [];
    if (root.matches && root.matches && root.hasAttribute(attr)) out.push(root);
    for (const el of root.querySelectorAll('[' + attr + ']')) out.push(el);
    for (const el of out) {
      const src = el.getAttribute(attr);
      apply(el, (lang === 'en' && EN[src]) ? EN[src] : src, src);
    }
  };
  // 值不变就不写，避免 textContent 替换文本节点又触发 MutationObserver 死循环
  hit('data-ff-zh', (el, val) => { if (el.textContent !== val) el.textContent = val; });
  hit('data-ff-ph', (el, val) => { if (el.getAttribute('placeholder') !== val) el.setAttribute('placeholder', val); });
  hit('data-ff-title', (el, val) => { if (el.getAttribute('title') !== val) el.setAttribute('title', val); });
  hit('data-ff-al', (el, val) => { if (el.getAttribute('aria-label') !== val) el.setAttribute('aria-label', val); });
}

// 动态插入的内容（app.js 渲染的列表、toast 等）自动进入翻译管线
let moQueued = false;
const mo = new MutationObserver(() => {
  if (moQueued) return;
  moQueued = true;
  Promise.resolve().then(() => {
    moQueued = false;
    autoTag(document.body);
    applyLangTo(document, cur);
  });
});
if (document.body) {
  mo.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { childList: true, subtree: true }));
}

// 顶栏语言按钮：中英互切
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnLang');
  if (btn) btn.onclick = () => applyLang(cur === 'en' ? 'zh' : 'en');
});

autoTag(document);
applyLang(cur);

// 顶栏语言按钮：中英互切
