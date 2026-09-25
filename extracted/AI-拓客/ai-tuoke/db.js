/* ============================================================
   AI超级员工 - SQLite 数据访问层 (零依赖, 使用 Node.js 内置 node:sqlite)
   替代原有的 JSON 文件全量读写, 提供索引/事务/并发安全
   启动需加 --experimental-sqlite 标志: node --experimental-sqlite server.js
   ============================================================ */
'use strict';

const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ---------- 路径 ----------
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

// ---------- 数据库连接 (单例) ----------
let _db = null;

function getDB() {
  if (!_db) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA journal_mode = WAL');     // WAL 模式: 读写不互斥, 崩溃不丢数据
    _db.exec('PRAGMA foreign_keys = ON');       // 开启外键级联删除
    _db.exec('PRAGMA busy_timeout = 5000');     // 锁等待 5 秒
  }
  return _db;
}

// ---------- 建表 ----------
const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY,
  name          TEXT DEFAULT '',
  phone         TEXT DEFAULT '',
  address       TEXT DEFAULT '',
  type          TEXT DEFAULT '',
  region        TEXT DEFAULT '',
  source        TEXT DEFAULT '',
  status        TEXT DEFAULT '新客',
  tags          TEXT DEFAULT '[]',
  rating        TEXT DEFAULT '',
  lng           REAL DEFAULT 0,
  lat           REAL DEFAULT 0,
  owner         TEXT DEFAULT '',
  note          TEXT DEFAULT '',
  ai            TEXT DEFAULT '{}',
  next_follow_at  INTEGER DEFAULT 0,
  reminder_note   TEXT DEFAULT '',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_phone   ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_status  ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_source  ON customers(source);
CREATE INDEX IF NOT EXISTS idx_customers_updated ON customers(updated_at DESC);

CREATE TABLE IF NOT EXISTS customer_followups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  time        INTEGER NOT NULL,
  content     TEXT NOT NULL,
  by          TEXT DEFAULT '系统',
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_followups_cust ON customer_followups(customer_id);

CREATE TABLE IF NOT EXISTS templates (
  id         TEXT PRIMARY KEY,
  title      TEXT DEFAULT '',
  content    TEXT NOT NULL,
  category   TEXT DEFAULT '通用',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  category   TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_cat ON ai_history(category, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_leads (
  id           TEXT PRIMARY KEY,
  platform     TEXT DEFAULT '',
  platform_name TEXT DEFAULT '',
  from_user    TEXT DEFAULT '',
  source_type  TEXT DEFAULT '私信',
  content      TEXT DEFAULT '',
  contact      TEXT DEFAULT '',
  level        TEXT DEFAULT '中',
  reason       TEXT DEFAULT '',
  tags         TEXT DEFAULT '[]',
  status       TEXT DEFAULT '待筛选',
  added        INTEGER DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_level ON platform_leads(level);

CREATE TABLE IF NOT EXISTS platform_tokens (
  platform      TEXT PRIMARY KEY,
  access_token  TEXT NOT NULL,
  refresh_token TEXT DEFAULT '',
  expires_in    INTEGER DEFAULT 0,
  connected_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user',
  display_name TEXT DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
`;

// ---------- 序列化辅助 ----------
function serializeCustomer(c) {
  return {
    id: c.id,
    name: c.name || '',
    phone: c.phone || '',
    address: c.address || '',
    type: c.type || '',
    region: c.region || '',
    source: c.source || '手动添加',
    status: c.status || '新客',
    tags: JSON.stringify(c.tags || []),
    rating: c.rating != null ? String(c.rating) : '',
    lng: parseFloat(c.lng) || 0,
    lat: parseFloat(c.lat) || 0,
    owner: c.owner || '',
    note: c.note || '',
    ai: JSON.stringify(c.ai || null),
    next_follow_at: (typeof c.nextFollowAt === 'number' && c.nextFollowAt > 0) ? c.nextFollowAt : 0,
    reminder_note: c.reminderNote || '',
    created_at: c.createdAt || Date.now(),
    updated_at: c.updatedAt || Date.now()
  };
}

function deserializeCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    type: row.type,
    region: row.region,
    source: row.source,
    status: row.status,
    tags: safeParseArr(row.tags),
    rating: row.rating,
    lng: row.lng,
    lat: row.lat,
    owner: row.owner,
    note: row.note,
    ai: safeParseObj(row.ai),
    nextFollowAt: row.nextFollowAt,
    reminderNote: row.reminderNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function safeParseArr(s) { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function safeParseObj(s) { try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }

function genUserId() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// ---------- 密码哈希（sha256 + 前缀标记；兼容历史明文，自动升级） ----------
const PASSWORD_HASH_PREFIX = 'sha256:';

function hashPassword(password) {
  return PASSWORD_HASH_PREFIX + crypto.createHash('sha256').update(String(password || ''), 'utf8').digest('hex');
}

function isPasswordHashed(value) {
  return typeof value === 'string' && value.startsWith(PASSWORD_HASH_PREFIX);
}

// 校验：哈希记录按哈希比对；历史明文记录按原文比对（由迁移/登录时升级为哈希）
function verifyPassword(stored, input) {
  if (!stored) return false;
  const given = String(input || '');
  if (isPasswordHashed(stored)) return stored === hashPassword(given);
  return stored === given;
}

// 一次性迁移：把 users 表里残留的历史明文密码升级为哈希（幂等，可重复调用）
function migratePlaintextPasswords() {
  const db = getDB();
  const rows = db.prepare('SELECT id, password FROM users').all();
  const stmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
  let migrated = 0;
  rows.forEach(row => {
    if (isPasswordHashed(row.password)) return;
    stmt.run(hashPassword(row.password), row.id);
    migrated++;
  });
  if (migrated) console.log('[DB] 密码存储升级: ' + migrated + ' 个用户由明文改为 sha256 哈希');
  return migrated;
}

// 登录成功后按需升级（仅当该记录仍是明文时触发）
function upgradePasswordIfNeeded(userId, plainPassword) {
  const db = getDB();
  const row = db.prepare('SELECT password FROM users WHERE id = ?').get(String(userId || ''));
  if (!row || isPasswordHashed(row.password)) return false;
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(plainPassword), String(userId));
  return true;
}

// ---------- 预置话术模板（首次使用 / 数据重置后恢复） ----------
const DEFAULT_TEMPLATES = [
  { title: '初次问候', category: '开场白', content: '您好，我是XX的小助手～感谢您对我们的关注！请问有什么我可以帮您的吗？😊' },
  { title: '价格咨询回复', category: '咨询回复', content: '我们的课程有多种套餐，您方便留个联系方式吗？我让顾问根据您的情况给您一份专属报价~' },
  { title: '邀约到店', category: '邀约', content: '这周末我们有线下体验课，就在您附近，欢迎来现场了解，我帮您预留位置？' },
  { title: '节日问候', category: '维护', content: '中秋快乐🥮！感谢您一直以来的信任，有需要随时找我~' }
];

function seedDefaultTemplates() {
  DEFAULT_TEMPLATES.forEach(s => createTemplate(s));
  return DEFAULT_TEMPLATES.length;
}

// ---------- 数据重置（事务化，仅清业务数据，保留账号与配置） ----------
const RESETTABLE_TABLES = [
  'customer_followups',
  'customers',
  'templates',
  'ai_history',
  'platform_leads',
  'platform_tokens'
];

function resetAllData({ keepUsers = true, reseedTemplates = true } = {}) {
  const db = getDB();
  const before = {};
  RESETTABLE_TABLES.forEach(t => {
    try { before[t] = db.prepare('SELECT COUNT(*) AS cnt FROM ' + t).get().cnt; } catch (e) { before[t] = 0; }
  });
  db.exec('BEGIN');
  try {
    RESETTABLE_TABLES.forEach(t => db.prepare('DELETE FROM ' + t).run());
    if (!keepUsers) db.prepare('DELETE FROM users').run();
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (e2) { /* ignore */ }
    throw e;
  }
  let templatesReseeded = 0;
  if (reseedTemplates) {
    try { templatesReseeded = seedDefaultTemplates(); } catch (e) { templatesReseeded = 0; }
  }
  // 尽量把 WAL 落盘，保证紧接着做的文件备份内容完整
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) { /* 有并发读时会失败，忽略 */ }
  return { deleted: before, keepUsers: !!keepUsers, templatesReseeded };
}

// ---------- 用户与权限 ----------
function listUsers() {
  const db = getDB();
  return db.prepare('SELECT id, username, role, display_name AS displayName, created_at AS createdAt FROM users ORDER BY created_at DESC').all();
}

function getUserByUsername(username) {
  const db = getDB();
  const row = db.prepare('SELECT id, username, password, role, display_name AS displayName, created_at AS createdAt FROM users WHERE username = ?').get(String(username || '').trim());
  return row || null;
}

function getUserById(id) {
  const db = getDB();
  const row = db.prepare('SELECT id, username, password, role, display_name AS displayName, created_at AS createdAt FROM users WHERE id = ?').get(String(id || ''));
  return row || null;
}

function upsertUser({ id, username, password, role, displayName }) {
  const db = getDB();
  const u = String(username || '').trim();
  if (!u) throw new Error('用户名不能为空');
  // 密码一律以哈希入库；已是哈希的值原样保留（避免重复哈希）
  const rawPwd = String(password || '').trim();
  const storedPwd = rawPwd ? (isPasswordHashed(rawPwd) ? rawPwd : hashPassword(rawPwd)) : '';
  const existing = db.prepare('SELECT id, password FROM users WHERE username = ?').get(u);
  if (existing) {
    const target = String(id || existing.id);
    // 未传新密码时保持原密码不变
    const finalPwd = storedPwd || existing.password;
    db.prepare('UPDATE users SET password = ?, role = ?, display_name = ? WHERE id = ?').run(finalPwd, String(role || 'user'), String(displayName || ''), target);
    return db.prepare('SELECT id, username, password, role, display_name AS displayName, created_at AS createdAt FROM users WHERE id = ?').get(target);
  }
  const row = {
    id: id || genUserId(),
    username: u,
    password: storedPwd,
    role: String(role || 'user'),
    displayName: String(displayName || ''),
    createdAt: Date.now()
  };
  db.prepare('INSERT INTO users (id, username, password, role, display_name, created_at) VALUES (?,?,?,?,?,?)')
    .run(row.id, row.username, row.password, row.role, row.displayName, row.createdAt);
  return row;
}

function ensureDefaultUsers() {
  const db = getDB();
  const defaults = [
    { username: 'admin', password: 'admin123', role: 'admin', displayName: '管理员' },
    { username: 'sales', password: 'sales123', role: 'user', displayName: '销售专员' }
  ];
  defaults.forEach(item => {
    const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(item.username);
    if (!exists) {
      db.prepare('INSERT INTO users (id, username, password, role, display_name, created_at) VALUES (?,?,?,?,?,?)')
        .run(genUserId(), item.username, hashPassword(item.password), item.role, item.displayName, Date.now());
    }
  });
  // 兜底：把任何残留的明文密码升级为哈希
  migratePlaintextPasswords();
}

// ---------- ID 生成 ----------
function genCustId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function genTemplateId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function custKey(c) { return ((c.name || '') + '|' + (c.phone || '')).trim().toLowerCase(); }

// ---------- normalizeCustomer (纯函数, 保持与原版兼容) ----------
function normalizeCustomer(c, isNew) {
  const now = Date.now();
  return {
    id: isNew ? (c.id || genCustId()) : c.id,
    name: String(c.name || '').trim(),
    phone: String(c.phone || '').trim(),
    address: String(c.address || '').trim(),
    type: String(c.type || '').trim(),
    region: String(c.region || (c.city || '')).trim(),
    source: String(c.source || '手动添加').trim(),
    status: ['新客', '跟进中', '已成交', '已流失'].includes(c.status) ? c.status : '新客',
    tags: Array.isArray(c.tags) ? c.tags.map(t => String(t).trim()).filter(Boolean) : (c.tags ? [String(c.tags).trim()].filter(Boolean) : []),
    rating: c.rating != null && c.rating !== '' ? String(c.rating) : '',
    lng: parseFloat(c.lng) || 0,
    lat: parseFloat(c.lat) || 0,
    owner: String(c.owner || '').trim(),
    note: String(c.note || '').trim(),
    followups: Array.isArray(c.followups) ? c.followups : [],
    ai: (c.ai && typeof c.ai === 'object') ? c.ai : null,
    nextFollowAt: (typeof c.nextFollowAt === 'number' && c.nextFollowAt > 0) ? c.nextFollowAt : 0,
    reminderNote: String(c.reminderNote || '').trim(),
    createdAt: c.createdAt || now,
    updatedAt: now
  };
}

// ============================================================
//  Customer 数据访问
// ============================================================

// 批量加载 followups (避免 N+1)
function loadFollowupsForCustomers(ids) {
  if (!ids.length) return {};
  const db = getDB();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT customer_id, time, content, by FROM customer_followups WHERE customer_id IN (${placeholders}) ORDER BY time DESC`
  ).all(...ids);
  const map = {};
  rows.forEach(r => {
    if (!map[r.customer_id]) map[r.customer_id] = [];
    map[r.customer_id].push({ time: r.time, content: r.content, by: r.by });
  });
  return map;
}

function getCustomerById(id) {
  const db = getDB();
  const row = db.prepare(
    `SELECT id, name, phone, address, type, region, source, status, tags, rating,
            lng, lat, owner, note, ai, next_follow_at AS nextFollowAt,
            reminder_note AS reminderNote, created_at AS createdAt, updated_at AS updatedAt
     FROM customers WHERE id = ?`
  ).get(id);
  if (!row) return null;
  const cust = deserializeCustomer(row);
  const fuRows = db.prepare(
    'SELECT time, content, by FROM customer_followups WHERE customer_id = ? ORDER BY time DESC'
  ).all(id);
  cust.followups = fuRows.map(r => ({ time: r.time, content: r.content, by: r.by }));
  return cust;
}

function listCustomers(filters) {
  const db = getDB();
  const { q, tag, source, status, region, page, pageSize } = filters;
  const pg = Math.max(1, page || 1);
  const ps = Math.min(200, Math.max(1, pageSize || 20));
  const where = [];
  const params = [];

  if (q) {
    where.push('(LOWER(name) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(address) LIKE ? OR LOWER(note) LIKE ?)');
    const kw = '%' + q.toLowerCase() + '%';
    params.push(kw, kw, kw, kw);
  }
  if (status) { where.push('status = ?'); params.push(status); }
  if (source) { where.push('source = ?'); params.push(source); }
  if (region) { where.push('region LIKE ?'); params.push('%' + region + '%'); }
  if (tag) { where.push('tags LIKE ?'); params.push('%"' + tag.replace(/"/g, '\\"') + '"%'); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) AS cnt FROM customers ${whereClause}`).get(...params).cnt;
  const totalPages = Math.ceil(total / ps) || 1;

  const rows = db.prepare(
    `SELECT id, name, phone, address, type, region, source, status, tags, rating,
            lng, lat, owner, note, ai, next_follow_at AS nextFollowAt,
            reminder_note AS reminderNote, created_at AS createdAt, updated_at AS updatedAt
     FROM customers ${whereClause}
     ORDER BY updated_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, ps, (pg - 1) * ps);

  let items = rows.map(deserializeCustomer);
  // 批量加载 followups
  if (items.length) {
    const fuMap = loadFollowupsForCustomers(items.map(c => c.id));
    items.forEach(c => { c.followups = fuMap[c.id] || []; });
  }

  return { items, total, page: pg, pageSize: ps, totalPages };
}

function createCustomer(data) {
  const db = getDB();
  const c = normalizeCustomer(data, true);
  const s = serializeCustomer(c);
  db.prepare(
    `INSERT INTO customers (id, name, phone, address, type, region, source, status, tags, rating,
                            lng, lat, owner, note, ai, next_follow_at, reminder_note, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(s.id, s.name, s.phone, s.address, s.type, s.region, s.source, s.status, s.tags, s.rating,
        s.lng, s.lat, s.owner, s.note, s.ai, s.next_follow_at, s.reminder_note, s.created_at, s.updated_at);
  // 写入 followups
  if (c.followups && c.followups.length) {
    const stmt = db.prepare('INSERT INTO customer_followups (customer_id, time, content, by) VALUES (?,?,?,?)');
    c.followups.forEach(f => stmt.run(c.id, f.time || Date.now(), f.content || '', f.by || '系统'));
  }
  return c;
}

function updateCustomer(id, data) {
  const db = getDB();
  const existing = getCustomerById(id);
  if (!existing) return null;
  const merged = normalizeCustomer(Object.assign({}, existing, data, { id }), false);
  const s = serializeCustomer(merged);
  db.prepare(
    `UPDATE customers SET name=?, phone=?, address=?, type=?, region=?, source=?, status=?, tags=?,
                          rating=?, lng=?, lat=?, owner=?, note=?, ai=?, next_follow_at=?,
                          reminder_note=?, updated_at=? WHERE id=?`
  ).run(s.name, s.phone, s.address, s.type, s.region, s.source, s.status, s.tags, s.rating,
        s.lng, s.lat, s.owner, s.note, s.ai, s.next_follow_at, s.reminder_note, s.updated_at, id);
  return merged;
}

function deleteCustomer(id) {
  const db = getDB();
  db.prepare('DELETE FROM customer_followups WHERE customer_id = ?').run(id);
  db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  return { ok: true };
}

function importCustomers(items) {
  const db = getDB();
  const arr = Array.isArray(items) ? items : (Array.isArray(items.items) ? items.items : []);
  const existingRows = db.prepare('SELECT name, phone FROM customers').all();
  const existing = new Set(existingRows.map(r => ((r.name || '') + '|' + (r.phone || '')).trim().toLowerCase()));
  let added = 0, skipped = 0;

  db.exec('BEGIN');
  try {
    const stmt = db.prepare(
      `INSERT INTO customers (id, name, phone, address, type, region, source, status, tags, rating,
                              lng, lat, owner, note, ai, next_follow_at, reminder_note, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    arr.forEach(it => {
      const c = normalizeCustomer(it, true);
      if (!c.name && !c.phone) { skipped++; return; }
      const k = custKey(c);
      if (existing.has(k)) { skipped++; return; }
      existing.add(k);
      const s = serializeCustomer(c);
      stmt.run(s.id, s.name, s.phone, s.address, s.type, s.region, s.source, s.status, s.tags, s.rating,
               s.lng, s.lat, s.owner, s.note, s.ai, s.next_follow_at, s.reminder_note, s.created_at, s.updated_at);
      added++;
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const total = db.prepare('SELECT COUNT(*) AS cnt FROM customers').get().cnt;
  return { added, skipped, total };
}

function getCustomerStats() {
  const db = getDB();
  const weekAgo = Date.now() - 7 * 86400000;
  const byStatus = {};
  const bySource = {};
  const byTag = {};

  const rows = db.prepare('SELECT status, source, tags, created_at FROM customers').all();
  let weekNew = 0;
  rows.forEach(r => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    safeParseArr(r.tags).forEach(t => byTag[t] = (byTag[t] || 0) + 1);
    if ((r.created_at || 0) >= weekAgo) weekNew++;
  });

  const highIntention = byTag['高意向'] || 0;
  const pending = (byStatus['新客'] || 0) + (byStatus['跟进中'] || 0);
  return { ok: true, total: rows.length, highIntention, pending, weekNew, byStatus, bySource, byTag };
}

function batchTagCustomers(ids, tag) {
  const db = getDB();
  let updated = 0;
  db.exec('BEGIN');
  try {
    const getStmt = db.prepare('SELECT tags FROM customers WHERE id = ?');
    const updStmt = db.prepare('UPDATE customers SET tags = ?, updated_at = ? WHERE id = ?');
    ids.forEach(id => {
      const row = getStmt.get(String(id));
      if (!row) return;
      const tags = safeParseArr(row.tags);
      if (!tags.includes(tag)) {
        tags.push(tag);
        updStmt.run(JSON.stringify(tags), Date.now(), String(id));
        updated++;
      }
    });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { ok: true, updated, tag };
}

function batchAssignCustomers(ids, owner) {
  const db = getDB();
  const placeholders = ids.map(() => '?').join(',');
  const now = Date.now();
  const result = db.prepare(
    `UPDATE customers SET owner = ?, updated_at = ? WHERE id IN (${placeholders})`
  ).run(owner, now, ...ids.map(String));
  return { ok: true, updated: result.changes, owner };
}

function setReminder(id, nextFollowAt, reminderNote) {
  const db = getDB();
  let ts = 0;
  if (nextFollowAt) {
    if (typeof nextFollowAt === 'number') ts = nextFollowAt;
    else { const t = new Date(String(nextFollowAt)).getTime(); ts = isNaN(t) ? 0 : t; }
  }
  db.prepare('UPDATE customers SET next_follow_at = ?, reminder_note = ?, updated_at = ? WHERE id = ?')
    .run(ts, String(reminderNote || '').trim(), Date.now(), id);
  return getCustomerById(id);
}

function addFollowup(id, content, by) {
  const db = getDB();
  const now = Date.now();
  db.prepare('INSERT INTO customer_followups (customer_id, time, content, by) VALUES (?,?,?,?)')
    .run(id, now, content, by || '系统');
  db.prepare('UPDATE customers SET updated_at = ? WHERE id = ?').run(now, id);
  return getCustomerById(id);
}

function dedupCustomers() {
  const db = getDB();
  const rows = db.prepare('SELECT id, name, phone FROM customers').all();
  const normPhone = p => String(p || '').replace(/[\s\-()（）]/g, '');
  const normName = n => String(n || '').trim().toLowerCase();
  const byPhone = {}, byName = {};
  rows.forEach(c => {
    const ph = normPhone(c.phone);
    const nm = normName(c.name);
    if (ph) (byPhone[ph] = byPhone[ph] || []).push(c);
    if (nm) (byName[nm] = byName[nm] || []).push(c);
  });
  const groups = [];
  const seen = new Set();
  const pushGroup = (key, field, members) => {
    const ids = members.map(c => c.id).sort();
    const sig = ids.join('|');
    if (members.length > 1 && !seen.has(sig)) { seen.add(sig); groups.push({ key, field, members }); }
  };
  Object.keys(byPhone).forEach(k => pushGroup('phone:' + k, 'phone', byPhone[k]));
  Object.keys(byName).forEach(k => pushGroup('name:' + k, 'name', byName[k]));
  const dupCount = groups.reduce((s, g) => s + g.members.length - 1, 0);
  return { ok: true, groups, dupCount };
}

function mergeCustomers(keepId, mergeIds) {
  const db = getDB();
  let keep = getCustomerById(keepId);
  if (!keep) throw new Error('保留客户不存在');
  const removed = [];

  db.exec('BEGIN');
  try {
    for (const mid of mergeIds) {
      const merge = getCustomerById(mid);
      if (!merge) continue;
      // 缺值补全
      const fill = (k) => {
        if (!keep[k] || keep[k] === '' || (Array.isArray(keep[k]) && keep[k].length === 0)) {
          if (merge[k]) keep[k] = merge[k];
        }
      };
      ['phone', 'address', 'type', 'region', 'source', 'status', 'owner', 'note', 'lng', 'lat', 'nextFollowAt', 'reminderNote'].forEach(fill);
      // 标签合并去重
      if ((!keep.tags || keep.tags.length === 0) && merge.tags) keep.tags = merge.tags.slice();
      else if (keep.tags && merge.tags) keep.tags = Array.from(new Set([...keep.tags, ...merge.tags]));
      // 跟进去重合并
      const fset = new Set((keep.followups || []).map(f => f.time + '|' + f.content));
      (merge.followups || []).forEach(f => {
        const s = f.time + '|' + f.content;
        if (!fset.has(s)) { fset.add(s); keep.followups.push(f); }
      });
      keep.followups.sort((a, b) => b.time - a.time);
      // AI 评分取更高
      const ks = (keep.ai && typeof keep.ai.score === 'number') ? keep.ai.score : 0;
      const ms = (merge.ai && typeof merge.ai.score === 'number') ? merge.ai.score : 0;
      if (ms > ks) keep.ai = merge.ai;
      // 删除被合并记录
      db.prepare('DELETE FROM customer_followups WHERE customer_id = ?').run(mid);
      db.prepare('DELETE FROM customers WHERE id = ?').run(mid);
      removed.push(mid);
    }
    // 更新 keep
    keep.updatedAt = Date.now();
    const s = serializeCustomer(keep);
    db.prepare(
      `UPDATE customers SET name=?, phone=?, address=?, type=?, region=?, source=?, status=?, tags=?,
                            rating=?, lng=?, lat=?, owner=?, note=?, ai=?, next_follow_at=?,
                            reminder_note=?, updated_at=? WHERE id=?`
    ).run(s.name, s.phone, s.address, s.type, s.region, s.source, s.status, s.tags, s.rating,
          s.lng, s.lat, s.owner, s.note, s.ai, s.next_follow_at, s.reminder_note, s.updated_at, keepId);
    // 重建 keep 的 followups
    db.prepare('DELETE FROM customer_followups WHERE customer_id = ?').run(keepId);
    const fuStmt = db.prepare('INSERT INTO customer_followups (customer_id, time, content, by) VALUES (?,?,?,?)');
    (keep.followups || []).forEach(f => fuStmt.run(keepId, f.time, f.content, f.by || '系统'));

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { ok: true, customer: keep, removedIds: removed };
}

function getTodos() {
  const db = getDB();
  const now = Date.now();
  const sod = new Date(); sod.setHours(0, 0, 0, 0);
  const eod = sod.getTime() + 86400000;

  const rows = db.prepare(
    `SELECT id, name, phone, status, source, rating, next_follow_at AS nextFollowAt, reminder_note AS reminderNote
     FROM customers WHERE next_follow_at > 0`
  ).all();

  const bins = { overdue: [], today: [], upcoming: [] };
  rows.forEach(c => {
    const item = { id: c.id, name: c.name, phone: c.phone, status: c.status, source: c.source,
                   rating: c.rating, nextFollowAt: c.nextFollowAt, reminderNote: c.reminderNote || '',
                   overdue: c.nextFollowAt < now };
    if (c.nextFollowAt < now) bins.overdue.push(item);
    else if (c.nextFollowAt < eod) bins.today.push(item);
    else bins.upcoming.push(item);
  });
  bins.overdue.sort((a, b) => a.nextFollowAt - b.nextFollowAt);
  bins.today.sort((a, b) => a.nextFollowAt - b.nextFollowAt);
  bins.upcoming.sort((a, b) => a.nextFollowAt - b.nextFollowAt);

  const total = bins.overdue.length + bins.today.length + bins.upcoming.length;
  return { ok: true, now, counts: { overdue: bins.overdue.length, today: bins.today.length, upcoming: bins.upcoming.length, total },
           overdue: bins.overdue, today: bins.today, upcoming: bins.upcoming };
}

function getDashboardData() {
  const db = getDB();
  const days = 30;
  const localDate = (ts) => { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
  const base = new Date(); base.setHours(0, 0, 0, 0);
  const idxMap = {}; const trend = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86400000);
    const key = localDate(d.getTime());
    idxMap[key] = 0; trend.push({ date: key, count: 0 });
  }

  const custRows = db.prepare('SELECT id, name, phone, status, source, tags, rating, created_at FROM customers').all();
  const byStatus = {}; const bySource = {}; const byTag = {};
  const levelDist = { '高': 0, '中': 0, '低': 0 };
  let weekNew = 0, monthNew = 0;
  const weekAgo = Date.now() - 7 * 86400000;
  const monthAgo = Date.now() - 30 * 86400000;

  custRows.forEach(c => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    bySource[c.source] = (bySource[c.source] || 0) + 1;
    const tags = safeParseArr(c.tags);
    tags.forEach(t => byTag[t] = (byTag[t] || 0) + 1);
    if (c.rating === '高' || tags.includes('高意向')) levelDist['高']++;
    else if (c.rating === '中') levelDist['中']++;
    else if (c.rating === '低') levelDist['低']++;
    if ((c.created_at || 0) >= weekAgo) weekNew++;
    if ((c.created_at || 0) >= monthAgo) monthNew++;
    const k = localDate(c.created_at || 0);
    if (k in idxMap) idxMap[k]++;
  });
  trend.forEach(t => t.count = idxMap[t.date]);

  const highIntention = levelDist['高'];
  const pending = (byStatus['新客'] || 0) + (byStatus['跟进中'] || 0);

  // 平台线索
  const leadRows = db.prepare('SELECT from_user, platform_name, level, source_type, created_at FROM platform_leads').all();
  const plByLevel = { '高': 0, '中': 0, '低': 0 };
  leadRows.forEach(l => { if (plByLevel[l.level] != null) plByLevel[l.level]++; });
  const recentLeads = leadRows.slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0)).slice(0, 5)
    .map(l => ({ fromUser: l.from_user, platform: l.platform_name, level: l.level, sourceType: l.source_type, createdAt: l.created_at }));

  const recentCustomers = custRows.slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0)).slice(0, 6)
    .map(c => ({ name: c.name, source: c.source, status: c.status, rating: c.rating, createdAt: c.created_at }));

  return { ok: true, total: custRows.length, highIntention, pending, weekNew, monthNew,
           trend, byStatus, bySource, byTag, levelDist,
           platformLeads: { total: leadRows.length, byLevel: plByLevel, recent: recentLeads },
           recentCustomers };
}

function exportCustomersRows(filters) {
  const { q, tag, source, status, region } = filters;
  const result = listCustomers({ q, tag, source, status, region, page: 1, pageSize: 100000 });
  const fmt = (t) => (t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '');
  return result.items.map(c => {
    const ai = c.ai || {};
    const f = (c.followups || []);
    const last = f.length ? f[f.length - 1] : null;
    return {
      name: c.name || '', phone: c.phone || '', source: c.source || '', status: c.status || '',
      tags: (c.tags || []).join('、'), owner: c.owner || '',
      aiScore: (ai.score != null ? ai.score : ''), aiLevel: ai.level || '',
      region: c.region || '', type: c.type || '', address: c.address || '', note: c.note || '',
      followupLast: last ? (fmt(last.time) + ' ' + (last.content || '').replace(/\s+/g, ' ').slice(0, 60)) : '',
      nextFollowAt: c.nextFollowAt ? fmt(c.nextFollowAt) : '',
      createdAt: fmt(c.createdAt), updatedAt: fmt(c.updatedAt)
    };
  });
}

// ============================================================
//  Template 数据访问
// ============================================================
function listTemplates() {
  const db = getDB();
  const rows = db.prepare('SELECT id, title, content, category, created_at AS createdAt FROM templates ORDER BY rowid DESC').all();
  return rows;
}
function createTemplate(data) {
  const db = getDB();
  const t = { id: genTemplateId(), title: String(data.title || '').trim(), content: String(data.content || '').trim(),
              category: String(data.category || '通用').trim(), createdAt: Date.now() };
  db.prepare('INSERT INTO templates (id, title, content, category, created_at) VALUES (?,?,?,?,?)')
    .run(t.id, t.title, t.content, t.category, t.createdAt);
  return t;
}
function updateTemplate(id, data) {
  const db = getDB();
  const row = db.prepare('SELECT id FROM templates WHERE id = ?').get(id);
  if (!row) return null;
  const updates = [];
  const params = [];
  if (data.title !== undefined) { updates.push('title = ?'); params.push(String(data.title || '').trim()); }
  if (data.content !== undefined) { updates.push('content = ?'); params.push(String(data.content || '').trim()); }
  if (data.category !== undefined) { updates.push('category = ?'); params.push(String(data.category || '通用').trim()); }
  if (!updates.length) return db.prepare('SELECT id, title, content, category, created_at AS createdAt FROM templates WHERE id = ?').get(id);
  params.push(id);
  db.prepare(`UPDATE templates SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return db.prepare('SELECT id, title, content, category, created_at AS createdAt FROM templates WHERE id = ?').get(id);
}
function deleteTemplate(id) {
  const db = getDB();
  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  return { ok: true };
}

// ============================================================
//  AI History 数据访问 (替代 store.json)
// ============================================================
const AI_CATEGORIES = ['keyword', 'legal', 'script', 'zhinao', 'chuangzuo'];
const AI_MAX_PER_CAT = 200;

function pushAIHistory(category, item) {
  const db = getDB();
  db.prepare('INSERT INTO ai_history (category, data, created_at) VALUES (?,?,?)')
    .run(category, JSON.stringify(item), Date.now());
  // 超出上限删除旧记录
  const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM ai_history WHERE category = ?').get(category).cnt;
  if (cnt > AI_MAX_PER_CAT) {
    db.prepare(`DELETE FROM ai_history WHERE category = ? AND id NOT IN (
      SELECT id FROM ai_history WHERE category = ? ORDER BY created_at DESC LIMIT ?
    )`).run(category, category, AI_MAX_PER_CAT);
  }
}
function getAIHistory() {
  const db = getDB();
  const store = {};
  AI_CATEGORIES.forEach(c => store[c] = []);
  const rows = db.prepare('SELECT category, data FROM ai_history ORDER BY created_at DESC').all();
  rows.forEach(r => {
    if (!store[r.category]) store[r.category] = [];
    try { store[r.category].push(JSON.parse(r.data)); } catch (e) {}
  });
  const summary = {};
  Object.keys(store).forEach(k => summary[k] = store[k].length);
  return { summary, store };
}
function listAIHistory(limit = 200) {
  const db = getDB();
  const rows = db.prepare('SELECT category, data, created_at FROM ai_history ORDER BY created_at DESC LIMIT ?').all(limit || 200);
  return rows.map(r => ({ category: r.category, data: JSON.parse(r.data), createdAt: r.created_at }));
}

// ============================================================
//  Platform 数据访问 (替代 platform_leads.json + platform_tokens.json)
// ============================================================
function listPlatformLeads() {
  const db = getDB();
  const rows = db.prepare(
    `SELECT id, platform, platform_name AS platformName, from_user AS fromUser, source_type AS sourceType,
            content, contact, level, reason, tags, status, added, created_at AS createdAt
     FROM platform_leads ORDER BY created_at DESC`
  ).all();
  return rows.map(r => ({ ...r, tags: safeParseArr(r.tags) }));
}
function addPlatformLead(lead) {
  const db = getDB();
  db.prepare(
    `INSERT INTO platform_leads (id, platform, platform_name, from_user, source_type, content, contact,
                                  level, reason, tags, status, added, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(lead.id, lead.platform || '', lead.platformName || '', lead.fromUser || '', lead.sourceType || '私信',
        lead.content || '', lead.contact || '', lead.level || '中', lead.reason || '',
        JSON.stringify(lead.tags || []), lead.status || '待筛选', lead.added ? 1 : 0, lead.createdAt || Date.now());
  return lead;
}
function updatePlatformLead(id, updates) {
  const db = getDB();
  const lead = db.prepare('SELECT id, platform, platform_name, from_user, source_type, content, contact, level, reason, tags, status, added, created_at FROM platform_leads WHERE id = ?').get(id);
  if (!lead) return null;
  const merged = Object.assign({}, lead, updates);
  db.prepare(
    `UPDATE platform_leads SET status = ?, added = ?, tags = ? WHERE id = ?`
  ).run(merged.status, merged.added ? 1 : 0, JSON.stringify(safeParseArr(merged.tags) || []), id);
  return listPlatformLeads().find(l => l.id === id);
}
function getPlatformTokens() {
  const db = getDB();
  const rows = db.prepare('SELECT platform, access_token, refresh_token, expires_in, connected_at FROM platform_tokens').all();
  const tokens = {};
  rows.forEach(r => {
    tokens[r.platform] = { accessToken: r.access_token, refreshToken: r.refresh_token, expiresIn: r.expires_in, connectedAt: r.connected_at };
  });
  return tokens;
}
function savePlatformTokens(tokens) {
  const db = getDB();
  db.exec('BEGIN');
  try {
    Object.keys(tokens || {}).forEach(platform => {
      const t = tokens[platform];
      db.prepare(
        `INSERT INTO platform_tokens (platform, access_token, refresh_token, expires_in, connected_at)
         VALUES (?,?,?,?,?)
         ON CONFLICT(platform) DO UPDATE SET access_token=excluded.access_token,
           refresh_token=excluded.refresh_token, expires_in=excluded.expires_in,
           connected_at=excluded.connected_at`
      ).run(platform, t.accessToken || '', t.refreshToken || '', t.expiresIn || 0, t.connectedAt || Date.now());
    });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// ============================================================
//  初始化 + 自动迁移 (从 JSON → SQLite)
// ============================================================
function initDB() {
  const db = getDB();
  db.exec(SCHEMA);

  // ---- 迁移 customers.json ----
  const custFile = path.join(DATA_DIR, 'customers.json');
  if (fs.existsSync(custFile)) {
    try {
      const arr = JSON.parse(fs.readFileSync(custFile, 'utf8'));
      if (Array.isArray(arr) && arr.length > 0) {
        const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM customers').get().cnt;
        if (cnt === 0) {
          console.log('[DB] 迁移 customers.json → SQLite (' + arr.length + ' 条)...');
          db.exec('BEGIN');
          try {
            const cStmt = db.prepare(
              `INSERT INTO customers (id, name, phone, address, type, region, source, status, tags, rating,
                                      lng, lat, owner, note, ai, next_follow_at, reminder_note, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
            );
            const fStmt = db.prepare('INSERT INTO customer_followups (customer_id, time, content, by) VALUES (?,?,?,?)');
            arr.forEach(c => {
              const s = serializeCustomer(normalizeCustomer(c, false));
              cStmt.run(s.id, s.name, s.phone, s.address, s.type, s.region, s.source, s.status, s.tags, s.rating,
                        s.lng, s.lat, s.owner, s.note, s.ai, s.next_follow_at, s.reminder_note, s.created_at, s.updated_at);
              (c.followups || []).forEach(f => fStmt.run(s.id, f.time || Date.now(), f.content || '', f.by || '系统'));
            });
            db.exec('COMMIT');
            fs.renameSync(custFile, custFile + '.bak');
            console.log('[DB] customers 迁移完成, JSON 已备份为 .bak');
          } catch (e) { db.exec('ROLLBACK'); console.error('[DB] customers 迁移失败:', e.message); }
        }
      }
    } catch (e) { /* 文件损坏, 忽略 */ }
  }

  // ---- 迁移 templates.json ----
  const tplFile = path.join(DATA_DIR, 'templates.json');
  if (fs.existsSync(tplFile)) {
    try {
      const arr = JSON.parse(fs.readFileSync(tplFile, 'utf8'));
      if (Array.isArray(arr) && arr.length > 0) {
        const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM templates').get().cnt;
        if (cnt === 0) {
          console.log('[DB] 迁移 templates.json → SQLite (' + arr.length + ' 条)...');
          const stmt = db.prepare('INSERT INTO templates (id, title, content, category, created_at) VALUES (?,?,?,?,?)');
          arr.forEach(t => stmt.run(t.id || genTemplateId(), t.title || '', t.content || '', t.category || '通用', t.createdAt || Date.now()));
          fs.renameSync(tplFile, tplFile + '.bak');
          console.log('[DB] templates 迁移完成');
        }
      }
    } catch (e) {}
  }

  // ---- 迁移 store.json ----
  const storeFile = path.join(DATA_DIR, 'store.json');
  if (fs.existsSync(storeFile)) {
    try {
      const store = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
      const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM ai_history').get().cnt;
      if (cnt === 0) {
        let total = 0;
        AI_CATEGORIES.forEach(cat => {
          if (Array.isArray(store[cat])) {
            total += store[cat].length;
            store[cat].forEach(item => pushAIHistory(cat, item));
          }
        });
        if (total > 0) {
          console.log('[DB] 迁移 store.json → SQLite (' + total + ' 条)...');
          fs.renameSync(storeFile, storeFile + '.bak');
          console.log('[DB] ai_history 迁移完成');
        }
      }
    } catch (e) {}
  }

  // ---- 迁移 platform_leads.json ----
  const leadFile = path.join(DATA_DIR, 'platform_leads.json');
  if (fs.existsSync(leadFile)) {
    try {
      const arr = JSON.parse(fs.readFileSync(leadFile, 'utf8'));
      if (Array.isArray(arr) && arr.length > 0) {
        const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM platform_leads').get().cnt;
        if (cnt === 0) {
          console.log('[DB] 迁移 platform_leads.json → SQLite (' + arr.length + ' 条)...');
          const stmt = db.prepare(
            `INSERT INTO platform_leads (id, platform, platform_name, from_user, source_type, content, contact,
                                          level, reason, tags, status, added, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
          );
          arr.forEach(l => stmt.run(l.id, l.platform || '', l.platformName || '', l.fromUser || '', l.sourceType || '私信',
            l.content || '', l.contact || '', l.level || '中', l.reason || '', JSON.stringify(l.tags || []),
            l.status || '待筛选', l.added ? 1 : 0, l.createdAt || Date.now()));
          fs.renameSync(leadFile, leadFile + '.bak');
          console.log('[DB] platform_leads 迁移完成');
        }
      }
    } catch (e) {}
  }

  // ---- 迁移 platform_tokens.json ----
  const tokenFile = path.join(DATA_DIR, 'platform_tokens.json');
  if (fs.existsSync(tokenFile)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      if (tokens && Object.keys(tokens).length > 0) {
        const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM platform_tokens').get().cnt;
        if (cnt === 0) {
          console.log('[DB] 迁移 platform_tokens.json → SQLite...');
          savePlatformTokens(tokens);
          fs.renameSync(tokenFile, tokenFile + '.bak');
          console.log('[DB] platform_tokens 迁移完成');
        }
      }
    } catch (e) {}
  }

  // ---- 预置模板（首次使用）----
  const tplCnt = db.prepare('SELECT COUNT(*) AS cnt FROM templates').get().cnt;
  if (tplCnt === 0) {
    seedDefaultTemplates();
    console.log('[DB] 预置 ' + DEFAULT_TEMPLATES.length + ' 条话术模板');
  }

  ensureDefaultUsers();
  console.log('[DB] 初始化完成:', DB_PATH);
}

module.exports = {
  initDB,
  getDB,
  // Customer
  normalizeCustomer,
  genCustId,
  custKey,
  getCustomerById,
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  importCustomers,
  getCustomerStats,
  batchTagCustomers,
  batchAssignCustomers,
  setReminder,
  addFollowup,
  dedupCustomers,
  mergeCustomers,
  getTodos,
  getDashboardData,
  exportCustomersRows,
  // Template
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  // AI History
  pushAIHistory,
  getAIHistory,
  listAIHistory,
  // Auth & users
  listUsers,
  getUserByUsername,
  getUserById,
  upsertUser,
  ensureDefaultUsers,
  hashPassword,
  isPasswordHashed,
  verifyPassword,
  migratePlaintextPasswords,
  upgradePasswordIfNeeded,
  // Maintenance
  resetAllData,
  // Platform
  listPlatformLeads,
  addPlatformLead,
  updatePlatformLead,
  getPlatformTokens,
  savePlatformTokens
};
