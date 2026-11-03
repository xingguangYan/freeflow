'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// ---------- 主题 ----------
const THEMES = ['light', 'dark', 'blue', 'green', 'orange', 'rose'];
function applyTheme(name) {
  const t = THEMES.includes(name) ? name : 'light';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('freeflow-theme', t); } catch { /* */ }
  $$('#themeSwitch button').forEach(b => b.classList.toggle('active', b.dataset.theme === t));
}
applyTheme((() => { try { return localStorage.getItem('freeflow-theme') || 'light'; } catch { return 'light'; } })());
$('#themeSwitch').addEventListener('click', e => {
  const b = e.target.closest('button'); if (b) applyTheme(b.dataset.theme);
});

// ---------- 连接电脑端（手机版用）----------
// 桌面端默认同源；手机 APK 填电脑局域网地址（如 192.168.1.10:8917）后，账号与发布都走电脑引擎
const API = (() => {
  try { return (localStorage.getItem('ff_host') || '').trim().replace(/\/+$/, ''); } catch { return ''; }
})();
function asset(p) { return API && p.startsWith('/') ? API + p : p; }

async function api(path, opts = {}) {
  const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || r.statusText); }
  return r.status === 204 ? null : r.json();
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3600);
}
function fmtTime(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function esc(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function mdToHtmlLocal(md) {
  const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => s
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inCode = false, code = [], list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      if (!inCode) { inCode = true; code = []; close(); }
      else { inCode = false; out.push(`<pre><code>${escH(code.join('\n'))}</code></pre>`); }
      continue;
    }
    if (inCode) { code.push(line); continue; }
    if (!line.trim()) { close(); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { close(); out.push(`<h${h[1].length}>${inline(escH(h[2]))}</h${h[1].length}>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { close(); out.push('<hr>'); continue; }
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const t = ul ? 'ul' : 'ol';
      if (list !== t) { close(); out.push(`<${t}>`); list = t; }
      out.push(`<li>${inline(escH((ul || ol)[1]))}</li>`);
      continue;
    }
    close();
    const bq = /^>\s?(.*)$/.exec(line);
    if (bq) { out.push(`<blockquote>${inline(escH(bq[1]))}</blockquote>`); continue; }
    out.push(`<p>${inline(escH(line))}</p>`);
  }
  if (inCode) out.push(`<pre><code>${escH(code.join('\n'))}</code></pre>`);
  close();
  return out.join('');
}

const S = { platforms: [], accounts: [], articles: [], materials: [], stats: [], current: null, loginPoll: new Map(), taskTimer: null, search: '' };

const platOf = id => S.platforms.find(p => p.id === id) || {};
const platName = id => platOf(id).name || id;
const platColor = id => platOf(id).color || '#666';
const platAbbr = id => (platOf(id).name || '?').slice(0, 1);
const platAvatar = id => `<span class="plat-av" style="background:${platColor(id)}">${platAbbr(id)}</span>`;
const accStatusPill = a => a.status === 'loggedIn'
  ? '<span class="pill ok">已登录</span>'
  : a.status === 'waiting' ? '<span class="pill warn">等待登录…</span>'
  : a.status === 'expired' ? '<span class="pill err">登录过期</span>'
  : '<span class="pill gray">未登录</span>';
function updateTopStats() {
  const n = S.accounts.filter(a => a.status === 'loggedIn').length;
  $('#topStats').textContent = `文章 ${S.articles.length} 篇 · 账号 ${S.accounts.length} 个 · 已登录 ${n} 个`;
}

// ---------- 导航 ----------
function switchView(view, title) {
  $$('.nav-item').forEach(x => x.classList.toggle('active', x.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  $('#viewTitle').textContent = title;
  if (view === 'publish') { renderPublish(); startTaskPoll(); }
  if (view === 'logs') loadLogs();
  if (view === 'stats') loadStats();
}
$('#nav').addEventListener('click', e => {
  const b = e.target.closest('.nav-item'); if (!b) return;
  switchView(b.dataset.view, b.textContent.trim());
});

// ---------- 文章 ----------
async function loadArticles() {
  S.articles = await api('/api/articles');
  renderArticleList(); renderPubArticleSelect(); updateTopStats();
}
function renderArticleList() {
  const list = S.search ? S.articles.filter(a => (a.title || '').toLowerCase().includes(S.search.toLowerCase())) : S.articles;
  if (!list.length) {
    $('#articleList').innerHTML = '<div class="empty">还没有文章<br>点右上「+ 新建」开始第一篇</div>';
    return;
  }
  $('#articleList').innerHTML = list.map(a => `
    <li data-id="${a.id}" class="${S.current && S.current.id === a.id ? 'active' : ''}">
      <span class="t">${esc(a.title)}</span>
      <span class="meta">${fmtTime(a.updatedAt || a.createdAt)}${a.cover ? ' · 有封面' : ''}${a.mode === 'markdown' ? ' · MD' : ''}</span>
    </li>`).join('');
  $$('#articleList li[data-id]').forEach(li => li.onclick = () => selectArticle(li.dataset.id));
}
async function selectArticle(id) {
  await saveCurrent(false);
  S.current = S.articles.find(a => a.id === id);
  if (!S.current) return;
  $('#editorTitle').textContent = S.current.title;
  $('#artTitle').value = S.current.title;
  const mode = S.current.mode || 'richtext';
  $('#artContent').innerHTML = mode === 'markdown' ? '' : (S.current.content || '');
  $('#artMd').value = mode === 'markdown' ? (S.current.content || '') : '';
  applyMode(mode);
  applyType(S.current.type || 'article');
  $('#artTags').value = S.current.tags || '';
  $('#videoStatus').textContent = S.current.videoFile || S.current.videoPath
    ? '已选视频：' + (S.current.videoName || S.current.videoFile || S.current.videoPath) : '';
  renderCoverSelect();
  renderArticleList();
  updateArtStats();
}
function applyMode(mode) {
  $$('#view-articles input[name="artMode"]').forEach(r => r.checked = (r.value === mode));
  const md = mode === 'markdown';
  $('#mdWrap').style.display = md ? 'block' : 'none';
  $('#artContent').style.display = md ? 'none' : 'block';
  $('#edToolbar').style.display = md ? 'none' : 'flex';
  $('#mdPreview').style.display = 'none';
}
$$('#view-articles input[name="artMode"]').forEach(r => r.addEventListener('change', () => {
  if (!S.current) return;
  const mode = r.value;
  // 切换时保留已有内容
  if (mode === 'markdown') $('#artMd').value = $('#artContent').innerText || $('#artMd').value || '';
  else $('#artContent').innerHTML = mdToHtmlLocal($('#artMd').value || '') || $('#artContent').innerHTML;
  applyMode(mode);
  if (S.current.type !== 'video') $('#edToolbar').style.display = mode === 'markdown' ? 'none' : 'flex';
  updateArtStats();
}));
function applyType(t) {
  $$('#view-articles input[name="artType"]').forEach(r => r.checked = (r.value === t));
  const video = t === 'video';
  $('#videoFields').style.display = video ? 'block' : 'none';
  const md = ($('#view-articles input[name="artMode"]:checked') || {}).value === 'markdown';
  $('#edToolbar').style.display = (video || md) ? 'none' : 'flex';
  $('#artContent').setAttribute('data-placeholder', video ? '写视频简介 / 文案…' : '写正文，也可以直接从 Word / 网页粘贴（保留格式）。');
  $('#btnScanArticle').style.display = video ? 'none' : '';
}
$$('#view-articles input[name="artType"]').forEach(r => r.addEventListener('change', () => applyType(r.value)));
function renderCoverSelect() {
  const sel = $('#artCover');
  sel.innerHTML = '<option value="">（不设置）</option>' + S.materials.map(m =>
    `<option value="${m.id}" ${S.current && S.current.cover === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  $('#coverThumb').innerHTML = S.current && S.current.cover ? `<img src="${asset('/materials/' + S.current.cover)}">` : '';
}
$('#artCover').addEventListener('change', () => {
  if (S.current) { S.current.cover = $('#artCover').value || null; saveCurrent(false); renderCoverSelect(); }
});
$('#btnNewArticle').onclick = async () => {
  const a = await api('/api/articles', { method: 'POST', body: JSON.stringify({ title: '未命名文章' }) });
  S.articles.push(a); renderArticleList(); await selectArticle(a.id); updateTopStats(); toast('已新建文章');
};
async function saveCurrent(notify = true) {
  if (!S.current) return;
  const type = ($('#view-articles input[name="artType"]:checked') || {}).value || 'article';
  const mode = ($('#view-articles input[name="artMode"]:checked') || {}).value || 'richtext';
  const content = mode === 'markdown' ? $('#artMd').value : $('#artContent').innerHTML;
  const body = { id: S.current.id, type, mode, title: $('#artTitle').value.trim() || '未命名', content, cover: S.current.cover, tags: $('#artTags').value.trim(), videoFile: S.current.videoFile || null, videoPath: S.current.videoPath || null };
  const a = await api('/api/articles', { method: 'POST', body: JSON.stringify(body) });
  Object.assign(S.current, a);
  $('#editorTitle').textContent = a.title;
  const li = $$('#articleList li').find(x => x.dataset.id === a.id);
  if (li) { li.querySelector('.t').textContent = a.title; li.querySelector('.meta').textContent = fmtTime(a.updatedAt) + (a.cover ? ' · 有封面' : '') + (a.mode === 'markdown' ? ' · MD' : ''); }
  if (notify) toast('已保存');
}
$('#btnSaveArticle').onclick = () => saveCurrent(true);
$('#artSearch').addEventListener('input', e => { S.search = e.target.value.trim(); renderArticleList(); });
['#artTitle', '#artContent', '#artMd'].forEach(sel => $(sel).addEventListener('input', updateArtStats));
$('#btnDelArticle').onclick = async () => {
  if (!S.current) return toast('先选择一篇文章');
  if (!confirm('删除文章「' + S.current.title + '」？此操作不可恢复')) return;
  await api('/api/articles/' + S.current.id, { method: 'DELETE' });
  S.articles = S.articles.filter(a => a.id !== S.current.id);
  S.current = null;
  $('#editorTitle').textContent = '未选择文章'; $('#artTitle').value = ''; $('#artContent').innerHTML = ''; $('#artMd').value = '';
  renderArticleList(); renderPubArticleSelect(); updateTopStats(); toast('已删除');
};
$('#btnDupArticle').onclick = async () => {
  if (!S.current) return toast('先选择一篇文章');
  await saveCurrent(false);
  const copy = await api('/api/articles/' + S.current.id + '/duplicate', { method: 'POST' });
  S.articles.push(copy); renderArticleList(); await selectArticle(copy.id); updateTopStats(); toast('已复制为新文章');
};
$('#btnMdPreview').onclick = () => {
  const box = $('#mdPreview');
  if (box.style.display === 'block') { box.style.display = 'none'; return; }
  box.innerHTML = mdToHtmlLocal($('#artMd').value || '');
  box.style.display = 'block';
};
function updateArtStats() {
  const md = ($('#view-articles input[name="artMode"]:checked') || {}).value === 'markdown';
  const text = md ? ($('#artMd').value || '') : ($('#artContent').innerText || '');
  const n = text.replace(/\s/g, '').length;
  $('#artStats').textContent = `字数 ${n} · 段落 ${text.split(/\n+/).filter(x => x.trim()).length}`;
  $('#mdCount').textContent = `Markdown ${(($('#artMd').value || '').length)} 字符`;
}
$('#btnScanArticle').onclick = () => {
  const txt = ($('#artTitle').value + '\n' + $('#artContent').innerText).trim();
  if (!txt) return toast('文章是空的');
  switchView('sensitive', '违禁词');
  $('#sensText').value = txt;
  scanSensitive();
};
$('#edToolbar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const cmd = b.dataset.cmd;
  const ed = $('#artContent'); ed.focus();
  if (cmd === 'insertImage') { insertMaterialImage(); return; }
  if (cmd === 'h2' || cmd === 'p') document.execCommand('formatBlock', false, cmd === 'h2' ? '<h2>' : '<p>');
  else document.execCommand(cmd, false, null);
});
function insertMaterialImage() {
  if (!S.materials.length) return toast('先去素材库上传图片');
  const ed = $('#artContent');
  const sel = window.getSelection();
  if (sel && sel.rangeCount && ed.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
  $('#imgModalGrid').innerHTML = S.materials.map((m, i) => `
    <div class="cell" data-i="${i}" title="${esc(m.name)}">
      <img src="${asset(m.url)}" alt="${esc(m.name)}" loading="lazy">
      <span>${i + 1}. ${esc(m.name)}</span>
    </div>`).join('');
  $$('#imgModalGrid .cell').forEach(c => c.onclick = () => doInsertImage(S.materials[+c.dataset.i]));
  $('#imgModal').style.display = 'flex';
}
let savedRange = null;
function doInsertImage(m) {
  $('#imgModal').style.display = 'none';
  if (!m) return;
  const ed = $('#artContent');
  ed.focus();
  const sel = window.getSelection();
  sel.removeAllRanges();
  if (savedRange && ed.contains(savedRange.startContainer)) {
    sel.addRange(savedRange);
  } else {
    const r = document.createRange();
    r.selectNodeContents(ed);
    r.collapse(false);
    sel.addRange(r);
  }
  document.execCommand('insertImage', false, m.url);
  const ok = [...ed.querySelectorAll('img')].some(img => img.getAttribute('src') === m.url);
  if (!ok) document.execCommand('insertHTML', false, `<img src="${m.url}" alt="${esc(m.name)}">`);
  toast('已插入图片：' + m.name);
  saveCurrent(false);
}
$('#imgModalClose').onclick = () => { $('#imgModal').style.display = 'none'; };
$('#imgModal').addEventListener('click', e => { if (e.target.id === 'imgModal') $('#imgModal').style.display = 'none'; });
// ---------- 从网页/剪贴板粘贴图片 ----------
function fileToDataUrl(f) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}
function insertImageAt(ed, m, range) {
  ed.focus();
  const sel = window.getSelection();
  sel.removeAllRanges();
  if (range && ed.contains(range.startContainer)) sel.addRange(range);
  else { const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); sel.addRange(r); }
  document.execCommand('insertImage', false, m.url);
  if (![...ed.querySelectorAll('img')].some(i => i.getAttribute('src') === m.url)) {
    document.execCommand('insertHTML', false, `<img src="${m.url}" alt="${esc(m.name)}">`);
  }
}
function insertTextAtCursor(ta, text) {
  const start = ta.selectionStart == null ? ta.value.length : ta.selectionStart;
  const end = ta.selectionEnd == null ? start : ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + text.length;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
async function handlePasteImages(e, target) {
  const dt = e.clipboardData; if (!dt) return;
  const urls = [];
  const html = dt.getData('text/html');
  if (html) {
    try {
      new DOMParser().parseFromString(html, 'text/html').querySelectorAll('img').forEach(img => {
        if (/^https?:/i.test(img.src)) urls.push(img.src);
      });
    } catch { /* */ }
  }
  const files = [...(dt.files || [])].filter(f => f.type.startsWith('image/'));
  if (!urls.length && !files.length) return;
  e.preventDefault();
  if (target === 'md') {
    let text = '';
    for (const f of files) {
      const b64 = await fileToDataUrl(f);
      const m = await api('/api/materials', { method: 'POST', body: JSON.stringify({ name: f.name || '粘贴图片.png', base64: b64 }) });
      text += `\n![${m.name}](${m.url})\n`;
    }
    for (const url of urls) {
      try {
        const m = await api('/api/materials/from-url', { method: 'POST', body: JSON.stringify({ url }) });
        text += `\n![${m.name}](${m.url})\n`;
      } catch (err) { toast('图片下载失败：' + err.message); }
    }
    if (text) { insertTextAtCursor($('#artMd'), text); loadMaterials(); toast('图片已插入'); }
    return;
  }
  const ed = $('#artContent');
  const sel = window.getSelection();
  const range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  for (const f of files) {
    const b64 = await fileToDataUrl(f);
    const m = await api('/api/materials', { method: 'POST', body: JSON.stringify({ name: f.name || '粘贴图片.png', base64: b64 }) });
    insertImageAt(ed, m, range);
  }
  for (const url of urls) {
    try {
      toast('正在下载网页图片…');
      const m = await api('/api/materials/from-url', { method: 'POST', body: JSON.stringify({ url }) });
      insertImageAt(ed, m, range);
    } catch (err) { toast('图片下载失败：' + err.message); }
  }
  if (files.length || urls.length) { loadMaterials(); saveCurrent(false); toast('图片已插入正文'); }
}
$('#artContent').addEventListener('paste', e => handlePasteImages(e, 'rich'));
$('#artMd').addEventListener('paste', e => handlePasteImages(e, 'md'));

// ---------- 视频 ----------
function setVideo(v) {
  S.current.videoFile = v.file; S.current.videoPath = null; S.current.videoName = v.name;
  $('#videoStatus').textContent = '已选视频：' + v.name;
}
$('#artVideoFile').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  if (!S.current) return toast('先新建或选择一篇文章');
  const rd = new FileReader();
  rd.onload = async () => {
    const v = await api('/api/videos', { method: 'POST', body: JSON.stringify({ name: f.name, base64: rd.result }) });
    setVideo(v); toast('视频已上传入库');
  };
  rd.readAsDataURL(f);
});
$('#btnUsePath').onclick = async () => {
  const p = $('#artVideoPath').value.trim();
  if (!p) return toast('请填写视频文件的本地路径');
  if (!S.current) return toast('先新建或选择一篇文章');
  try {
    const v = await api('/api/videos/path', { method: 'POST', body: JSON.stringify({ path: p }) });
    setVideo(v); toast('视频已登记');
  } catch (e) { toast(e.message); }
};

// ---------- 账号 ----------
async function loadAccounts() {
  S.accounts = await api('/api/accounts');
  renderAccounts(); renderPubAccounts(); updateTopStats();
}
function renderAccounts() {
  if (!S.accounts.length) {
    $('#accountGrid').innerHTML = '<div class="empty">还没有账号<br>用上方表单添加第一个平台账号</div>';
    return;
  }
  $('#accountGrid').innerHTML = S.accounts.map(a => {
    const p = platOf(a.platformId);
    return `
    <div class="acc-card">
      <div class="row1">${platAvatar(a.platformId)}
        <div style="flex:1;min-width:0">
          <div class="name">${esc(a.name)}</div>
          <div class="plat">${p.name}${p.experimental ? '（实验性）' : ''} · ${a.lastLoginAt ? '上次登录 ' + fmtTime(a.lastLoginAt) : '未登录过'}</div>
        </div>
        ${accStatusPill(a)}
      </div>
      <div class="ops">
        ${a.status === 'waiting'
          ? `<button class="btn small primary" data-done="${a.id}">我已登录完成</button>`
          : `<button class="btn small primary" data-login="${a.id}">${a.status === 'loggedIn' ? '重新登录' : '登录'}</button>`}
        <button class="btn small" data-check="${a.id}">检测</button>
        <button class="btn small danger" data-del="${a.id}">删除</button>
      </div>
    </div>`;
  }).join('');
  $$('#accountGrid [data-login]').forEach(b => b.onclick = () => startLogin(b.dataset.login));
  $$('#accountGrid [data-done]').forEach(b => b.onclick = () => finishLogin(b.dataset.done));
  $$('#accountGrid [data-check]').forEach(b => b.onclick = () => checkLogin(b.dataset.check));
  $$('#accountGrid [data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('删除账号会同时清掉它的本地登录态，确定？')) return;
    await api('/api/accounts/' + b.dataset.del, { method: 'DELETE' });
    toast('已删除'); loadAccounts();
  });
}
async function startLogin(accId) {
  const acc = S.accounts.find(a => a.id === accId);
  if (!acc) return;
  acc.status = 'waiting'; renderAccounts();
  try {
    const { sid } = await api(`/api/accounts/${accId}/login`, { method: 'POST' });
    toast('已打开登录窗口，扫码或登录后这里会自动变成「已登录」');
    const poll = async () => {
      try {
        const st = await api('/api/login-sessions/' + sid);
        if (st.closed) { S.loginPoll.delete(accId); await loadAccounts(); toast(`${platName(acc.platformId)} 登录完成`); return; }
        if (!S.loginPoll.has(accId)) return;
        setTimeout(poll, 3000);
      } catch { S.loginPoll.delete(accId); loadAccounts(); }
    };
    S.loginPoll.set(accId, true); setTimeout(poll, 3000);
  } catch (e) { acc.status = 'pending'; renderAccounts(); toast('登录启动失败: ' + e.message); }
}
async function finishLogin(accId) {
  await api('/api/accounts/' + accId + '/recheck', { method: 'POST' }).catch(() => null);
  S.loginPoll.delete(accId);
  await loadAccounts();
  toast('已标记为登录完成');
}
async function checkLogin(accId) {
  const acc = S.accounts.find(a => a.id === accId);
  if (!acc) return;
  toast('正在检测登录态…');
  try {
    const r = await api('/api/accounts/' + accId + '/check', { method: 'POST' });
    await loadAccounts();
    toast(r.loggedIn ? `${platName(acc.platformId)} 已登录` : `${platName(acc.platformId)} 未登录，请点「登录」扫码`);
  } catch (e) { toast('检测失败: ' + e.message); }
}
$('#btnAddAccount').onclick = async () => {
  const platformId = $('#newAccPlatform').value;
  const name = $('#newAccName').value.trim() || undefined;
  await api('/api/accounts', { method: 'POST', body: JSON.stringify({ platformId, name }) });
  $('#newAccName').value = '';
  toast('已添加，点「登录」去扫码'); loadAccounts();
};

// macOS 没装系统 Chrome 时的兜底：下载 Playwright chromium 内核（约 150MB，只需一次）
$('#btnInstallBrowser').onclick = async () => {
  const btn = $('#btnInstallBrowser');
  btn.disabled = true; btn.textContent = '下载中…（约150MB）';
  try {
    const r = await api('/api/browser/install-chromium', { method: 'POST' });
    toast(r.already ? '浏览器内核已就绪，可直接登录' : '浏览器内核下载完成，现在可以登录了');
  } catch (e) {
    toast('内核下载失败: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '安装浏览器内核';
  }
};

// ---------- 发布 ----------
function renderPubArticleSelect() {
  const sel = $('#pubArticle'); if (!sel) return;
  sel.innerHTML = S.articles.map(a => `<option value="${a.id}">${esc(a.title)}</option>`).join('') || '<option value="">（没有文章）</option>';
}
function renderPubAccounts() {
  const el = $('#pubAccounts'); if (!el) return;
  const art = S.articles.find(a => a.id === $('#pubArticle').value);
  const need = art && art.type === 'video' ? 'video' : 'article';
  updatePubModeHint(art);
  const html = S.platforms.map(p => {
    if (p.mode && p.mode !== 'both' && p.mode !== need) return '';
    const accs = S.accounts.filter(a => a.platformId === p.id);
    if (!accs.length) return '';
    const chip = p.contentType === 'markdown' ? '<span class="mode-chip md">Markdown</span>' : '<span class="mode-chip rt">富文本</span>';
    return `<div class="pub-group">${p.name}${p.region === 'global' ? ' · 海外' : ''}${p.experimental ? '（实验性）' : ''} · ${need === 'video' ? '视频' : '图文'} ${chip}</div>` + accs.map(a => `
      <label class="pub-acc">
        <input type="checkbox" value="${a.id}" ${a.status !== 'loggedIn' ? 'data-maybe="1"' : ''}>
        ${platAvatar(a.platformId)}
        <span class="who"><span class="n">${esc(a.name)}</span> ${accStatusPill(a)}</span>
      </label>`).join('');
  }).join('');
  el.innerHTML = html || `<span class="muted">${need === 'video' ? '没有可发视频的账号：先去「账号」页添加抖音 / 快手 / B站视频等' : '先去「账号」页添加并登录账号'}</span>`;
  el.querySelectorAll('input[data-maybe]').forEach(cb => cb.addEventListener('change', () => {
    cb.closest('.pub-acc').style.background = cb.checked ? '#fff8e6' : '';
  }));
}
function updatePubModeHint(art) {
  const el = $('#pubModeHint'); if (!el) return;
  if (!art) { el.textContent = ''; return; }
  const md = art.mode === 'markdown';
  el.innerHTML = `当前文章 <span class="mode-chip ${md ? 'md' : 'rt'}">${md ? 'Markdown' : '富文本'}</span>，发布时按平台模式自动转换（Markdown ⇄ 富文本），不会乱发。`;
}
$('#pubArticle').addEventListener('change', renderPubAccounts);
function renderPublish() { renderPubArticleSelect(); renderPubAccounts(); renderTasks(); }
$('#btnPublish').onclick = async () => {
  const articleId = $('#pubArticle').value;
  const accountIds = $$('#pubAccounts input:checked').map(i => i.value);
  if (!articleId) return toast('请先写一篇文章');
  if (!accountIds.length) return toast('至少勾选一个账号');
  const scheduledAt = $('#pubSchedule').value || null;
  await api('/api/tasks', { method: 'POST', body: JSON.stringify({ articleId, accountIds, scheduledAt }) });
  $('#pubSchedule').value = '';
  toast(scheduledAt ? '已加入定时队列' : '开始分发，浏览器会逐个打开平台编辑页');
  renderTasks(); startTaskPoll();
};
async function renderTasks() {
  const tasks = await api('/api/tasks');
  tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!tasks.length) { $('#taskList').innerHTML = '<div class="empty">还没有任务<br>选好文章和账号后点「开始分发」</div>'; return; }
  $('#taskList').innerHTML = tasks.slice(0, 20).map(t => {
    const art = (S.articles.find(a => a.id === t.articleId) || {}).title || '?';
    const st = { done: ['ok', '完成'], partial: ['manual', '部分完成'], failed: ['err', '失败'], running: ['warn', '进行中'], scheduled: ['gray', '定时中'], pending: ['gray', '排队中'] }[t.status] || ['gray', t.status];
    const chips = (t.accountIds || []).map(id => {
      const r = (t.results || {})[id];
      const a = S.accounts.find(x => x.id === id);
      const cls = !r ? 'res-pend' : r.status === 'ok' ? 'res-ok' : r.status === 'manual' ? 'res-manual' : 'res-fail';
      const txt = !r ? '待发' : (r.status === 'ok' ? '已发' : r.status === 'manual' ? '待手动' : r.status === 'skipped' ? '不支持' : '失败');
      return `<span class="res-chip ${cls}" title="${esc(r ? r.message : '')}">${platName(a && a.platformId)}:${esc(a ? a.name : id)} ${txt}</span>`;
    }).join('');
    return `<div class="task">
      <div class="head"><strong>${esc(art)}</strong><span class="pill ${st[0]}">${st[1]}</span>
      <span class="muted">${t.scheduledAt ? '定时 ' + fmtTime(t.scheduledAt) : fmtTime(t.createdAt)}</span>
      <span class="task-ops"><button class="btn small" data-retry="${t.id}">重试</button><button class="btn small danger" data-deltask="${t.id}">删除</button></span></div>
      <div class="results">${chips}</div></div>`;
  }).join('');
  $$('#taskList [data-retry]').forEach(b => b.onclick = async () => {
    await api('/api/tasks/' + b.dataset.retry + '/retry', { method: 'POST' });
    toast('已重新加入队列'); renderTasks(); startTaskPoll();
  });
  $$('#taskList [data-deltask]').forEach(b => b.onclick = async () => {
    await api('/api/tasks/' + b.dataset.deltask, { method: 'DELETE' });
    renderTasks(); toast('已删除任务记录');
  });
}
function startTaskPoll() {
  if (S.taskTimer) return;
  S.taskTimer = setInterval(async () => {
    const tasks = await api('/api/tasks').catch(() => []);
    renderTasks();
    if (!tasks.some(t => t.status === 'running' || t.status === 'pending' || t.status === 'scheduled')) {
      clearInterval(S.taskTimer); S.taskTimer = null;
    }
  }, 4000);
}
$('#btnRefreshTasks').onclick = renderTasks;
$('#btnClearTasks').onclick = async () => {
  if (!confirm('清空所有历史任务记录？（正在运行的任务会保留）')) return;
  await api('/api/tasks', { method: 'DELETE' });
  toast('历史记录已清空'); renderTasks();
};

// ---------- 素材库 ----------
async function loadMaterials() {
  S.materials = await api('/api/materials');
  $('#materialGrid').innerHTML = S.materials.map(m => `
    <div class="mat">
      <img src="${m.url}" alt="${esc(m.name)}" loading="lazy">
      <div class="mbar"><span class="muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70px">${esc(m.name)}</span>
        <span><button class="btn small" data-copy="${m.url}">复制链接</button>
        <button class="btn small danger" data-mdel="${m.id}">删</button></span></div>
    </div>`).join('') || '<div class="empty">素材库是空的<br>把图片拖到上方区域即可上传</div>';
  $$('#materialGrid [data-copy]').forEach(b => b.onclick = () => { navigator.clipboard.writeText((API || location.origin) + b.dataset.copy); toast('链接已复制'); });
  $$('#materialGrid [data-mdel]').forEach(b => b.onclick = async () => {
    await api('/api/materials/' + b.dataset.mdel, { method: 'DELETE' });
    loadMaterials();
  });
  renderCoverSelect();
}
function uploadFiles(files) {
  const imgs = [...files].filter(f => f.type.startsWith('image/'));
  if (!imgs.length) return toast('只支持图片');
  imgs.forEach(f => {
    const rd = new FileReader();
    rd.onload = async () => {
      await api('/api/materials', { method: 'POST', body: JSON.stringify({ name: f.name, base64: rd.result }) });
      loadMaterials(); toast('已上传 ' + f.name);
    };
    rd.readAsDataURL(f);
  });
}
$('#dropZone').onclick = () => $('#fileInput').click();
$('#fileInput').onchange = e => uploadFiles(e.target.files);
$('#dropZone').ondragover = e => e.preventDefault();
$('#dropZone').ondrop = e => { e.preventDefault(); uploadFiles(e.dataTransfer.files); };

// ---------- 违禁词 ----------
$('#btnLoadArticle').onclick = () => {
  if (!S.current) return toast('先在「文章」页选一篇');
  $('#sensText').value = $('#artTitle').value + '\n\n' + $('#artContent').innerText;
};
async function scanSensitive() {
  const text = $('#sensText').value;
  if (!text.trim()) return toast('请输入要检测的内容');
  const { hits } = await api('/api/sensitive/scan', { method: 'POST', body: JSON.stringify({ title: '', content: text }) });
  $('#sensResult').innerHTML = hits.length
    ? '<div class="form-row"><label>命中</label><div>' + hits.map(h => `<span class="pill err">「${esc(h.word)}」×${h.count}</span>`).join(' ') + '</div></div>'
      + '<div class="note">共 ' + hits.length + ' 类命中词。发布前请改写或删除这些表述。</div>'
    : '<div class="form-row"><label>结果</label><span class="pill ok">未命中任何已知违禁词</span></div>';
}
$('#btnScan').onclick = scanSensitive;

// ---------- 日志 ----------
async function loadLogs() {
  const logs = await api('/api/logs').catch(() => []);
  logs.reverse();
  $('#logList').innerHTML = logs.map(l =>
    `<div class="l"><span class="log-time">${fmtTime(l.ts)}</span><span class="log-level log-${l.level}">[${l.level}]</span> ${esc(l.msg)}</div>`
  ).join('') || '<div class="empty">暂无日志</div>';
}
$('#btnRefreshLogs').onclick = loadLogs;
$('#btnClearLogs').onclick = async () => {
  if (!confirm('清空全部运行日志？')) return;
  await api('/api/logs', { method: 'DELETE' });
  loadLogs(); toast('日志已清空');
};

// ---------- 平台数据 ----------
const METRIC_LABELS = { fans: '粉丝', read: '阅读/播放', like: '点赞', comment: '评论', share: '分享' };
const METRIC_COLORS = { fans: '#4f46e5', read: '#059669', like: '#ea7c0c', comment: '#e11d63', share: '#2563eb' };

async function loadStats() {
  S.stats = await api('/api/stats').catch(() => []);
  renderStats();
}
function latestStatsPerAccount() {
  const map = new Map();
  for (const s of S.stats) {
    const cur = map.get(s.accountId);
    if (!cur || cur.ts < s.ts) map.set(s.accountId, s);
  }
  return map;
}
function renderStats() {
  const latest = latestStatsPerAccount();
  const withStats = S.accounts.filter(a => latest.has(a.id));
  $('#statsCards').innerHTML = withStats.length ? withStats.map(a => {
    const s = latest.get(a.id);
    const pills = Object.keys(METRIC_LABELS).filter(k => s.metrics && s.metrics[k] != null)
      .map(k => `<span class="stat-pill" style="--c:${METRIC_COLORS[k]}">${METRIC_LABELS[k]} ${fmtNum(s.metrics[k])}</span>`).join('');
    return `<div class="stat-card">
      <div class="row1">${platAvatar(a.platformId)}<div style="flex:1;min-width:0"><div class="name">${esc(a.name)}</div><div class="muted">${platName(a.platformId)} · ${fmtTime(s.ts)}</div></div></div>
      <div class="stat-pills">${pills || '<span class="muted">无可识别指标</span>'}</div></div>`;
  }).join('') : '<div class="empty">还没有数据<br>点上方「采集选中账号 / 采集全部已登录」</div>';
  const sel = $('#statsAccount');
  const prev = sel.value;
  sel.innerHTML = S.accounts.map(a => `<option value="${a.id}">${esc(a.name)} · ${platName(a.platformId)}${latest.has(a.id) ? '' : '（无数据）'}</option>`).join('');
  sel.value = prev && S.accounts.some(a => a.id === prev) ? prev : (withStats[0] ? withStats[0].id : (S.accounts[0] ? S.accounts[0].id : ''));
  drawStatsChart(sel.value);
}
function fmtNum(n) {
  if (n == null) return '-';
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return String(n);
}
function drawStatsChart(accountId) {
  const canvas = $('#statsChart'); if (!canvas) return;
  const snaps = S.stats.filter(s => s.accountId === accountId).sort((a, b) => a.ts - b.ts).slice(-12);
  const acc = S.accounts.find(a => a.id === accountId);
  $('#statsTrendTitle').textContent = acc ? `${platName(acc.platformId)} · ${acc.name}（最近 ${snaps.length} 次）` : '选择账号查看';
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 760, h = 220;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  if (!snaps.length) {
    g.fillStyle = getComputedStyle(document.body).color; g.globalAlpha = .5; g.font = '13px sans-serif';
    g.fillText('暂无数据，先采集一次', 20, 40); g.globalAlpha = 1;
    return;
  }
  const pad = { l: 48, r: 16, t: 22, b: 30 };
  const series = {};
  for (const k of Object.keys(METRIC_LABELS)) {
    const vals = snaps.map(s => (s.metrics && s.metrics[k] != null) ? s.metrics[k] : 0);
    if (vals.some(v => v > 0)) series[k] = vals;
  }
  const max = Math.max(1, ...Object.values(series).flat());
  g.strokeStyle = 'rgba(128,128,128,.25)'; g.lineWidth = 1; g.fillStyle = 'rgba(128,128,128,.9)'; g.font = '11px sans-serif';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h - pad.t - pad.b) * i / 4;
    g.beginPath(); g.moveTo(pad.l, y); g.lineTo(w - pad.r, y); g.stroke();
    g.fillText(fmtNum(Math.round(max * (1 - i / 4))), 4, y + 4);
  }
  const n = snaps.length;
  for (const [k, vals] of Object.entries(series)) {
    g.strokeStyle = METRIC_COLORS[k]; g.lineWidth = 2.2; g.beginPath();
    vals.forEach((v, i) => {
      const x = pad.l + (w - pad.l - pad.r) * (n <= 1 ? 0 : i / (n - 1));
      const y = pad.t + (h - pad.t - pad.b) * (1 - v / max);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.stroke();
  }
  let lx = pad.l;
  for (const [k] of Object.entries(series)) {
    g.fillStyle = METRIC_COLORS[k]; g.fillRect(lx, 6, 10, 3);
    g.fillStyle = getComputedStyle(document.body).color; g.font = '11px sans-serif';
    g.fillText(METRIC_LABELS[k], lx + 14, 11);
    lx += 14 + g.measureText(METRIC_LABELS[k]).width + 16;
  }
  g.fillStyle = 'rgba(128,128,128,.9)';
  g.fillText(fmtTime(snaps[0].ts), pad.l, h - 8);
  g.fillText(fmtTime(snaps[n - 1].ts), w - pad.r - 56, h - 8);
}
async function collectOne(accountId) {
  const r = await api('/api/stats/collect', { method: 'POST', body: JSON.stringify({ accountId }) });
  toast(r.logged ? `${r.platformName} 数据采集完成` : `${r.platformName} 未登录，请先登录`);
  await loadStats();
  return r;
}
$('#statsAccount').addEventListener('change', e => drawStatsChart(e.target.value));
$('#btnCollectOne').onclick = async () => {
  const id = $('#statsAccount').value;
  if (!id) return toast('先添加账号');
  toast('正在打开平台后台采集，请稍候…');
  try { await collectOne(id); } catch (e) { toast('采集失败: ' + e.message); }
};
$('#btnCollectAll').onclick = async () => {
  const list = S.accounts.filter(a => a.status === 'loggedIn');
  if (!list.length) return toast('没有已登录账号');
  toast(`开始采集 ${list.length} 个账号，全程约 ${list.length * 20} 秒`);
  for (const a of list) {
    try { await collectOne(a.id); } catch (e) { toast(`${a.name} 采集失败: ${e.message}`); }
  }
  toast('全部采集完成');
};

// ---------- 启动 ----------
// 右上角状态条：点击设置电脑端地址（手机版遥控）；桌面端同源不用填
$('#btnSideToggle').onclick = () => document.querySelector('aside').classList.toggle('open');
$('#nav').addEventListener('click', () => document.querySelector('aside').classList.remove('open'));
$('#serverState').addEventListener('click', () => {
  $('#connHost').value = API.replace(/^https?:\/\//, '');
  $('#connModal').style.display = 'flex';
});
$('#btnConnCancel').onclick = () => { $('#connModal').style.display = 'none'; };
$('#btnConnSave').onclick = () => {
  let v = $('#connHost').value.trim();
  if (v && !/^https?:\/\//.test(v)) v = 'http://' + v;
  v = v.replace(/\/+$/, '');
  try { v ? localStorage.setItem('ff_host', v) : localStorage.removeItem('ff_host'); } catch { /* */ }
  location.reload();
};

(async () => {
  try {
    S.platforms = await api('/api/platforms');
    $('#newAccPlatform').innerHTML = [
      ['cn-article', '国内 · 图文'], ['cn-video', '国内 · 视频'],
      ['global-article', '海外 · 图文'], ['global-video', '海外 · 视频']
    ].map(([key, label]) => {
      const items = S.platforms.filter(p => `${p.region || 'cn'}-${p.mode === 'video' ? 'video' : 'article'}` === key);
      if (!items.length) return '';
      return `<optgroup label="${label}">` + items.map(p => `<option value="${p.id}">${p.name}${p.experimental ? '（实验）' : ''}</option>`).join('') + '</optgroup>';
    }).join('');
    await Promise.all([loadArticles(), loadAccounts(), loadMaterials()]);
    if (API) $('#serverState').textContent = '已连接 ' + API.replace(/^https?:\/\//, '');
    toast('自由发已就绪：先添加账号并登录，再写文章一键分发');
  } catch (e) {
    $('#serverState').textContent = '服务连接失败'; $('#serverState').className = 'pill err';
    toast('启动失败: ' + e.message + (API ? '，请检查电脑端是否已启动' : ''));
  }
})();
