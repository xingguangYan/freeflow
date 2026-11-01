'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
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

const S = { platforms: [], accounts: [], articles: [], materials: [], current: null, loginPoll: new Map(), taskTimer: null };

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
  if (!S.articles.length) {
    $('#articleList').innerHTML = '<div class="empty">还没有文章<br>点右上「+ 新建」开始第一篇</div>';
    return;
  }
  $('#articleList').innerHTML = S.articles.map(a => `
    <li data-id="${a.id}" class="${S.current && S.current.id === a.id ? 'active' : ''}">
      <span class="t">${esc(a.title)}</span>
      <span class="meta">${fmtTime(a.updatedAt || a.createdAt)}${a.cover ? ' · 有封面' : ''}</span>
    </li>`).join('');
  $$('#articleList li[data-id]').forEach(li => li.onclick = () => selectArticle(li.dataset.id));
}
async function selectArticle(id) {
  await saveCurrent(false);
  S.current = S.articles.find(a => a.id === id);
  $('#editorTitle').textContent = S.current.title;
  $('#artTitle').value = S.current.title;
  $('#artContent').innerHTML = S.current.content || '';
  applyType(S.current.type || 'article');
  $('#artTags').value = S.current.tags || '';
  $('#videoStatus').textContent = S.current.videoFile || S.current.videoPath
    ? '已选视频：' + (S.current.videoName || S.current.videoFile || S.current.videoPath) : '';
  renderCoverSelect();
  renderArticleList();
}
function applyType(t) {
  $$('#view-articles input[name="artType"]').forEach(r => r.checked = (r.value === t));
  const video = t === 'video';
  $('#videoFields').style.display = video ? 'block' : 'none';
  $('#edToolbar').style.display = video ? 'none' : 'flex';
  $('#artContent').setAttribute('data-placeholder', video ? '写视频简介 / 文案…' : '写正文，也可以直接从 Word / 网页粘贴（保留格式）。');
  $('#btnScanArticle').style.display = video ? 'none' : '';
}
$$('#view-articles input[name="artType"]').forEach(r => r.addEventListener('change', () => applyType(r.value)));
function renderCoverSelect() {
  const sel = $('#artCover');
  sel.innerHTML = '<option value="">（不设置）</option>' + S.materials.map(m =>
    `<option value="${m.id}" ${S.current && S.current.cover === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  $('#coverThumb').innerHTML = S.current && S.current.cover ? `<img src="/materials/${S.current.cover}">` : '';
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
  const body = { id: S.current.id, type, title: $('#artTitle').value.trim() || '未命名', content: $('#artContent').innerHTML, cover: S.current.cover, tags: $('#artTags').value.trim(), videoFile: S.current.videoFile || null, videoPath: S.current.videoPath || null };
  const a = await api('/api/articles', { method: 'POST', body: JSON.stringify(body) });
  Object.assign(S.current, a);
  $('#editorTitle').textContent = a.title;
  const li = $$('#articleList li').find(x => x.dataset.id === a.id);
  if (li) { li.querySelector('.t').textContent = a.title; li.querySelector('.meta').textContent = fmtTime(a.updatedAt) + (a.cover ? ' · 有封面' : ''); }
  if (notify) toast('已保存');
}
$('#btnSaveArticle').onclick = () => saveCurrent(true);
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
  const list = S.materials.map((m, i) => `${i + 1}. ${m.name}`).join('\n');
  const n = window.prompt('选择要插入的图片（输入序号）：\n' + list);
  const i = parseInt(n, 10) - 1;
  if (isNaN(i) || !S.materials[i]) return;
  document.execCommand('insertImage', false, S.materials[i].url);
}

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
        <button class="btn small danger" data-del="${a.id}">删除</button>
      </div>
    </div>`;
  }).join('');
  $$('#accountGrid [data-login]').forEach(b => b.onclick = () => startLogin(b.dataset.login));
  $$('#accountGrid [data-done]').forEach(b => b.onclick = () => finishLogin(b.dataset.done));
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
$('#btnAddAccount').onclick = async () => {
  const platformId = $('#newAccPlatform').value;
  const name = $('#newAccName').value.trim() || undefined;
  await api('/api/accounts', { method: 'POST', body: JSON.stringify({ platformId, name }) });
  $('#newAccName').value = '';
  toast('已添加，点「登录」去扫码'); loadAccounts();
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
  const html = S.platforms.map(p => {
    if (p.mode && p.mode !== 'both' && p.mode !== need) return '';
    const accs = S.accounts.filter(a => a.platformId === p.id);
    if (!accs.length) return '';
    return `<div class="pub-group">${p.name}${p.experimental ? '（实验性）' : ''} · ${need === 'video' ? '视频' : '图文'}</div>` + accs.map(a => `
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
      <span class="muted">${t.scheduledAt ? '定时 ' + fmtTime(t.scheduledAt) : fmtTime(t.createdAt)}</span></div>
      <div class="results">${chips}</div></div>`;
  }).join('');
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
  $$('#materialGrid [data-copy]').forEach(b => b.onclick = () => { navigator.clipboard.writeText(location.origin + b.dataset.copy); toast('链接已复制'); });
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

// ---------- 启动 ----------
(async () => {
  try {
    S.platforms = await api('/api/platforms');
    $('#newAccPlatform').innerHTML = S.platforms.map(p => `<option value="${p.id}">${p.name}${p.experimental ? '（实验）' : ''}</option>`).join('');
    await Promise.all([loadArticles(), loadAccounts(), loadMaterials()]);
    toast('自由发已就绪：先添加账号并登录，再写文章一键分发');
  } catch (e) {
    $('#serverState').textContent = '服务连接失败'; $('#serverState').className = 'pill err';
    toast('启动失败: ' + e.message);
  }
})();
