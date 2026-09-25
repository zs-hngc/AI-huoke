/* ============================================================
   AI超级员工 - 后端服务 (零依赖 Node.js)
   功能: 静态托管前端 + /api/ai/generate 统一AI接口(直连DeepSeek) + 本地JSON持久化
   运行: node server.js   (默认端口 3000, 可用 PORT 环境变量覆盖)
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

// ---------- SQLite 数据层 (零依赖, 使用 Node.js 内置 node:sqlite) ----------
const db = require('./db.js');

// ---------- 读取 .env ----------
function loadEnv() {
  const env = {};
  try {
    const raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    raw.split('\n').forEach(line => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch (e) { /* 无 .env 也可运行, 用默认值 */ }
  return env;
}
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');
function ensureDataDir() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
function readSettingsFile() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); }
  catch (e) { return {}; }
}
function writeSettingsFile(data) {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
}
// 判断 settings.json 里的值是否可用: 空值 / 纯问号 / 含替换字符(U+FFFD) 视为无效
// 无效值不参与覆盖, 避免坏配置把 .env 里的真实配置"锁死"
function isUsableSettingValue(v) {
  if (v == null) return false;
  const s = String(v).trim();
  if (!s) return false;
  if (s.includes('\uFFFD')) return false;      // UTF-8 替换字符 = 编码损坏
  if (/^[?\s]+$/.test(s)) return false;        // 中文被终端编码替换成问号
  return true;
}
// 合并配置: .env 打底, settings.json 中"可用"的值覆盖
function mergeSettings() {
  const env = loadEnv();
  const file = readSettingsFile() || {};
  const merged = Object.assign({}, env);
  Object.keys(file).forEach(k => { if (isUsableSettingValue(file[k])) merged[k] = file[k]; });
  return merged;
}
const ENV = mergeSettings();
let DEEPSEEK_API_KEY = ENV.DEEPSEEK_API_KEY || '';
let DEEPSEEK_BASE_URL = ENV.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
let DEEPSEEK_MODEL = ENV.DEEPSEEK_MODEL || 'deepseek-chat';
let PRODUCT = {
  name: ENV.PRODUCT_NAME || '示例产品',
  desc: ENV.PRODUCT_DESC || '一款用于演示拓客工具的产品',
  target: ENV.TARGET_CUSTOMER || '有相关需求的企业与个人用户',
  advantages: ENV.PRODUCT_ADVANTAGES || '高效便捷、成本低'
};
const AMAP_KEY = ENV.AMAP_KEY || '';

const PORT = process.env.PORT || 3000;
// 数据持久化已迁移到 SQLite (db.js), 以下函数请使用 db.xxx
// 旧函数对照表:
//   readStore/saveStore/pushStore → db.getAIHistory()/db.pushAIHistory()
//   readCustomers/saveCustomers   → db.listCustomers()/db.createCustomer()/db.updateCustomer() 等
//   readTemplates/saveTemplates   → db.listTemplates()/db.createTemplate() 等
//   normalizeCustomer/genCustId/custKey → db.normalizeCustomer()/db.genCustId()/db.custKey()

function applyRuntimeSettings(next) {
  const cfg = Object.assign({}, ENV, next || {});
  if (cfg.DEEPSEEK_API_KEY) DEEPSEEK_API_KEY = String(cfg.DEEPSEEK_API_KEY);
  else DEEPSEEK_API_KEY = '';
  if (cfg.DEEPSEEK_BASE_URL) DEEPSEEK_BASE_URL = String(cfg.DEEPSEEK_BASE_URL);
  else DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
  if (cfg.DEEPSEEK_MODEL) DEEPSEEK_MODEL = String(cfg.DEEPSEEK_MODEL);
  else DEEPSEEK_MODEL = 'deepseek-chat';
  PRODUCT = {
    name: cfg.PRODUCT_NAME || '示例产品',
    desc: cfg.PRODUCT_DESC || '一款用于演示拓客工具的产品',
    target: cfg.TARGET_CUSTOMER || '有相关需求的企业与个人用户',
    advantages: cfg.PRODUCT_ADVANTAGES || '高效便捷、成本低'
  };
}

// 重新从 .env + settings.json 载入配置 (保存配置后调用, 避免 ENV 被历史值污染)
function reloadSettings() {
  const merged = mergeSettings();
  Object.keys(ENV).forEach(k => { delete ENV[k]; });
  Object.assign(ENV, merged);
  applyRuntimeSettings(merged);
  return merged;
}

// 配置来源标记: 便于排查"到底哪一份配置生效"
function settingsSource() {
  const file = readSettingsFile() || {};
  const pick = (key) => isUsableSettingValue(file[key]) ? 'settings.json' : '.env';
  return {
    deepseekApiKey: pick('DEEPSEEK_API_KEY'),
    deepseekBaseUrl: pick('DEEPSEEK_BASE_URL'),
    productName: pick('PRODUCT_NAME')
  };
}

// 明显的占位/测试密钥, 一律拒绝写入, 防止把 .env 里的真实密钥覆盖成测试值
const PLACEHOLDER_KEY_RE = /^(sk-)?(test|demo|xxx+|changeme|placeholder|abc123|123456+|your[-_]?key\d*)$/i;

// 保存前的输入校验, 返回空字符串表示通过, 否则返回错误说明
function validateSettingsInput(body) {
  const key = String(body.deepseekApiKey || '').trim();
  if (key) {
    if (PLACEHOLDER_KEY_RE.test(key)) {
      return 'DeepSeek API Key 看起来是占位/测试值（' + key + '），已拒绝保存，避免覆盖 .env 中的真实密钥';
    }
    if (key.length < 8) {
      return 'DeepSeek API Key 过短（' + key.length + ' 字符），请确认填写的是完整密钥';
    }
  }
  const textFields = {
    productName: '产品名称',
    productDesc: '产品描述',
    targetCustomer: '目标客户',
    productAdvantages: '产品优势'
  };
  for (const field of Object.keys(textFields)) {
    const raw = String(body[field] == null ? '' : body[field]);
    if (raw.includes('\uFFFD')) {
      return textFields[field] + ' 含编码损坏字符（U+FFFD），已拒绝保存：请改用浏览器「设置」页保存，不要用 GBK 终端直接调接口';
    }
    if (raw.trim() && /^[?\s]+$/.test(raw)) {
      return textFields[field] + ' 内容全是问号（中文被终端编码破坏），已拒绝保存：请改用浏览器「设置」页保存';
    }
  }
  return '';
}

function buildSettingsSnapshot() {
  return {
    deepseekApiKey: DEEPSEEK_API_KEY ? DEEPSEEK_API_KEY.slice(0, 6) + '********' : '',
    deepseekApiKeyFull: DEEPSEEK_API_KEY,
    deepseekBaseUrl: DEEPSEEK_BASE_URL,
    deepseekModel: DEEPSEEK_MODEL,
    productName: PRODUCT.name,
    productDesc: PRODUCT.desc,
    targetCustomer: PRODUCT.target,
    productAdvantages: PRODUCT.advantages,
    amapKey: AMAP_KEY ? AMAP_KEY.slice(0, 4) + '********' : ''
  };
}

function backupRuntimeData() {
  ensureDataDir();
  const stamp = new Date().toISOString().replace(/[\:\.]/g, '-');
  const outDir = path.join(DATA_DIR, 'backups', stamp);
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(DATA_DIR).filter(f => f !== 'backups');
  files.forEach(file => {
    const src = path.join(DATA_DIR, file);
    const dest = path.join(outDir, file);
    if (fs.statSync(src).isFile()) fs.copyFileSync(src, dest);
  });
  return { backupDir: outDir, files: files.length };
}

// ---------- DeepSeek 调用 ----------
async function callDeepSeek(systemPrompt, userPrompt, opts = {}) {
  if (!DEEPSEEK_API_KEY) throw new Error('未配置 DEEPSEEK_API_KEY，请在 .env 中填写');
  const body = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: opts.temperature != null ? opts.temperature : 0.8,
    max_tokens: opts.max_tokens || 1500
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(DEEPSEEK_BASE_URL.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error('DeepSeek 接口返回 ' + res.status + ': ' + txt.slice(0, 300));
    }
    const json = await res.json();
    return json.choices && json.choices[0] ? json.choices[0].message.content : '';
  } finally {
    clearTimeout(timer);
  }
}

// 从模型返回文本中容错提取 JSON 数组（兼容 ```json 代码块 / 多余说明文字）
function extractJsonArray(text) {
  if (!text) return [];
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { const j = JSON.parse(t); return Array.isArray(j) ? j : (j && Array.isArray(j.leads) ? j.leads : []); } catch (e) { /* 继续尝试 */ }
  const arr = t.match(/\[[\s\S]*\]/);
  if (arr) { try { const j = JSON.parse(arr[0]); return Array.isArray(j) ? j : []; } catch (e) { /* 继续 */ } }
  const obj = t.match(/\{[\s\S]*\}/);
  if (obj) { try { const j = JSON.parse(obj[0]); return Array.isArray(j) ? j : [j]; } catch (e) { /* 继续 */ } }
  return [];
}

// 提取单个 JSON 对象（用于 AI 分类等返回对象的场景；不影响上面的数组解析）
function extractJsonObject(text) {
  if (!text) return null;
  let t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { const j = JSON.parse(t); if (j && typeof j === 'object' && !Array.isArray(j)) return j; } catch (e) {}
  const obj = t.match(/\{[\s\S]*\}/);
  if (obj) { try { const j = JSON.parse(obj[0]); if (j && typeof j === 'object') return j; } catch (e) {} }
  return null;
}

// ---------- 高德地图 Web 服务 (地图获客) ----------
async function callAmap(params) {
  if (!AMAP_KEY) throw new Error('未配置 AMAP_KEY，请在 .env 中填写高德 Web 服务 Key');
  const u = new URL('https://restapi.amap.com/v3/place/text');
  u.searchParams.set('key', AMAP_KEY);
  u.searchParams.set('extensions', 'all');
  Object.keys(params).forEach(k => {
    if (params[k] != null && params[k] !== '') u.searchParams.set(k, String(params[k]));
  });
  const res = await fetch(u.toString());
  const json = await res.json();
  if (json.status !== '1') throw new Error('高德地图返回错误: ' + (json.info || '未知错误'));
  const pois = (json.pois || []).map(p => {
    const loc = (p.location || '').split(',');
    const rating = (p.biz_ext && p.biz_ext.rating) || '';
    return {
      id: p.id || '',
      name: p.name || '',
      address: p.address || '',
      tel: p.tel || '',
      type: (p.type || '').split(';')[0],
      location: p.location || '',
      lng: parseFloat(loc[0]) || 0,
      lat: parseFloat(loc[1]) || 0,
      rating: rating,
      business: p.business_area || '',
      city: p.cityname || '',
      district: p.adname || ''
    };
  });
  return { pois, total: parseInt(json.count || '0', 10), page: params.page || 1 };
}

// 行政区划查询（省/市/区县级联 + 边界多边形）
async function callAmapDistrict(keywords, subdistrict, extensions) {
  if (!AMAP_KEY) throw new Error('未配置 AMAP_KEY，请在 .env 中填写高德 Web 服务 Key');
  const u = new URL('https://restapi.amap.com/v3/config/district');
  u.searchParams.set('key', AMAP_KEY);
  u.searchParams.set('keywords', keywords || '100000');
  u.searchParams.set('subdistrict', subdistrict || '1');
  u.searchParams.set('extensions', extensions || 'base');
  const res = await fetch(u.toString());
  const json = await res.json();
  if (json.status !== '1') throw new Error('高德区划返回错误: ' + (json.info || '未知错误'));
  const root = json.districts && json.districts[0];
  if (!root) throw new Error('未找到对应行政区划');
  const children = (root.districts || []).map(d => ({
    name: d.name,
    adcode: d.adcode,
    level: d.level,
    center: d.center || '',
    polyline: d.polyline || ''
  }));
  return { name: root.name, adcode: root.adcode, level: root.level, center: root.center || '', polyline: root.polyline || '', children };
}

// ---------- 各类 Prompt ----------
const PROMPTS = {
  keyword: (p) => ({
    system: '你是一名SEO与公域获客关键词拓展专家。根据用户给出的产品基础关键词，生成用于在抖音/小红书/快手等平台做搜索截流与内容布局的关键词。请覆盖：同义词、口语化表达、长尾词、疑问词、场景词、地域词。只返回一个JSON数组（字符串数组，20-30个词，不要序号、不要解释）。',
    user: `产品: ${p.product || PRODUCT.name}\n基础关键词: ${p.keyword}\n目标平台: ${p.platform || '全平台'}\n请直接返回JSON数组。`
  }),
  legal: (p) => ({
    system: '你是一名资深中国企业法务顾问，熟悉《民法典》《劳动合同法》《公司法》《消费者权益保护法》《网络安全法》等。针对用户的法律问题，给出结构化、专业、可落地的意见。格式：\n一、法律依据\n二、关键风险点（用⚠️标注）\n三、建议措施（用✅标注）\n四、相关法条参考\n语言专业但不晦涩，使用中文。结尾加一句：⚖️ 以上内容由AI生成，仅供参考，具体法律问题请咨询执业律师。',
    user: `请就以下法律问题提供专业意见：\n${p.question}`
  }),
  script: (p) => ({
    system: '你是企业/电商客服话术专家。根据用户给出的分类与场景，生成5条可直接复制使用的客服话术。返回JSON数组，每个元素形如 {"title":"话术标题","content":"话术正文"}。话术要专业、亲切、可落地，能化解客户疑虑并引导转化。只返回JSON数组。',
    user: `产品: ${p.product || PRODUCT.name}\n话术分类: ${p.category || '常见问题'}\n场景描述: ${p.scene || '客户常规咨询'}\n请返回JSON数组。`
  }),
  zhinao: (p) => {
    const map = {
      content: '企业内容营销专家，擅长撰写营销文案、公众号文章、产品描述、小红书笔记。',
      design: '企业品牌与设计创意顾问，擅长海报创意、文案配图思路、视觉风格建议。',
      analysis: '企业数据分析师，擅长从销售/获客/转化角度做数据解读与洞察建议。',
      report: '企业管理顾问，擅长撰写规范的日报/周报/月报与项目进度汇报。',
      team: '团队管理专家，擅长任务分配、绩效看板、协作流程设计。'
    };
    return {
      system: `你是${map[p.type] || '企业智能助手'}。请基于用户给出的主题与产品信息，生成结构清晰、专业、可直接使用的中文内容（使用Markdown格式，含标题、分点、加粗）。`,
      user: `产品/业务背景: ${p.product || PRODUCT.name}（${PRODUCT.desc}）\n创作主题/要求: ${p.topic}\n请生成内容。`
    };
  },
  chuangzuo: (p) => {
    const map = {
      '短视频脚本': '短视频分镜脚本编剧，输出带画面/台词/时长标注的分镜脚本。',
      '朋友圈文案': '朋友圈种草文案写手，输出有温度、能引发互动的文案。',
      '数字人口播': '口播文案写手，输出适合数字人朗读的口播稿（口语化、节奏感强）。',
      '带货文案': '电商带货文案专家，输出强转化、突出卖点与紧迫感的文案。',
      '小红书笔记': '小红书爆款笔记写手，输出标题+正文+话题标签。',
      '爆款标题': '爆款标题党专家，输出10个吸睛标题。'
    };
    return {
      system: `你是${map[p.type] || 'AI内容创作专家'}。请根据主题生成3条不同角度的成品，返回JSON数组，每个元素 {"title":"标题","content":"正文"}。内容要贴合产品、有网感、可直接使用。只返回JSON数组。`,
      user: `产品: ${p.product || PRODUCT.name}（${PRODUCT.desc}）\n创作类型: ${p.type}\n主题/素材: ${p.subject}\n风格/语气: ${p.tone || '自然亲切'}\n请返回JSON数组。`
    };
  }
};

// ---------- 结果解析辅助 ----------
function parseJsonArray(text) {
  try { const v = JSON.parse(text); if (Array.isArray(v)) return v; } catch (e) {}
  const m = text.match(/\[[\s\S]*\]/);
  if (m) { try { const v = JSON.parse(m[0]); if (Array.isArray(v)) return v; } catch (e) {} }
  return null;
}
function asStringArray(v) {
  if (Array.isArray(v)) return v.map(x => typeof x === 'string' ? x : (x && x.content) || (x && x.title) || String(x)).filter(Boolean);
  if (typeof v === 'string') return v.split(/\n+/).map(s => s.replace(/^[\-\*\d\.\、\.\s]+/, '').trim()).filter(Boolean);
  return [];
}
function asScriptArray(v) {
  let arr = v;
  if (!Array.isArray(v)) { const p = parseJsonArray(typeof v === 'string' ? v : JSON.stringify(v)); arr = p || []; }
  return arr.map(x => {
    if (typeof x === 'string') return { title: '', content: x };
    return { title: x.title || '', content: x.content || x.text || '' };
  }).filter(x => x.content);
}

// ---------- 路由处理 ----------
async function handleGenerate(payload) {
  const cat = payload.category;
  if (!cat || !PROMPTS[cat]) return { error: '未知的生成类别: ' + cat };
  const { system, user } = PROMPTS[cat](payload);
  const raw = await callDeepSeek(system, user, { temperature: 0.85, max_tokens: 1800 });

  if (cat === 'keyword') {
    const arr = asStringArray(parseJsonArray(raw) || raw);
    db.pushAIHistory('keyword', { keyword: payload.keyword, platform: payload.platform, count: arr.length, results: arr.slice(0, 30), time: Date.now() });
    return { keywords: arr.slice(0, 30) };
  }
  if (cat === 'legal') {
    db.pushAIHistory('legal', { question: payload.question, answer: raw, time: Date.now() });
    return { answer: raw };
  }
  if (cat === 'script') {
    const arr = asScriptArray(raw);
    db.pushAIHistory('script', { category: payload.category, count: arr.length, results: arr, time: Date.now() });
    return { scripts: arr };
  }
  if (cat === 'zhinao') {
    db.pushAIHistory('zhinao', { type: payload.type, topic: payload.topic, content: raw, time: Date.now() });
    return { content: raw };
  }
  if (cat === 'chuangzuo') {
    const arr = asScriptArray(raw);
    db.pushAIHistory('chuangzuo', { type: payload.type, subject: payload.subject, results: arr, time: Date.now() });
    return { scripts: arr };
  }
  return { error: '未处理的类别' };
}

// ---------- HTTP 服务 ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function sendJSON(res, status, obj, extraHeaders = {}) {
  const buf = Buffer.from(JSON.stringify(obj));
  const headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  }, extraHeaders);
  res.writeHead(status, headers);
  res.end(buf);
}

const AUTH_SESSIONS = new Map();
// 密码哈希/校验统一由数据层负责（sha256 + 前缀，兼容历史明文并自动升级）
function hashPassword(password) {
  return db.hashPassword(password);
}
function parseCookies(cookieHeader = '') {
  const cookies = {};
  String(cookieHeader).split(';').forEach(part => {
    const [key, ...rest] = part.split('=');
    if (!key) return;
    cookies[key.trim()] = decodeURIComponent(rest.join('=').trim());
  });
  return cookies;
}
function createSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  AUTH_SESSIONS.set(token, { user: { id: user.id, username: user.username, role: user.role, displayName: user.displayName || user.username }, expiresAt: Date.now() + 86400000 });
  return token;
}
function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.session;
  if (!token) return null;
  const row = AUTH_SESSIONS.get(token);
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    AUTH_SESSIONS.delete(token);
    return null;
  }
  return row.user;
}
function requireAuth(req, res, adminOnly = false) {
  const user = getSessionUser(req);
  if (!user) return { ok: false, status: 401, error: '未登录或登录已过期' };
  if (adminOnly && user.role !== 'admin') return { ok: false, status: 403, error: '需要管理员权限' };
  return { ok: true, user };
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { throw new Error('请求体不是合法JSON'); }
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('请求体过大')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ============================================================
// AI销冠（智能服务）数据层
// ============================================================
const XIAOGUAN_FILE = path.join(DATA_DIR, 'xiaoguan.json');
const XG_DATE = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
function genXgId(prefix) { return (prefix || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function defaultXiaoguan() {
  return {
    accounts: [
      { id: 'a1', name: '销售-A-主账号', platform: '微信', status: 'online', todayAdd: 245, todayChat: 1200, todayMoments: 560 },
      { id: 'a2', name: '销售-B-备用账号', platform: '微信', status: 'online', todayAdd: 189, todayChat: 890, todayMoments: 420 },
      { id: 'a3', name: '企业微信-官方号', platform: '企微', status: 'online', todayAdd: 567, todayChat: 2100, todayMoments: 890 },
      { id: 'a4', name: '销售-C-新账号', platform: '微信', status: 'offline', todayAdd: 0, todayChat: 0, todayMoments: 0 }
    ],
    autoAdd: { config: { source: '群聊成员', dailyLimit: 50, interval: 30, verifyMsg: '您好，看到您对XX感兴趣，想加您交个朋友~', afterMsg: '感谢通过~有任何问题随时找我😊', runAccount: '全部账号' }, status: 'stopped', startedAt: 0, addedToday: 0, target: 0 },
    moments: { config: { like: true, comment: true, style: '温馨赞美', dailyLimit: 100 }, status: 'stopped', interactedToday: 0 },
    massSend: { templates: [{ id: 'm1', title: '新品推荐', content: '{姓名}您好！根据您的喜好，我们最近上了{推荐产品}，觉得您可能会喜欢~' }], history: [] },
    chat: { persona: '热情销售型', scene: '新好友破冰', conversations: [] },
    stats: { date: XG_DATE(), newFriends: 1847, activeTouch: 12456, momentsInteractions: 8923, groupMessages: 3421 }
  };
}
function ensureXiaoguan() {
  ensureDataDir();
  if (!fs.existsSync(XIAOGUAN_FILE)) fs.writeFileSync(XIAOGUAN_FILE, JSON.stringify(defaultXiaoguan(), null, 2));
}
function readXiaoguan() {
  ensureXiaoguan();
  try { const d = JSON.parse(fs.readFileSync(XIAOGUAN_FILE, 'utf8')); if (!d.stats) d.stats = defaultXiaoguan().stats; return d; }
  catch (e) { return defaultXiaoguan(); }
}
function saveXiaoguan(d) { ensureXiaoguan(); fs.writeFileSync(XIAOGUAN_FILE, JSON.stringify(d, null, 2)); }

// 变量替换：千人千面群发模板 {姓名}{标签}{上次购买}{推荐产品}
function renderMassTemplate(tpl, vars) {
  return String(tpl || '')
    .replace(/\{姓名\}/g, vars.name || '朋友')
    .replace(/\{标签\}/g, (vars.tags && vars.tags.length) ? vars.tags.join('、') : 'VIP')
    .replace(/\{上次购买\}/g, vars.lastBuy || '暂无记录')
    .replace(/\{推荐产品\}/g, vars.product || (PRODUCT.name || '我们的产品'));
}

// ============================================================
// AI客服 数据层
// ============================================================
const KEFU_FILE = path.join(DATA_DIR, 'kefu.json');
const KF_DATE = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
function genKfId(prefix) { return (prefix || 'kf') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

const _KF_SURNAMES = ['李','王','张','赵','陈','刘','周','吴','郑','孙','杨','黄','朱','林','何','郭','马','罗','梁','宋'];
const _KF_NAMES = ['女士','先生','总','经理','小姐','老师'];
const _KF_TOPICS = ['订单咨询 #DK' + KF_DATE().replace(/-/g,''), '退款申请', '产品功能问询', '企业版报价', '物流查询', '账户问题', '发票开具', '技术支持', '合作洽谈', '售后维修', '价格优惠', '配送时效'];
const _kfRand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function defaultKefuConversations() {
  return [
    { id: genKfId('c'), name: '李女士', avatar: '李', platform: 'wechat', source: '微信客服', topic: '订单咨询 #' + KF_DATE().replace(/-/g,''), status: 'chatting', tags: ['VIP','老客户'], unread: 0,
      messages: [
        { id: genKfId('m'), role: 'customer', text: '您好，我想查一下我的订单状态，订单号是 DK20240715001', time: '14:22' },
        { id: genKfId('m'), role: 'agent', text: '您好李女士！稍等帮您查询一下 📋', time: '14:22' },
        { id: genKfId('m'), role: 'agent', text: '查询到了您的订单信息：\n📦 订单号：DK20240715001\n📦 商品：AI超级员工年度会员\n📦 状态：已发货\n🚚 物流：顺丰速运 SF1234567890\n📍 当前位置：已到达【北京市分拨中心】', time: '14:23', ai: true },
        { id: genKfId('m'), role: 'customer', text: '大概什么时候能送到呀？', time: '14:24' },
        { id: genKfId('m'), role: 'agent', text: '根据物流信息显示，预计明天下午就能送达啦！届时快递员会提前电话联系您 ☎️\n还有什么其他需要帮助的吗？', time: '14:24', ai: true },
      ],
      stats: { sessionCount: 3, firstContact: '2024-06-15' } },
    { id: genKfId('c'), name: '王先生', avatar: '王', platform: 'wechat', source: '微信客服', topic: '退款申请', status: 'pending', tags: [], unread: 2,
      messages: [{ id: genKfId('m'), role: 'customer', text: '我买的东西不想要了，想申请退款', time: '14:30' }],
      stats: { sessionCount: 1, firstContact: KF_DATE() } },
    { id: genKfId('c'), name: '张小姐', avatar: '张', platform: 'qywx', source: '企业微信', topic: '产品功能问询', status: 'chatting', tags: ['高意向'], unread: 0,
      messages: [
        { id: genKfId('m'), role: 'customer', text: '你们这个AI拓客系统支持哪些平台？', time: '13:50' },
        { id: genKfId('m'), role: 'agent', text: '您好！我们的AI拓客系统目前支持抖音、小红书、微信、企业微信等多个主流平台的获客与运营能力，具体包括：\n1. 公域地图获客\n2. 私信线索解析\n3. AI智能回复\n4. 朋友圈运营\n5. 千人千面群发\n\n请问您主要关注哪个场景呢？我可以详细介绍~', time: '13:51', ai: true },
      ],
      stats: { sessionCount: 2, firstContact: '2024-07-10' } },
    { id: genKfId('c'), name: '赵总', avatar: '赵', platform: 'douyin', source: '抖音客服', topic: '企业版报价', status: 'pending', tags: ['企业客户'], unread: 1,
      messages: [{ id: genKfId('m'), role: 'customer', text: '我们是公司使用，大概50个账号，怎么收费？', time: '11:20' }],
      stats: { sessionCount: 5, firstContact: '2024-05-20' } },
    { id: genKfId('c'), name: '陈女士', avatar: '陈', platform: 'wechat', source: '微信客服', topic: '物流查询', status: 'ended', tags: [], unread: 0,
      messages: [
        { id: genKfId('m'), role: 'customer', text: '我的货到哪了？', time: '昨天 16:00' },
        { id: genKfId('m'), role: 'agent', text: '您好，请提供一下订单号，我帮您查一下~', time: '昨天 16:01', ai: true },
        { id: genKfId('m'), role: 'customer', text: 'DK20240710088', time: '昨天 16:02' },
        { id: genKfId('m'), role: 'agent', text: '查到了，您的订单已签收，感谢您的耐心等待！如有问题随时联系我们~', time: '昨天 16:03', ai: true },
      ],
      stats: { sessionCount: 2, firstContact: '2024-07-08' } },
    { id: genKfId('c'), name: '刘先生', avatar: '刘', platform: 'qywx', source: '企业微信', topic: '账户问题', status: 'chatting', tags: ['新客户'], unread: 0,
      messages: [{ id: genKfId('m'), role: 'customer', text: '登录不上去了，提示密码错误', time: '15:10' }],
      stats: { sessionCount: 1, firstContact: KF_DATE() } },
    { id: genKfId('c'), name: '周女士', avatar: '周', platform: 'wechat', source: '微信客服', topic: '发票开具', status: 'chatting', tags: ['老客户'], unread: 0,
      messages: [
        { id: genKfId('m'), role: 'customer', text: '需要开一张发票，怎么操作？', time: '14:00' },
        { id: genKfId('m'), role: 'agent', text: '好的，开票信息麻烦发给我：公司名称、税号、地址电话、开户行及账号。收到后我会尽快为您安排~', time: '14:01', ai: true },
      ],
      stats: { sessionCount: 8, firstContact: '2024-03-01' } },
    { id: genKfId('c'), name: '吴先生', avatar: '吴', platform: 'douyin', source: '抖音客服', topic: '技术支持', status: 'pending', tags: [], unread: 3,
      messages: [{ id: genKfId('m'), role: 'customer', text: 'AI生成一直转圈，用不了', time: '12:30' }],
      stats: { sessionCount: 1, firstContact: KF_DATE() } },
    { id: genKfId('c'), name: '郑小姐', avatar: '郑', platform: 'wechat', source: '微信客服', topic: '合作洽谈', status: 'chatting', tags: ['代理商'], unread: 0,
      messages: [{ id: genKfId('m'), role: 'customer', text: '我们想做区域代理，有什么政策？', time: '10:00' }],
      stats: { sessionCount: 3, firstContact: '2024-06-01' } },
  ];
}

function defaultKefu() {
  return {
    conversations: defaultKefuConversations(),
    activeConversationId: defaultKefuConversations()[0]?.id || '',
    scripts: {
      '常见问题': ['如何查看订单？','如何申请退款？','配送范围有哪些？','支付方式说明','如何修改收货地址？'],
      '产品介绍': ['产品功能概览','版本对比','定价方案','适用场景','客户案例'],
      '售后政策': ['退换货规则','质保期限说明','维修流程','投诉渠道','补偿标准'],
      '促销活动': ['当前优惠活动','优惠券使用规则','满减活动','会员特权','推荐返利']
    },
    stats: {
      date: KF_DATE(),
      totalReceived: 186,
      avgResponseSec: 15,
      resolveRate: 94.2,
      satisfaction: 4.8,
      todayReplied: 42
    }
  };
}
function ensureKefu() {
  ensureDataDir();
  if (!fs.existsSync(KEFU_FILE)) fs.writeFileSync(KEFU_FILE, JSON.stringify(defaultKefu(), null, 2));
}
function readKefu() {
  ensureKefu();
  try { return JSON.parse(fs.readFileSync(KEFU_FILE, 'utf8')); }
  catch (e) { return defaultKefu(); }
}
function saveKefu(d) { ensureKefu(); fs.writeFileSync(KEFU_FILE, JSON.stringify(d, null, 2)); }

// 获取格式化时间 HH:mm
function kfNowTime() { const d = new Date(); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }

// ============================================================
// AI人事（智能招聘）数据层
// ============================================================
const RENSHI_FILE = path.join(DATA_DIR, 'renshi.json');
const _RS_SURNAMES = ['李','王','张','刘','陈','杨','黄','赵','周','吴','徐','孙','马','朱','胡','林','郭','何','高','罗'];
const _RS_GIVEN = ['伟','强','敏','静','丽','magic','军','洋','勇','艳','杰','娟','涛','明','超','秀英','霞','平','刚','桂英','建华','俊杰','雪','鹏','浩'];
function _rsName() {
  const g = _RS_GIVEN[_kfRand(0, _RS_GIVEN.length - 1)].replace('magic','浩然');
  return _RS_SURNAMES[_kfRand(0, _RS_SURNAMES.length - 1)] + g;
}
function _rsDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  const p = x => String(x).padStart(2, '0');
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

function defaultRenshiPositions() {
  return [
    { id: 'p1', name: '销售经理', dept: '销售部', jd: '3年以上B端销售经验，有客户资源者优先，负责大客户开发与团队管理。', salary: '15-25K' },
    { id: 'p2', name: 'Java开发工程师', dept: '技术部', jd: '熟悉Spring Cloud微服务，3年以上后端经验，有高并发系统经验优先。', salary: '20-35K' },
    { id: 'p3', name: 'UI设计师', dept: '产品部', jd: '精通Figma/Sketch，有B端SaaS产品设计经验，作品集优秀。', salary: '12-20K' },
    { id: 'p4', name: '产品经理', dept: '产品部', jd: '负责AI拓客产品规划与迭代，3年以上SaaS产品经验。', salary: '20-35K' },
    { id: 'p5', name: '运营专员', dept: '市场部', jd: '负责用户增长与内容运营，熟悉短视频/私域运营。', salary: '8-15K' }
  ];
}

function defaultRenshiResumes() {
  const P = defaultRenshiPositions();
  const rows = [
    { pos: 0, degree: '本科', school: '某211大学 市场营销', exp: '5年', salary: '18-25K', last: 1, status: '待处理', highlight: '带过10人销售团队，年度业绩超额30%' },
    { pos: 1, degree: '硕士', school: '某985大学 计算机', exp: '6年', salary: '30-40K', last: 0, status: '待处理', highlight: '主导过千万级DAU系统架构' },
    { pos: 2, degree: '本科', school: '某美院 视觉传达', exp: '3年', salary: '13-18K', last: 2, status: '待处理', highlight: 'Dribbble作品获赞过万' },
    { pos: 3, degree: '本科', school: '某财经大学 信息管理', exp: '4年', salary: '22-30K', last: 1, status: '已打招呼', highlight: '0-1搭建过SaaS产品线' },
    { pos: 4, degree: '大专', school: '某职院 电子商务', exp: '2年', salary: '8-12K', last: 3, status: '待处理', highlight: '单条短视频破500万播放' },
    { pos: 0, degree: '本科', school: '某综合大学 工商管理', exp: '3年', salary: '15-20K', last: 0, status: '面试中', highlight: '互联网行业大客户销售背景' },
    { pos: 1, degree: '本科', school: '某理工大学 软件工程', exp: '4年', salary: '25-32K', last: 1, status: '待处理', highlight: '熟悉Spring Cloud全家桶' },
    { pos: 3, degree: '硕士', school: '某名校 MBA', exp: '7年', salary: '30-45K', last: 5, status: '待处理', highlight: '带过完整产品团队' },
    { pos: 2, degree: '本科', school: '某传媒大学 数字媒体', exp: '2年', salary: '10-15K', last: 0, status: '待处理', highlight: '擅长B端后台与数据可视化' },
    { pos: 4, degree: '本科', school: '某师范大学 汉语言', exp: '3年', salary: '9-14K', last: 2, status: '已录用', highlight: '私域用户增长操盘手' },
    { pos: 1, degree: '大专', school: '某职院 计算机应用', exp: '5年', salary: '20-26K', last: 4, status: '待处理', highlight: '实战经验丰富但学历偏低' },
    { pos: 0, degree: '本科', school: '某商学院 国际贸易', exp: '1年', salary: '10-14K', last: 1, status: '待处理', highlight: '销售新人，学习能力强' }
  ];
  return rows.map(r => ({
    id: genKfId('r'),
    name: _rsName(),
    gender: Math.random() > 0.5 ? '男' : '女',
    age: _kfRand(24, 38),
    positionId: P[r.pos].id,
    position: P[r.pos].name,
    degree: r.degree,
    school: r.school,
    exp: r.exp,
    salary: r.salary,
    phone: '1' + _kfRand(3, 9) + String(_kfRand(0, 999999999)).padStart(9, '0'),
    lastActive: _rsDaysAgo(r.last),
    status: r.status,
    matchRate: null,      // 未AI筛选前为空
    aiScored: false,
    highlights: [],
    risks: [],
    summary: '',
    recommend: '',
    _seed: r.highlight,   // 供AI参考的原始亮点
    greeted: r.status === '已打招呼' || r.status === '面试中' || r.status === '已录用',
    messages: []
  }));
}

function defaultRenshi() {
  return {
    positions: defaultRenshiPositions(),
    resumes: defaultRenshiResumes(),
    config: {
      autoGreet: true,
      greetTemplate: '{姓名}您好！我们是{公司}，看了您的简历非常符合我们{职位}岗位的要求，方便详细聊聊吗？期待与您沟通~',
      autoAnswer: true,
      knowledge: ['公司介绍', '薪资福利', '工作地点', '晋升空间', '五险一金']
    },
    stats: { date: KF_DATE(), screenedToday: 0, greetedToday: 0 }
  };
}
function ensureRenshi() {
  ensureDataDir();
  if (!fs.existsSync(RENSHI_FILE)) fs.writeFileSync(RENSHI_FILE, JSON.stringify(defaultRenshi(), null, 2));
}
function readRenshi() {
  ensureRenshi();
  try { return JSON.parse(fs.readFileSync(RENSHI_FILE, 'utf8')); }
  catch (e) { return defaultRenshi(); }
}
function saveRenshi(d) { ensureRenshi(); fs.writeFileSync(RENSHI_FILE, JSON.stringify(d, null, 2)); }

function renshiStats(d) {
  const r = d.resumes;
  return {
    total: r.length,
    pending: r.filter(x => x.status === '待处理').length,
    greeted: r.filter(x => x.status === '已打招呼').length,
    interviewing: r.filter(x => x.status === '面试中').length,
    hired: r.filter(x => x.status === '已录用').length,
    rejected: r.filter(x => x.status === '不合适').length,
    scored: r.filter(x => x.aiScored).length,
    highMatch: r.filter(x => x.aiScored && x.matchRate >= 80).length,
    screenedToday: d.stats.screenedToday || 0,
    greetedToday: d.stats.greetedToday || 0
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  // API
  if (pathname.startsWith('/api/')) {
    const publicApi = ['/api/health', '/api/auth/login', '/api/auth/session', '/api/auth/logout'];
    if (!publicApi.includes(pathname)) {
      const auth = requireAuth(req, res);
      if (!auth.ok) return sendJSON(res, auth.status, { ok: false, error: auth.error });
    }

    if (pathname === '/api/health') {
      return sendJSON(res, 200, {
        ok: true,
        keyConfigured: !!DEEPSEEK_API_KEY,
        amapConfigured: !!AMAP_KEY,
        model: DEEPSEEK_MODEL,
        base: DEEPSEEK_BASE_URL,
        product: PRODUCT.name,
        time: Date.now()
      });
    }
    if (pathname === '/api/auth/session' && req.method === 'GET') {
      const user = getSessionUser(req);
      if (!user) return sendJSON(res, 401, { ok: false, error: '未登录' });
      return sendJSON(res, 200, { ok: true, user });
    }
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      try {
        const body = await readJson(req);
        const username = String(body.username || '').trim();
        const password = String(body.password || '').trim();
        const user = db.getUserByUsername(username);
        const passwordOk = !!user && db.verifyPassword(user.password, password);
        if (!user || !passwordOk) {
          return sendJSON(res, 401, { ok: false, error: '用户名或密码错误' });
        }
        // 兼容期兜底：历史明文密码在登录成功后立即升级为哈希存储
        try { db.upgradePasswordIfNeeded(user.id, password); } catch (e) { /* 升级失败不影响本次登录 */ }
        const token = createSession(user);
        const safeUser = { id: user.id, username: user.username, role: user.role, displayName: user.displayName || user.username };
        return sendJSON(res, 200, { ok: true, user: safeUser }, {
          'Set-Cookie': 'session=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400'
        });
      } catch (e) {
        return sendJSON(res, 500, { ok: false, error: e.message || '登录失败' });
      }
    }
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const cookies = parseCookies(req.headers.cookie || '');
      if (cookies.session) AUTH_SESSIONS.delete(cookies.session);
      return sendJSON(res, 200, { ok: true }, {
        'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
      });
    }
    if (pathname === '/api/auth/users' && req.method === 'GET') {
      const auth = requireAuth(req, res, true);
      if (!auth.ok) return sendJSON(res, auth.status, { ok: false, error: auth.error });
      return sendJSON(res, 200, { ok: true, users: db.listUsers() });
    }
    if (pathname === '/api/settings' && req.method === 'GET') {
      return sendJSON(res, 200, {
        ok: true,
        config: {
          deepseekApiKey: DEEPSEEK_API_KEY,
          deepseekBaseUrl: DEEPSEEK_BASE_URL,
          deepseekModel: DEEPSEEK_MODEL,
          productName: PRODUCT.name,
          productDesc: PRODUCT.desc,
          targetCustomer: PRODUCT.target,
          productAdvantages: PRODUCT.advantages,
          amapKey: AMAP_KEY,
          configSource: settingsSource(),
          dataStats: {
            customers: db.getCustomerStats().total || 0,
            templates: db.listTemplates().length,
            leadCount: db.listPlatformLeads().length,
            backups: fs.existsSync(path.join(DATA_DIR, 'backups')) ? fs.readdirSync(path.join(DATA_DIR, 'backups')).length : 0
          }
        }
      });
    }
    if (pathname === '/api/settings' && req.method === 'POST') {
      try {
        const body = await readJson(req);
        const inputError = validateSettingsInput(body);
        if (inputError) return sendJSON(res, 400, { ok: false, error: inputError });
        const next = {
          DEEPSEEK_API_KEY: String(body.deepseekApiKey || DEEPSEEK_API_KEY || ''),
          DEEPSEEK_BASE_URL: String(body.deepseekBaseUrl || DEEPSEEK_BASE_URL || 'https://api.deepseek.com'),
          DEEPSEEK_MODEL: String(body.deepseekModel || DEEPSEEK_MODEL || 'deepseek-chat'),
          PRODUCT_NAME: String(body.productName || PRODUCT.name || '示例产品'),
          PRODUCT_DESC: String(body.productDesc || PRODUCT.desc || '一款用于演示拓客工具的产品'),
          TARGET_CUSTOMER: String(body.targetCustomer || PRODUCT.target || '有相关需求的企业与个人用户'),
          PRODUCT_ADVANTAGES: String(body.productAdvantages || PRODUCT.advantages || '高效便捷、成本低')
        };
        writeSettingsFile(next);
        reloadSettings();
        return sendJSON(res, 200, { ok: true, config: buildSettingsSnapshot(), configSource: settingsSource() });
      } catch (e) {
        return sendJSON(res, 500, { error: e.message || '保存配置失败' });
      }
    }
    if (pathname === '/api/settings/test-connection' && req.method === 'POST') {
      try {
        const body = await readJson(req);
        const apiKey = String(body.deepseekApiKey || DEEPSEEK_API_KEY || '').trim();
        const apiBase = String(body.deepseekBaseUrl || DEEPSEEK_BASE_URL || 'https://api.deepseek.com').trim();
        const model = String(body.deepseekModel || DEEPSEEK_MODEL || 'deepseek-chat').trim();
        const testKey = apiKey || DEEPSEEK_API_KEY;
        if (!testKey) return sendJSON(res, 400, { ok: false, error: 'DeepSeek API Key 为空' });
        const url = (apiBase || 'https://api.deepseek.com').replace(/\/$/, '') + '/chat/completions';
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + testKey },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: '请回复“连接成功”' }], max_tokens: 20, temperature: 0 })
        });
        const text = await r.text();
        if (!r.ok) return sendJSON(res, 502, { ok: false, error: '连接失败: ' + text.slice(0, 300) });
        return sendJSON(res, 200, { ok: true, message: 'DeepSeek 连接成功' });
      } catch (e) {
        return sendJSON(res, 500, { error: e.message || '测试连接失败' });
      }
    }
    if (pathname === '/api/settings/backup' && req.method === 'POST') {
      try {
        const stat = backupRuntimeData();
        return sendJSON(res, 200, { ok: true, backup: stat });
      } catch (e) {
        return sendJSON(res, 500, { error: e.message || '备份失败' });
      }
    }
    if (pathname === '/api/settings/export' && req.method === 'POST') {
      try {
        const payload = {
          exportedAt: new Date().toISOString(),
          settings: buildSettingsSnapshot(),
          customers: db.listCustomers({ page: 1, pageSize: 99999 }).items,
          templates: db.listTemplates(),
          platformLeads: db.listPlatformLeads(),
          aiHistory: db.listAIHistory(99999)
        };
        const fileName = 'ai-tuoke-export-' + Date.now() + '.json';
        const exportDir = path.join(DATA_DIR, 'exports');
        fs.mkdirSync(exportDir, { recursive: true });
        const filePath = path.join(exportDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
        return sendJSON(res, 200, { ok: true, fileName, filePath });
      } catch (e) {
        return sendJSON(res, 500, { error: e.message || '导出失败' });
      }
    }
    if (pathname === '/api/settings/clear-cache' && req.method === 'POST') {
      try {
        const files = ['xiaoguan.json', 'kefu.json', 'renshi.json'];
        let cleared = 0;
        files.forEach(file => {
          const p = path.join(DATA_DIR, file);
          if (fs.existsSync(p)) { fs.unlinkSync(p); cleared++; }
        });
        return sendJSON(res, 200, { ok: true, cleared, message: '缓存已清理' });
      } catch (e) {
        return sendJSON(res, 500, { error: e.message || '清理失败' });
      }
    }
    if (pathname === '/api/settings/reset' && req.method === 'POST') {
      try {
        const body = await readJson(req);
        if (String(body.confirm || '').trim() !== 'RESET_ALL_DATA') {
          return sendJSON(res, 400, { ok: false, error: '确认口令不正确' });
        }
        const keepUsers = body.keepUsers !== false;   // 默认保留账号
        // 1) 先尝试把 WAL 落盘，让随后生成的备份文件自包含
        try { db.getDB().exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) { /* 有并发读时失败，忽略 */ }
        // 2) 备份必须在清空之前——原实现是清空后才备份，备份出来是空库
        const backup = backupRuntimeData();
        // 3) 事务内清空业务表；users / 配置 / 备份目录一律不动
        const result = db.resetAllData({ keepUsers });
        // 4) 清理演示模块的 JSON 数据与遗留迁移文件（绝不触碰 settings.json、*.bak、backups/、exports/）
        const removable = ['xiaoguan.json', 'kefu.json', 'renshi.json', 'customers.json'];
        const removedFiles = [];
        const failedFiles = [];
        removable.forEach(file => {
          const p = path.join(DATA_DIR, file);
          if (!fs.existsSync(p)) return;
          try { fs.unlinkSync(p); removedFiles.push(file); }
          catch (e) { failedFiles.push({ file, error: e.message }); }
        });
        return sendJSON(res, 200, {
          ok: true,
          backup,
          deleted: result.deleted,
          keepUsers: result.keepUsers,
          templatesReseeded: result.templatesReseeded,
          removedFiles,
          failedFiles,
          message: '业务数据已清空' + (result.keepUsers ? '（账号与配置保留）' : '') + '，备份已生成'
        });
      } catch (e) {
        return sendJSON(res, 500, { ok: false, error: e.message || '重置失败' });
      }
    }
    if (pathname === '/api/amap/poi' && req.method === 'GET') {
      try {
        const poi = await callAmap({
          keywords: url.searchParams.get('keyword') || '',
          city: url.searchParams.get('city') || '',
          citylimit: url.searchParams.get('citylimit') || 'true',
          page: url.searchParams.get('page') || '1',
          offset: url.searchParams.get('offset') || '25'
        });
        return sendJSON(res, 200, poi);
      } catch (e) {
        return sendJSON(res, 500, { error: e.message || '高德接口错误' });
      }
    }
    if (pathname === '/api/amap/district' && req.method === 'GET') {
      try {
        const data = await callAmapDistrict(
          url.searchParams.get('keywords') || '100000',
          url.searchParams.get('subdistrict') || '1',
          url.searchParams.get('extensions') || 'base'
        );
        return sendJSON(res, 200, { ok: true, ...data });
      } catch (e) {
        return sendJSON(res, 502, { ok: false, error: e.message || '高德区划接口错误' });
      }
    }
    if (pathname === '/api/ai/generate' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) { return sendJSON(res, 400, { error: '请求体不是合法JSON' }); }
        const result = await handleGenerate(payload);
        if (result.error) return sendJSON(res, 400, result);
        return sendJSON(res, 200, result);
      } catch (e) {
        return sendJSON(res, 500, { error: e.message || '服务器错误' });
      }
    }
    if (pathname === '/api/history' && req.method === 'GET') {
      const { summary, store } = db.getAIHistory();
      return sendJSON(res, 200, { summary, store });
    }

    // ================= 私信获客 API (合规: 人工粘贴 + AI解析/生成草稿, 不爬取不自动发送) =================
    if (pathname === '/api/sixin/parse' && req.method === 'POST') {
      try {
        const body = await readJson(req);
        const text = String(body.text || '').trim();
        const platform = String(body.platform || '抖音').trim();
        if (text.length < 4) return sendJSON(res, 400, { error: '请粘贴至少一段私信内容' });
        const system = '你是一个销售线索提取助手。用户会粘贴从社交平台（如抖音、小红书、微信）收到的私信对话或评论内容。请从中识别潜在客户，提取为结构化线索。每条线索包含字段：nickname(对方昵称/账号，未知留空字符串)、platform(来源平台名称)、intent(对方的需求或意向，用一句话概括)、region(地区，未知留空字符串)、contact(联系方式如微信号/电话，未知留空字符串)、tags(标签字符串数组，如["高意向","咨询价格"])、level(意向等级，取值：高/中/低)。只输出一个JSON数组，不要任何解释或 Markdown 代码块，格式：[{"nickname":"...","platform":"...","intent":"...","region":"...","contact":"...","tags":["..."],"level":"高"}]。若没有可识别的潜在客户，返回空数组 []。';
        const user = '平台：' + platform + '\n内容：\n' + text;
        const raw = await callDeepSeek(system, user, { temperature: 0.3, max_tokens: 2000 });
        const leads = extractJsonArray(raw);
        return sendJSON(res, 200, { ok: true, leads });
      } catch (e) {
        return sendJSON(res, 500, { error: e.message || '解析失败' });
      }
    }
    if (pathname === '/api/sixin/reply' && req.method === 'POST') {
      try {
        const body = await readJson(req);
        const context = String(body.context || '').trim();
        const tone = String(body.tone || '专业').trim();
        const requirement = String(body.requirement || '').trim();
        if (!context) return sendJSON(res, 400, { error: '缺少客户私信内容' });
        const system = '你是销售私信回复助手。根据用户提供的客户私信内容、期望语气和额外要求，生成可用于回复的预选话术草稿。请生成3条不同侧重点的回复（例如：一条专业正式、一条亲切自然、一条促单引导），但整体需贴合指定的语气。只输出一个JSON数组，每条是一个完整回复字符串，不要编号、不要解释、不要 Markdown 代码块，格式：["回复1","回复2","回复3"]。';
        const user = '客户私信内容：\n' + context + '\n\n期望语气：' + tone + '\n额外要求：' + (requirement || '无') + '\n\n请生成3条预选回复。';
        const raw = await callDeepSeek(system, user, { temperature: 0.8, max_tokens: 1200 });
        const replies = extractJsonArray(raw).map(r => String(r));
        return sendJSON(res, 200, { ok: true, replies });
      } catch (e) {
        return sendJSON(res, 500, { error: e.message || '生成失败' });
      }
    }

    // ================= 话术模板库 API (常用回复/话术模板, 一键插入) =================
    if (pathname === '/api/templates' && req.method === 'GET') {
      try { return sendJSON(res, 200, { ok: true, templates: db.listTemplates() }); }
      catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }
    if (pathname === '/api/templates' && req.method === 'POST') {
      try {
        const body = await readJson(req);
        const content = String(body.content || '').trim();
        if (!content) return sendJSON(res, 400, { error: '模板内容不能为空' });
        const t = db.createTemplate({ title: body.title, content, category: body.category });
        return sendJSON(res, 200, { ok: true, template: t });
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }
    if (pathname.startsWith('/api/templates/')) {
      const id = decodeURIComponent(pathname.slice('/api/templates/'.length));
      if (req.method === 'PUT') {
        try {
          const body = await readJson(req);
          const t = db.updateTemplate(id, body);
          if (!t) return sendJSON(res, 404, { error: '模板不存在' });
          return sendJSON(res, 200, { ok: true, template: t });
        } catch (e) { return sendJSON(res, 500, { error: e.message }); }
      }
      if (req.method === 'DELETE') {
        try {
          db.deleteTemplate(id);
          return sendJSON(res, 200, { ok: true });
        } catch (e) { return sendJSON(res, 500, { error: e.message }); }
      }
      return sendJSON(res, 405, { error: '方法不支持' });
    }

    // ================= 平台接入 API (合规: 仅官方开放平台 OAuth + Webhook, 不爬取不模拟点击) =================
    const PUBLIC_BASE = ENV.PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL || ('http://localhost:' + PORT);
    const PLC = (k) => ENV[k] || process.env[k] || '';
    const PLATFORM_CFG = {
      douyin: {
        key: 'douyin', name: '抖音',
        clientId: PLC('DOUYIN_CLIENT_ID'),
        clientSecret: PLC('DOUYIN_CLIENT_SECRET'),
        authorizeUrl: 'https://open.douyin.com/platform/oauth/connect/',
        tokenUrl: 'https://open.douyin.com/oauth/access_token/',
        scope: 'im.direct_message',
        note: '需认证企业号/小程序品牌号，并审批 im.direct_message 私信权限'
      },
      xiaohongshu: {
        key: 'xiaohongshu', name: '小红书',
        clientId: PLC('XHS_CLIENT_ID'),
        clientSecret: PLC('XHS_CLIENT_SECRET'),
        authorizeUrl: 'https://open.xiaohongshu.com/platform/oauth/authorize',
        tokenUrl: 'https://open.xiaohongshu.com/api/open/connect/token',
        scope: 'message.read,comment.read',
        note: '需企业号/专业号，并审批 message.read / comment.read 权限'
      }
    };
    // 平台令牌和线索已迁移到 SQLite
    const readPlatformTokens = db.getPlatformTokens;
    const savePlatformTokens = db.savePlatformTokens;
    const readPlatformLeads = db.listPlatformLeads;
    const savePlatformLeads = (a) => { /* 兼容: 批量保存线索 */ if (Array.isArray(a)) { a.forEach(l => db.updatePlatformLead(l.id, l)); } };
    function buildAuthUrl(platform) {
      const cfg = PLATFORM_CFG[platform]; if (!cfg) return '';
      const redirect = encodeURIComponent(PUBLIC_BASE + '/api/platform/callback/' + platform);
      if (platform === 'douyin') {
        return cfg.authorizeUrl + '?client_key=' + cfg.clientId + '&response_type=code&scope=' + encodeURIComponent(cfg.scope) + '&redirect_uri=' + redirect + '&state=dt';
      }
      return cfg.authorizeUrl + '?client_id=' + cfg.clientId + '&response_type=code&scope=' + encodeURIComponent(cfg.scope) + '&redirect_uri=' + redirect + '&state=xhs';
    }
    async function classifyIntent(text, platformName) {
      const system = '你是销售意向分级助手。根据用户从' + (platformName || '平台') + '收到的私信或评论内容，判断购买/留资意向强度并提取标签。只输出一个JSON对象：{\"level\":\"高|中|低\",\"reason\":\"一句话理由\",\"tags\":[\"标签1\"]}。不要解释或代码块。明确问价/怎么买/留联系方式/要到店=高；有兴趣未明确=中；闲聊吐槽无信号=低。';
      try {
        const raw = await callDeepSeek(system, '内容：' + text, { temperature: 0.2, max_tokens: 400 });
        const obj = extractJsonObject(raw) || {};
        return { level: ['高','中','低'].includes(obj.level) ? obj.level : '中', reason: String(obj.reason || ''), tags: Array.isArray(obj.tags) ? obj.tags.map(String) : [] };
      } catch (e) { return { level: '中', reason: 'AI分级暂不可用', tags: [] }; }
    }
    async function ingestPlatformMessage(platform, msg) {
      const cfg = PLATFORM_CFG[platform]; if (!cfg) throw new Error('未知平台');
      const content = String(msg.content || '').trim();
      if (!content) throw new Error('消息内容为空');
      const cls = await classifyIntent(content, cfg.name);
      const lead = {
        id: 'pl_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
        platform: cfg.key, platformName: cfg.name,
        fromUser: String(msg.fromUser || msg.nickname || '未知用户'),
        sourceType: String(msg.sourceType || '私信'),
        content, contact: String(msg.contact || ''),
        level: cls.level, reason: cls.reason, tags: cls.tags,
        status: '待筛选', createdAt: Date.now(), added: false
      };
      db.addPlatformLead(lead);
      return lead;
    }

    // 配置状态（不暴露 secret）
    if (pathname === '/api/platform/config' && req.method === 'GET') {
      const tokens = readPlatformTokens();
      const platforms = Object.values(PLATFORM_CFG).map(c => ({
        key: c.key, name: c.name, note: c.note, scope: c.scope,
        configured: !!(c.clientId && c.clientSecret),
        clientIdSet: !!c.clientId,
        clientSecretSet: !!c.clientSecret,
        // 脱敏展示，仅用于确认「填进去的是不是这个 ID」，不暴露完整值
        clientIdMasked: c.clientId ? (c.clientId.length > 8 ? c.clientId.slice(0, 4) + '****' + c.clientId.slice(-4) : '****') : '',
        connected: !!(tokens[c.key] && tokens[c.key].accessToken)
      }));
      return sendJSON(res, 200, { ok: true, publicBase: PUBLIC_BASE, needPublicHttps: PUBLIC_BASE.indexOf('localhost') >= 0, platforms });
    }
    // 获取授权 URL
    const am = pathname.match(/^\/api\/platform\/auth-url\/([a-z]+)$/);
    if (am && req.method === 'GET') {
      const cfg = PLATFORM_CFG[am[1]];
      if (!cfg) return sendJSON(res, 404, { error: '未知平台' });
      const idKey = cfg.key === 'douyin' ? 'DOUYIN_CLIENT_ID' : 'XHS_CLIENT_ID';
      const secKey = cfg.key === 'douyin' ? 'DOUYIN_CLIENT_SECRET' : 'XHS_CLIENT_SECRET';
      if (!cfg.clientId) return sendJSON(res, 400, { error: '未配置「' + cfg.name + '」的 AppID（Client Key），请在 .env 填入 ' + idKey });
      if (!cfg.clientSecret) return sendJSON(res, 400, { error: '「' + cfg.name + '」的 AppSecret 未配置，请在 .env 填入 ' + secKey + ' 后重启服务' });
      return sendJSON(res, 200, { ok: true, url: buildAuthUrl(am[1]) });
    }
    // OAuth 回调（浏览器跳转，平台把 code 推回来；本地 localhost 无法被公网回调，仅部署公网后生效）
    const pm = pathname.match(/^\/api\/platform\/callback\/([a-z]+)$/);
    if (pm && req.method === 'GET') {
      const platform = pm[1]; const cfg = PLATFORM_CFG[platform];
      if (!cfg) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('未知平台'); }
      const code = url.searchParams.get('code');
      if (!code) { res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('缺少授权 code'); }
      try {
        const postBody = platform === 'douyin'
          ? { client_key: cfg.clientId, client_secret: cfg.clientSecret, code, grant_type: 'authorization_code' }
          : { client_id: cfg.clientId, client_secret: cfg.clientSecret, code, grant_type: 'authorization_code', redirect_uri: PUBLIC_BASE + '/api/platform/callback/' + platform };
        const r = await fetch(cfg.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(postBody) });
        const j = await r.json();
        const accessToken = j.access_token || (j.data && j.data.access_token);
        if (!accessToken) {
          res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end('<h3>授权失败</h3><pre>' + JSON.stringify(j) + '</pre><script>setTimeout(()=>window.close(),3000)</script>');
        }
        const tokens = readPlatformTokens();
        tokens[platform] = { accessToken, refreshToken: j.refresh_token || (j.data && j.data.refresh_token) || '', expiresIn: j.expires_in || (j.data && j.data.expires_in) || 0, connectedAt: Date.now() };
        savePlatformTokens(tokens);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<h3>✅ ' + cfg.name + ' 授权成功</h3><p>已获取访问令牌，可关闭此窗口。</p><script>setTimeout(()=>window.close(),2000)</script>');
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<h3>授权回调错误</h3><pre>' + e.message + '</pre>');
      }
    }
    // Webhook 接收平台推送（部署公网后，平台主动 POST 至此）
    const wm = pathname.match(/^\/api\/platform\/webhook\/([a-z]+)$/);
    if (wm && req.method === 'POST') {
      const platform = wm[1];
      if (!PLATFORM_CFG[platform]) return sendJSON(res, 404, { error: '未知平台' });
      const body = await readJson(req);
      const msgs = Array.isArray(body) ? body : (body.messages || body.data || [body]);
      const arr = Array.isArray(msgs) ? msgs : [msgs];
      const leads = [];
      for (const m of arr) {
        try {
          const lead = await ingestPlatformMessage(platform, {
            fromUser: m.from_user || m.nickname || m.user_name || m.open_id,
            content: m.content || m.text || m.message,
            contact: m.contact || m.mobile || '',
            sourceType: m.source_type || m.event || '私信'
          });
          leads.push(lead);
        } catch (e) {}
      }
      return sendJSON(res, 200, { ok: true, ingested: leads.length, leads });
    }
    // 本地模拟推送（无需公网/凭证，用于自测完整链路）
    if (pathname === '/api/platform/simulate' && req.method === 'POST') {
      const body = await readJson(req);
      const platform = body.platform || 'douyin';
      const sample = body.message || { fromUser: '测试用户·小美', content: '你们这个产品怎么买？有杭州的门店吗？想了解一下', contact: 'vx: xiaomei2026', sourceType: '直播发言' };
      try {
        const lead = await ingestPlatformMessage(platform, sample);
        return sendJSON(res, 200, { ok: true, lead });
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }
    // 线索池列表
    if (pathname === '/api/platform/leads' && req.method === 'GET') {
      const leads = readPlatformLeads();
      return sendJSON(res, 200, { ok: true, leads });
    }
    // 线索 加入客户库 / 忽略
    const lam = pathname.match(/^\/api\/platform\/leads\/([^/]+)\/(add|ignore)$/);
    if (lam && req.method === 'POST') {
      const id = decodeURIComponent(lam[1]); const action = lam[2];
      const leads = db.listPlatformLeads();
      const lead = leads.find(l => l.id === id);
      if (!lead) return sendJSON(res, 404, { error: '线索不存在' });
      if (action === 'ignore') {
        db.updatePlatformLead(id, { status: '已忽略' });
        return sendJSON(res, 200, { ok: true, lead: Object.assign({}, lead, { status: '已忽略' }) });
      }
      if (lead.added) return sendJSON(res, 400, { error: '该线索已加入客户库' });
      const body = await readJson(req);
      const cust = db.createCustomer(db.normalizeCustomer({
        name: lead.fromUser, phone: lead.contact,
        note: '来自' + lead.platformName + lead.sourceType + '：' + lead.content,
        type: body.type || '', region: body.region || '',
        source: '平台接入·' + lead.platformName, status: '新客',
        tags: lead.level === '高' ? ['高意向'].concat(lead.tags || []) : (lead.tags || []),
        platform: lead.platform, inboxLevel: lead.level
      }, true));
      db.updatePlatformLead(id, { added: true, status: '已加入客户库' });
      return sendJSON(res, 200, { ok: true, customer: cust, lead: Object.assign({}, lead, { added: true, status: '已加入客户库' }) });
    }
    // 断开平台
    const dm = pathname.match(/^\/api\/platform\/disconnect\/([a-z]+)$/);
    if (dm && req.method === 'POST') {
      const tokens = readPlatformTokens();
      delete tokens[dm[1]];
      savePlatformTokens(tokens);
      return sendJSON(res, 200, { ok: true });
    }

    // ================= 客户管理 API =================
    if (pathname.startsWith('/api/customers')) {
      try {
        // 集合：列表
        if (pathname === '/api/customers') {
          if (req.method === 'GET') {
            const result = db.listCustomers({
              q: (url.searchParams.get('q') || '').trim().toLowerCase(),
              tag: url.searchParams.get('tag') || '',
              source: url.searchParams.get('source') || '',
              status: url.searchParams.get('status') || '',
              region: (url.searchParams.get('region') || '').trim(),
              page: parseInt(url.searchParams.get('page') || '1', 10),
              pageSize: parseInt(url.searchParams.get('pageSize') || '20', 10)
            });
            return sendJSON(res, 200, result);
          }
          if (req.method === 'POST') {
            const body = await readJson(req);
            if (!String(body.name || '').trim() && !String(body.phone || '').trim())
              return sendJSON(res, 400, { error: '客户名称或电话至少填一项' });
            const c = db.createCustomer(body);
            return sendJSON(res, 200, { ok: true, customer: c });
          }
          return sendJSON(res, 405, { error: '方法不支持' });
        }
        // 去重检测：按 phone / name 分组找出重复客户（须放在 /api/customers/:id 正则之前）
        if (pathname === '/api/customers/dedup' && req.method === 'GET') {
          return sendJSON(res, 200, db.dedupCustomers());
        }
        // 合并：把多个 mergeIds 合并进 keepId，删除被合并记录（须放在 /api/customers/:id 正则之前）
        if (pathname === '/api/customers/merge' && req.method === 'POST') {
          const body = await readJson(req);
          const keepId = String(body.keepId || '').trim();
          const mergeIds = Array.isArray(body.mergeIds) ? body.mergeIds.map(String).map(s => s.trim()).filter(Boolean)
                                                         : [String(body.mergeId || '').trim()].filter(Boolean);
          if (!keepId || !mergeIds.length) return sendJSON(res, 400, { error: '请提供 keepId 与至少一个 mergeId' });
          if (mergeIds.includes(keepId)) return sendJSON(res, 400, { error: 'keepId 不能与 mergeId 重复' });
          try { return sendJSON(res, 200, db.mergeCustomers(keepId, mergeIds)); }
          catch (e) { return sendJSON(res, 404, { error: e.message }); }
        }
        // 批量导入（去重）
        if (pathname === '/api/customers/import' && req.method === 'POST') {
          const body = await readJson(req);
          return sendJSON(res, 200, db.importCustomers(body));
        }
        // 数据导出（CSV / Excel），复用列表筛选逻辑
        if (pathname === '/api/customers/export' && req.method === 'GET') {
          const q = (url.searchParams.get('q') || '').trim().toLowerCase();
          const tag = url.searchParams.get('tag') || '';
          const source = url.searchParams.get('source') || '';
          const status = url.searchParams.get('status') || '';
          const region = (url.searchParams.get('region') || '').trim();
          const format = (url.searchParams.get('format') || 'csv').toLowerCase();
          const rows = db.exportCustomersRows({ q, tag, source, status, region });

          const cols = [
            { k: 'name', t: '客户名称' }, { k: 'phone', t: '电话' }, { k: 'source', t: '来源' },
            { k: 'status', t: '状态' }, { k: 'tags', t: '标签' }, { k: 'owner', t: '归属销售' },
            { k: 'aiScore', t: 'AI评分' }, { k: 'aiLevel', t: 'AI等级' }, { k: 'region', t: '地区' },
            { k: 'type', t: '行业类型' }, { k: 'address', t: '地址' }, { k: 'note', t: '备注' },
            { k: 'followupLast', t: '最近跟进' }, { k: 'nextFollowAt', t: '下次跟进' },
            { k: 'createdAt', t: '创建时间' }, { k: 'updatedAt', t: '更新时间' }
          ];
          const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

          const stamp = new Date().toISOString().slice(0, 10);
          const ext = (format === 'xls' ? 'xls' : 'csv');
          const baseAscii = 'customers_export_' + stamp;
          const baseUtf8 = '客户导出_' + stamp;
          const disp = 'attachment; filename="' + baseAscii + '.' + ext + '"; filename*=UTF-8' + "'" + "'" + encodeURIComponent(baseUtf8 + '.' + ext);
          if (format === 'xls') {
            let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body><table border="1">';
            html += '<tr>' + cols.map(c => '<th>' + c.t + '</th>').join('') + '</tr>';
            html += rows.map(r => '<tr>' + cols.map(c => '<td>' + escHtml(r[c.k]) + '</td>').join('') + '</tr>').join('');
            html += '</table></body></html>';
            const buf = Buffer.from(html, 'utf8');
            res.writeHead(200, {
              'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
              'Content-Disposition': disp,
              'X-Export-Total': String(list.length)
            });
            return res.end(buf);
          }
          // 默认 CSV（带 UTF-8 BOM，Excel 直接开中文不乱码）
          const escCsv = (s) => { const v = String(s == null ? '' : s); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
          const lines = [cols.map(c => c.t).join(',')];
          rows.forEach(r => lines.push(cols.map(c => escCsv(r[c.k])).join(',')));
          const csv = '﻿' + lines.join('\r\n');
          const buf = Buffer.from(csv, 'utf8');
          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': disp,
            'X-Export-Total': String(list.length)
          });
          return res.end(buf);
        }
        // 统计聚合
        if (pathname === '/api/customers/stats' && req.method === 'GET') {
          return sendJSON(res, 200, db.getCustomerStats());
        }
        // 批量打标签
        if (pathname === '/api/customers/batch-tag' && req.method === 'POST') {
          const body = await readJson(req);
          const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
          const tag = String(body.tag || '').trim();
          if (!tag) return sendJSON(res, 400, { error: '标签不能为空' });
          if (!ids.length) return sendJSON(res, 400, { error: '请先勾选客户' });
          return sendJSON(res, 200, db.batchTagCustomers(ids, tag));
        }
        // 批量分配归属销售
        if (pathname === '/api/customers/batch-assign' && req.method === 'POST') {
          const body = await readJson(req);
          const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
          const owner = String(body.owner || '').trim();
          if (!owner) return sendJSON(res, 400, { error: '归属销售不能为空' });
          if (!ids.length) return sendJSON(res, 400, { error: '请先勾选客户' });
          return sendJSON(res, 200, db.batchAssignCustomers(ids, owner));
        }
        // AI 智能分析线索：打分 + 跟进话术 + 外呼脚本
        if (pathname === '/api/customers/analyze' && req.method === 'POST') {
          const body = await readJson(req);
          const id = String(body.id || '');
          if (!id) return sendJSON(res, 400, { error: '客户 id 不能为空' });
          const c = db.getCustomerById(id);
          if (!c) return sendJSON(res, 404, { error: '客户不存在' });
          const snippet = [
            '客户名称：' + (c.name || '未知'),
            '电话：' + (c.phone || '未知'),
            '地区：' + (c.region || '未知'),
            '行业/类型：' + (c.type || '未知'),
            '来源：' + (c.source || '未知'),
            '状态：' + (c.status || '未知'),
            '标签：' + ((c.tags || []).join('、') || '无'),
            '备注：' + (c.note || '无'),
            '最近跟进：' + ((c.followups || []).slice(0, 2).map(f => f.content).join('；') || '无')
          ].join('\n');
          const systemPrompt = '你是资深 B2B 销售分析师。请基于客户资料输出 JSON，字段：score(0-100整数)、level("高"|"中"|"低")、reason(一句话打分理由)、followupScript(给销售的微信/短信跟进话术，口语自然可直接复制)、callScript(电话外呼开场+探需+约见脚本)。只输出 JSON，不要其它文字。';
          const userPrompt = '请分析以下客户：\n' + snippet;
          let result;
          try {
            const raw = await callDeepSeek(systemPrompt, userPrompt, { temperature: 0.6, max_tokens: 1200 });
            const obj = extractJsonObject(raw);
            if (obj) {
              result = {
                score: Math.max(0, Math.min(100, Number(obj.score) || 0)),
                level: ['高', '中', '低'].includes(obj.level) ? obj.level : '中',
                reason: String(obj.reason || ''),
                followupScript: String(obj.followupScript || ''),
                callScript: String(obj.callScript || '')
              };
            } else {
              const m = String(raw).match(/score["\s:]+(\d+)/i);
              result = { score: m ? Number(m[1]) : 60, level: '中', reason: '模型返回未结构化，已采用原始分析', followupScript: raw, callScript: '' };
            }
          } catch (e) {
            return sendJSON(res, 502, { error: 'AI 分析失败：' + e.message });
          }
          return sendJSON(res, 200, { ok: true, id, analysis: result });
        }
        // 设置/清除客户跟进提醒
        if (pathname === '/api/customers/reminder' && req.method === 'POST') {
          const body = await readJson(req);
          const id = String(body.id || '');
          if (!id) return sendJSON(res, 400, { error: '客户 id 不能为空' });
          const cust = db.setReminder(id, body.nextFollowAt, body.reminderNote);
          if (!cust) return sendJSON(res, 404, { error: '客户不存在' });
          return sendJSON(res, 200, { ok: true, customer: cust });
        }
        // 单条资源：/api/customers/:id 或 /api/customers/:id/followup
        const m = pathname.match(/^\/api\/customers\/([^/]+)(\/followup)?$/);
        if (m) {
          const id = decodeURIComponent(m[1]);
          const isFollowup = m[2] === '/followup';
          if (!isFollowup) {
            if (req.method === 'GET') {
              const cust = db.getCustomerById(id);
              if (!cust) return sendJSON(res, 404, { error: '客户不存在' });
              return sendJSON(res, 200, { ok: true, customer: cust });
            }
            if (req.method === 'PUT') {
              const body = await readJson(req);
              const merged = db.updateCustomer(id, body);
              if (!merged) return sendJSON(res, 404, { error: '客户不存在' });
              return sendJSON(res, 200, { ok: true, customer: merged });
            }
            if (req.method === 'DELETE') {
              db.deleteCustomer(id);
              return sendJSON(res, 200, { ok: true });
            }
            return sendJSON(res, 405, { error: '方法不支持' });
          } else {
            if (req.method === 'POST') {
              const body = await readJson(req);
              const content = String(body.content || '').trim();
              if (!content) return sendJSON(res, 400, { error: '跟进内容不能为空' });
              const cust = db.addFollowup(id, content, body.by);
              if (!cust) return sendJSON(res, 404, { error: '客户不存在' });
              return sendJSON(res, 200, { ok: true, customer: cust });
            }
            return sendJSON(res, 405, { error: '方法不支持' });
          }
        }
        return sendJSON(res, 404, { error: 'API不存在' });
      } catch (e) {
        return sendJSON(res, 500, { error: e.message || '客户接口错误' });
      }
    }

    // ---------- AI销冠（智能服务） ----------
    if (pathname.startsWith('/api/xiaoguan')) {
      try {
        // 全量状态
        if (pathname === '/api/xiaoguan/state' && req.method === 'GET') {
          return sendJSON(res, 200, { ok: true, data: readXiaoguan() });
        }
        // 统计卡片
        if (pathname === '/api/xiaoguan/stats' && req.method === 'GET') {
          const d = readXiaoguan();
          return sendJSON(res, 200, { ok: true, stats: d.stats, autoAdd: d.autoAdd.status, moments: d.moments.status, accountsOnline: d.accounts.filter(a => a.status === 'online').length, accountsTotal: d.accounts.length });
        }

        // ===== 自动加好友 =====
        if (pathname === '/api/xiaoguan/auto-add/start' && req.method === 'POST') {
          const body = await readBody(req); let p = {}; try { p = JSON.parse(body); } catch (e) {}
          const d = readXiaoguan();
          if (p.config) d.autoAdd.config = Object.assign({}, d.autoAdd.config, p.config);
          d.autoAdd.status = 'running'; d.autoAdd.startedAt = Date.now(); d.autoAdd.addedToday = 0;
          d.autoAdd.target = Math.min(parseInt(p.dailyLimit || d.autoAdd.config.dailyLimit || 50, 10), 200);
          saveXiaoguan(d);
          return sendJSON(res, 200, { ok: true, data: d.autoAdd });
        }
        if (pathname === '/api/xiaoguan/auto-add/stop' && req.method === 'POST') {
          const d = readXiaoguan(); d.autoAdd.status = 'stopped'; saveXiaoguan(d);
          return sendJSON(res, 200, { ok: true, data: d.autoAdd, stats: d.stats });
        }
        if (pathname === '/api/xiaoguan/auto-add/tick' && req.method === 'POST') {
          const d = readXiaoguan();
          if (d.autoAdd.status === 'running') {
            const inc = Math.max(1, Math.floor(Math.random() * 4));
            d.autoAdd.addedToday += inc; d.stats.newFriends += inc; d.stats.activeTouch += inc;
            saveXiaoguan(d);
          }
          return sendJSON(res, 200, { ok: true, data: d.autoAdd, stats: d.stats });
        }

        // ===== 朋友圈运营 =====
        if (pathname === '/api/xiaoguan/moments/start' && req.method === 'POST') {
          const body = await readBody(req); let p = {}; try { p = JSON.parse(body); } catch (e) {}
          const d = readXiaoguan();
          if (p.config) d.moments.config = Object.assign({}, d.moments.config, p.config);
          d.moments.status = 'running'; d.moments.interactedToday = 0;
          saveXiaoguan(d); return sendJSON(res, 200, { ok: true, data: d.moments });
        }
        if (pathname === '/api/xiaoguan/moments/stop' && req.method === 'POST') {
          const d = readXiaoguan(); d.moments.status = 'stopped'; saveXiaoguan(d);
          return sendJSON(res, 200, { ok: true, data: d.moments, stats: d.stats });
        }
        if (pathname === '/api/xiaoguan/moments/tick' && req.method === 'POST') {
          const d = readXiaoguan();
          if (d.moments.status === 'running') {
            const inc = Math.max(1, Math.floor(Math.random() * 3));
            d.moments.interactedToday += inc; d.stats.momentsInteractions += inc;
            saveXiaoguan(d);
          }
          return sendJSON(res, 200, { ok: true, data: d.moments, stats: d.stats });
        }
        if (pathname === '/api/xiaoguan/moments/comment' && req.method === 'POST') {
          const body = await readBody(req); let p = {}; try { p = JSON.parse(body); } catch (e) {}
          const styleMap = { '温馨赞美': '温暖、真诚地赞美对方分享的内容', '有趣互动': '轻松、有梗、能引发对方回复的互动语气', '专业点评': '专业、有洞察地点评内容' };
          const sys = '你是为客户微信朋友圈生成互动评论的助手。根据指定风格和客户朋友圈内容，生成一条简短（20字内）、真实自然、不尴尬的评论。只输出评论正文，不要解释、不要引号。';
          const usr = `风格要求：${styleMap[p.style] || '自然真诚'}\n客户朋友圈内容：${p.content || '今天天气真好，出去走走~'}\n请生成一条评论。`;
          const comment = await callDeepSeek(sys, usr, { temperature: 0.9, max_tokens: 80 });
          return sendJSON(res, 200, { ok: true, comment: String(comment || '').trim() });
        }

        // ===== 千人千面群发 =====
        if (pathname === '/api/xiaoguan/mass-send/preview' && req.method === 'POST') {
          const body = await readBody(req); let p = {}; try { p = JSON.parse(body); } catch (e) {}
          const d = readXiaoguan();
          const sample = p.vars || { name: '李女士', tags: ['高意向', '母婴'], lastBuy: '婴儿推车', product: PRODUCT.name || '我们的产品' };
          const rendered = renderMassTemplate(p.content, sample);
          return sendJSON(res, 200, { ok: true, rendered, sample });
        }
        if (pathname === '/api/xiaoguan/mass-send/send' && req.method === 'POST') {
          const body = await readBody(req); let p = {}; try { p = JSON.parse(body); } catch (e) {}
          const d = readXiaoguan();
          const count = Math.max(1, parseInt(p.count || 1, 10));
          const rec = { id: genXgId('ms'), time: Date.now(), target: p.target || '全部好友', content: p.content || '', count, status: '已发送' };
          d.massSend.history.unshift(rec);
          if (d.massSend.history.length > 50) d.massSend.history = d.massSend.history.slice(0, 50);
          d.stats.groupMessages += count;
          saveXiaoguan(d);
          return sendJSON(res, 200, { ok: true, record: rec, stats: d.stats });
        }
        if (pathname === '/api/xiaoguan/mass-send/template' && req.method === 'POST') {
          const body = await readBody(req); let p = {}; try { p = JSON.parse(body); } catch (e) {}
          const d = readXiaoguan();
          const tpl = { id: genXgId('m'), title: p.title || '未命名模板', content: p.content || '' };
          d.massSend.templates.push(tpl); saveXiaoguan(d);
          return sendJSON(res, 200, { ok: true, template: tpl });
        }
        if (pathname.startsWith('/api/xiaoguan/mass-send/template/') && req.method === 'DELETE') {
          const id = pathname.slice('/api/xiaoguan/mass-send/template/'.length);
          const d = readXiaoguan();
          d.massSend.templates = d.massSend.templates.filter(t => t.id !== id);
          saveXiaoguan(d); return sendJSON(res, 200, { ok: true });
        }

        // ===== 拟人聊天（AI） =====
        if (pathname === '/api/xiaoguan/chat/reply' && req.method === 'POST') {
          const body = await readBody(req); let p = {}; try { p = JSON.parse(body); } catch (e) {}
          const personaMap = {
            '热情销售型': '热情、主动、有冲劲的销售，善于拉近关系、制造紧迫感',
            '专业顾问型': '专业、稳重、以专业建议赢得信任的顾问',
            '贴心客服型': '温柔、耐心、站在客户角度考虑的贴心客服',
            '幽默风趣型': '幽默、松弛、用轻松语气化解尴尬的销售'
          };
          const sys = '你是拟人化微信销售聊天助手。根据给定的人格设定、聊天场景与客户上文，生成一条自然、像真人一样口语化、有温度、不机械的回复。禁止使用"亲""您好，很高兴为您服务""有什么可以帮您"等标准客服腔。直接输出回复正文，不要任何解释或引号。';
          const usr = `人格设定：${personaMap[p.persona] || p.persona || '热情销售型'}\n聊天场景：${p.scene || '新好友破冰'}\n客户上文：${p.context || '（无）'}\n请生成一条回复。`;
          const reply = await callDeepSeek(sys, usr, { temperature: 0.9, max_tokens: 200 });
          return sendJSON(res, 200, { ok: true, reply: String(reply || '').trim() });
        }

        // ===== 多账号管理 =====
        if (pathname === '/api/xiaoguan/accounts' && req.method === 'POST') {
          const body = await readBody(req); let p = {}; try { p = JSON.parse(body); } catch (e) {}
          const d = readXiaoguan();
          const acc = { id: genXgId('a'), name: p.name || '新账号', platform: p.platform || '微信', status: p.status || 'offline', todayAdd: 0, todayChat: 0, todayMoments: 0 };
          d.accounts.push(acc); saveXiaoguan(d);
          return sendJSON(res, 200, { ok: true, account: acc });
        }
        if (pathname.startsWith('/api/xiaoguan/accounts/') && req.method === 'PUT') {
          const id = pathname.slice('/api/xiaoguan/accounts/'.length);
          const body = await readBody(req); let p = {}; try { p = JSON.parse(body); } catch (e) {}
          const d = readXiaoguan();
          const acc = d.accounts.find(a => a.id === id);
          if (!acc) return sendJSON(res, 404, { error: '账号不存在' });
          if (p.status) acc.status = p.status;
          if (p.name) acc.name = p.name;
          if (p.platform) acc.platform = p.platform;
          saveXiaoguan(d); return sendJSON(res, 200, { ok: true, account: acc });
        }
        if (pathname.startsWith('/api/xiaoguan/accounts/') && req.method === 'DELETE') {
          const id = pathname.slice('/api/xiaoguan/accounts/'.length);
          const d = readXiaoguan();
          d.accounts = d.accounts.filter(a => a.id !== id);
          saveXiaoguan(d); return sendJSON(res, 200, { ok: true });
        }

        return sendJSON(res, 404, { error: 'AI销冠接口不存在: ' + pathname });
      } catch (e) {
        return sendJSON(res, 500, { error: e.message || 'AI销冠接口错误' });
      }
    }

    // ============================================================
    // AI客服 API
    // ============================================================
    if (pathname.startsWith('/api/kefu/')) {
      try {
        const body = req.method !== 'GET' && req.method !== 'DELETE' ? JSON.parse(await readBody(req)) : {};

        // 会话列表 + 统计
        if (pathname === '/api/kefu/state' && req.method === 'GET') {
          const d = readKefu();
          const activeCount = d.conversations.filter(c => c.status === 'chatting').length;
          const pendingCount = d.conversations.filter(c => c.status === 'pending').length;
          return sendJSON(res, 200, { ok: true, data: {
            conversations: d.conversations,
            activeId: d.activeConversationId,
            scripts: d.scripts,
            stats: {
              ...d.stats,
              activeCount,
              pendingCount,
              totalConversations: d.conversations.length
            }
          }});

        }

        // 切换会话
        if (pathname === '/api/kefu/conversation/switch' && req.method === 'POST') {
          const d = readKefu();
          const conv = d.conversations.find(c => c.id === body.id);
          if (!conv) return sendJSON(res, 404, { error: '会话不存在' });
          conv.unread = 0; // 清除未读
          d.activeConversationId = body.id;
          saveKefu(d);
          return sendJSON(res, 200, { ok: true, data: conv });
        }

        // 发送消息（人工）
        if (pathname === '/api/kefu/message/send' && req.method === 'POST') {
          const d = readKefu();
          const conv = d.conversations.find(c => c.id === body.convId);
          if (!conv) return sendJSON(res, 404, { error: '会话不存在' });
          const msg = { id: genKfId('m'), role: 'agent', text: String(body.text || '').trim(), time: kfNowTime(), ai: false };
          if (!msg.text) return sendJSON(res, 400, { error: '消息不能为空' });
          conv.messages.push(msg);
          if (conv.status === 'pending') conv.status = 'chatting';
          d.stats.todayReplied = (d.stats.todayReplyed || d.stats.todayReplied || 0) + 1;
          saveKefu(d);
          return sendJSON(res, 200, { ok: true, data: msg });
        }

        // AI 智能回复（基于上下文）
        if (pathname === '/api/kefu/message/ai-reply' && req.method === 'POST') {
          const d = readKefu();
          const conv = d.conversations.find(c => c.id === body.convId);
          if (!conv) return sendJSON(res, 404, { error: '会话不存在' });
          const recentMsgs = conv.messages.slice(-8).map(m =>
            (m.role === 'customer' ? '客户：' : '客服：') + m.text
          ).join('\n');
          const sysPrompt = `你是「${PRODUCT.name || 'AI智能客服'}」的专业客服代表。你的特点是：
- 回复自然亲切，像真人聊天一样有温度
- 熟悉产品信息：${PRODUCT.name || ''} ${PRODUCT.desc || ''}
- 能准确理解客户意图并给出有帮助的答复
- 适当使用emoji增加亲和力，但不要过度
- 如果涉及订单/物流/价格等具体问题，用合理的模拟数据回复

当前客户：${conv.name}（来源：${conv.source}，咨询主题：${conv.topic}）
${recentMsgs ? '近期对话记录：\n' + recentMsgs : '这是该客户的首次消息。'}

请生成一条针对客户最新消息的回复。直接输出回复正文，不要任何解释、引号或前缀。`;
          const aiText = await callDeepSeek(sysPrompt, '');
          const msg = { id: genKfId('m'), role: 'agent', text: aiText, time: kfNowTime(), ai: true };
          conv.messages.push(msg);
          if (conv.status === 'pending') conv.status = 'chatting';
          saveKefu(d);
          return sendJSON(res, 200, { ok: true, data: msg });
        }

        // 标记会话状态
        if (pathname === '/api/kefu/conversation/status' && req.method === 'POST') {
          const d = readKefu();
          const conv = d.conversations.find(c => c.id === body.id);
          if (!conv) return sendJSON(res, 404, { error: '会话不存在' });
          conv.status = body.status || conv.status;
          if (body.tags) conv.tags = body.tags;
          saveKefu(d);
          return sendJSON(res, 200, { ok: true, data: conv });
        }

        // 新建会话（模拟新客户进线）
        if (pathname === '/api/kefu/conversation/create' && req.method === 'POST') {
          const d = readKefu();
          const name = body.name || _KF_SURNAMES[_kfRand(0, _KF_SURNAMES.length - 1)] + _KF_NAMES[_kfRand(0, _KF_NAMES.length - 1)];
          const platforms = { wechat: '微信客服', qywx: '企业微信', douyin: '抖音客服' };
          const conv = {
            id: genKfId('c'),
            name,
            avatar: name[0],
            platform: body.platform || 'wechat',
            source: platforms[body.platform || 'wechat'] || '微信客服',
            topic: body.topic || _KF_TOPICS[_kfRand(0, _KF_TOPICS.length - 1)],
            status: 'pending',
            tags: body.tags || [],
            unread: 1,
            messages: body.firstMessage ? [{ id: genKfId('m'), role: 'customer', text: body.firstMessage, time: kfNowTime() }] : [],
            stats: { sessionCount: 1, firstContact: KF_DATE() }
          };
          d.conversations.unshift(conv);
          d.stats.totalReceived += 1;
          saveKefu(d);
          return sendJSON(res, 200, { ok: true, data: conv });
        }

        // 话术库：AI 生成
        if (pathname === '/api/kefu/scripts/generate' && req.method === 'POST') {
          const category = body.category || '常见问题';
          const sys = '你是企业/电商客服话术专家。根据用户给出的分类与场景，生成5条可直接复制使用的客服话术。返回JSON数组，每个元素形如 {"title":"话术标题","content":"话术正文"}。话术要专业、亲切、可落地，能化解客户疑虑并引导转化。只返回JSON数组。';
          const prompt = `分类：${category}\n场景：${category}场景\n产品：${PRODUCT.name || 'AI智能客服系统'}`;
          let scripts = [];
          try {
            const raw = await callDeepSeek(sys, prompt);
            const parsed = JSON.parse(raw);
            scripts = Array.isArray(parsed) ? parsed : [];
          } catch(e) { /* fallback to empty */ }
          // 同时保存到本地话术库
          if (scripts.length > 0) {
            const d = readKefu();
            d.scripts[category] = scripts.map(s => s.title ? (s.title + '：' + s.content) : s.content);
            saveKefu(d);
          }
          return sendJSON(res, 200, { ok: true, scripts });
        }

        // 客户信息更新
        if (pathname === '/api/kefu/customer/update' && req.method === 'POST') {
          const d = readKefu();
          const conv = d.conversations.find(c => c.id === body.convId);
          if (!conv) return sendJSON(res, 404, { error: '会话不存在' });
          if (body.tags) conv.tags = body.tags;
          if (body.name) conv.name = body.name;
          if (body.notes) conv.notes = body.notes;
          saveKefu(d);
          return sendJSON(res, 200, { ok: true, data: conv });
        }

        return sendJSON(res, 404, { error: 'AI客服接口不存在: ' + pathname });
      } catch (e) {
        return sendJSON(res, 500, { error: e.message || 'AI客服接口错误' });
      }
    }

    // ============================================================
    // AI人事（智能招聘）API
    // ============================================================
    if (pathname.startsWith('/api/renshi/')) {
      try {
        const body = req.method !== 'GET' && req.method !== 'DELETE' ? JSON.parse(await readBody(req)) : {};

        // 全量状态：简历列表 + 职位 + 配置 + 统计
        if (pathname === '/api/renshi/state' && req.method === 'GET') {
          const d = readRenshi();
          return sendJSON(res, 200, { ok: true, data: {
            resumes: d.resumes,
            positions: d.positions,
            config: d.config,
            stats: renshiStats(d)
          }});
        }

        // AI 批量筛选：对未评分（或全部）简历打分，返回匹配度/亮点/风险/建议
        if (pathname === '/api/renshi/screen' && req.method === 'POST') {
          const d = readRenshi();
          const onlyUnscored = body.onlyUnscored !== false; // 默认只筛未评分的
          const targets = d.resumes.filter(r => onlyUnscored ? !r.aiScored : true);
          if (targets.length === 0) return sendJSON(res, 200, { ok: true, updated: 0, stats: renshiStats(d) });

          const posMap = {}; d.positions.forEach(p => { posMap[p.id] = p; });
          const cand = targets.map((r, i) => {
            const p = posMap[r.positionId] || {};
            return `#${i + 1} 应聘【${r.position}】(岗位要求：${p.jd || '无'})；候选人：${r.gender}/${r.age}岁/${r.degree}/${r.school}/${r.exp}经验/期望${r.salary}/背景亮点：${r._seed || '无'}`;
          }).join('\n');
          const sys = '你是资深招聘HR与人才评估专家。根据每位候选人的资料与所应聘岗位的要求，逐一评估匹配度。严格返回JSON数组，元素顺序与输入编号一一对应，每个元素形如 {"index":1,"matchRate":88,"highlights":["亮点1","亮点2"],"risks":["风险点1"],"summary":"一句话综合评价","recommend":"推荐"}。matchRate为0-100整数；recommend取值仅限"推荐"/"待定"/"不推荐"。只返回JSON数组，不要多余文字。';
          const prompt = '请评估以下候选人：\n' + cand;
          let arr = [];
          try {
            const raw = await callDeepSeek(sys, prompt, { max_tokens: 2500 });
            arr = extractJsonArray(raw);
          } catch (e) { /* 保底走本地评分 */ }

          let updated = 0;
          targets.forEach((r, i) => {
            const a = arr.find(x => Number(x.index) === i + 1) || arr[i];
            if (a && a.matchRate != null) {
              r.matchRate = Math.max(0, Math.min(100, Math.round(Number(a.matchRate))));
              r.highlights = Array.isArray(a.highlights) ? a.highlights.slice(0, 4) : (r._seed ? [r._seed] : []);
              r.risks = Array.isArray(a.risks) ? a.risks.slice(0, 3) : [];
              r.summary = a.summary || '';
              r.recommend = ['推荐', '待定', '不推荐'].includes(a.recommend) ? a.recommend : (r.matchRate >= 80 ? '推荐' : r.matchRate >= 60 ? '待定' : '不推荐');
            } else {
              // AI 不可用时的本地兜底评分
              r.matchRate = _kfRand(55, 95);
              r.highlights = r._seed ? [r._seed] : ['经验与岗位基本匹配'];
              r.risks = r.matchRate < 70 ? ['需进一步核实项目经历'] : [];
              r.summary = r.matchRate >= 80 ? '综合素质优秀，建议优先安排面试' : '基本符合要求，可进一步沟通';
              r.recommend = r.matchRate >= 80 ? '推荐' : r.matchRate >= 60 ? '待定' : '不推荐';
            }
            r.aiScored = true;
            updated++;
          });
          d.stats.screenedToday = (d.stats.screenedToday || 0) + updated;
          saveRenshi(d);
          return sendJSON(res, 200, { ok: true, updated, resumes: d.resumes, stats: renshiStats(d) });
        }

        // AI 生成/发送打招呼话术
        if (pathname === '/api/renshi/greet' && req.method === 'POST') {
          const d = readRenshi();
          const r = d.resumes.find(x => x.id === body.id);
          if (!r) return sendJSON(res, 404, { error: '简历不存在' });
          let greeting = '';
          if (body.useAI) {
            const sys = '你是专业招聘HR。根据候选人资料与岗位，撰写一条自然、真诚、有吸引力的BOSS直聘打招呼消息，60字以内，突出岗位亮点并邀约沟通，不要过度客套，直接可发送。只返回消息正文。';
            const prompt = `候选人：${r.name}，应聘${r.position}，${r.degree}/${r.exp}经验/亮点：${r._seed || '无'}。公司：${PRODUCT.name || '我们公司'}。`;
            try { greeting = (await callDeepSeek(sys, prompt, { max_tokens: 300 })).trim(); } catch (e) {}
          }
          if (!greeting) {
            greeting = (d.config.greetTemplate || '{姓名}您好！看了您的简历很合适{职位}岗位，方便聊聊吗？')
              .replace(/\{姓名\}/g, r.name)
              .replace(/\{职位\}/g, r.position)
              .replace(/\{公司\}/g, PRODUCT.name || '我们公司');
          }
          // 落库为一条消息并更新状态
          r.messages.push({ role: 'hr', text: greeting, time: kfNowTime() });
          if (r.status === '待处理') r.status = '已打招呼';
          r.greeted = true;
          d.stats.greetedToday = (d.stats.greetedToday || 0) + 1;
          saveRenshi(d);
          return sendJSON(res, 200, { ok: true, greeting, data: r, stats: renshiStats(d) });
        }

        // AI 面试问答：候选人提问，AI 基于知识库/岗位作答
        if (pathname === '/api/renshi/qa' && req.method === 'POST') {
          const d = readRenshi();
          const r = body.id ? d.resumes.find(x => x.id === body.id) : null;
          const question = (body.question || '').trim();
          if (!question) return sendJSON(res, 400, { error: '请输入问题' });
          const sys = '你是企业招聘HR助手，代表公司回答求职者的问题。回答要专业、真诚、有温度，能打消顾虑并促进候选人到面。控制在120字以内，不编造不确定的信息。只返回回答正文。';
          const kb = (d.config.knowledge || []).join('、');
          const posInfo = r ? `（该候选人应聘${r.position}岗位）` : '';
          const prompt = `公司：${PRODUCT.name || '我们公司'}${posInfo}\n可参考知识点：${kb}\n求职者问题：${question}`;
          let answer = '';
          try { answer = (await callDeepSeek(sys, prompt, { max_tokens: 400 })).trim(); }
          catch (e) { answer = '感谢您的关注！关于「' + question + '」，欢迎在面试中与我们详细沟通，我们会为您安排专人解答~'; }
          if (r) { r.messages.push({ role: 'candidate', text: question, time: kfNowTime() }); r.messages.push({ role: 'hr', text: answer, time: kfNowTime() }); saveRenshi(d); }
          return sendJSON(res, 200, { ok: true, answer });
        }

        // 更新简历状态（待处理/已打招呼/面试中/已录用/不合适）
        if (pathname === '/api/renshi/resume/status' && req.method === 'POST') {
          const d = readRenshi();
          const r = d.resumes.find(x => x.id === body.id);
          if (!r) return sendJSON(res, 404, { error: '简历不存在' });
          const allow = ['待处理', '已打招呼', '面试中', '已录用', '不合适'];
          if (!allow.includes(body.status)) return sendJSON(res, 400, { error: '非法状态' });
          r.status = body.status;
          saveRenshi(d);
          return sendJSON(res, 200, { ok: true, data: r, stats: renshiStats(d) });
        }

        // 简历详情
        if (pathname === '/api/renshi/resume/detail' && req.method === 'GET') {
          const d = readRenshi();
          const r = d.resumes.find(x => x.id === url.searchParams.get('id'));
          if (!r) return sendJSON(res, 404, { error: '简历不存在' });
          return sendJSON(res, 200, { ok: true, data: r });
        }

        // 模拟新简历进线
        if (pathname === '/api/renshi/resume/create' && req.method === 'POST') {
          const d = readRenshi();
          const pos = body.positionId ? d.positions.find(p => p.id === body.positionId) : d.positions[_kfRand(0, d.positions.length - 1)];
          const degrees = ['本科', '硕士', '大专', '本科', '本科'];
          const exps = ['1年', '2年', '3年', '4年', '5年', '6年'];
          const r = {
            id: genKfId('r'),
            name: body.name || _rsName(),
            gender: Math.random() > 0.5 ? '男' : '女',
            age: _kfRand(23, 40),
            positionId: pos.id,
            position: pos.name,
            degree: degrees[_kfRand(0, degrees.length - 1)],
            school: '某高校 相关专业',
            exp: exps[_kfRand(0, exps.length - 1)],
            salary: pos.salary || '面议',
            phone: '1' + _kfRand(3, 9) + String(_kfRand(0, 999999999)).padStart(9, '0'),
            lastActive: '刚刚',
            status: '待处理',
            matchRate: null, aiScored: false, highlights: [], risks: [], summary: '', recommend: '',
            _seed: '新投递简历，待AI评估',
            greeted: false, messages: []
          };
          d.resumes.unshift(r);
          saveRenshi(d);
          return sendJSON(res, 200, { ok: true, data: r, stats: renshiStats(d) });
        }

        // 保存招聘自动化配置
        if (pathname === '/api/renshi/config' && req.method === 'POST') {
          const d = readRenshi();
          if (body.autoGreet != null) d.config.autoGreet = !!body.autoGreet;
          if (body.autoAnswer != null) d.config.autoAnswer = !!body.autoAnswer;
          if (typeof body.greetTemplate === 'string') d.config.greetTemplate = body.greetTemplate;
          if (Array.isArray(body.knowledge)) d.config.knowledge = body.knowledge;
          saveRenshi(d);
          return sendJSON(res, 200, { ok: true, config: d.config });
        }

        return sendJSON(res, 404, { error: 'AI人事接口不存在: ' + pathname });
      } catch (e) {
        return sendJSON(res, 500, { error: e.message || 'AI人事接口错误' });
      }
    }

    // 待办聚合：跟进提醒（逾期/今日/即将到期）
    if (pathname === '/api/todos' && req.method === 'GET') {
      return sendJSON(res, 200, db.getTodos());
    }

    // 控制台 Dashboard 聚合接口（真实数据）
    if (pathname === '/api/dashboard' && req.method === 'GET') {
        try {
            return sendJSON(res, 200, db.getDashboardData());
        } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }

    return sendJSON(res, 404, { error: 'API不存在' });
  }

  if (pathname === '/download' && req.method === 'GET') {
    const fileParam = url.searchParams.get('file');
    if (!fileParam) return sendJSON(res, 400, { error: '缺少 file 参数' });
    const target = path.resolve(fileParam);
    const allowedRoot = path.resolve(DATA_DIR);
    if (!target.startsWith(allowedRoot)) {
      return sendJSON(res, 403, { error: '非法文件访问' });
    }
    try {
      const data = fs.readFileSync(target);
      const ext = path.extname(target).toLowerCase();
      const contentType = {
        '.json': 'application/json; charset=utf-8',
        '.csv': 'text/csv; charset=utf-8',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Disposition': 'attachment; filename="' + encodeURIComponent(path.basename(target)) + '"'
      });
      res.end(data);
    } catch (e) {
      return sendJSON(res, 404, { error: '文件不存在或无法读取' });
    }
  }

  // 静态
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname);
  res.writeHead(405); res.end('Method Not Allowed');
});

// ---------- 启动 ----------
db.initDB();
server.listen(PORT, () => {
  console.log('🤖 AI超级员工后端已启动: http://localhost:' + PORT);
  console.log('   DeepSeek Key: ' + (DEEPSEEK_API_KEY ? '已配置(' + DEEPSEEK_API_KEY.slice(0, 6) + '...) ' : '❌ 未配置') + ' | 模型: ' + DEEPSEEK_MODEL);
  console.log('   高德 Key: ' + (AMAP_KEY ? '已配置(' + AMAP_KEY.slice(0, 6) + '...) ' : '❌ 未配置') + ' | 地图获客可用');
  console.log('   打开 http://localhost:' + PORT + ' 即可使用');
});
