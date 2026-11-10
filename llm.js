'use strict';
// 「我的大模型」：导入自己的大语言模型（OpenAI 兼容接口 / 本地服务），配合本地素材生成文章。
// 所有配置只存在本机 data/llm.json；API Key 不明文回传给前端。
const fs = require('fs');
const path = require('path');
const { load, save, uid, filesDir } = require('./store');

// ---------- 主流厂商预设：前端选厂商即自动填好端点和常用模型 ----------
// 全部走 OpenAI 兼容接口（/chat/completions、/models），Key 只存本机
const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', tag: '官方', endpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini', 'gpt-3.5-turbo'],
    keyHint: 'sk-...（platform.openai.com 申请）',
    note: '官方接口，需要海外网络环境' },
  { id: 'deepseek', name: 'DeepSeek 深度求索', tag: '国内可直连', endpoint: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyHint: 'sk-...（platform.deepseek.com 申请）',
    note: '国内直连，性价比高；deepseek-reasoner 会输出思考过程，写正文建议用 deepseek-chat' },
  { id: 'qwen', name: '通义千问', tag: '阿里云', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long', 'qwen-max-latest'],
    keyHint: 'sk-...（百炼控制台申请）',
    note: '阿里云百炼，兼容模式端点；长文可选 qwen-long（1000 万 token 上下文）' },
  { id: 'glm', name: '智谱 GLM', tag: 'BigModel', endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    models: ['glm-4-plus', 'glm-4-air', 'glm-4-flashx', 'glm-4-flash', 'glm-4-long'],
    keyHint: 'xxx.yyy（bigmodel.cn 控制台）',
    note: '智谱开放平台；glm-4-flash 免费额度较大，glm-4-long 适合长文' },
  { id: 'moonshot', name: 'Kimi (Moonshot)', tag: '月之暗面', endpoint: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-latest'],
    keyHint: 'sk-...（platform.moonshot.cn）',
    note: '长上下文选 moonshot-v1-128k' },
  { id: 'doubao', name: '豆包', tag: '字节火山', endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: '',
    models: [],
    keyHint: '火山引擎 ARK API Key',
    note: '接入点（endpoint）ID 即模型名，需在火山方舟控制台创建接入点后，把接入点 ID 填到「模型名」，或点「拉取列表」读取已部署接入点' },
  { id: 'gemini', name: 'Google Gemini', tag: 'OpenAI 兼容', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
    keyHint: 'AIza...（Google AI Studio）',
    note: '走 Google 提供的 OpenAI 兼容端点，国内需代理' },
  { id: 'ollama', name: 'Ollama 本地', tag: '免密', endpoint: 'http://127.0.0.1:11434/v1',
    defaultModel: 'qwen2.5:7b',
    models: ['qwen2.5:7b', 'llama3.2:3b', 'gemma2:9b', 'deepseek-r1:8b'],
    keyHint: '本地服务不需要 Key',
    note: '先装 Ollama 并 ollama pull 模型；本机服务免密直连' },
  { id: 'siliconflow', name: '硅基流动', tag: '国内可直连', endpoint: 'https://api.siliconflow.cn/v1',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    models: ['Qwen/Qwen2.5-7B-Instruct', 'Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1'],
    keyHint: 'sk-...（cloud.siliconflow.cn）',
    note: '聚合托管了主流开源模型，部分模型有免费额度' }
];
function getProviders() { return PROVIDERS.map(p => ({ ...p })); }

const MAT_DIR = filesDir('llm_materials'); // 本地素材目录：只有用户主动选择的文件才会进来
const TXT_EXT = ['.txt', '.md', '.markdown', '.json', '.csv', '.text', '.log', '.html', '.htm'];

function cfg() { return load('llm.json', { models: [], materials: [] }); }
function saveCfg(c) { save('llm.json', c); }

// 给前端展示的模型配置：Key 打码，另给 hasKey 标记
function modelForClient(m) {
  const { apiKey, ...rest } = m;
  return { ...rest, hasKey: !!apiKey, maskedKey: maskKey(apiKey) };
}

// 前端展示时打码：sk-abc***wxyz
function maskKey(key) {
  const k = String(key || '');
  if (!k) return '';
  if (k.length <= 8) return '***';
  return k.slice(0, 4) + '***' + k.slice(-4);
}

// 连通性测试：发一个极小的对话请求，确认地址和 Key 可用
async function testModel(entry) {
  const started = Date.now();
  const base = String(entry.endpoint || '').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) return { ok: false, error: '服务地址必须以 http(s):// 开头' };
  const headers = { 'Content-Type': 'application/json' };
  if (entry.apiKey) headers['Authorization'] = 'Bearer ' + entry.apiKey;
  try {
    const r = await fetch(base + '/chat/completions', {
      method: 'POST', headers,
      body: JSON.stringify({
        model: entry.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: '回复「ok」两个字符' }],
        max_tokens: 8, temperature: 0
      })
    });
    const latencyMs = Date.now() - started;
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return { ok: false, latencyMs, error: `HTTP ${r.status} ${t.slice(0, 140)}` };
    }
    const j = await r.json().catch(() => null);
    const reply = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return { ok: true, latencyMs, reply: String(reply || '').slice(0, 60) };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - started, error: e.message };
  }
}

// 拉取服务端可用的模型列表（OpenAI 兼容 /v1/models）
async function listModels(entry) {
  const base = String(entry.endpoint || '').replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  if (!/^https?:\/\//.test(base)) return { ok: false, error: '服务地址必须以 http(s):// 开头' };
  const headers = {};
  if (entry.apiKey) headers['Authorization'] = 'Bearer ' + entry.apiKey;
  try {
    const r = await fetch(base + '/models', { headers });
    if (!r.ok) return { ok: false, error: 'HTTP ' + r.status };
    const j = await r.json().catch(() => null);
    const ids = (j && j.data || []).map(m => m.id).filter(Boolean);
    if (!ids.length) return { ok: false, error: '返回里没有 model 列表（可能是非 OpenAI 兼容接口）' };
    return { ok: true, models: ids.slice(0, 200) };
  } catch (e) { return { ok: false, error: e.message }; }
}

// 导入本地素材：只接受文本类文件，大小受限，内容落盘到 data/llm_materials/
function addMaterial(name, text) {
  const ext = path.extname(name || '').toLowerCase();
  if (!TXT_EXT.includes(ext)) return { error: `不支持的文件类型 ${ext || '（无后缀）'}，支持：${TXT_EXT.join(' ')}` };
  const t = String(text || '');
  if (!t.trim()) return { error: '文件内容为空' };
  if (t.length > 2 * 1024 * 1024) return { error: '文件过大（超过 2MB），请只放必要的文本' };
  const c = cfg();
  const m = { id: uid('mat'), name: path.basename(name), file: uid('f') + ext, size: t.length, at: Date.now(), status: '已读取' };
  fs.writeFileSync(path.join(MAT_DIR, m.file), t, 'utf8');
  c.materials.unshift(m);
  saveCfg(c);
  return { ok: true, material: m };
}
function removeMaterial(id) {
  const c = cfg();
  const m = c.materials.find(x => x.id === id);
  if (m) { try { fs.rmSync(path.join(MAT_DIR, m.file), { force: true }); } catch { /* */ } }
  c.materials = c.materials.filter(x => x.id !== id);
  saveCfg(c);
}

// 读取素材全文（仅本地读取，可撤销：删掉素材即不再参与生成）
function readMaterial(id) {
  const c = cfg();
  const m = c.materials.find(x => x.id === id);
  if (!m) return null;
  try {
    return { ...m, text: fs.readFileSync(path.join(MAT_DIR, m.file), 'utf8') };
  } catch (e) { return { ...m, text: '', error: e.message }; }
}

// 生成文章：把选中素材作为上下文，要求模型输出「标题 + HTML 正文」
async function generate(modelId, prompt, materialIds) {
  const c = cfg();
  const entry = c.models.find(m => m.id === modelId);
  if (!entry) throw new Error('模型配置不存在');
  if (!entry.enabled) throw new Error('该模型已停用，请先启用');
  const ctxParts = [];
  for (const id of (materialIds || [])) {
    const m = readMaterial(id);
    if (m && m.text) ctxParts.push(`【素材：${m.name}】\n${m.text.slice(0, 8000)}`);
    else if (m) ctxParts.push(`【素材：${m.name}（读取失败：${m.error || '内容为空'}）】`);
  }
  const sys = entry.systemPrompt && entry.systemPrompt.trim()
    ? entry.systemPrompt.trim()
    : '你是自媒体写作助手。根据主题和素材产出一篇适合多平台分发的图文文章。'
    + '第一行输出标题（不超过 30 字，不要写「标题：」这类前缀），空一行后输出正文。'
    + '正文用 HTML：段落用 <p>，小标题用 <h3>，重要的词用 <strong>，列表用 <ul><li>。不要输出代码块标记。';
  const user = (ctxParts.length ? '参考素材：\n' + ctxParts.join('\n\n') + '\n\n' : '')
    + '写作主题/要求：' + String(prompt || '');
  const base = String(entry.endpoint || '').replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (entry.apiKey) headers['Authorization'] = 'Bearer ' + entry.apiKey;
  const r = await fetch(base + '/chat/completions', {
    method: 'POST', headers,
    body: JSON.stringify({
      model: entry.model || 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      temperature: typeof entry.temperature === 'number' ? entry.temperature : 0.7,
      max_tokens: entry.maxTokens > 0 ? entry.maxTokens : 3000
    })
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
 throw new Error(`模型请求失败 HTTP ${r.status}：${t.slice(0, 150)}`);
  }
  const j = await r.json().catch(() => null);
  const content = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '';
  // 部分模型会用 ```html 包裹正文；裸 markdown 也要转成可读 HTML
  let body = String(content || '').trim();
  body = body.replace(/^```(?:html|HTML)?\s*\r?\n/, '').replace(/\r?\n```\s*$/, '');
  let lines = body.split(/\r?\n/).filter(l => l.trim());
  let title = (lines[0] || '').replace(/^#+\s*/, '').replace(/^《|》$/, '').slice(0, 60);
  if (!/^<\w+/.test(lines[0] || '')) {
    // 第一行不是 HTML 标签 = 纯标题行，正文去掉标题后转段落
    const rest = lines.slice(1).join('\n').trim() || body;
    body = /^<\w+/.test(rest) ? rest : mdToHtml(rest);
  } else {
    title = '';
    body = mdToHtml(body);
  }
  if (!title) title = 'AI 生成文章';
  return { title, content: body, model: entry.model || entry.name };
}

// 极简 Markdown → HTML，避免把模型返回的普通文本当 JavaScript 源码展示
function mdToHtml(md) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return String(md).split(/\r?\n{2,}/).map(block => {
    const t = block.trim();
    if (!t) return '';
    if (/^<(h[1-6]|p|ul|ol|li|blockquote|pre|img|table|strong|em)\b/i.test(t)) return t;
    if (/^(#{1,6})\s/.test(t)) { const lv = t.match(/^#+/)[0].length; return `<h${Math.min(lv, 3)}>${esc(t.replace(/^#+\s*/, ''))}</h${Math.min(lv, 3)}>`; }
    if (/^\s*[-*]\s/m.test(t)) return '<ul>' + t.split(/\r?\n/).map(l => l.replace(/^\s*[-*]\s*/, '').replace(/^(\d+)\.\s*/, '')).map(l => `<li>${esc(l)}</li>`).join('') + '</ul>';
    if (/^\s*\d+\.\s/m.test(t)) return '<ol>' + t.split(/\r?\n/).map(l => `<li>${esc(l.replace(/^\s*\d+\.\s*/, ''))}</li>`).join('') + '</ol>';
    return '<p>' + esc(t).replace(/\r?\n/g, '<br>') + '</p>';
  }).filter(Boolean).join('\n');
}

module.exports = {
  cfg, saveCfg, maskKey, testModel, listModels, getProviders, modelForClient,
  addMaterial, removeMaterial, readMaterial, generate, TXT_EXT
};
