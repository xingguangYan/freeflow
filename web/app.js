'use strict';
/* 自由发网页版：连接同局域网电脑端引擎（server.js），完成多平台一键发布。
 * 引擎接口复用桌面/移动端同一套 REST API：/api/platforms /api/accounts /api/articles
 * /api/materials /api/tasks /api/logs。本地上传：文件 → base64 → 素材库 → 发布时一并带走。 */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const I18N = {
  connect: { zh: '连接引擎', en: 'Connect' }, useLocal: { zh: '本机', en: 'Local' },
  platforms: { zh: '平台账号', en: 'Platforms' }, selectAll: { zh: '全选', en: 'Select all' }, selectNone: { zh: '清空', en: 'Clear' },
  searchPh: { zh: '搜索平台 / 账号', en: 'Search platform / account' },
  checkAllLogin: { zh: '一键检测登录', en: 'Check login' },
  editor: { zh: '内容编辑', en: 'Editor' }, ctArticle: { zh: '图文', en: 'Article' }, ctVideo: { zh: '视频', en: 'Video' }, ctAudio: { zh: '音频', en: 'Audio' },
  saveDraft: { zh: '保存草稿', en: 'Save draft' },
  titlePh: { zh: '标题', en: 'Title' }, summaryPh: { zh: '摘要（选填，部分平台用作描述）', en: 'Summary (optional)' }, tagsPh: { zh: '标签，逗号分隔（选填）', en: 'Tags, comma separated' },
  coverHint: { zh: '点击或拖拽上传封面（选填）', en: 'Click or drop cover image' },
  pickCover: { zh: '选择图片', en: 'Pick image' }, clearCover: { zh: '清除', en: 'Clear' }, coverTip: { zh: '支持本地上传，随内容一起发布', en: 'Local upload, sent with your post' },
  insImage: { zh: '图片', en: 'Image' }, uploadIns: { zh: '上传', en: 'Upload' },
  chars: { zh: '字', en: 'chars' }, drafts: { zh: '草稿箱', en: 'Drafts' },
  publish: { zh: '一键发布', en: 'Publish' }, sched: { zh: '定时发布', en: 'Schedule' },
  publishNow: { zh: '立即一键发布', en: 'Publish to all selected' },
  donateTitle: { zh: '请作者喝杯咖啡', en: 'Buy me a coffee' },
  donateText: { zh: '工具对你有帮助的话，扫码支持一下，这是我继续更新的动力 :)', en: 'Scan to support if this tool helps you — it keeps the updates coming :)' },
  biz: { zh: '商务合作', en: 'Business' },
  footHint: { zh: '网页版连接本机或局域网电脑端的「自由发」引擎来执行发布；先在电脑上启动桌面版。', en: 'The web edition talks to the Freeflow engine on your computer; start the desktop app first.' },
  themeLight: { zh: '浅色', en: 'Light' }, themeDark: { zh: '深色', en: 'Dark' },
  heroSub: { zh: '一个页面写好内容，勾选平台，一键发到 59 个平台。完全免费、开源；发布在你自己电脑上的浏览器里完成，账号与数据不经云端。', en: 'Write once, tick the platforms, publish to 59 platforms in one click. Free & open source; publishing runs in the browser on your own computer — no cloud backend.' },
  heroDl: { zh: '免费下载桌面版（获得发布能力）', en: 'Download desktop app (enables publishing)' },
  heroHow: { zh: '如何使用', en: 'How to use' },
  step0: { zh: '没连引擎时也能写文章：草稿保存在本浏览器，可导出 Markdown / HTML', en: 'Without an engine you can still write: drafts save in this browser, export as Markdown / HTML' },
  step1: { zh: '下载并在电脑上启动桌面版（绿色免安装）', en: 'Download and start the desktop app on your computer (portable)' },
  step2: { zh: '在本页顶部地址栏填入电脑局域网地址，如 http://192.168.1.10:8917（本机就是 http://localhost:8917）', en: 'Enter the desktop address in the bar above, e.g. http://192.168.1.10:8917 (or http://localhost:8917)' },
  step3: { zh: '点「连接引擎」，左侧即可看到你所有已登录账号，直接一键发布', en: 'Click Connect — your logged-in accounts appear on the left, ready to publish' },
  exportMd: { zh: '导出 Markdown', en: 'Export Markdown' },
  exportHtml: { zh: '导出 HTML', en: 'Export HTML' },
};
let lang = localStorage.getItem('ff_web_lang') || 'zh';
let theme = localStorage.getItem('ff_web_theme') || 'light';
let API = (localStorage.getItem('ff_web_engine') || 'http://localhost:8917').replace(/\/+$/, '');
let platforms = [], accounts = [], materials = [], drafts = [];
let staticPlatforms = []; // 公网独立模式兜底：静态平台清单（platforms.json）

// 加载静态平台清单（与桌面端 platforms.js 同源，构建时生成）
async function loadStaticPlatforms() {
  try { const r = await fetch('platforms.json', { cache: 'no-cache' }); if (r.ok) staticPlatforms = await r.json(); }
  catch (e) { /* 静默：旧站点无此文件 */ }
}
let selected = new Set();          // 选中的账号 id
let curArticle = null;             // 当前编辑的文章对象
let groupFilter = '', kw = '';
let logStartTs = 0, logTimer = null, pollTimer = null;
let connected = false; // false = 独立模式（浏览器本地写作），true = 已连引擎（可发布）
// 独立模式草稿箱：存在 localStorage，引擎模式用服务端 /api/articles
const localDrafts = {
  load: () => { try { return JSON.parse(localStorage.getItem('ff_web_drafts') || '[]'); } catch { return []; } },
  save: (list) => { try { localStorage.setItem('ff_web_drafts', JSON.stringify(list.slice(-50))); } catch { /* */ } },
};
function setMode(isConn) {
  connected = isConn;
  $('#modeBanner').textContent = isConn ? ('已连接引擎 ' + API + ' · 可一键发布') : (lang === 'zh' ? '独立模式 · 发布需连接本机引擎' : 'Standalone · connect the engine to publish');
  $('#modeBanner').className = 'hero-mode' + (isConn ? ' on' : '');
  $('#heroBox').classList.toggle('slim', isConn);
  if (isConn) { $('#howToBox').hidden = true; }
}
function mdToHtml(md) {
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const lines = String(md || '').split(/\r?\n/);
  let html = '', inList = false, inCode = false;
  for (const ln of lines) {
    if (/^```/.test(ln)) { inCode = !inCode; html += inCode ? '<pre><code>' : '</code></pre>'; continue; }
    if (inCode) { html += esc(ln) + '\n'; continue; }
    let l = ln.trim();
    if (/^- /.test(l)) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + esc(l.slice(2)) + '</li>'; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    let m = /^(#{1,3})\s+(.*)$/.exec(l); if (m) { html += `<h${m[1].length}>${esc(m[2])}</h${m[1].length}>`; continue; }
    if (l.startsWith('> ')) { html += '<blockquote>' + esc(l.slice(2)) + '</blockquote>'; continue; }
    l = esc(l).replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
    html += l ? '<p>' + l + '</p>' : '';
  }
  if (inList) html += '</ul>';
  return html;
}
function exportContent(kind) {
  const title = $('#artTitle').value.trim() || (lang === 'zh' ? '未命名' : 'Untitled');
  const content = $('#artContent').value;
  const blob = kind === 'md'
    ? new Blob(['# ' + title + '\n\n' + content], { type: 'text/markdown;charset=utf-8' })
    : new Blob(['<!DOCTYPE html><meta charset="utf-8"><title>' + title + '</title><body style="font-family:sans-serif;max-width:720px;margin:40px auto;padding:0 16px">' + mdToHtml(content) + '</body>'], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = title + '.' + kind;
  document.body.appendChild(a); a.click(); a.remove();
}

function t(k) { return (I18N[k] && (I18N[k][lang] || I18N[k].zh)) || k; }
function applyI18n() { $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); }); $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); }); $('#btnLang').textContent = lang === 'zh' ? 'English' : '中文'; }
function applyTheme(name) { theme = name; document.documentElement.dataset.theme = name; $('#themeSelect').value = name; localStorage.setItem('ff_web_theme', name); }
function setEngine(url, keep) { API = String(url || '').trim().replace(/\/+$/, ''); if (!keep) localStorage.setItem('ff_web_engine', API); $('#engineUrl').value = API; }
function fmtTime(ts) { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }

async function api(path, opts = {}) {
  const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || r.statusText || ('HTTP ' + r.status)); }
  return r.status === 204 ? null : r.json();
}
function toast(msg, kind) {
  const box = $('#logBox'); const line = document.createElement('div');
  line.className = 'log-line ' + (kind || 'info'); line.textContent = `[${fmtTime(Date.now())}] ${msg}`;
  box.appendChild(line); box.scrollTop = box.scrollHeight;
}

// ---------- 引擎连接 ----------
async function connect(keep) {
  setEngine($('#engineUrl').value, keep);
  $('#connDot').classList.remove('on'); $('#btnConnect').disabled = true;
  try {
    platforms = await api('/api/platforms');
    accounts = await api('/api/accounts');
    materials = await api('/api/materials');
    drafts = await api('/api/articles');
    $('#connDot').classList.add('on');
    toast(`已连接引擎 ${API}：${platforms.length} 平台 / ${accounts.length} 账号`, 'ok');
    // 独立模式下勾选的平台（pf:前缀）自动映射到对应账号
    const pfSel = [...selected].filter(k => String(k).startsWith('pf:')).map(k => k.slice(3));
    if (pfSel.length) {
      selected = new Set([...selected].filter(k => !String(k).startsWith('pf:')));
      accounts.filter(a => pfSel.includes(a.platformId)).forEach(a => selected.add(a.id));
    }
    renderPlatforms(); renderDrafts(); renderTargets();
    setMode(true);
    return true;
  } catch (e) {
    toast('连接引擎失败：' + e.message + '（确认电脑端「自由发」已启动）', 'error');
    // 公网访客没有本地引擎：进入独立模式（本地草稿 + 导出），不阻塞使用
    setMode(false);
    platforms = staticPlatforms.slice(); accounts = []; materials = [];
    drafts = localDrafts.load();
    renderPlatforms(); renderDrafts(); renderTargets();
    return false;
  } finally { $('#btnConnect').disabled = false; }
}

// ---------- 平台与账号 ----------
function statusBadge(st) {
  const m = { loggedIn: ['logged', '已登录'], waiting: ['waiting', '登录中'], expired: ['expired', '未登录'] };
  const hit = m[st]; return hit ? `<span class="badge ${hit[0]}">${hit[1]}</span>` : '<span class="badge unknown">未检测</span>';
}
function renderPlatforms() {
  const box = $('#platformList'); box.innerHTML = '';
  const groups = [...new Set(platforms.map(p => p.group || '其他'))];
  $('#groupChips').innerHTML = groups.map(g => `<span class="chip ${groupFilter === g ? 'on' : ''}" data-g="${g}">${g}</span>`).join('');
  const typeMap = { article: '图文', video: '视频', audio: '音频' };
  const ct = $('#contentType').value;
  for (const row of selRows()) {
    const { p, acc, key } = row;
    if (kw && !(p.name + (acc ? acc.name : '')).toLowerCase().includes(kw)) continue;
    if (groupFilter && (p.group || '其他') !== groupFilter) continue;
    const item = document.createElement('label');
    item.className = 'platform-item';
    const off = ct === 'video' ? !/视频|Video/.test(p.group || '') : false;
    const sub = acc ? `${acc.name} · ${typeMap[acc.type] || typeMap.article}` : '勾选后连接引擎自动匹配账号';
    item.innerHTML = `<input type="checkbox" data-id="${key}" ${selected.has(key) ? 'checked' : ''} ${off ? 'disabled' : ''}>
      <span class="pi-name">${p.name}</span><span class="pi-sub">${sub}</span>${acc ? statusBadge(acc.status) : '<span class="badge waiting">待连接</span>'}`;
    item.querySelector('input').addEventListener('change', e => {
      e.target.checked ? selected.add(key) : selected.delete(key);
      renderTargets();
    });
    box.appendChild(item);
  }
  if (!box.children.length) box.innerHTML = '<div style="color:var(--muted);font-size:12.5px;padding:8px">无匹配平台 / 账号</div>';
}
// 可选择行：已连引擎按账号列；独立模式（未连引擎）按平台列，选中后连引擎会自动映射到账号
function selRows() {
  if (connected && accounts.length) return accounts.map(a => ({ acc: a, p: platforms.find(x => x.id === a.platformId), key: a.id })).filter(r => r.p);
  return platforms.map(p => ({ acc: null, p, key: 'pf:' + p.id }));
}
function renderTargets() {
  const rows = selRows().filter(r => selected.has(r.key));
  const names = rows.map(r => r.acc ? `${r.p.name}/${r.acc.name}` : r.p.name);
  $('#publishTargets').innerHTML = names.length
    ? names.map(n => `<div>✓ ${n}</div>`).join('') + `<div style="margin-top:4px">共 ${names.length} 个目标${connected ? '' : ' · 独立模式，连接引擎后匹配账号'}</div>`
    : '<div>尚未选择（在左侧勾选平台 / 账号）</div>';
  const btn = $('#btnPublish'); btn.disabled = !names.length;
  btn.textContent = t('publishNow') + `（${names.length}）`;
}
async function checkAllLogin() {
  if (!connected) { toast('未连接引擎，无法检测登录态。请先连接本机引擎。', 'warn'); return; }
  toast('开始检测所有账号登录态…');
  try {
    await api('/api/accounts/check-all', { method: 'POST', body: JSON.stringify({}) });
    toast('检测完成', 'ok');
    accounts = await api('/api/accounts'); renderPlatforms();
  } catch (e) { toast('检测失败：' + e.message, 'error'); }
}

// ---------- 编辑器 ----------
function countChars() { $('#charCount').textContent = $('#artContent').value.length; }
function readFileAsDataURL(file) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
}
async function uploadImage(file) {
  const base64 = await readFileAsDataURL(file);
  const m = await api('/api/materials', { method: 'POST', body: JSON.stringify({ name: file.name, base64 }) });
  materials = await api('/api/materials');
  return m; // { id, name, url, ... }
}
async function pickAndUpload(forCover) {
  return new Promise(res => {
    const inp = $('#filePick');
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; inp.value = '';
      if (!f) return res(null);
      try { const m = await uploadImage(f); toast(`本地上传成功：${m.name}`, 'ok'); res(m); }
      catch (e) { toast('上传失败：' + e.message, 'error'); res(null); }
    };
    inp.click();
  });
}
function setCover(m) {
  if (!m) { curArticle && (curArticle.cover = null); $('#coverPreview').src = ''; $('#coverPreview').style.display = 'none'; return; }
  if (!curArticle) curArticle = { id: null, type: $('#contentType').value, mode: 'richtext' };
  curArticle.cover = m.url;
  $('#coverPreview').src = API + m.url; $('#coverPreview').style.display = 'block';
}
function insertAtCursor(text) {
 const ta = $('#artContent'); const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + text.length; countChars();
}
async function collectArticle() {
  const type = $('#contentType').value;
  if (!curArticle) curArticle = { id: null, type, mode: 'richtext' };
  curArticle.type = type;
  curArticle.title = $('#artTitle').value.trim();
  curArticle.content = $('#artContent').value;
  curArticle.summary = $('#artSummary').value.trim();
  curArticle.tags = $('#artTags').value.trim();
  curArticle.mode = 'richtext';
  return curArticle;
}
async function saveDraft() {
  const art = await collectArticle();
  if (!art.title && !art.content) return toast('标题或正文不能都为空', 'warn');
  if (!connected) {
    // 独立模式：草稿存本浏览器（localStorage）
    const list = localDrafts.load();
    const item = { id: curArticle && curArticle.id || ('local_' + Date.now()), ...art, updatedAt: Date.now() };
    const i = list.findIndex(x => x.id === item.id);
    if (i !== -1) list[i] = item; else list.push(item);
    localDrafts.save(list); drafts = list; curArticle = item;
    renderDrafts(); toast(`草稿已保存到本浏览器：${item.title || '未命名'}`, 'ok');
    return item;
  }
  const body = { ...art };
  const saved = await api('/api/articles', { method: 'POST', body: JSON.stringify(body) });
  curArticle = saved;
  drafts = await api('/api/articles'); renderDrafts();
  toast(`草稿已保存：${saved.title || '未命名'}`, 'ok');
  return saved;
}
function renderDrafts() {
  const box = $('#draftList'); box.innerHTML = '';
  const list = [...drafts].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30);
  for (const d of list) {
    const el = document.createElement('div'); el.className = 'draft-item';
    el.innerHTML = `<span class="t">${d.title || '未命名'}</span><span style="color:var(--muted)">${fmtTime(d.updatedAt)}</span><span class="x" title="删除">✕</span>`;
    el.querySelector('.t').addEventListener('click', () => loadDraft(d));
    el.querySelector('.x').addEventListener('click', async ev => {
      ev.stopPropagation();
      if (connected) { await api('/api/articles/' + d.id, { method: 'DELETE' }); drafts = await api('/api/articles'); }
      else { localDrafts.save(localDrafts.load().filter(x => x.id !== d.id)); drafts = localDrafts.load(); }
      renderDrafts(); toast('草稿已删除');
    });
    box.appendChild(el);
  }
  if (!box.children.length) box.innerHTML = '<div style="color:var(--muted);font-size:12px">暂无草稿</div>';
}
function loadDraft(d) {
  curArticle = { ...d };
  $('#artTitle').value = d.title || ''; $('#artContent').value = d.content || '';
  $('#artSummary').value = d.summary || ''; $('#artTags').value = d.tags || '';
  $('#contentType').value = d.type || 'article';
  if (d.cover) { $('#coverPreview').src = API + d.cover; $('#coverPreview').style.display = 'block'; } else setCover(null);
  countChars(); toast(`已载入草稿「${d.title || '未命名'}」`);
}

// ---------- 发布 ----------
async function publish() {
  const btn = $('#btnPublish'); btn.disabled = true;
  try {
    if (!connected) {
      toast(`已选 ${selected.size} 个平台。发布需要在电脑上启动「自由发」桌面版：在顶部地址栏填入引擎地址（本机 http://localhost:8917，局域网 http://<电脑IP>:8917）点「连接引擎」，勾选的平台会自动匹配已登录账号。`, 'warn');
      return;
    }
    const art = await saveDraft();
    const accountIds = [...selected];
    const sched = $('#schedEnable').checked ? new Date($('#schedAt').value).getTime() : null;
    if ($('#schedEnable').checked && (!sched || isNaN(sched))) { toast('定时时间无效', 'warn'); btn.disabled = false; return; }
    const task = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ articleId: art.id, accountIds, scheduledAt: sched }) });
    toast(`已创建发布任务 ${task.id || ''}：${accountIds.length} 个平台${sched ? '（定时 ' + fmtTime(sched) + '）' : '，立即执行'}`, 'ok');
    startLogPolling();
  } catch (e) {
    toast('发布失败：' + e.message, 'error');
  } finally { btn.disabled = false; }
}
function startLogPolling() {
  logStartTs = Date.now(); clearInterval(logTimer);
  $('#publishProgress').innerHTML = '<div class="bar"><i id="barFill"></i></div><div id="barText">执行中…</div>';
  logTimer = setInterval(pollLogs, 1500);
}
async function pollLogs() {
  try {
    const logs = await api('/api/logs');
    const box = $('#logBox');
    const fresh = logs.slice(-80).filter(l => l.ts >= logStartTs);
    logStartTs = Math.max.apply(null, [logStartTs].concat(fresh.map(l => l.ts)));
    box.innerHTML = fresh.map(l => `<div class="log-line ${l.level}">[${fmtTime(l.ts)}] ${l.msg}</div>`).join('');
    box.scrollTop = box.scrollHeight;
    // 进度：成功/失败数 ≥ 选中数则结束
    const done = fresh.filter(l => /登录成功|发布成功|发布失败|存为草稿|继续发布|发布超时/.test(l.msg)).length;
    if (done > 0) {
      const bar = $('#barFill'); if (bar) bar.style.width = Math.min(100, Math.round(done / Math.max(1, selected.size) * 100)) + '%';
      const bt = $('#barText'); if (bt) bt.textContent = `已完成 ${done}/${selected.size} 项`;
    }
    if (done && done >= selected.size) { clearInterval(logTimer); toast('全部发布流程结束', 'ok'); }
  } catch { /* 引擎忙 */ }
}

// ---------- 事件绑定 ----------
$('#btnConnect').addEventListener('click', () => connect(false));
$('#btnLocal').addEventListener('click', () => { setEngine('http://localhost:8917'); connect(false); });
$('#engineUrl').addEventListener('keydown', e => { if (e.key === 'Enter') connect(false); });
$('#btnLang').addEventListener('click', () => { lang = lang === 'zh' ? 'en' : 'zh'; localStorage.setItem('ff_web_lang', lang); applyI18n(); renderTargets(); });
$('#themeSelect').addEventListener('change', e => applyTheme(e.target.value));
$('#platformSearch').addEventListener('input', e => { kw = e.target.value.trim().toLowerCase(); renderPlatforms(); });
$('#groupChips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; groupFilter = groupFilter === c.dataset.g ? '' : c.dataset.g; renderPlatforms(); });
$('#btnSelectAll').addEventListener('click', () => { selRows().forEach(r => selected.add(r.key)); renderPlatforms(); renderTargets(); });
$('#btnSelectNone').addEventListener('click', () => { selected.clear(); renderPlatforms(); renderTargets(); });
$('#btnCheckAll').addEventListener('click', checkAllLogin);
$('#contentType').addEventListener('change', renderPlatforms);
$('#artContent').addEventListener('input', countChars);
$('#btnSaveDraft').addEventListener('click', saveDraft);
$('#btnRefreshDrafts').addEventListener('click', async () => {
  if (connected) { try { drafts = await api('/api/articles'); } catch { /* */ } }
  else { drafts = localDrafts.load(); }
  renderDrafts();
});
$('#btnHowTo').addEventListener('click', () => { const b = $('#howToBox'); b.hidden = !b.hidden; });
$('#btnExportMd').addEventListener('click', () => exportContent('md'));
$('#btnExportHtml').addEventListener('click', () => exportContent('html'));
$('#coverZone').addEventListener('click', async () => { const m = await pickAndUpload(true); if (m) setCover(m); });
$('#coverZone').addEventListener('dragover', e => { e.preventDefault(); $('#coverZone').classList.add('drag'); });
$('#coverZone').addEventListener('dragleave', () => $('#coverZone').classList.remove('drag'));
$('#coverZone').addEventListener('drop', async e => {
  e.preventDefault(); $('#coverZone').classList.remove('drag');
  const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
  try { const m = await uploadImage(f); setCover(m); toast('封面上传成功', 'ok'); } catch (err) { toast('上传失败：' + err.message, 'error'); }
});
$('#btnPickCover').addEventListener('click', () => pickAndUpload(true).then(m => m && setCover(m)));
$('#btnClearCover').addEventListener('click', () => setCover(null));
$('#btnUploadIns').addEventListener('click', async () => {
  const m = await pickAndUpload(false);
  if (m) insertAtCursor(`\n![${m.name}](${API + m.url})\n`);
});
$('#btnInsImage').addEventListener('click', () => {
  if (!materials.length) return toast('素材库为空，先上传一张图片', 'warn');
  const m = materials[materials.length - 1];
  insertAtCursor(`\n![${m.name}](${API + m.url})\n`);
  toast(`已插入最近上传的「${m.name}」；如需其它图片请点「上传」`);
});
$$('.toolbar .tool[data-fmt]').forEach(b => b.addEventListener('click', () => {
  const f = b.dataset.fmt;
  const map = { bold: '**加粗**', italic: '*斜体*', h2: '\n## 标题\n', quote: '\n> 引用\n', list: '\n- 列表项\n', code: '\n```\n代码\n```\n' };
  if (map[f]) insertAtCursor(map[f]);
}));
$('#btnPublish').addEventListener('click', publish);

// ---------- 初始化 ----------
applyTheme(theme); applyI18n(); setEngine(API, true); countChars(); renderTargets();
(async () => {
  // 先加载静态平台清单并渲染（公网访客无引擎也能看到全部平台并勾选），再尝试连接引擎
  await loadStaticPlatforms();
  if (!platforms.length) { platforms = staticPlatforms.slice(); renderPlatforms(); }
  connect(true);
})();
