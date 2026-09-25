/* ============================================================
   AI超级员工 - 主应用逻辑
   路由 / 交互 / 模拟数据 / 实时动态
   ============================================================ */

// ========== 路由与导航 ==========
function navigateTo(pageId) {
    // 切换页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if (target) target.classList.add('active');

    // 更新侧边栏激活状态
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (activeNav) activeNav.classList.add('active');

    // 页面特定初始化
    initPageData(pageId);
}

// 侧边栏导航点击
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(item.dataset.page);
    });
});

// 子标签页切换（通用）
document.querySelectorAll('.sub-tabs .sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const parent = tab.closest('.page') || tab.closest('.sub-tabs').parentElement;
        const tabGroup = tab.parentElement;
        tabGroup.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const panelId = 'subtab-' + tab.dataset.subtab;
        parent.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.add('active');
    });
});

// AI销冠标签切换
document.querySelectorAll('.xiaoguan-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        tab.parentElement.querySelectorAll('.xiaoguan-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.xiaoguan-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById('xiaoguan-' + tab.dataset.xiaoguan);
        if (panel) panel.classList.add('active');
    });
});

// 法务标签切换
document.querySelectorAll('.falv-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        tab.parentElement.querySelectorAll('.falv-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.falv-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById('falv-' + tab.dataset.falv);
        if (panel) panel.classList.add('active');
    });
});

// AI客服平台切换
document.querySelectorAll('.kefu-platform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.parentElement.querySelectorAll('.kefu-platform-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// 话术分类切换
document.querySelectorAll('.script-cat').forEach(cat => {
    cat.addEventListener('click', () => {
        cat.parentElement.querySelectorAll('.script-cat').forEach(c => c.classList.remove('active'));
        cat.classList.add('active');
        loadScriptList(cat.textContent.trim());
    });
});

// 监控面板Tab切换
document.querySelectorAll('.monitor-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        tab.parentElement.querySelectorAll('.monitor-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    });
});

// 地图范围滑块
const mapRangeInput = document.getElementById('mapRange');
const mapRangeValue = document.getElementById('mapRangeValue');
if (mapRangeInput && mapRangeValue) {
    mapRangeInput.addEventListener('input', () => {
        mapRangeValue.textContent = mapRangeInput.value + ' km';
    });
}

// 通知弹窗
document.getElementById('notificationBtn')?.addEventListener('click', () => {
    document.getElementById('notificationModal').style.display = 'flex';
});
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ========== 模拟数据生成器 ==========
const SURNAMES = ['张','王','李','刘','陈','杨','赵','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗'];
const NAMES = ['伟','芳','娜','秀英','敏','静','丽','强','磊','军','洋','勇','艳','杰','娟','涛','明','超','秀兰','霞'];
const CITIES = ['北京','上海','广州','深圳','杭州','成都','武汉','南京','西安','重庆','天津','苏州'];
const DOUYIN_COMMENTS = [
    '老板这款车多少钱？', '还有现车吗？', '能优惠多少？', '支持分期吗？',
    '这车油耗怎么样？', '有试驾车吗？', '什么时候可以提车？', '售后怎么样？',
    '看了好几家了，你们家价格实在吗？', '想周末过来看看，在哪儿？', '这个颜色好看！',
    '对比了XX车型，感觉还是这个好', '贷款首付要多少？', '置换有补贴吗？',
    '车况保证吗？', '保养贵不贵？', '保险怎么买？', '送什么赠品？',
    '能不能便宜点？最低多少？', '全款有什么优惠？'
];
const XHS_COMMENTS = [
    '求推荐！想买二手车不知道选哪个好', '姐妹们这款真的好用吗？',
    '已入手！体验很好分享给大家~', '请问在哪里可以买到？',
    '价格美丽，种草了', '有人买过吗？靠谱吗？', '收藏了，回头看看',
    '博主能出个详细测评吗？', '这个价位还有什么推荐的吗？'
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function _escHtml(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function randPhone() { return `1${randInt(3,9)}${String(randInt(10000000,99999999))}`; }
function timeAgo(minutes) {
    if (minutes < 60) return minutes + '分钟前';
    if (minutes < 1440) return Math.floor(minutes/60) + '小时前';
    return Math.floor(minutes/1440) + '天前';
}
function fmtDate(offsetDays, offsetHours) {
    const d = new Date();
    d.setDate(d.getDate() - (offsetDays||0));
    d.setHours(d.getHours() - (offsetHours||0));
    return d.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}

function generateName() { return rand(SURNAMES) + rand(NAMES) + (Math.random()>0.5 ? rand(['先生','女士']) : ''); }

// ========== 页面数据初始化 ==========
function initPageData(pageId) {
    switch(pageId) {
        case 'dashboard': initDashboard(); break;
        case 'gongyu-tuoke': initGongyuTuoke(); break;
        case 'gongzhuan-si': initGongzhuanSi(); break;
        case 'ai-xiaoguan': initAiXiaoguan(); break;
        case 'ai-renshi': initAiRenshi(); break;
        case 'ai-kefu': initAiKefu(); break;
        case 'falv-zhuanyuan': initFalv(); break;
        case 'qiye-zhinao': initQiyeZhinao(); break;
        case 'ai-chuangzuo': initAiChuangzuo(); break;
        case 'kehu-guanli': initKehuGuanli(); break;
        case 'genjin-tixing': initGenjinTixing(); break;
        case 'kanban': initKanban(); break;
        case 'sixin-huoqu': initSixinHuoqu(); break;
        case 'huashu': initHuashu(); break;
        case 'platform': initPlatform(); break;
        case 'settings': /* already populated */ break;
    }
}

// ================= 客户管理 =================
let custPage = 1;
let custPageSize = 20;
let custLoading = false;

function initKehuGuanli() {
  loadCustomers();
}

function custApi(path, opts) {
  return fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts))
    .then(r => r.json());
}

function getCustFilters() {
  return {
    q: (document.getElementById('custSearch').value || '').trim(),
    status: document.getElementById('custFilterStatus').value || '',
    source: document.getElementById('custFilterSource').value || '',
    tag: document.getElementById('custFilterTag').value || ''
  };
}

async function loadCustomers(page) {
  if (custLoading) return;
  if (page) custPage = page;
  custLoading = true;
  const f = getCustFilters();
  const params = new URLSearchParams({
    q: f.q, status: f.status, source: f.source, tag: f.tag,
    page: custPage, pageSize: custPageSize
  });
  try {
    const data = await custApi('/api/customers?' + params.toString());
    if (data.error) { mapToast('客户接口：' + data.error, 'error'); return; }
    renderCustomers(data.items || []);
    renderCustPagination(data);
    await loadCustStats();
  } catch (e) {
    mapToast('加载客户失败：' + e.message, 'error');
  } finally {
    custLoading = false;
  }
}

function statusBadgeClass(s) {
  return { '新客': 'tag-blue', '跟进中': 'tag-orange', '已成交': 'tag-green', '已流失': 'tag-gray' }[s] || 'tag-gray';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderCustomers(list) {
  const body = document.getElementById('custBody');
  if (!body) return;
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无客户数据，点击右上角「新增客户」或先从地图获客导入</td></tr>';
    return;
  }
  body.innerHTML = list.map(c => `
    <tr>
      <td><input type="checkbox" class="cust-row-check" data-id="${c.id}" onchange="onCustCheckChange()"></td>
      <td class="cust-name">${esc(c.name || '—')}</td>
      <td>${esc(c.phone || '—')}</td>
      <td>${esc(c.region || '—')}</td>
      <td>${esc(c.type || '—')}</td>
      <td>${(c.tags || []).map(t => `<span class="tag-chip">${esc(t)}</span>`).join('') || '—'}</td>
      <td>${esc(c.source || '—')}</td>
      <td><span class="tag-badge ${statusBadgeClass(c.status)}">${esc(c.status)}</span>${c.ai && c.ai.score != null ? ` <span class="ai-score-chip" title="AI评分">AI ${c.ai.score}</span>` : ''}</td>
      <td class="row-actions">
        <button class="btn btn-xs btn-outline" onclick="viewCust('${c.id}')" title="详情"><i class="fas fa-eye"></i></button>
        <button class="btn btn-xs btn-ai" onclick="analyzeFromRow('${c.id}')" title="AI 分析"><i class="fas fa-brain"></i></button>
        <button class="btn btn-xs btn-outline" onclick="editCust('${c.id}')" title="编辑"><i class="fas fa-edit"></i></button>
        <button class="btn btn-xs btn-danger" onclick="deleteCust('${c.id}')" title="删除"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('');
}

function renderCustPagination(data) {
  const el = document.getElementById('custPagination');
  if (!el) return;
  const total = data.total || 0;
  const totalPages = data.totalPages || 1;
  if (total === 0) { el.innerHTML = ''; return; }
  let html = `<span class="page-info">共 ${total} 条 · 第 ${custPage}/${totalPages} 页</span>`;
  html += `<button class="page-btn" ${custPage <= 1 ? 'disabled' : ''} onclick="loadCustomers(${custPage - 1})">上一页</button>`;
  html += `<button class="page-btn" ${custPage >= totalPages ? 'disabled' : ''} onclick="loadCustomers(${custPage + 1})">下一页</button>`;
  el.innerHTML = html;
}

// ---------- 客户列表批量勾选 + 批量操作 ----------
function getCheckedCustIds() {
  return Array.from(document.querySelectorAll('.cust-row-check:checked')).map(cb => cb.dataset.id);
}
function toggleCustSelectAll(box) {
  document.querySelectorAll('.cust-row-check').forEach(cb => { cb.checked = box.checked; });
  onCustCheckChange();
}
function onCustCheckChange() {
  const all = document.querySelectorAll('.cust-row-check');
  const checked = document.querySelectorAll('.cust-row-check:checked');
  const head = document.getElementById('custSelectAll');
  if (head) {
    head.checked = all.length > 0 && checked.length === all.length;
    head.indeterminate = checked.length > 0 && checked.length < all.length;
  }
  const bar = document.getElementById('custBatchBar');
  const cnt = document.getElementById('custSelCount');
  if (bar) bar.style.display = checked.length > 0 ? 'flex' : 'none';
  if (cnt) cnt.textContent = '已选 ' + checked.length + ' 项';
}
function clearCustSelection() {
  document.querySelectorAll('.cust-row-check').forEach(cb => { cb.checked = false; });
  onCustCheckChange();
}
async function batchTag() {
  const ids = getCheckedCustIds();
  if (!ids.length) { mapToast('请先勾选客户', 'warn'); return; }
  const tag = (document.getElementById('batchTagInput').value || '').trim();
  if (!tag) { mapToast('请输入标签内容', 'warn'); return; }
  try {
    const data = await custApi('/api/customers/batch-tag', { method: 'POST', body: JSON.stringify({ ids, tag }) });
    if (data.error) { mapToast('批量打标签失败：' + data.error, 'error'); return; }
    mapToast('已为 ' + data.updated + ' 位客户打上「' + tag + '」', 'success');
    document.getElementById('batchTagInput').value = '';
    loadCustomers(custPage);
  } catch (e) { mapToast('批量打标签失败：' + e.message, 'error'); }
}
async function batchAssign() {
  const ids = getCheckedCustIds();
  if (!ids.length) { mapToast('请先勾选客户', 'warn'); return; }
  const owner = (document.getElementById('batchOwnerInput').value || '').trim();
  if (!owner) { mapToast('请输入归属销售姓名', 'warn'); return; }
  try {
    const data = await custApi('/api/customers/batch-assign', { method: 'POST', body: JSON.stringify({ ids, owner }) });
    if (data.error) { mapToast('批量分配失败：' + data.error, 'error'); return; }
    mapToast('已分配 ' + data.updated + ' 位客户给「' + owner + '」', 'success');
    document.getElementById('batchOwnerInput').value = '';
    loadCustomers(custPage);
  } catch (e) { mapToast('批量分配失败：' + e.message, 'error'); }
}

// ---------- AI 智能分析线索 ----------
let _analyzingId = null;
let _lastAiAnalysis = null;
async function analyzeFromRow(id) {
  await viewCust(id);
  analyzeCust(id);
}
async function analyzeCust(id) {
  const box = document.getElementById('aiAnalyzeBox');
  if (box) box.remove();
  _analyzingId = id;
  _lastAiAnalysis = null;
  const drawerBody = document.getElementById('drawerBody');
  if (!drawerBody) { mapToast('请先打开客户详情', 'warn'); return; }
  const holder = document.createElement('div');
  holder.id = 'aiAnalyzeBox';
  holder.className = 'ai-analyze-box loading';
  holder.innerHTML = '<div class="ai-analyze-head"><i class="fas fa-spinner fa-spin"></i> AI 正在分析该客户…</div>';
  drawerBody.appendChild(holder);
  try {
    const data = await custApi('/api/customers/analyze', { method: 'POST', body: JSON.stringify({ id }) });
    if (data.error) { holder.innerHTML = '<div class="ai-analyze-head err">分析失败：' + esc(data.error) + '</div>'; return; }
    const a = data.analysis;
    _lastAiAnalysis = a;
    const lvClass = { '高': 'tag-green', '中': 'tag-orange', '低': 'tag-gray' }[a.level] || 'tag-gray';
    holder.className = 'ai-analyze-box';
    holder.innerHTML = `
      <div class="ai-analyze-head"><i class="fas fa-brain"></i> AI 意向分析
        <span class="ai-score">${a.score}<small>分</small></span>
        <span class="tag-badge ${lvClass}">${a.level}意向</span>
      </div>
      <div class="ai-reason"><b>分析理由：</b>${esc(a.reason || '—')}</div>
      <div class="ai-block">
        <div class="ai-block-title"><i class="fas fa-comment-dots"></i> 跟进话术（微信/短信）</div>
        <pre class="ai-text">${esc(a.followupScript || '—')}</pre>
        <button class="btn btn-xs btn-outline" onclick="copyAiText(this)"><i class="fas fa-copy"></i> 复制</button>
      </div>
      <div class="ai-block">
        <div class="ai-block-title"><i class="fas fa-phone-volume"></i> 电话外呼脚本</div>
        <pre class="ai-text">${esc(a.callScript || '—')}</pre>
        <button class="btn btn-xs btn-outline" onclick="copyAiText(this)"><i class="fas fa-copy"></i> 复制</button>
      </div>
      <div class="ai-actions">
        <button class="btn btn-sm btn-primary" onclick="applyAiAnalysis('${id}')"><i class="fas fa-check"></i> 应用到客户</button>
      </div>`;
  } catch (e) {
    holder.innerHTML = '<div class="ai-analyze-head err">分析失败：' + esc(e.message) + '</div>';
  }
}
function copyAiText(btn) {
  const block = btn.closest('.ai-block');
  const text = block ? (block.querySelector('.ai-text') || {}).textContent || '' : '';
  copyText(text);
}
async function applyAiAnalysis(id) {
  const a = _lastAiAnalysis;
  if (!a) { mapToast('请先进行分析', 'warn'); return; }
  const ai = { score: a.score, level: a.level, reason: a.reason, followupScript: a.followupScript, callScript: a.callScript, analyzedAt: Date.now() };
  try {
    const data = await custApi('/api/customers/' + id, { method: 'PUT', body: JSON.stringify({ ai, rating: a.level === '高' ? '高' : (a.level === '低' ? '低' : '') }) });
    if (data.error) { mapToast('应用失败：' + data.error, 'error'); return; }
    mapToast('AI 分析已应用（评分 ' + a.score + ' / ' + a.level + '意向）', 'success');
    viewCust(id);
  } catch (e) { mapToast('应用失败：' + e.message, 'error'); }
}
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => mapToast('已复制', 'success')).catch(() => fallbackCopy(text));
  } else fallbackCopy(text);
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); mapToast('已复制', 'success'); } catch (e) { mapToast('复制失败', 'error'); }
  document.body.removeChild(ta);
}

async function loadCustStats() {
  try {
    const s = await custApi('/api/customers/stats');
    if (s.error) return;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('custTotal', s.total || 0);
    set('custHigh', s.highIntention || 0);
    set('custPending', s.pending || 0);
    set('custWeek', s.weekNew || 0);
  } catch (e) { /* ignore */ }
}

let custSearchTimer = null;
function custSearchDebounce() {
  clearTimeout(custSearchTimer);
  custSearchTimer = setTimeout(() => { custPage = 1; loadCustomers(1); }, 350);
}

// ---------- 新增 / 编辑 ----------
function openCustModal(cust) {
  cust = cust || {};
  document.getElementById('custModalTitle').textContent = cust.id ? '编辑客户' : '新增客户';
  document.getElementById('custId').value = cust.id || '';
  document.getElementById('custName').value = cust.name || '';
  document.getElementById('custPhone').value = cust.phone || '';
  document.getElementById('custRegion').value = cust.region || '';
  document.getElementById('custType').value = cust.type || '';
  document.getElementById('custAddress').value = cust.address || '';
  document.getElementById('custSource').value = cust.source || '手动添加';
  document.getElementById('custStatus').value = cust.status || '新客';
  document.getElementById('custTags').value = (cust.tags || []).join(', ');
  document.getElementById('custOwner').value = cust.owner || '';
  document.getElementById('custNote').value = cust.note || '';
  document.getElementById('custModal').style.display = 'flex';
}

function closeCustModal() {
  document.getElementById('custModal').style.display = 'none';
}

async function saveCust() {
  const id = document.getElementById('custId').value;
  const payload = {
    name: document.getElementById('custName').value.trim(),
    phone: document.getElementById('custPhone').value.trim(),
    region: document.getElementById('custRegion').value.trim(),
    type: document.getElementById('custType').value.trim(),
    address: document.getElementById('custAddress').value.trim(),
    source: document.getElementById('custSource').value,
    status: document.getElementById('custStatus').value,
    tags: document.getElementById('custTags').value.split(',').map(t => t.trim()).filter(Boolean),
    owner: document.getElementById('custOwner').value.trim(),
    note: document.getElementById('custNote').value.trim()
  };
  if (!payload.name && !payload.phone) { mapToast('请至少填写客户名称或电话', 'warn'); return; }
  try {
    const data = id
      ? await custApi('/api/customers/' + id, { method: 'PUT', body: JSON.stringify(payload) })
      : await custApi('/api/customers', { method: 'POST', body: JSON.stringify(payload) });
    if (data.error) { mapToast('保存失败：' + data.error, 'error'); return; }
    mapToast(id ? '客户已更新' : '客户已添加', 'success');
    closeCustModal();
    loadCustomers(custPage);
  } catch (e) { mapToast('保存失败：' + e.message, 'error'); }
}

async function editCust(id) {
  try {
    const data = await custApi('/api/customers/' + id);
    if (data.error) { mapToast('读取失败：' + data.error, 'error'); return; }
    openCustModal(data.customer);
  } catch (e) { mapToast('读取失败：' + e.message, 'error'); }
}

async function deleteCust(id) {
  const ok = await showConfirm('确定删除该客户？此操作不可撤销。', '删除客户');
  if (!ok) return;
  try {
    const data = await custApi('/api/customers/' + id, { method: 'DELETE' });
    if (data.error) { mapToast('删除失败：' + data.error, 'error'); return; }
    mapToast('客户已删除', 'success');
    loadCustomers(custPage);
  } catch (e) { mapToast('删除失败：' + e.message, 'error'); }
}

// ---------- 详情抽屉 + 跟进记录 ----------
async function viewCust(id) {
  try {
    const data = await custApi('/api/customers/' + id);
    if (data.error) { mapToast('读取失败：' + data.error, 'error'); return; }
    const c = data.customer;
    document.getElementById('drawerName').textContent = c.name || '客户详情';
    const tags = (c.tags || []).map(t => `<span class="tag-chip">${esc(t)}</span>`).join(' ') || '—';
    const followups = (c.followups || []).map(f => `
      <div class="followup-item">
        <div class="followup-meta"><span>${esc(f.by || '系统')}</span><span>${new Date(f.time).toLocaleString('zh-CN')}</span></div>
        <div class="followup-content">${esc(f.content)}</div>
      </div>`).join('') || '<div class="empty-cell">暂无跟进记录</div>';
    document.getElementById('drawerBody').innerHTML = `
      <div class="drawer-fields">
        <div class="df"><label>电话</label><span>${esc(c.phone || '—')}</span></div>
        <div class="df"><label>地区</label><span>${esc(c.region || '—')}</span></div>
        <div class="df"><label>行业/类型</label><span>${esc(c.type || '—')}</span></div>
        <div class="df"><label>地址</label><span>${esc(c.address || '—')}</span></div>
        <div class="df"><label>来源</label><span>${esc(c.source || '—')}</span></div>
        <div class="df"><label>状态</label><span class="tag-badge ${statusBadgeClass(c.status)}">${esc(c.status)}</span></div>
        <div class="df"><label>标签</label><span>${tags}</span></div>
        <div class="df"><label>归属销售</label><span>${esc(c.owner || '—')}</span></div>
        <div class="df"><label>备注</label><span>${esc(c.note || '—')}</span></div>
      </div>
      <hr>
      <h4><i class="fas fa-comments"></i> 跟进记录</h4>
      <div class="followup-form">
        <textarea id="followupInput" rows="2" placeholder="记录本次跟进内容…"></textarea>
        <button class="btn btn-sm btn-primary" onclick="addFollowup('${c.id}')"><i class="fas fa-paper-plane"></i> 添加跟进</button>
      </div>
      <div class="followup-list">${followups}</div>
      <hr>
      <h4><i class="fas fa-bell"></i> 跟进提醒</h4>
      <div class="reminder-form">
        <div class="reminder-row">
          <label>下次跟进时间</label>
          <input type="datetime-local" id="reminderTime" class="input-sm" value="${localInputValue(c.nextFollowAt)}">
        </div>
        <div class="reminder-row">
          <label>提醒备注</label>
          <input type="text" id="reminderNote" class="input-sm" placeholder="如：确认到店时间 / 发报价单" value="${esc(c.reminderNote || '')}">
        </div>
        <div class="reminder-actions">
          <button class="btn btn-sm btn-primary" onclick="saveReminder('${c.id}')"><i class="fas fa-save"></i> 保存提醒</button>
          ${c.nextFollowAt ? `<button class="btn btn-sm btn-outline" onclick="clearReminder('${c.id}')"><i class="fas fa-bell-slash"></i> 清除</button><span class="reminder-current">当前：${fmtDateTime(c.nextFollowAt)}（${fmtRemain(c.nextFollowAt, Date.now())}）</span>` : '<span class="reminder-current muted">未设置提醒</span>'}
        </div>
      </div>
      <hr>
      <div class="drawer-actions">
        <button class="btn btn-ai" onclick="analyzeCust('${c.id}')"><i class="fas fa-brain"></i> AI 分析</button>
        <button class="btn btn-outline" onclick="editCust('${c.id}')"><i class="fas fa-edit"></i> 编辑</button>
        <button class="btn btn-danger" onclick="deleteCust('${c.id}')"><i class="fas fa-trash"></i> 删除</button>
      </div>`;
    document.getElementById('custDrawer').style.display = 'flex';
  } catch (e) { mapToast('打开详情失败：' + e.message, 'error'); }
}

function closeCustDrawer() {
  document.getElementById('custDrawer').style.display = 'none';
}

// ---------- 通用确认弹窗（替代原生 confirm，兼容嵌入式预览） ----------
let _confirmResolver = null;
function showConfirm(message, title) {
  document.getElementById('confirmMsg').textContent = message || '请确认';
  document.getElementById('confirmTitle').textContent = title || '请确认';
  document.getElementById('confirmModal').style.display = 'flex';
  return new Promise(resolve => { _confirmResolver = resolve; });
}
function closeConfirm(result) {
  document.getElementById('confirmModal').style.display = 'none';
  if (_confirmResolver) { _confirmResolver(result); _confirmResolver = null; }
}

async function addFollowup(id) {
  const input = document.getElementById('followupInput');
  const content = (input.value || '').trim();
  if (!content) { mapToast('跟进内容不能为空', 'warn'); return; }
  try {
    const data = await custApi('/api/customers/' + id + '/followup', { method: 'POST', body: JSON.stringify({ content, by: '销售' }) });
    if (data.error) { mapToast('添加失败：' + data.error, 'error'); return; }
    mapToast('跟进已记录', 'success');
    viewCust(id);
  } catch (e) { mapToast('添加失败：' + e.message, 'error'); }
}

// ---------- 跟进提醒 / 待办 ----------
let _todoData = null;
let _todoTab = 'all';

function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function isTodayTs(ts) {
  const d = new Date(ts), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function fmtRemain(ts, now) {
  const diff = ts - now, abs = Math.abs(diff);
  const day = 86400000, hour = 3600000, min = 60000;
  if (diff < 0) {
    if (abs >= day) return '逾期 ' + Math.floor(abs / day) + ' 天';
    if (abs >= hour) return '逾期 ' + Math.floor(abs / hour) + ' 小时';
    return '逾期 ' + Math.max(1, Math.floor(abs / min)) + ' 分钟';
  }
  const d = new Date(ts);
  const hm = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  if (abs < hour) return '约 ' + Math.max(1, Math.floor(abs / min)) + ' 分钟后';
  if (abs < day) return '今天 ' + hm;
  return Math.floor(abs / day) + ' 天后';
}
function localInputValue(ts) {
  if (!ts) return '';
  const d = new Date(ts - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

async function initGenjinTixing() {
  try {
    const data = await custApi('/api/todos');
    if (data.error) { mapToast('加载失败：' + data.error, 'error'); return; }
    const c = data.counts || { overdue: 0, today: 0, upcoming: 0, total: 0 };
    document.getElementById('todoOverdue').textContent = c.overdue;
    document.getElementById('todoToday').textContent = c.today;
    document.getElementById('todoUpcoming').textContent = c.upcoming;
    document.getElementById('todoTotal').textContent = c.total;
    document.getElementById('tabAll').textContent = c.total;
    document.getElementById('tabOverdue').textContent = c.overdue;
    document.getElementById('tabToday').textContent = c.today;
    document.getElementById('tabUpcoming').textContent = c.upcoming;
    _todoData = data;
    renderTodoTable();
    refreshRemindBadge(data);
  } catch (e) { mapToast('加载失败：' + e.message, 'error'); }
}
function renderTodoTable() {
  const data = _todoData; if (!data) return;
  const tbody = document.getElementById('todoBody');
  const empty = document.getElementById('todoEmpty');
  let rows = [];
  if (_todoTab === 'all') rows = [...data.overdue, ...data.today, ...data.upcoming];
  else if (_todoTab === 'overdue') rows = data.overdue;
  else if (_todoTab === 'today') rows = data.today;
  else rows = data.upcoming;
  if (!rows.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  const now = data.now || Date.now();
  tbody.innerHTML = rows.map(r => {
    const lvClass = r.overdue ? 'tag-red' : (isTodayTs(r.nextFollowAt) ? 'tag-orange' : 'tag-blue');
    return `<tr>
      <td class="cust-name">${esc(r.name || '—')}<br><small class="muted">${esc(r.phone || '')}</small></td>
      <td><span class="tag-badge ${statusBadgeClass(r.status)}">${esc(r.status)}</span></td>
      <td>${fmtDateTime(r.nextFollowAt)}</td>
      <td>${esc(r.reminderNote || '—')}</td>
      <td><span class="tag-badge ${lvClass}">${fmtRemain(r.nextFollowAt, now)}</span></td>
      <td class="row-actions">
        <button class="btn btn-xs btn-primary" onclick="viewCust('${r.id}')"><i class="fas fa-eye"></i> 去跟进</button>
        <button class="btn btn-xs btn-outline" onclick="clearReminder('${r.id}')"><i class="fas fa-bell-slash"></i> 清除</button>
      </td>
    </tr>`;
  }).join('');
}
function switchTodoTab(tab) {
  _todoTab = tab;
  document.querySelectorAll('.todo-tab').forEach(b => { b.classList.toggle('active', b.getAttribute('onclick').indexOf("'" + tab + "'") >= 0); });
  renderTodoTable();
}
async function clearReminder(id) {
  try {
    const data = await custApi('/api/customers/reminder', { method: 'POST', body: JSON.stringify({ id, nextFollowAt: 0, reminderNote: '' }) });
    if (data.error) { mapToast('清除失败：' + data.error, 'error'); return; }
    mapToast('已清除提醒', 'success');
    initGenjinTixing();
  } catch (e) { mapToast('清除失败：' + e.message, 'error'); }
}
async function saveReminder(id) {
  const tEl = document.getElementById('reminderTime');
  const nEl = document.getElementById('reminderNote');
  const val = tEl ? tEl.value : '';
  const note = nEl ? nEl.value.trim() : '';
  if (!val) { mapToast('请选择跟进时间', 'warn'); return; }
  const ts = new Date(val).getTime();
  if (isNaN(ts)) { mapToast('时间格式无效', 'warn'); return; }
  try {
    const data = await custApi('/api/customers/reminder', { method: 'POST', body: JSON.stringify({ id, nextFollowAt: ts, reminderNote: note }) });
    if (data.error) { mapToast('设置失败：' + data.error, 'error'); return; }
    mapToast('跟进提醒已设置', 'success');
    viewCust(id);
    refreshRemindBadge();
  } catch (e) { mapToast('设置失败：' + e.message, 'error'); }
}
async function refreshRemindBadge(data) {
  try {
    if (!data) data = await custApi('/api/todos');
    const c = (data && data.counts) || { overdue: 0, today: 0 };
    const badge = document.getElementById('navRemindBadge');
    if (badge) {
      const n = (c.overdue || 0) + (c.today || 0);
      if (n > 0) { badge.textContent = n; badge.style.display = 'inline-block'; }
      else badge.style.display = 'none';
    }
  } catch (e) { /* 忽略 */ }
}

// ---------- 地图获客结果：勾选联动 ----------
// 返回当前勾选的结果索引数组
function getCheckedMapIndexes() {
  return Array.from(document.querySelectorAll('.map-row-check:checked'))
    .map(cb => parseInt(cb.dataset.index, 10))
    .filter(i => !isNaN(i));
}

// 表头全选/取消全选
function toggleMapSelectAll(box) {
  document.querySelectorAll('.map-row-check').forEach(cb => { cb.checked = box.checked; });
  onMapCheckChange();
}

// 任一行勾选变化：同步表头全选态 + 更新导入按钮文案
function onMapCheckChange() {
  const all = document.querySelectorAll('.map-row-check');
  const checked = document.querySelectorAll('.map-row-check:checked');
  const head = document.getElementById('mapSelectAll');
  if (head) {
    head.checked = all.length > 0 && checked.length === all.length;
    head.indeterminate = checked.length > 0 && checked.length < all.length;
  }
  const btn = document.getElementById('importMapBtn');
  if (btn) {
    btn.innerHTML = checked.length > 0
      ? `<i class="fas fa-address-book"></i> 导入选中(${checked.length})`
      : `<i class="fas fa-address-book"></i> 导入客户库`;
  }
}

// ---------- 地图获客结果 → 导入客户库 ----------
function importMapToCustomers() {
  if (!mapResults || !mapResults.length) { mapToast('请先在「公域拓客-地图获客」采集到客户', 'warn'); return; }
  // 勾选了就只导勾选的；一个都没勾就导全部
  const checkedIdx = getCheckedMapIndexes();
  const source = checkedIdx.length > 0 ? checkedIdx.map(i => mapResults[i]).filter(Boolean) : mapResults;
  const items = source.map(p => ({
    name: p.name,
    phone: p.tel || '',
    address: p.address || '',
    type: p.type || '',
    region: p.city ? (p.city + (p.district ? '·' + p.district : '')) : '',
    source: '地图获客',
    status: '新客',
    lng: p.lng, lat: p.lat
  }));
  const scope = checkedIdx.length > 0 ? ('选中的 ' + items.length + ' 条') : ('全部 ' + items.length + ' 条');
  mapToast('正在导入' + scope + '到客户库…', 'info');
  custApi('/api/customers/import', { method: 'POST', body: JSON.stringify({ items }) })
    .then(data => {
      if (data.error) { mapToast('导入失败：' + data.error, 'error'); return; }
      mapToast('导入完成：新增 ' + data.added + ' 条，跳过重复 ' + data.skipped + ' 条', 'success');
      navigateTo('kehu-guanli');
    })
    .catch(e => mapToast('导入失败：' + e.message, 'error'));
}

// ---------- 导出 ----------
// 数据导出：走后端 /api/customers/export，支持 csv / xls，复用当前筛选条件
async function exportCustomers(format) {
  const f = getCustFilters();
  const params = new URLSearchParams({ q: f.q, status: f.status, source: f.source, tag: f.tag, format });
  try {
    const resp = await fetch('/api/customers/export?' + params.toString());
    if (!resp.ok) {
      let msg = '导出失败（HTTP ' + resp.status + '）';
      try { const j = await resp.json(); if (j && j.error) msg = j.error; } catch (e) {}
      mapToast(msg, 'error'); return;
    }
    const blob = await resp.blob();
    const total = resp.headers.get('X-Export-Total');
    const cd = resp.headers.get('Content-Disposition') || '';
    let fname = (format === 'xls' ? 'customers.xls' : 'customers.csv');
    const m = cd.match(/filename\*=UTF-8''([^;]+)/);
    if (m) fname = decodeURIComponent(m[1]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    const label = format === 'xls' ? 'Excel' : 'CSV';
    mapToast('已导出 ' + (total || '?') + ' 位客户 → ' + label + ' 文件', 'success');
  } catch (e) { mapToast('导出失败：' + e.message, 'error'); }
}
// ================= 私信获客 (合规: 人工粘贴 + AI解析/草稿, 不爬取不自动发送) =================
let sixinLeads = [];
let sixinReplyCache = {};
// ---------- 平台接入 (合规: 官方 OAuth + Webhook + 本地模拟推送) ----------
function platformApi(path, opts) {
  return fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts))
    .then(r => r.json()).catch(e => ({ error: e.message }));
}
function initPlatform() {
  loadPlatformStatus();
  loadPlatformLeads();
}
async function loadPlatformStatus() {
  try {
    const cfg = await platformApi('/api/platform/config');
    const wrap = document.getElementById('platformCards');
    const note = document.getElementById('platformPubNote');
    if (!wrap) return;
    if (cfg.needPublicHttps) {
      note.textContent = '当前为 localhost，无法接收实时推送（需部署公网 HTTPS）';
      note.style.color = '#e67e22';
    } else {
      note.textContent = '公网地址: ' + cfg.publicBase;
      note.style.color = '';
    }
    wrap.innerHTML = (cfg.platforms || []).map(p => {
      let statusBadge, btn;
      if (p.connected) {
        statusBadge = '<span class="status-dot ok"></span> 已连接';
        btn = '<button class="btn btn-sm btn-outline" onclick="disconnectPlatform(\'' + p.key + '\')"><i class="fas fa-unlink"></i> 断开</button>';
      } else if (p.configured) {
        statusBadge = '<span class="status-dot warn"></span> 未连接';
        btn = '<button class="btn btn-sm btn-primary" onclick="openPlatformAuth(\'' + p.key + '\')"><i class="fas fa-sign-in-alt"></i> 登录授权</button>';
        // 凭证齐全但回调地址不是公网 HTTPS：平台会拒绝授权，先说清楚，避免点了按钮只看到平台报错
        if (cfg.needPublicHttps) {
          const cbNow = (cfg.publicBase || '').replace(/\/$/, '') + '/api/platform/callback/' + p.key;
          const cbNeed = 'https://<你的域名>/api/platform/callback/' + p.key;
          btn += '<div class="pc-hint" style="color:#e67e22;font-size:12px;margin-top:6px;line-height:1.5">' +
            '<i class="fas fa-exclamation-triangle"></i> 当前回调地址是 <code>' + cbNow + '</code>，' + p.name +
            '只接受<b>公网 HTTPS</b>回调，现在点授权会被平台拒绝。请先部署到公网 HTTPS，' +
            '把 <code>' + cbNeed + '</code> 填进' + p.name + '开放平台的回调白名单，' +
            '再把 .env 的 <code>PUBLIC_BASE_URL</code> 改成 https 域名后重启。</div>';
        }
      } else if (p.clientIdSet) {
        statusBadge = '<span class="status-dot warn"></span> 凭证不完整';
        btn = '<span class="muted">AppID 已填（' + (p.clientIdMasked || '****') + '），还缺 AppSecret</span>';
      } else {
        statusBadge = '<span class="status-dot off"></span> 未配置凭证';
        btn = '<span class="muted">在 .env 配置 AppID / AppSecret</span>';
      }
      const icon = p.key === 'douyin' ? 'tiktok' : 'book-open';
      return '<div class="platform-card">' +
        '<div class="pc-head"><i class="fab fa-' + icon + '"></i> ' + p.name + '</div>' +
        '<div class="pc-status">' + statusBadge + '</div>' +
        '<div class="pc-note">' + p.note + '</div>' +
        '<div class="pc-actions">' + btn + '</div>' +
        '</div>';
    }).join('');
  } catch (e) { console.error(e); }
}
async function openPlatformAuth(platform) {
  try {
    const r = await platformApi('/api/platform/auth-url/' + platform);
    if (r.error) { mapToast(r.error, 'error'); return; }
    window.open(r.url, '_blank', 'width=600,height=700');
  } catch (e) { mapToast('获取授权地址失败: ' + e.message, 'error'); }
}
async function disconnectPlatform(platform) {
  if (!(await showConfirm('确定断开该平台连接？'))) return;
  await platformApi('/api/platform/disconnect/' + platform, { method: 'POST' });
  loadPlatformStatus();
}
async function simulatePlatformPush() {
  const platform = document.getElementById('simPlatform').value;
  const source = document.getElementById('simSource').value;
  const custom = (document.getElementById('simContent')?.value || '').trim();
  const samples = {
    '私信': { fromUser: '用户·阿强', content: '你们这个套餐怎么收费？想了解一下', contact: 'vx: aqiang88', sourceType: '私信' },
    '视频留言': { fromUser: '用户·莉莉', content: '视频里那款还有货吗？怎么下单呀', contact: 'wx: lili_buy', sourceType: '视频留言' },
    '直播发言': { fromUser: '用户·老王', content: '直播说的体验店在哪？能留个联系方式吗', contact: 'vx: wanglaoben', sourceType: '直播发言' }
  };
  const base = samples[source] || samples['私信'];
  const message = custom
    ? Object.assign({}, base, { content: custom, sourceType: source })
    : base;
  const r = await platformApi('/api/platform/simulate', { method: 'POST', body: JSON.stringify({ platform, message }) });
  if (r.error) { mapToast('模拟失败: ' + r.error, 'error'); return; }
  loadPlatformLeads();
  const lead = r.lead || {};
  mapToast('已模拟推送 1 条（' + (lead.platformName || platform) + '·' + (lead.sourceType || source) + '），AI 意向分级：' + (lead.level || '中') + '。已入线索池。', 'success');
}
async function loadPlatformLeads() {
  const wrap = document.getElementById('platformLeads');
  if (!wrap) return;
  try {
    const r = await platformApi('/api/platform/leads');
    const leads = (r.leads || []);
    if (!leads.length) {
      wrap.innerHTML = '<div class="empty-cell"><i class="fas fa-inbox"></i><p>暂无线索。连接平台或点击上方「模拟推送」试试。</p></div>';
      return;
    }
    wrap.innerHTML = leads.map(l => {
      const lv = l.level || '中';
      const lvClass = lv === '高' ? 'lv-high' : (lv === '低' ? 'lv-low' : 'lv-mid');
      const tags = (l.tags || []).map(t => '<span class="tag-chip">' + escapeHtml(t) + '</span>').join('');
      const action = l.added
        ? '<span class="status-text ok">已加入客户库</span>'
        : (l.status === '已忽略'
            ? '<span class="status-text muted">已忽略</span>'
            : '<button class="btn btn-xs btn-primary" onclick="addPlatformLead(\'' + l.id + '\')"><i class="fas fa-plus"></i> 加入客户库</button> <button class="btn btn-xs btn-outline" onclick="ignorePlatformLead(\'' + l.id + '\')">忽略</button>');
      return '<div class="platform-lead ' + lvClass + '">' +
        '<div class="pl-top"><span class="pl-platform">' + escapeHtml(l.platformName) + '·' + escapeHtml(l.sourceType) + '</span>' +
        '<span class="lv-badge ' + lvClass + '">' + lv + '意向</span>' +
        '<span class="pl-time">' + new Date(l.createdAt).toLocaleString() + '</span></div>' +
        '<div class="pl-user"><strong>' + escapeHtml(l.fromUser) + '</strong>' + (l.contact ? ' · ' + escapeHtml(l.contact) : '') + '</div>' +
        '<div class="pl-content">' + escapeHtml(l.content) + '</div>' +
        '<div class="pl-tags">' + tags + (l.reason ? '<span class="pl-reason">分级理由: ' + escapeHtml(l.reason) + '</span>' : '') + '</div>' +
        '<div class="pl-actions">' + action + '</div>' +
        '</div>';
    }).join('');
  } catch (e) { console.error(e); }
}
async function addPlatformLead(id) {
  const r = await platformApi('/api/platform/leads/' + encodeURIComponent(id) + '/add', { method: 'POST', body: JSON.stringify({}) });
  if (r.error) { mapToast('加入失败: ' + r.error, 'error'); return; }
  loadPlatformLeads();
  mapToast('已加入客户库（来源: ' + (r.customer && r.customer.source) + '）', 'success');
}
async function ignorePlatformLead(id) {
  await platformApi('/api/platform/leads/' + encodeURIComponent(id) + '/ignore', { method: 'POST', body: JSON.stringify({}) });
  loadPlatformLeads();
}

function initSixinHuoqu() {
  sixinLeads = [];
  sixinReplyCache = {};
  renderSixinLeads();
  const input = document.getElementById('sixinInput');
  if (input) input.value = '';
}
function clearSixinInput() {
  const input = document.getElementById('sixinInput');
  if (input) input.value = '';
}
async function parseSixin() {
  const input = document.getElementById('sixinInput');
  const platform = document.getElementById('sixinPlatform');
  const text = input ? input.value.trim() : '';
  if (text.length < 4) { mapToast('请先粘贴至少一段私信内容', 'warn'); return; }
  const btn = document.querySelector('#page-sixin-huoqu button[onclick="parseSixin()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 解析中…'; }
  try {
    const res = await fetch('/api/sixin/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, platform: platform ? platform.value : '抖音' }) });
    const data = await res.json();
    if (!res.ok || data.error) { mapToast('解析失败：' + (data.error || res.status), 'error'); return; }
    sixinLeads = Array.isArray(data.leads) ? data.leads : [];
    renderSixinLeads();
    mapToast('已解析出 ' + sixinLeads.length + ' 条线索', 'success');
  } catch (e) {
    mapToast('解析失败：' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-robot"></i> AI 解析为线索'; }
  }
}
function renderSixinLeads() {
  const box = document.getElementById('sixinLeads');
  const cnt = document.getElementById('sixinCount');
  if (!box) return;
  if (cnt) cnt.textContent = sixinLeads.length + ' 条';
  if (!sixinLeads.length) {
    box.innerHTML = '<div class="empty-cell"><i class="fas fa-inbox"></i><p>暂无线索。粘贴私信内容后点击「AI 解析为线索」。</p></div>';
    return;
  }
  box.innerHTML = sixinLeads.map((l, i) => {
    const tags = (l.tags && l.tags.length) ? l.tags.map(t => '<span class="tag-chip">' + escapeHtml(t) + '</span>').join('') : '<span class="tag-chip muted">无标签</span>';
    const levelCls = (l.level === '高') ? 'lv-high' : (l.level === '中') ? 'lv-mid' : 'lv-low';
    const context = [l.nickname, l.intent, l.contact, l.region].filter(Boolean).join('；');
    return `<div class="sixin-lead" data-i="${i}">
      <div class="sixin-lead-head">
        <div class="sixin-lead-name"><i class="fas fa-user-circle"></i> ${escapeHtml(l.nickname || '未知用户')}</div>
        <span class="level-badge ${levelCls}">意向 ${escapeHtml(l.level || '中')}</span>
      </div>
      <div class="sixin-lead-meta">
        <span><i class="fas fa-tag"></i> ${escapeHtml(l.platform || '其他')}</span>
        ${l.region ? '<span><i class="fas fa-map-marker-alt"></i> ' + escapeHtml(l.region) + '</span>' : ''}
        ${l.contact ? '<span><i class="fas fa-phone"></i> ' + escapeHtml(l.contact) + '</span>' : ''}
      </div>
      <div class="sixin-lead-intent"><i class="fas fa-comment"></i> ${escapeHtml(l.intent || '—')}</div>
      <div class="sixin-lead-tags">${tags}</div>
      <div class="sixin-lead-actions">
        <button class="btn btn-sm btn-primary" onclick="addSixinLead(${i})"><i class="fas fa-plus"></i> 添加到客户库</button>
        <button class="btn btn-sm btn-outline" onclick="toggleReplyPanel(${i})"><i class="fas fa-reply"></i> 生成预选回复</button>
        <button class="btn btn-sm btn-ghost" onclick="ignoreSixinLead(${i})"><i class="fas fa-times"></i> 忽略</button>
      </div>
      <div class="sixin-reply-panel" id="replyPanel-${i}" style="display:none">
        <div class="reply-tone">
          <span>语气：</span>
          <button class="tone-chip active" data-tone="专业" onclick="selectTone(this,${i})">专业</button>
          <button class="tone-chip" data-tone="亲切" onclick="selectTone(this,${i})">亲切</button>
          <button class="tone-chip" data-tone="热情" onclick="selectTone(this,${i})">热情</button>
          <button class="tone-chip" data-tone="简洁" onclick="selectTone(this,${i})">简洁</button>
        </div>
        <textarea class="form-control reply-req" id="replyReq-${i}" rows="2" placeholder="额外要求（可选）：如“重点说明免费试听、不要太长”"></textarea>
        <button class="btn btn-sm btn-primary" onclick="generateReply(${i})"><i class="fas fa-magic"></i> 生成3条预选回复</button>
        <div class="reply-drafts" id="replyDrafts-${i}"></div>
        <textarea class="form-control reply-final" id="replyFinal-${i}" rows="3" placeholder="最终回复（可把 AI 草稿「填入」或「插入话术模板」后人工润色，复制后到平台手动发送）"></textarea>
        <div class="reply-final-actions">
          <button class="btn btn-sm btn-outline" onclick="openTemplatePicker(${i})"><i class="fas fa-book"></i> 插入话术模板</button>
          <button class="btn btn-sm btn-primary" onclick="copyFinalReply(${i})"><i class="fas fa-copy"></i> 复制最终回复</button>
        </div>
        <input type="hidden" id="replyCtx-${i}" value="${escapeHtml(context)}">
      </div>
    </div>`;
  }).join('');
}
function ignoreSixinLead(i) {
  sixinLeads.splice(i, 1);
  renderSixinLeads();
  mapToast('已忽略该线索', 'info');
}
async function addSixinLead(i) {
  const l = sixinLeads[i];
  if (!l) return;
  const payload = {
    name: l.nickname || (l.contact || '私信线索'),
    phone: l.contact || '',
    address: l.region || '',
    type: '',
    region: l.region || '',
    source: '私信获客·' + (l.platform || '其他'),
    status: '新客',
    tags: (l.tags && l.tags.length) ? l.tags.concat(['私信线索']) : ['私信线索'],
    note: '意向：' + (l.level || '中') + '；需求：' + (l.intent || '')
  };
  try {
    const res = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || data.error) { mapToast('添加失败：' + (data.error || res.status), 'error'); return; }
    mapToast('已添加到客户库', 'success');
    sixinLeads.splice(i, 1);
    renderSixinLeads();
  } catch (e) {
    mapToast('添加失败：' + e.message, 'error');
  }
}
function toggleReplyPanel(i) {
  const p = document.getElementById('replyPanel-' + i);
  if (p) p.style.display = (p.style.display === 'none') ? 'block' : 'none';
}
function selectTone(el, i) {
  const panel = document.getElementById('replyPanel-' + i);
  if (!panel) return;
  panel.querySelectorAll('.tone-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}
async function generateReply(i) {
  const l = sixinLeads[i];
  if (!l) return;
  const panel = document.getElementById('replyPanel-' + i);
  const ctx = document.getElementById('replyCtx-' + i);
  const req = document.getElementById('replyReq-' + i);
  const drafts = document.getElementById('replyDrafts-' + i);
  const toneEl = panel.querySelector('.tone-chip.active');
  const tone = toneEl ? toneEl.getAttribute('data-tone') : '专业';
  const context = ctx ? ctx.value : '';
  const btn = panel.querySelector('button[onclick="generateReply(' + i + ')"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中…'; }
  try {
    const res = await fetch('/api/sixin/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context, tone, requirement: req ? req.value.trim() : '' }) });
    const data = await res.json();
    if (!res.ok || data.error) { mapToast('生成失败：' + (data.error || res.status), 'error'); return; }
    const replies = (data.replies || []).filter(Boolean);
    sixinReplyCache[i] = replies;
    if (!replies.length) { drafts.innerHTML = '<p class="hint-text">未生成回复，请重试。</p>'; return; }
    drafts.innerHTML = replies.map((r, k) => `<div class="reply-draft">
      <div class="reply-draft-text">${escapeHtml(r)}</div>
      <button class="btn btn-xs btn-outline" onclick="fillDraftToFinal(${i},${k})"><i class="fas fa-arrow-down"></i> 填入</button>
      <button class="btn btn-xs btn-outline" onclick="copyReply(${i},${k})"><i class="fas fa-copy"></i> 复制</button>
    </div>`).join('');
  } catch (e) {
    mapToast('生成失败：' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-magic"></i> 生成3条预选回复'; }
  }
}
function copyReply(i, k) {
  const arr = sixinReplyCache[i] || [];
  copyText(arr[k]);
}
function copyText(text) {
  const t = String(text || '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(() => mapToast('已复制到剪贴板', 'success')).catch(() => fallbackCopy(t));
  } else { fallbackCopy(t); }
}
function fallbackCopy(t) {
  const ta = document.createElement('textarea');
  ta.value = t; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); mapToast('已复制到剪贴板', 'success'); } catch (e) { mapToast('复制失败，请手动复制', 'error'); }
  document.body.removeChild(ta);
}

async function initDashboard() {
    let data;
    try {
        const res = await fetch('/api/dashboard');
        data = await res.json();
        if (!data.ok) throw new Error(data.error || '加载失败');
    } catch (e) {
        const feed = document.getElementById('activityFeed');
        if (feed) feed.innerHTML = '<div class="text-muted">数据加载失败：' + esc(e.message || e) + '</div>';
        return;
    }
    renderDashCards(data);
    renderDashTrend(data.trend);
    renderDashSource(data.bySource);
    renderDashLevel(data.levelDist);
    renderDashPlatform(data.platformLeads);
    renderDashActivity(data.recentCustomers, (data.platformLeads && data.platformLeads.recent) || []);
    animateCounters();
    refreshRemindBadge();
}

function initActivityFeed() {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;
    const activities = [
        { icon: 'fa-map-marked-alt', bg: '#7c3aed', text: '<strong>地图获客</strong> 在北京市发现 <strong>86</strong> 个汽车4S店商家', time: '刚刚' },
        { icon: 'fab fa-tiktok', bg: '#000', text: '<strong>抖音截留</strong> 从"二手车交易"关键词捕获 <strong>234</strong> 条评论', time: '3分钟前' },
        { icon: 'fa-exchange-alt', bg: '#3b82f6', text: '<strong>公转私</strong> AI自动回复 <strong>56</strong> 条私信，转化 <strong>12</strong> 个到企微', time: '8分钟前' },
        { icon: 'fa-crown', bg: '#f59e0b', text: '<strong>AI销冠</strong> 今日新增好友 <strong>1,847</strong> 人，群发触达 <strong>3,421</strong> 人', time: '15分钟前' },
        { icon: 'fa-broadcast-tower', bg: '#ef4444', text: '<strong>直播间监控</strong> "XX车行"直播捕获 <strong>42</strong> 条高意向线索', time: '22分钟前' },
        { icon: 'fa-user-tie', bg: '#10b981', text: '<strong>AI人事</strong> 自动筛选简历 <strong>28</strong> 份，打招呼 <strong>18</strong> 人', time: '35分钟前' },
        { icon: 'fas fa-gavel', bg: '#6366f1', text: '<strong>法务审查</strong> 合同风险检测完成，发现 <strong>3</strong> 处需关注条款', time: '1小时前' },
        { icon: 'fa-magic', bg: '#ec4899', text: '<strong>AI创作</strong> 短视频矩阵任务完成，产出 <strong>10</strong> 条短视频', time: '2小时前' },
    ];
    feed.innerHTML = activities.map(a => `
        <div class="activity-item">
            <div class="activity-icon" style="background:${a.bg}"><i class="fas ${a.icon}"></i></div>
            <div>
                <div class="activity-text">${a.text}</div>
                <div class="activity-time">${a.time}</div>
            </div>
        </div>`).join('');
}

function animateCounters() {
    document.querySelectorAll('.stat-number').forEach(el => {
        const target = parseInt(el.textContent.replace(/,/g,''));
        if (isNaN(target)) return;
        let current = 0;
        const step = Math.ceil(target / 40);
        const timer = setInterval(() => {
            current += step;
            if (current >= target) { current = target; clearInterval(timer); }
            el.textContent = current.toLocaleString();
        }, 30);
    });
}

// ---------- Dashboard 渲染（真实数据） ----------
function setNum(id, v) { const el = document.getElementById(id); if (el) el.textContent = (v || 0).toLocaleString(); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }
function fmtAgo(ts) { if (!ts) return ''; const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return '刚刚'; if (s < 3600) return Math.floor(s / 60) + '分钟前'; if (s < 86400) return Math.floor(s / 3600) + '小时前'; return Math.floor(s / 86400) + '天前'; }

function renderDashCards(d) {
    setNum('statTotalCustomers', d.total);
    setNum('statHighIntention', d.highIntention);
    setNum('statPlatformLeads', (d.platformLeads && d.platformLeads.total) || 0);
    setNum('statWeekNew', d.weekNew);
}

function renderDashTrend(trend) {
    const box = document.getElementById('dashTrend'); if (!box || !trend) return;
    const w = 640, h = 180, pad = 28;
    const max = Math.max(1, ...trend.map(t => t.count));
    const n = trend.length;
    const x = i => pad + i * (w - pad * 2) / (n - 1);
    const y = v => h - pad - (v / max) * (h - pad * 2);
    const pts = trend.map((t, i) => x(i).toFixed(1) + ',' + y(t.count).toFixed(1)).join(' ');
    const area = pad + ',' + (h - pad) + ' ' + pts + ' ' + (w - pad) + ',' + (h - pad);
    let svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" class="trend-svg" preserveAspectRatio="none">';
    svg += '<defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c3aed" stop-opacity="0.35"/><stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/></linearGradient></defs>';
    svg += '<line x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - pad) + '" y2="' + (h - pad) + '" stroke="#e5e7eb"/>';
    svg += '<polygon points="' + area + '" fill="url(#tg)"/>';
    svg += '<polyline points="' + pts + '" fill="none" stroke="#7c3aed" stroke-width="2"/>';
    trend.forEach((t, i) => { if (i % 6 === 0 || i === n - 1) svg += '<text x="' + x(i) + '" y="' + (h - 8) + '" font-size="9" fill="#9ca3af" text-anchor="middle">' + t.date.slice(5) + '</text>'; });
    trend.forEach((t, i) => { if (t.count > 0) svg += '<circle cx="' + x(i) + '" cy="' + y(t.count) + '" r="2.5" fill="#7c3aed"/>'; });
    svg += '</svg>';
    const total = trend.reduce((s, t) => s + t.count, 0);
    box.innerHTML = svg + '<div class="trend-foot">近 30 天累计新增 <strong>' + total + '</strong> 个客户（峰值 ' + max + '/天）</div>';
}

function renderDashSource(bySource) {
    const box = document.getElementById('dashSource'); if (!box) return;
    const entries = Object.entries(bySource || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (!entries.length) { box.innerHTML = '<div class="text-muted">暂无客户数据</div>'; return; }
    const max = Math.max(...entries.map(e => e[1]));
    box.innerHTML = entries.map(e => '<div class="bar-row"><span class="bar-label">' + esc(e[0]) + '</span><div class="bar-track"><div class="bar-fill" style="width:' + (e[1] / max * 100).toFixed(1) + '%"></div></div><span class="bar-val">' + e[1] + '</span></div>').join('');
}

function renderDashLevel(levelDist) {
    const box = document.getElementById('dashLevel'); if (!box) return;
    const map = [['高', '#059669'], ['中', '#d97706'], ['低', '#64748b']];
    const total = (levelDist['高'] || 0) + (levelDist['中'] || 0) + (levelDist['低'] || 0);
    if (!total) { box.innerHTML = '<div class="text-muted">暂无意向标注</div>'; return; }
    box.innerHTML = map.map(kv => {
        const v = levelDist[kv[0]] || 0;
        return '<div class="bar-row"><span class="bar-label"><span class="dot" style="background:' + kv[1] + '"></span>' + kv[0] + '意向</span><div class="bar-track"><div class="bar-fill" style="width:' + (v / total * 100).toFixed(1) + '%;background:' + kv[1] + '"></div></div><span class="bar-val">' + v + '</span></div>';
    }).join('') + '<div class="trend-foot">共 ' + total + ' 个客户已标注意向</div>';
}

function renderDashPlatform(pl) {
    const box = document.getElementById('dashPlatform'); if (!box) return;
    if (!pl || !pl.total) { box.innerHTML = '<div class="text-muted">暂无平台线索，可在「平台接入」点「模拟推送」自测</div>'; return; }
    const lv = pl.byLevel || {}; const colors = { 高: '#059669', 中: '#d97706', 低: '#64748b' };
    let html = '<div class="pl-total">线索总数 <strong>' + pl.total + '</strong></div>';
    ['高', '中', '低'].forEach(k => {
        const v = lv[k] || 0;
        html += '<div class="bar-row"><span class="bar-label"><span class="dot" style="background:' + colors[k] + '"></span>' + k + '意向</span><div class="bar-track"><div class="bar-fill" style="width:' + (pl.total ? (v / pl.total * 100).toFixed(1) : 0) + '%;background:' + colors[k] + '"></div></div><span class="bar-val">' + v + '</span></div>';
    });
    html += '<div class="trend-foot">数据来自抖音/小红书 Webhook（或模拟推送）</div>';
    box.innerHTML = html;
}

function renderDashActivity(customers, leads) {
    const feed = document.getElementById('activityFeed'); if (!feed) return;
    const items = [];
    (customers || []).forEach(c => { items.push({ _t: c.createdAt, icon: 'fa-user-plus', bg: '#7c3aed', text: '新增客户 <strong>' + esc(c.name || '未命名') + '</strong>（来源：' + esc(c.source || '未知') + '）', time: fmtAgo(c.createdAt) }); });
    (leads || []).forEach(l => { const colors = { 高: '#059669', 中: '#d97706', 低: '#64748b' }; const c = colors[l.level] || '#3b82f6'; items.push({ _t: l.createdAt, icon: 'fab fa-tiktok', bg: c, text: '<strong>' + esc(l.platform || '平台') + '</strong> 收到' + esc(l.sourceType || '私信') + ' · <strong style="color:' + c + '">' + l.level + '意向</strong>：' + esc(l.fromUser || '用户'), time: fmtAgo(l.createdAt) }); });
    items.sort((a, b) => (b._t || 0) - (a._t || 0));
    if (!items.length) { feed.innerHTML = '<div class="text-muted">暂无动态，去「地图获客」或「平台接入」试试吧</div>'; return; }
    feed.innerHTML = items.map(a => '<div class="activity-item"><div class="activity-icon" style="background:' + a.bg + '"><i class="fas ' + a.icon + '"></i></div><div><div class="activity-text">' + a.text + '</div><div class="activity-time">' + a.time + '</div></div></div>').join('');
}

// ---------- 公域拓客 ----------
function initGongyuTuoke() { fillMapResults(); fillDouyinResults(); fillXhsResults(); fillKeywordResults(); startLiveDanmaku(); }

function fillMapResults() {
    const tbody = document.getElementById('mapResultBody');
    if (!tbody) return;
    const shops = ['鑫源汽车销售','恒信二手车','顺达车行','通达4S店','诚信车业','宏达汽贸','嘉诚名车','远大汽车','华通二手车','博盛车行','众诚汽车','瑞丰车业','金鼎名车','盛世汽贸','龙腾车行'];
    const addresses = ['朝阳区建国路88号','海淀区中关村大街12号','丰台区南三环西路16号','昌平区回龙观东大街','大兴区黄村镇兴华路','通州区新华大街56号','石景山区阜石路188号','顺义区后沙峪镇','房山区良乡拱辰街道','门头沟区新桥大街'];
    tbody.innerHTML = shops.slice(0,15).map((s,i) => `<tr>
        <td><input type="checkbox"></td><td>${s}</td><td>${addresses[i%addresses.length]}</td><td>${randPhone()}</td>
        <td><span class="tag tag-purple">汽车销售</span></td><td>${randInt(1,25)}km</td>
        <td><span style="color:#f59e0b;font-weight:700">${(4+Math.random()).toFixed(1)}</span></td>
        <td><span style="color:${i%3===0?'#059669':'#3b82f6'}">${i%3===0?'已联系':'待跟进'}</span></td>
        <td><button class="btn btn-xs btn-primary">查看</button></td></tr>`).join('');
}

function fillDouyinResults() {
    const tbody = document.getElementById('douyinResultBody');
    if (!tbody) return;
    const videos = ['2025款丰田卡罗拉到店实拍 二手车性价比之王','这台宝马3系才15万？看完你就懂了！','二手车避坑指南｜老司机经验分享','20万预算买什么SUV？这5款闭眼入','从检测到交付｜全程记录一台二手车的购买过程','国产新能源二手车值得买吗？真实测评来了','小姐姐的购车日记｜最终选择了它...','车商不会告诉你的二手车内幕'];
    tbody.innerHTML = Array.from({length:15}, (_,i) => {
        const name = generateName();
        const comment = rand(DOUYIN_COMMENTS);
        const intention = ['高意向','高意向','中意向','中意向','中意向','低意向','低意向'][randInt(0,6)];
        const colors = { '高意向':'#059669', '中意向':'#d97706', '低意向':'#64748b' };
        return `<tr>
            <td><input type="checkbox"></td><td><i class="fab fa-tiktok"></i> 抖音</td>
            <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${videos[i%videos.length]}</td>
            <td><strong>${name}</strong></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${comment}</td>
            <td>${randInt(0,1)?randPhone():'<span class="text-muted">未公开</span>'}</td>
            <td>${rand(CITIES)}</td><td>${fmtDate(randInt(0,7),randInt(0,22))}</td>
            <td><span style="color:${colors[intention]};font-weight:700">${intention}</span></td>
            <td><a href="#" style="color:var(--primary)">查看主页 →</a></td></tr>`;
    }).join('');
}

function fillXhsResults() {
    const tbody = document.getElementById('xhsResultBody');
    if (!tbody) return;
    tbody.innerHTML = Array.from({length:10}, (_,i)=>`<tr>
        <td>${i+1}</td><td style="max-width:180px">小红书热门笔记 #${1000+i}</td>
        <td>${generateName()}</td><td>${rand(XHS_COMMENTS)}</td>
        <td>${randInt(50,9999)}</td><td>${fmtDate(randInt(0,3),randInt(0,18))}</td>
        <td><button class="btn btn-xs btn-outline">采集详情</button></td></tr>`).join('');
}

function fillKeywordResults() {
    const tbody = document.getElementById('keywordResultBody');
    if (!tbody) return;
    const keywords = ['二手车价格','二手车上哪里买','靠谱的二手车平台','二手车交易流程','二手车过户','二手车贷款','二手车评估','二手车验车技巧','本地二手车市场','豪华二手车推荐'];
    tbody.innerHTML = keywords.map(k=>`<tr>
        <td><strong>${k}</strong></td><td>抖音 / 小红书 / 快手</td><td>${randInt(50,5000)}</td><td>${randInt(10,800)}</td>
        <td><span style="color:${Math.random()>0.5?'#059669':'#f59e0b'}">${Math.random()>0.5?'↑ 上升':'↓ 下降'} ${randInt(1,30)}%</span></td></tr>`).join('');

    // 关键词云
    const cloud = document.getElementById('keywordCloud');
    if (cloud) {
        const allKeywords = [
            ...keywords,
            '二手车买卖','买车攻略','车辆鉴定','车况查询','过户手续','分期付款',
            '汽车金融','车辆保险','上牌指南','购车预算','车源渠道','看车技巧',
            '砍价策略','合同签署','交车流程','售后服务','保养知识','维修记录',
            '保值率分析','品牌选择','车型对比','配置参数','油耗数据','口碑评价'
        ];
        cloud.innerHTML = allKeywords.map((k,i) => {
            const sizeClass = i<5?'size-lg':i<14?'size-md':'size-sm';
            return `<span class="keyword-chip ${sizeClass}">${k}</span>`;
        }).join('');
    }
}

function startDouyinCrawl() {
    const bar = document.getElementById('douyinProgress');
    const txt = document.getElementById('douyinProgressText');
    if (!bar || !txt) return;
    let progress = 0;
    bar.style.width = '0%';
    txt.textContent = '0%';
    const interval = setInterval(() => {
        progress += randInt(1,5);
        if (progress >= 100) { progress = 100; clearInterval(interval); txt.textContent = '✅ 完成!'; }
        bar.style.width = progress + '%';
        txt.textContent = progress + '%';
    }, 300);
}

function startMapCrawl() {
    alert('🚀 已启动地图获客任务！\n正在扫描北京市范围内"汽车4S店"相关商户...\n\n（演示模式：使用实际API可获取真实地图POI数据）');
}

function expandKeywords() {
    const kw = document.getElementById('baseKeyword')?.value || '二手车买卖';
    alert(`🤖 AI正在基于「${kw}」扩展关键词...\n\n（连接DeepSeek API后将自动生成30+个同义/口语化关键词）`);
}

// 直播间弹幕模拟
let danmakuTimer = null;
function startLiveDanmaku() {
    const stream = document.getElementById('danmakuStream');
    if (!stream || danmakuTimer) return;
    const danmuTexts = [
        '老板这车多少钱啊？', '还在卖吗', '我看中了白色那台！', '支持分期不？',
        '坐标哪里？', '能优惠点吗', '有试驾吗', '什么时候的款', '跑了多少公里',
        '车况怎么样', '全款什么价', '送保养吗', '能看底盘吗', '内饰磨损严重吗',
        '这车之前事故吗', '发动机声音大不大', '油耗多少', '保险多少钱一年',
        '周末可以去看看吗', '地址发一下呗', '加个微信聊聊？', '太喜欢了！怎么买'
    ];
    const names = [];
    for(let i=0;i<20;i++) names.push(generateName().replace(/[先生女士]/,''));
    danmakuTimer = setInterval(() => {
        const item = document.createElement('div');
        item.className = 'danmaku-item';
        item.innerHTML = `<span class="danmaku-user">${names[randInt(0,names.length-1)]}:</span> ${rand(danmuTexts)}`;
        stream.prepend(item);
        while(stream.children.length > 25) stream.lastChild.remove();
    }, 1500);
}

// 评论实时监控填充
(function initMonitorComments() {
    const list = document.getElementById('monitorCommentsList');
    if (!list) return;

    function addComment() {
        const name = generateName();
        const comment = rand(DOUYIN_COMMENTS);
        const isHigh = comment.includes('钱') || comment.includes('价') || comment.includes('买') || comment.includes('优惠') || comment.includes('看看');
        const intentionLabel = isHigh ? '<span class="comment-intention-high">⭐ 高意向</span>' : '';
        const item = document.createElement('div');
        item.className = 'monitor-comment-item';
        item.innerHTML = `
            <div class="comment-user">${name}</div>
            <div class="comment-text">${comment}</div>
            <div class="comment-meta">
                <span><i class="far fa-clock"></i> 刚刚</span>
                <span><i class="fab fa-tiktok"></i> 抖音评论</span>
                ${intentionLabel}
            </div>`;
        list.prepend(item);
        while(list.children.length > 20) list.lastChild.remove();
    }

    // 初始加载几条
    for(let i=0;i<8;i++) setTimeout(addComment, i*200);

    // 定时添加新评论
    setInterval(addComment, 4000);
})();

// 直播间意向客户
(function initLiveLeads() {
    const leadList = document.getElementById('liveLeadList');
    if (!leadList) return;
    const leads = [
        {name:'王先生', msg:'老板这车最低多少钱？', level:'high'},
        {name:'李女士', msg:'白色还有吗？想周末来看', level:'medium'},
        {name:'赵总', msg:'能分期吗？首付多少', level:'high'},
        {name:'小刘', msg:'坐标哪里？离我近不近', level:'low'},
        {name:'陈姐', msg:'这车之前出过事故没', level:'medium'},
        {name:'周哥', msg:'加个微信聊细节', level:'high'},
    ];
    leadList.innerHTML = leads.map(l=>{
        const lvlColor = l.level==='high'? '#dc2626' : l.level==='medium' ? '#d97706' : '#6b7280';
        return `<div class="lead-item">
            <div class="lead-avatar">${l.name[0]}</div>
            <div class="lead-info"><div class="lead-name">${l.name}</div><div class="lead-msg">${l.msg}</div></div>
            <span class="lead-action" style="color:${lvlColor};font-weight:700">${l.level==='high'?'高意向':l.level==='medium'?'咨询中':'浏览'}</span>
        </div>`;
    }).join('');
})();

// ---------- 公转私 ----------
function initGongzhuanSi() { fillChatContacts(); fillChatMessages(); fillConversionList(); }

function fillChatContacts() {
    const list = document.getElementById('chatContactList');
    if (!list) return;
    const contacts = [
        {name:'张先生', preview:'您好，请问这款车的价格是多少？', unread:true, time:'刚刚'},
        {name:'李女士', preview:'周末可以去看车吗？在哪个位置？', unread:true, time:'3分钟前'},
        {name:'王总', preview:'支持分期付款吗 首付要多少', unread:true, time:'8分钟前'},
        {name:'赵小姐', preview:'这车是几款的 跑了多少公里了', unread:false, time:'15分钟前'},
        {name:'陈先生', preview:'有没有其他颜色的 看看红色', unread:false, time:'22分钟前'},
        {name:'刘女士', preview:'送保养吗 能优惠多少', unread:false, time:'35分钟前'},
        {name:'周先生', preview:'全款买的话最低什么价', unread:false, time:'1小时前'},
        {name:'吴小姐', preview:'车况有保障吗 有质保吗', unread:false, time:'1小时前'},
    ];
    list.innerHTML = contacts.map((c,i) => `<div class="chat-contact-item ${c.unread?'unread':''}${i===0?'active':''}">
        <div class="contact-avatar">${c.name[0]}</div>
        <div class="contact-info">
            <div class="contact-name">${c.name}<span style="font-size:10px;color:#ef4444;margin-left:4px">${c.unread?'●':''}</span></div>
            <div class="contact-preview">${c.preview}</div>
        </div>
        <div class="contact-time">${c.time}</div>
    </div>`).join('');
}

function fillChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = `
        <div class="msg msg-received">
            <div>你好，看到你们发的视频，想问问这台二手车多少钱？</div>
            <div class="msg-meta">17:32</div>
        </div>
        <div class="msg msg-sent">
            <div>您好张先生！感谢您的咨询😊 这款2022年的丰田卡罗拉，目前售价是<strong>9.8万元</strong>。车况非常好，实表3.2万公里，全程4S店保养。</div>
            <div class="msg-meta">17:33 · AI自动回复</div>
        </div>
        <div class="msg msg-received">
            <div>价格还能优惠吗？另外这车之前有过事故没有？</div>
            <div class="msg-meta">17:34</div>
        </div>
        <div class="msg msg-sent">
            <div>关于价格方面，如果您今天能定下来的话，我可以帮您申请<strong>3000元的专属优惠</strong>，到手价就是9.5万💪<br><br>至于车况请您放心，我们每台车都经过<strong>168项专业检测</strong>，并且提供<strong>3个月或5000公里质保</strong>。检测报告随时可以发给您查看~</div>
            <div class="msg-meta">17:35 · AI自动回复</div>
        </div>
        <div class="msg msg-received">
            <div>好的 那我周末过去看看 可以加个微信吗？</div>
            <div class="msg-meta">17:36</div>
        </div>
    `;
    container.scrollTop = container.scrollHeight;
}

function useAiReply() {
    const replyText = document.getElementById('aiReplyText')?.textContent;
    if (replyText) {
        alert('✅ 已采用AI建议回复！\n\n"' + replyText + '"\n\n（实际应用中将自动发送到对应平台）');
    }
}

function fillConversionList() {
    const list = document.getElementById('conversionList');
    if (!list) return;
    const conversions = [
        {name:'张先生', from:'dy', to:'qywx', time:'刚刚', label:'已完成'},
        {name:'李女士', from:'dy', to:'wx', time:'5分钟前', label:'进行中'},
        {name:'王总', from:'dy', to:'qywx', time:'12分钟前', label:'已完成'},
        {name:'赵小姐', from:'dy', to:'wx', time:'28分钟前', label:'进行中'},
        {name:'陈先生', from:'dy', to:'qywx', time:'45分钟前', label:'已完成'},
    ];
    list.innerHTML = conversions.map(c => `<div class="conversion-item">
        <div class="conversion-icon conv-icon-${c.from}"><i class="fas fa-${c.from==='dy'?'tiktok':'weixin'}"></i></div>
        <i class="fas fa-arrow-right" style="color:#ccc;font-size:11px;"></i>
        <div class="conversion-icon conv-icon-${c.to}"><i class="fas ${c.to==='qywx'?'fa-building':'fa-weixin'}"></i></div>
        <div style="flex:1"><strong>${c.name}</strong></div>
        <span style="font-size:11px;color:#9ca3af">${c.time}</span>
        <span class="chip" style="font-size:10px;padding:2px 8px">${c.label}</span>
    </div>`).join('');
}

// ---------- AI销冠（智能服务） ----------
let xgState = null;
let xgBound = false;
let xgPollTimer = null;

function xgVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function xgSet(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function xgNum(id) { const v = parseFloat(xgVal(id)); return isNaN(v) ? 0 : v; }
function xgFmt(n) { return (n == null ? 0 : n).toLocaleString('en-US'); }

async function xgApi(path, opts) {
  const res = await fetch('/api/xiaoguan' + path, Object.assign({ method: 'GET', headers: { 'Content-Type': 'application/json' } }, opts || {}));
  return res.json();
}

function initAiXiaoguan() {
    const page = document.getElementById('page-ai-xiaoguan');
    if (!page) return;
    if (!xgBound) { bindXgEvents(); xgBound = true; }
    loadXgState();
    startXgPoll();
}

async function loadXgState() {
  try {
    const j = await xgApi('/state');
    if (!j.ok) return;
    xgState = j.data;
    renderXgStatic(xgState);
    renderXgDynamic(xgState);
  } catch (e) { /* ignore */ }
}

function renderXgStatic(s) {
  if (s.autoAdd && s.autoAdd.config) {
    const c = s.autoAdd.config;
    xgSet('aa-source', c.source); xgSet('aa-daily', c.dailyLimit || 50); xgSet('aa-interval', c.interval || 30);
    xgSet('aa-verify', c.verifyMsg || ''); xgSet('aa-after', c.afterMsg || ''); xgSet('aa-account', c.runAccount || '全部账号');
  }
  if (s.moments && s.moments.config) {
    const c = s.moments.config;
    const like = document.getElementById('mo-like'); if (like) like.checked = !!c.like;
    const com = document.getElementById('mo-comment'); if (com) com.checked = !!c.comment;
    xgSet('mo-daily', c.dailyLimit || 100);
    document.querySelectorAll('#mo-style .chip').forEach(ch => ch.classList.toggle('active', ch.dataset.style === c.style));
  }
  if (s.massSend) {
    const sel = document.getElementById('ms-template');
    if (sel) {
      sel.innerHTML = (s.massSend.templates || []).map(t => `<option value="${t.id}">${t.title}</option>`).join('');
      if (s.massSend.templates && s.massSend.templates[0]) xgSet('ms-content', s.massSend.templates[0].content);
    }
  }
  renderXgAccounts(s);
}

function renderXgAccounts(s) {
  const list = document.getElementById('multiAccountList');
  if (!list) return;
  const accs = s.accounts || [];
  list.innerHTML = accs.map(a => `<div class="account-item" data-id="${a.id}">
      <div class="account-status ${a.status}"></div>
      <div class="account-info">
        <div class="account-name">${a.name}</div>
        <div class="account-detail">${a.platform} | 今日+${a.todayAdd}好友 | ${a.todayChat}次聊天</div>
      </div>
      <div class="account-actions">
        <button class="btn btn-xs ${a.status==='online'?'btn-outline':'btn-primary'}" data-act="toggle">${a.status==='online'?'下线':'上线'}</button>
        <button class="btn btn-xs btn-outline" data-act="del" title="删除"><i class="fas fa-trash"></i></button>
      </div>
  </div>`).join('');
  const sum = document.getElementById('acc-summary');
  if (sum) sum.textContent = `在线 ${accs.filter(a=>a.status==='online').length}/${accs.length}`;
}

function renderXgDynamic(s) {
  if (!s) return;
  const f = document.getElementById('xg-friends'); if (f) f.textContent = xgFmt(s.stats.newFriends);
  const t = document.getElementById('xg-touch'); if (t) t.textContent = xgFmt(s.stats.activeTouch);
  const m = document.getElementById('xg-moments2'); if (m) m.textContent = xgFmt(s.stats.momentsInteractions);
  const g = document.getElementById('xg-group'); if (g) g.textContent = xgFmt(s.stats.groupMessages);

  const aa = s.autoAdd;
  const aaBadge = document.getElementById('aa-status');
  if (aaBadge) { aaBadge.textContent = aa.status === 'running' ? '运行中' : '已停止'; aaBadge.className = 'xg-status-badge ' + (aa.status === 'running' ? 'running' : 'stopped'); }
  const prog = document.getElementById('aa-progress');
  if (prog) {
    if (aa.status === 'running') {
      prog.style.display = 'block';
      const pct = aa.target ? Math.min(100, Math.round(aa.addedToday / aa.target * 100)) : 0;
      const fill = document.getElementById('aa-progress-fill'); if (fill) fill.style.width = pct + '%';
      const txt = document.getElementById('aa-progress-text'); if (txt) txt.textContent = `今日已加 ${aa.addedToday}/${aa.target} 人`;
    } else prog.style.display = 'none';
  }

  const mo = s.moments;
  const moBadge = document.getElementById('mo-status');
  if (moBadge) { moBadge.textContent = mo.status === 'running' ? '运行中' : '已停止'; moBadge.className = 'xg-status-badge ' + (mo.status === 'running' ? 'running' : 'stopped'); }
  const moCount = document.getElementById('mo-count');
  if (moCount) moCount.textContent = mo.status === 'running' ? `今日互动 ${mo.interactedToday} 次` : '';

  renderXgHistory(s);
}

function renderXgHistory(s) {
  const wrap = document.getElementById('ms-history-wrap');
  const tbl = document.getElementById('ms-history');
  if (!tbl) return;
  const hist = (s.massSend && s.massSend.history) || [];
  if (!hist.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  tbl.innerHTML = `<tr><th>时间</th><th>对象</th><th>人数</th><th>状态</th></tr>` +
    hist.map(h => `<tr><td>${fmtDateTime(h.time)}</td><td>${h.target}</td><td>${h.count}</td><td><span class="intention-tag high">${h.status}</span></td></tr>`).join('');
}

function startXgPoll() {
  if (xgPollTimer) return;
  xgPollTimer = setInterval(async () => {
    if (!xgState) return;
    try {
      if (xgState.autoAdd && xgState.autoAdd.status === 'running') {
        const j = await xgApi('/auto-add/tick', { method: 'POST', body: '{}' });
        if (j.ok) { xgState.autoAdd = j.data; xgState.stats = j.stats; }
      }
      if (xgState.moments && xgState.moments.status === 'running') {
        const j = await xgApi('/moments/tick', { method: 'POST', body: '{}' });
        if (j.ok) { xgState.moments = j.data; xgState.stats = j.stats; }
      }
      renderXgDynamic(xgState);
    } catch (e) { /* ignore */ }
  }, 3000);
}

function bindXgEvents() {
  // 自动加好友
  const aaStart = document.getElementById('aa-start');
  if (aaStart) aaStart.addEventListener('click', async () => {
    const config = { source: xgVal('aa-source'), dailyLimit: xgNum('aa-daily'), interval: xgNum('aa-interval'), verifyMsg: xgVal('aa-verify'), afterMsg: xgVal('aa-after'), runAccount: xgVal('aa-account') };
    const j = await xgApi('/auto-add/start', { method: 'POST', body: JSON.stringify({ config, dailyLimit: config.dailyLimit }) });
    if (j.ok) { xgState.autoAdd = j.data; renderXgDynamic(xgState); showToast('自动加好友已启动', 'success'); }
  });
  const aaStop = document.getElementById('aa-stop');
  if (aaStop) aaStop.addEventListener('click', async () => {
    const j = await xgApi('/auto-add/stop', { method: 'POST', body: '{}' });
    if (j.ok) { xgState.autoAdd = j.data; renderXgDynamic(xgState); showToast('已停止', 'info'); }
  });

  // 拟人聊天（AI）
  const chatGen = document.getElementById('chat-gen');
  if (chatGen) chatGen.addEventListener('click', async () => {
    const ctx = xgVal('chat-context');
    if (!ctx.trim()) { showToast('请先填写客户上文', 'error'); return; }
    document.getElementById('chat-loading').style.display = 'inline';
    const j = await xgApi('/chat/reply', { method: 'POST', body: JSON.stringify({ persona: xgVal('chat-persona'), scene: xgVal('chat-scene'), context: ctx }) });
    document.getElementById('chat-loading').style.display = 'none';
    if (j.ok) {
      document.getElementById('chat-cust-text').textContent = ctx;
      document.getElementById('chat-ai-text').textContent = j.reply;
      document.getElementById('chat-preview').style.display = 'block';
    } else showToast('生成失败：' + (j.error || ''), 'error');
  });
  const chatCopy = document.getElementById('chat-copy');
  if (chatCopy) chatCopy.addEventListener('click', () => copyText(document.getElementById('chat-ai-text').textContent));

  // 朋友圈运营
  document.querySelectorAll('#mo-style .chip').forEach(ch => ch.addEventListener('click', () => {
    document.querySelectorAll('#mo-style .chip').forEach(c => c.classList.remove('active')); ch.classList.add('active');
  }));
  const moStart = document.getElementById('mo-start');
  if (moStart) moStart.addEventListener('click', async () => {
    const style = document.querySelector('#mo-style .chip.active');
    const config = { like: document.getElementById('mo-like').checked, comment: document.getElementById('mo-comment').checked, style: style ? style.dataset.style : '温馨赞美', dailyLimit: xgNum('mo-daily') };
    const j = await xgApi('/moments/start', { method: 'POST', body: JSON.stringify({ config }) });
    if (j.ok) { xgState.moments = j.data; renderXgDynamic(xgState); showToast('朋友圈互动已启动', 'success'); }
  });
  const moStop = document.getElementById('mo-stop');
  if (moStop) moStop.addEventListener('click', async () => {
    const j = await xgApi('/moments/stop', { method: 'POST', body: '{}' });
    if (j.ok) { xgState.moments = j.data; renderXgDynamic(xgState); showToast('已停止', 'info'); }
  });
  const moGen = document.getElementById('mo-gen');
  if (moGen) moGen.addEventListener('click', async () => {
    const content = xgVal('mo-content');
    if (!content.trim()) { showToast('请填写朋友圈内容', 'error'); return; }
    const style = document.querySelector('#mo-style .chip.active');
    document.getElementById('mo-loading').style.display = 'inline';
    const j = await xgApi('/moments/comment', { method: 'POST', body: JSON.stringify({ content, style: style ? style.dataset.style : '温馨赞美' }) });
    document.getElementById('mo-loading').style.display = 'none';
    const out = document.getElementById('mo-comment-out');
    if (j.ok) { out.style.display = 'block'; out.textContent = '💬 ' + j.comment; } else showToast('生成失败：' + (j.error || ''), 'error');
  });

  // 千人千面群发
  const msTpl = document.getElementById('ms-template');
  if (msTpl) msTpl.addEventListener('change', () => {
    const t = (xgState.massSend.templates || []).find(x => x.id === msTpl.value);
    if (t) xgSet('ms-content', t.content);
  });
  const msPreview = document.getElementById('ms-preview-btn');
  if (msPreview) msPreview.addEventListener('click', async () => {
    const content = xgVal('ms-content');
    const j = await xgApi('/mass-send/preview', { method: 'POST', body: JSON.stringify({ content }) });
    if (j.ok) { document.getElementById('ms-preview-text').textContent = j.rendered; document.getElementById('ms-preview').style.display = 'block'; }
  });
  const msSave = document.getElementById('ms-save-tpl');
  if (msSave) msSave.addEventListener('click', async () => {
    const content = xgVal('ms-content');
    if (!content.trim()) { showToast('模板内容为空', 'error'); return; }
    const title = window.prompt('模板名称：', '群发模板') || '群发模板';
    const j = await xgApi('/mass-send/template', { method: 'POST', body: JSON.stringify({ title, content }) });
    if (j.ok) { xgState.massSend.templates.push(j.template); renderXgStatic(xgState); showToast('已保存模板', 'success'); }
  });
  const msDel = document.getElementById('ms-del-tpl');
  if (msDel) msDel.addEventListener('click', async () => {
    const id = xgVal('ms-template');
    if (!id) return;
    const j = await xgApi('/mass-send/template/' + id, { method: 'DELETE' });
    if (j.ok) { xgState.massSend.templates = xgState.massSend.templates.filter(t => t.id !== id); renderXgStatic(xgState); showToast('已删除模板', 'info'); }
  });
  const msSend = document.getElementById('ms-send');
  if (msSend) msSend.addEventListener('click', async () => {
    const content = xgVal('ms-content');
    if (!content.trim()) { showToast('请填写群发内容', 'error'); return; }
    const targetEl = document.querySelector('#ms-target input[name=sendTarget]:checked');
    const target = targetEl ? targetEl.value : '全部好友';
    const count = xgNum('ms-daily') || 200;
    const j = await xgApi('/mass-send/send', { method: 'POST', body: JSON.stringify({ target, content, count }) });
    if (j.ok) { xgState.stats = j.stats; renderXgDynamic(xgState); showToast('群发完成，已发送至 ' + count + ' 人', 'success'); }
  });

  // 多账号管理
  const accAdd = document.getElementById('acc-add');
  if (accAdd) accAdd.addEventListener('click', async () => {
    const name = xgVal('acc-name');
    if (!name.trim()) { showToast('请填写账号名称', 'error'); return; }
    const j = await xgApi('/accounts', { method: 'POST', body: JSON.stringify({ name, platform: xgVal('acc-platform') }) });
    if (j.ok) { xgState.accounts.push(j.account); renderXgAccounts(xgState); xgSet('acc-name', ''); showToast('已添加账号', 'success'); }
  });
  const list = document.getElementById('multiAccountList');
  if (list) list.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return;
    const item = btn.closest('.account-item'); const id = item.dataset.id; const act = btn.dataset.act;
    if (act === 'toggle') {
      const acc = xgState.accounts.find(a => a.id === id);
      const j = await xgApi('/accounts/' + id, { method: 'PUT', body: JSON.stringify({ status: acc.status === 'online' ? 'offline' : 'online' }) });
      if (j.ok) { const i = xgState.accounts.findIndex(a => a.id === id); xgState.accounts[i] = j.account; renderXgAccounts(xgState); }
    } else if (act === 'del') {
      const j = await xgApi('/accounts/' + id, { method: 'DELETE' });
      if (j.ok) { xgState.accounts = xgState.accounts.filter(a => a.id !== id); renderXgAccounts(xgState); showToast('已删除', 'info'); }
    }
  });
}

// ---------- AI人事（完整交互版）----------
let _rsState = null; // 缓存后端状态

const _RS_STATUS_COLOR = { '待处理':'#d97706', '已打招呼':'#3b82f6', '面试中':'#8b5cf6', '已录用':'#059669', '不合适':'#94a3b8' };

async function _rsApi(path, opt) {
    const res = await fetch('/api/renshi' + path, opt);
    return res.json();
}

async function initAiRenshi() {
    try {
        const j = await _rsApi('/state');
        if (!j.ok) { showToast('加载失败', 'error'); return; }
        _rsState = j.data;
        _rsFillPositionFilter();
        _rsFillConfig();
        renderResumeTable();
        _rsRenderStats();
    } catch (e) { showToast('AI人事加载失败：' + e.message, 'error'); }
}

function _rsRenderStats() {
    const s = _rsState.stats || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('rsTotal', s.total || 0);
    set('rsPending', s.pending || 0);
    set('rsGreeted', s.greeted || 0);
    set('rsInterview', s.interviewing || 0);
    set('rsHighMatch', s.highMatch || 0);
    const badge = document.getElementById('rsBadge');
    if (badge) badge.textContent = (s.total || 0) + '份';
}

function _rsFillPositionFilter() {
    const sel = document.getElementById('rsFilterPos');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">全部职位</option>' +
        (_rsState.positions || []).map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    sel.value = cur;
}

function _rsFillConfig() {
    const c = _rsState.config || {};
    const ag = document.getElementById('rsAutoGreet'); if (ag) ag.checked = !!c.autoGreet;
    const aa = document.getElementById('rsAutoAnswer'); if (aa) aa.checked = !!c.autoAnswer;
    const tpl = document.getElementById('rsGreetTpl'); if (tpl) tpl.value = c.greetTemplate || '';
    _rsRenderKnowledge();
}

function _rsRenderKnowledge() {
    const box = document.getElementById('rsKnowledge');
    if (!box) return;
    const items = (_rsState.config && _rsState.config.knowledge) || [];
    box.innerHTML = items.map((k, i) =>
        `<span class="chip">${_escHtml(k)} <i class="fas fa-times" style="cursor:pointer;font-size:10px;margin-left:4px" onclick="renshiDelKnowledge(${i})"></i></span>`
    ).join('') + '<button class="chip chip-add" onclick="renshiAddKnowledge()"><i class="fas fa-plus"></i></button>';
}

function renshiAddKnowledge() {
    const v = prompt('添加知识点（如：转正标准、试用期）');
    if (!v || !v.trim()) return;
    _rsState.config.knowledge = _rsState.config.knowledge || [];
    _rsState.config.knowledge.push(v.trim());
    _rsRenderKnowledge();
}
function renshiDelKnowledge(i) {
    _rsState.config.knowledge.splice(i, 1);
    _rsRenderKnowledge();
}

function renderResumeTable() {
    const tbody = document.getElementById('resumeBody');
    if (!tbody || !_rsState) return;
    const fp = (document.getElementById('rsFilterPos') || {}).value || '';
    const fs = (document.getElementById('rsFilterStatus') || {}).value || '';
    let list = _rsState.resumes || [];
    if (fp) list = list.filter(r => r.position === fp);
    if (fs) list = list.filter(r => r.status === fs);
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px">暂无符合条件的简历</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(r => {
        const mr = r.aiScored && r.matchRate != null
            ? `<span style="color:${r.matchRate>=80?'#059669':r.matchRate>=60?'#d97706':'#94a3b8'};font-weight:700">${r.matchRate}%</span>${r.recommend?`<br><span class="mini-tag ${r.recommend==='推荐'?'ok':r.recommend==='不推荐'?'no':''}">${r.recommend}</span>`:''}`
            : '<span style="color:#cbd5e1">未筛选</span>';
        return `<tr>
            <td><strong>${_escHtml(r.name)}</strong><br><span style="color:#94a3b8;font-size:12px">${r.gender} · ${r.age}岁</span></td>
            <td>${_escHtml(r.position)}</td>
            <td>${_escHtml(r.degree)} / ${_escHtml(r.exp)}</td>
            <td>${mr}</td>
            <td>${_escHtml(r.salary)}</td>
            <td>${_escHtml(r.lastActive)}</td>
            <td><span style="color:${_RS_STATUS_COLOR[r.status]||'#64748b'};font-weight:600">${r.status}</span></td>
            <td style="white-space:nowrap">
                <button class="btn btn-xs btn-primary" onclick="renshiDetail('${r.id}')" title="查看详情"><i class="fas fa-eye"></i></button>
                <button class="btn btn-xs btn-outline" onclick="renshiGreet('${r.id}')" title="AI打招呼"><i class="fas fa-comment-dots"></i></button>
            </td>
        </tr>`;
    }).join('');
}

async function renshiScreen() {
    const btn = document.getElementById('rsScreenBtn');
    const unscored = (_rsState.resumes || []).filter(r => !r.aiScored).length;
    if (unscored === 0) {
        if (!confirm('所有简历都已完成AI筛选，是否重新筛选全部？')) return;
    }
    const oldHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI 分析中...'; }
    showToast('🤖 DeepSeek 正在逐份评估简历，请稍候...', 'info');
    try {
        const j = await _rsApi('/screen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ onlyUnscored: unscored > 0 })
        });
        if (j.ok) {
            _rsState.resumes = j.resumes;
            _rsState.stats = j.stats;
            // 按匹配度降序排列
            _rsState.resumes.sort((a, b) => (b.matchRate || -1) - (a.matchRate || -1));
            renderResumeTable();
            _rsRenderStats();
            showToast(`✅ 完成筛选 ${j.updated} 份，已按匹配度排序`, 'success');
        } else {
            showToast('筛选失败：' + (j.error || '未知错误'), 'error');
        }
    } catch (e) {
        showToast('筛选失败：' + e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = oldHtml; }
    }
}

async function renshiGreet(id) {
    const r = (_rsState.resumes || []).find(x => x.id === id);
    if (!r) return;
    showToast('AI 正在生成打招呼话术...', 'info');
    try {
        const j = await _rsApi('/greet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, useAI: true })
        });
        if (j.ok) {
            const idx = _rsState.resumes.findIndex(x => x.id === id);
            if (idx >= 0) _rsState.resumes[idx] = j.data;
            _rsState.stats = j.stats;
            renderResumeTable();
            _rsRenderStats();
            alert('✅ 已向【' + r.name + '】发送打招呼：\n\n' + j.greeting);
        } else showToast('打招呼失败：' + (j.error || ''), 'error');
    } catch (e) { showToast('打招呼失败：' + e.message, 'error'); }
}

async function renshiDetail(id) {
    const r = (_rsState.resumes || []).find(x => x.id === id);
    if (!r) return;
    document.getElementById('resumeModalTitle').textContent = r.name + ' · ' + r.position;
    const body = document.getElementById('resumeModalBody');
    const matchBlock = r.aiScored && r.matchRate != null ? `
        <div class="rs-match-box">
            <div class="rs-match-ring" style="--v:${r.matchRate};--c:${r.matchRate>=80?'#059669':r.matchRate>=60?'#d97706':'#94a3b8'}">
                <span>${r.matchRate}<small>%</small></span>
            </div>
            <div>
                <div class="mini-tag ${r.recommend==='推荐'?'ok':r.recommend==='不推荐'?'no':''}" style="font-size:13px">${r.recommend||'—'}</div>
                <p style="margin:8px 0 0;color:#475569;font-size:13px">${_escHtml(r.summary||'')}</p>
            </div>
        </div>
        ${r.highlights&&r.highlights.length?`<div class="rs-sec"><strong style="color:#059669"><i class="fas fa-check-circle"></i> 亮点</strong><ul>${r.highlights.map(h=>`<li>${_escHtml(h)}</li>`).join('')}</ul></div>`:''}
        ${r.risks&&r.risks.length?`<div class="rs-sec"><strong style="color:#dc2626"><i class="fas fa-exclamation-triangle"></i> 风险点</strong><ul>${r.risks.map(h=>`<li>${_escHtml(h)}</li>`).join('')}</ul></div>`:''}
    ` : '<div class="rs-empty">该简历尚未进行 AI 筛选，点击下方「AI 评估」生成匹配度分析。</div>';

    const msgs = (r.messages || []).length ? `<div class="rs-sec"><strong><i class="fas fa-comments"></i> 沟通记录</strong>${
        r.messages.map(m => `<div class="rs-msg ${m.role==='hr'?'hr':'cand'}"><b>${m.role==='hr'?'HR':'求职者'}</b> <span style="color:#94a3b8">${m.time||''}</span><br>${_escHtml(m.text)}</div>`).join('')
    }</div>` : '';

    body.innerHTML = `
        <div class="rs-info-grid">
            <div><span>性别年龄</span>${r.gender} · ${r.age}岁</div>
            <div><span>学历</span>${_escHtml(r.degree)}</div>
            <div><span>院校专业</span>${_escHtml(r.school||'—')}</div>
            <div><span>工作经验</span>${_escHtml(r.exp)}</div>
            <div><span>期望薪资</span>${_escHtml(r.salary)}</div>
            <div><span>联系电话</span>${_escHtml(r.phone||'—')}</div>
            <div><span>最后活跃</span>${_escHtml(r.lastActive)}</div>
            <div><span>当前状态</span><b style="color:${_RS_STATUS_COLOR[r.status]||'#64748b'}">${r.status}</b></div>
        </div>
        ${matchBlock}
        ${msgs}
    `;
    const footer = document.getElementById('resumeModalFooter');
    footer.innerHTML = `
        ${!r.aiScored ? `<button class="btn btn-outline" onclick="renshiScreenOne('${r.id}')"><i class="fas fa-robot"></i> AI 评估</button>` : ''}
        <button class="btn btn-outline" onclick="renshiGreet('${r.id}');closeModal('resumeModal')"><i class="fas fa-comment-dots"></i> AI 打招呼</button>
        <select class="form-control form-control-sm" style="width:auto" onchange="renshiSetStatus('${r.id}',this.value)">
            ${['待处理','已打招呼','面试中','已录用','不合适'].map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}
        </select>
        <button class="btn btn-primary" onclick="closeModal('resumeModal')">关闭</button>
    `;
    document.getElementById('resumeModal').style.display = 'flex';
}

async function renshiScreenOne(id) {
    // 复用批量接口筛选未评分的（含该条），简单起见直接触发一次筛选
    closeModal('resumeModal');
    await renshiScreen();
    renshiDetail(id);
}

async function renshiSetStatus(id, status) {
    try {
        const j = await _rsApi('/resume/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status })
        });
        if (j.ok) {
            const idx = _rsState.resumes.findIndex(x => x.id === id);
            if (idx >= 0) _rsState.resumes[idx] = j.data;
            _rsState.stats = j.stats;
            renderResumeTable();
            _rsRenderStats();
            showToast('状态已更新为「' + status + '」', 'success');
        }
    } catch (e) { showToast('更新失败：' + e.message, 'error'); }
}

async function renshiNewResume() {
    try {
        const j = await _rsApi('/resume/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (j.ok) {
            _rsState.resumes.unshift(j.data);
            _rsState.stats = j.stats;
            renderResumeTable();
            _rsRenderStats();
            showToast('📥 新简历进线：' + j.data.name + ' 应聘' + j.data.position, 'success');
        }
    } catch (e) { showToast('进线失败：' + e.message, 'error'); }
}

async function renshiSaveConfig() {
    const cfg = {
        autoGreet: document.getElementById('rsAutoGreet').checked,
        autoAnswer: document.getElementById('rsAutoAnswer').checked,
        greetTemplate: document.getElementById('rsGreetTpl').value,
        knowledge: (_rsState.config && _rsState.config.knowledge) || []
    };
    try {
        const j = await _rsApi('/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cfg)
        });
        if (j.ok) { _rsState.config = j.config; showToast('✅ 配置已保存', 'success'); }
    } catch (e) { showToast('保存失败：' + e.message, 'error'); }
}

async function renshiQa() {
    const input = document.getElementById('rsQaInput');
    const result = document.getElementById('rsQaResult');
    const q = (input.value || '').trim();
    if (!q) { showToast('请输入求职者问题', 'error'); return; }
    result.style.display = 'block';
    result.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI 思考中...';
    try {
        const j = await _rsApi('/qa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: q })
        });
        if (j.ok) {
            result.innerHTML = '<div class="qa-q"><b>求职者：</b>' + _escHtml(q) + '</div><div class="qa-a"><b><i class="fas fa-robot"></i> AI：</b>' + _escHtml(j.answer) + '</div>';
        } else result.innerHTML = '<span style="color:#dc2626">生成失败：' + (j.error || '') + '</span>';
    } catch (e) { result.innerHTML = '<span style="color:#dc2626">生成失败：' + e.message + '</span>'; }
}

function renshiExport() {
    if (!_rsState || !_rsState.resumes.length) { showToast('暂无数据', 'error'); return; }
    const headers = ['姓名','性别','年龄','应聘职位','学历','院校','经验','期望薪资','电话','AI匹配度','推荐','状态','最后活跃'];
    const rows = _rsState.resumes.map(r => [
        r.name, r.gender, r.age, r.position, r.degree, r.school || '', r.exp, r.salary, r.phone || '',
        r.aiScored ? r.matchRate + '%' : '未筛选', r.recommend || '', r.status, r.lastActive
    ]);
    const csv = '\ufeff' + [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '简历列表_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    showToast('已导出 ' + rows.length + ' 条简历', 'success');
}

// ---------- AI客服（完整交互版）----------
let _kefuState = null; // 缓存后端状态
let _kefuActiveConv = null; // 当前选中的会话

async function initAiKefu() {
  await _kefuLoadState();
  _kefuRenderConversationList();
  _kefuRenderActiveChat();
  _kefuBindEvents();
  _kefuRenderStats();
}

async function _kefuLoadState() {
  try {
    const res = await fetch('/api/kefu/state');
    const j = await res.json();
    if (j.ok) { _kefuState = j.data; _kefuActiveConv = j.data.conversations.find(c => c.id === j.data.activeId) || j.data.conversations[0] || null; }
  } catch(e) { console.warn('AI客服加载状态失败', e); }
}

function _kefuRenderStats() {
  // 更新头部 badge
  const badge = document.querySelector('#page-ai-kefu .badge-count');
  if (badge && _kefuState?.stats) {
    badge.textContent = _kefuState.stats.activeCount + '进行中';
  }
  // 更新右侧统计面板
  const statEls = document.querySelectorAll('.mini-stat-v .value');
  if (statEls.length >= 4 && _kefuState?.stats) {
    const s = _kefuState.stats;
    statEls[0].textContent = s.totalReceived || 0;
    statEls[1].textContent = (s.avgResponseSec || 0) + '秒';
    statEls[2].textContent = (s.resolveRate || 0) + '%';
    statEls[3].textContent = (s.satisfaction || 0) + '/5';
  }
}

function _kefuRenderConversationList() {
  const list = document.getElementById('conversationList');
  if (!list || !_kefuState) return;
  list.innerHTML = _kefuState.conversations.map(c => `
    <div class="conversation-item ${c.id === (_kefuActiveConv?.id || _kefuState.activeId) ? 'active' : ''}" data-cid="${c.id}">
      <div class="conv-avatar">${c.avatar || c.name[0]}</div>
      <div class="conv-info">
        <div class="conv-customer">${_escHtml(c.name)}</div>
        <div class="conv-topic">${_escHtml(c.topic)}</div>
      </div>
      ${c.unread > 0 ? '<div class="conv-badge"></div>' : ''}
      ${c.status === 'chatting' ? '<div class="conv-online" style="position:absolute;right:8px;top:16px;width:8px;height:8px;border-radius:50%;background:#10b981;"></div>' : ''}
    </div>
  `).join('');
  // 绑定点击
  list.querySelectorAll('.conversation-item').forEach(el => {
    el.addEventListener('click', () => _kefuSwitchConv(el.dataset.cid));
  });
}

function _kefuRenderActiveChat() {
  const conv = _kefuActiveConv;
  // 更新头部客户信息
  const nameEl = document.querySelector('.chat-user-name');
  if (nameEl) nameEl.textContent = conv ? conv.name : '未选择会话';
  const sourceEl = document.querySelector('.chat-user-source');
  if (sourceEl && conv) sourceEl.innerHTML = `<i class="fab fa-${conv.platform === 'qywx' ? 'weixin' : conv.platform === 'douyin' ? 'tiktok' : 'weixin'}"></i> ${_escHtml(conv.source)} · ${_escHtml(conv.topic)}`;
  const statusTag = document.querySelector('.kefu-chat-panel .intention-tag');
  if (statusTag && conv) {
    statusTag.textContent = conv.status === 'chatting' ? '咨询中' : conv.status === 'pending' ? '待接待' : '已结束';
    statusTag.className = 'intention-tag ' + (conv.status === 'chatting' ? 'medium' : conv.status === 'pending' ? 'low' : '');
  }

  // 渲染消息
  const msgsEl = document.getElementById('kefuChatMessages');
  if (msgsEl) {
    if (!conv || !conv.messages.length) {
      msgsEl.innerHTML = '<div class="msg system-msg" style="text-align:center;padding:40px 16px;color:#9ca3af;"><i class="fas fa-comments" style="font-size:32px;margin-bottom:12px;display:block;"></i>选择左侧会话开始对话，或点击下方"模拟新客户进线"</div>';
    } else {
      msgsEl.innerHTML = conv.messages.map(m =>
        `<div class="msg msg-${m.role === 'customer' ? 'received' : 'sent'}"><div>${_escHtml(m.text).replace(/\n/g, '<br>')}</div><div class="msg-meta">${m.time}${m.ai ? ' · <span style="color:#7c3aed">AI智能回复</span>' : ''}</div></div>`
      ).join('');
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
  }

  // 更新右侧客户信息面板
  const profileName = document.querySelector('.customer-profile .profile-field:first-child span');
  if (profileName && conv) profileName.textContent = conv.name;
  const profileSource = document.querySelectorAll('.customer-profile .profile-field span')[1];
  if (profileSource && conv) profileSource.textContent = conv.source;
  const profileSessions = document.querySelectorAll('.customer-profile .profile-field span')[2];
  if (profileSessions && conv) profileSessions.textContent = (conv.stats?.sessionCount || 1) + '次';
  const tagsEl = document.querySelector('.customer-profile .profile-field:last-child');
  if (tagsEl && conv) {
    tagsEl.innerHTML = '<label>标签：</label>' + (conv.tags && conv.tags.length ? conv.tags.map(t => `<span class="tag tag-purple">${_escHtml(t)}</span>`).join(' ') : '<span style="color:#9ca3af">暂无</span>');
  }

  // 渲染话术库（当前分类）
  _kefuRenderScripts();

  // 清除 AI 建议
  const aiReply = document.getElementById('kefuAiReply');
  if (aiReply) { const sp = aiReply.querySelector('span'); if (sp) sp.textContent = '发送消息后，AI将根据上下文自动生成建议回复…'; }
}

async function _kefuSwitchConv(cid) {
  if (!_kefuState) return;
  // 高亮选中
  document.querySelectorAll('#conversationList .conversation-item').forEach(el => {
    el.classList.toggle('active', el.dataset.cid === cid);
  });
  // 切换到该会话
  try {
    const res = await fetch('/api/kefu/conversation/switch', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ id: cid })
    });
    const j = await res.json();
    if (j.ok) {
      _kefuActiveConv = j.data;
      _kefuRenderActiveChat();
      // 刷新列表以更新未读数
      _kefuLoadState().then(() => _kefuRenderConversationList());
    }
  } catch(e) { console.error('切换会话失败', e); }
}

// 发送人工消息
async function _kefuSend() {
  const ta = document.getElementById('kefuInput');
  if (!ta || !ta.value.trim()) return;
  if (!_kefuActiveConv) { showToast('请先选择一个会话', 'warning'); return; }
  const text = ta.value.trim();
  ta.value = '';
  try {
    const res = await fetch('/api/kefu/message/send', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ convId: _kefuActiveConv.id, text })
    });
    const j = await res.json();
    if (j.ok) {
      _kefuActiveConv.messages.push(j.data);
      _kefuRenderActiveChat(); // 重新渲染聊天区
    }
  } catch(e) { showToast('发送失败：' + e.message, 'error'); }
}

// AI 智能回复
async function _kefuAiReply() {
  if (!_kefuActiveConv) { showToast('请先选择一个会话', 'warning'); return; }
  const btn = event?.target?.closest('button');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 思考中...'; }
  try {
    const res = await fetch('/api/kefu/message/ai-reply', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ convId: _kefuActiveConv.id })
    });
    const j = await res.json();
    if (j.ok) {
      _kefuActiveConv.messages.push(j.data);
      _kefuRenderActiveChat();
      // 同时填充 AI 建议条和输入框
      const sug = document.getElementById('kefuAiReply');
      const sp = sug?.querySelector('span');
      if (sp) sp.textContent = j.data.text;
      showToast('AI已生成回复', 'success');
    }
  } catch(e) { showToast('AI回复失败：' + e.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-robot"></i> AI回复'; } }
}

// 采用 AI 建议
function useKefuReply() {
  const sug = document.getElementById('kefuAiReply');
  const ta = document.getElementById('kefuInput');
  if (sug && ta) { const sp = sug.querySelector('span'); if (sp) { ta.value = sp.textContent.trim(); ta.focus(); showToast('已采用AI建议', 'success'); } }
}

// 话术库渲染
function loadScriptList(category) { _kefuRenderScripts(category); }

function _kefuRenderScripts(category) {
  const list = document.getElementById('scriptList');
  if (!list) return;
  const cat = category || document.querySelector('.script-cat.active')?.textContent?.trim() || '常见问题';
  let items = [];
  if (_kefuState?.scripts?.[cat]) {
    items = _kefuState.scripts[cat];
  } else {
    // fallback 静态数据
    const fallback = {
      '常见问题': ['如何查看订单？','如何申请退款？','配送范围有哪些？','支付方式说明','如何修改收货地址？'],
      '产品介绍': ['产品功能概览','版本对比','定价方案','适用场景','客户案例'],
      '售后政策': ['退换货规则','质保期限说明','维修流程','投诉渠道','补偿标准'],
      '促销活动': ['当前优惠活动','优惠券使用规则','满减活动','会员特权','推荐返利']
    };
    items = fallback[cat] || fallback['常见问题'];
  }
  list.innerHTML = items.map(s => `<div class="script-item" title="点击填入回复框">${_escHtml(s)}</div>`).join('');
  list.querySelectorAll('.script-item').forEach(it => {
    it.addEventListener('click', () => {
      const ta = document.getElementById('kefuInput');
      if (ta) { ta.value = it.innerText.trim(); ta.focus(); showToast('已填入回复框', 'success'); }
    });
  });
}

// AI 生成话术
async function genKefuScripts() {
  const activeCat = document.querySelector('.script-cat.active');
  const category = activeCat ? activeCat.textContent.trim() : '常见问题';
  const list = document.getElementById('scriptList');
  if (!list) return;
  const oldHtml = list.innerHTML;
  list.innerHTML = '<div class="script-item" style="color:#3b82f6"><i class="fas fa-spinner fa-spin"></i> AI生成话术中...</div>';
  try {
    const res = await fetch('/api/kefu/scripts/generate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ category })
    });
    const j = await res.json();
    const scripts = j.scripts || [];
    if (scripts.length > 0) {
      list.innerHTML = scripts.map(s =>
        `<div class="script-item" title="点击填入回复框">${s.title ? ('<strong>' + _escHtml(s.title) + '</strong><br>') : ''}${_escHtml(s.content)}</div>`
      ).join('');
      list.querySelectorAll('.script-item').forEach(it => {
        it.addEventListener('click', () => {
          const ta = document.getElementById('kefuInput');
          if (ta) { ta.value = it.innerText.trim(); ta.focus(); showToast('已填入回复框', 'success'); }
        });
      });
      // 更新本地缓存
      if (_kefuState) {
        _kefuState.scripts[category] = scripts.map(s => s.title ? (s.title + '：' + s.content) : s.content);
      }
      // 也填充 AI 建议条
      const sug = document.getElementById('kefuAiReply');
      if (sug && scripts[0]) { const sp = sug.querySelector('span'); if (sp) sp.textContent = scripts[0].content; }
      showToast('已生成 ' + scripts.length + ' 条话术', 'success');
    } else {
      list.innerHTML = oldHtml;
      showToast('未生成结果', 'warning');
    }
  } catch (e) {
    list.innerHTML = oldHtml;
    showToast('生成失败：' + e.message, 'error');
  }
}

// 模拟新客户进线
async function _kefuSimulateNew() {
  const platforms = ['wechat', 'qywx', 'douyin'];
  const plat = platforms[randInt(0, 2)];
  const firstMessages = [
    '你好，我想了解一下你们的产品',
    '请问你们有企业版的吗？大概多少钱？',
    '我之前买的东西什么时候发货？',
    '你们这个系统支持哪些功能？能试用吗？',
    '想咨询一下代理合作的事情',
    '登录不上去了，一直提示错误',
    '需要开一张发票，怎么操作？',
    '怎么联系你们客服？电话多少？'
  ];
  try {
    const res = await fetch('/api/kefu/conversation/create', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        platform: plat,
        firstMessage: firstMessages[randInt(0, firstMessages.length - 1)]
      })
    });
    const j = await res.json();
    if (j.ok) {
      await _kefuLoadState();
      _kefuActiveConv = j.data;
      _kefuRenderConversationList();
      _kefuRenderActiveChat();
      _kefuRenderStats();
      showToast(`新客户「${j.data.name}」已进线`, 'success');
    }
  } catch(e) { showToast('模拟失败：' + e.message, 'error'); }
}

function _kefuBindEvents() {
  // 平台 tab 切换
  document.querySelectorAll('.kefu-platform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.parentElement.querySelectorAll('.kefu-platform-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // 可以按平台过滤会话列表
      const plat = btn.dataset.platform;
      document.querySelectorAll('#conversationList .conversation-item').forEach(el => {
        el.style.display = ''; // 当前不过滤，后续可扩展
      });
    });
  });

  // 话术分类切换
  document.querySelectorAll('.script-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.parentElement.querySelectorAll('.script-cat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _kefuRenderScripts();
    });
  });

  // 发送按钮
  const sendBtn = document.querySelector('.kefu-chat-panel .send-btn');
  if (sendBtn) sendBtn.addEventListener('click', _kefuSend);

  // 回车发送
  const chatTa = document.getElementById('kefuInput');
  if (chatTa) chatTa.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _kefuSend(); } });

  // 标记按钮
  const markBtn = document.querySelector('.kefu-chat-panel .chat-actions .btn-outline');
  if (markBtn) markBtn.addEventListener('click', async () => {
    if (!_kefuActiveConv) return;
    const newStatus = _kefuActiveConv.status === 'ended' ? 'chatting' : 'ended';
    try {
      const res = await fetch('/api/kefu/conversation/status', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ id: _kefuActiveConv.id, status: newStatus })
      });
      const j = await res.json();
      if (j.ok) {
        Object.assign(_kefuActiveConv, j.data);
        _kefuRenderActiveChat();
        _kefuRenderConversationList();
        showToast(newStatus === 'ended' ? '已标记为结束' : '已重新打开', 'success');
      }
    } catch(e) {}
  });
}

function fillConversationList() {} // 兼容旧调用，由 initAiKefu 接管
function fillKefuChat() {} // 同上
function fillScriptList(cat) { _kefuRenderScripts(cat); }

// ---------- 法务专员 ----------
function initFalv() { fillLawSearchResults(); }

function fillLawSearchResults() {
    const results = document.getElementById('lawSearchResults');
    if (!results) return;
    const laws = [
        {title:'《中华人民共和国民法典》合同编', desc: '涵盖合同的订立、效力、履行、变更、转让、终止及违约责任等全面规定。适用于各类民商事合同纠纷的处理依据。', tags:['合同法','违约责任','民法典']},
        {title:'《劳动合同法》相关条款解读', desc: '明确用人单位与劳动者之间权利义务关系，包括劳动合同订立、解除、经济补偿、社保缴纳等核心内容。', tags:['劳动法','用工规范','经济补偿']},
        {title:'《消费者权益保护法》重点条文', desc: '保护消费者合法权益，规定经营者义务、消费者权利、争议解决途径、惩罚性赔偿等条款。', tags:['消法','消费者权益','三包规定']},
        {title:'最高人民法院关于审理买卖合同纠纷案件的规定', desc: '针对买卖合同纠纷案件的审理程序、证据认定、责任划分等作出具体司法解释。', tags:['司法解释','买卖合同','证据规则']},
        {title:'《公司法》股权转让相关规定', desc: '涉及有限责任公司股权转让的程序、限制条件、优先购买权等法律要点解析。', tags:['公司法','股权','转让流程']},
    ];
    results.innerHTML = laws.map(l => `<div class="law-result-item">
        <div class="law-title">${l.title}</div>
        <div class="law-desc">${l.desc}</div>
        <div class="law-tags">${l.tags.map(t=>`<span class="tag tag-purple">${t}</span>`).join('')}</div>
    </div>`).join('');
}

function askLegalTopic(topic) {
    const container = document.getElementById('consultMessages');
    if (!container) return;
    container.innerHTML += `<div class="msg msg-received"><div><strong>咨询问题：</strong>${topic}</div><div class="msg-meta">刚刚</div></div>`;
    setTimeout(() => {
        container.innerHTML += `<div class="msg msg-sent system-msg" style="background:white;border:none;"><div style="text-align:left;">
            <h4 style="color:var(--primary);margin-bottom:8px;">📋 关于「${topic}」的法律意见</h4>
            <p style="line-height:1.8;color:var(--text-secondary)">
            根据您的问题，以下是我们基于现行法律法规的分析和建议：
            <br><br>
            <strong style="color:var(--text-primary)">一、法律依据</strong><br>
            相关法律主要涉及《中华人民共和国民法典》《劳动合同法》等相关条款。具体条款会根据您的实际情况有所不同。
            <br><br>
            <strong style="color:var(--text-primary)">二、关键风险点</strong><br>
            ⚠️ 风险1：合同条款需明确约定各方权利义务<br>
            ⚠️ 风险2：注意诉讼时效（一般为3年）<br>
            ⚠️ 风险3：保留好相关证据材料
            <br><br>
            <strong style="color:var(--text-primary)">三、建议措施</strong><br>
            ✅ 建议先通过友好协商方式解决<br>
            ✅ 协商不成可向有关部门投诉举报<br>
            ✅ 必要时可通过法律途径维护权益<br>
            ✅ 建议咨询专业律师获取针对性方案
            </p>
            <p style="margin-top:10px;font-size:11px;color:#9ca3af;">⚖️ 以上内容由AI生成仅供参考，具体法律问题请咨询执业律师</p>
        </div><div class="msg-meta">刚刚 · AI法律助手</div></div>`;
        container.scrollTop = container.scrollHeight;
    }, 1200);
    container.scrollTop = container.scrollHeight;
}

function askLegal() {
    const input = document.getElementById('legalQuestion');
    if (!input?.value.trim()) { alert('请输入法律问题'); return; }
    askLegalTopic(input.value.trim());
    input.value = '';
}

// ---------- 企业智脑 ----------
function initQiyeZhinao() { fillTeamRanking(); }

function fillTeamRanking() {
    const list = document.getElementById('teamRanking');
    if (!list) return;
    const team = [
        {name:'销售一组', value:'¥128.5万'}, {name:'销售二组', value:'¥96.2万'},
        {name:'销售三组', value:'¥87.8万'}, {name:'拓客组', value:'¥72.3万'},
        {name:'客服组', value:'¥45.6万'}, {name:'运营组', value:'¥38.9万'}
    ];
    list.innerHTML = team.map((t,i) => `<div class="ranking-item">
        <span class="rank-num ${i<3?(i===0?'rank-1':i===1?'rank-2':'rank-3'):'rank-other'}">${i+1}</span>
        <span class="rank-name">${t.name}</span>
        <span class="rank-value">${t.value}</span>
    </div>`).join('');
}

function openZhinaoTool(tool) { alert(`🧠 「${tool}」工具即将开放！\n\n该功能将接入AI大模型能力，为您提供：\n• 智能内容生成\n• 数据可视化分析\n• 一键报告输出\n\n（完整功能需要配置API Key）`); }

// ---------- AI创作 ----------
function initAiChuangzuo() {
    const gallery = document.getElementById('worksGallery');
    if (!gallery) return;
    const icons = ['fa-film','fa-image','fa-video','fa-photo-video','fa-clapperboard','fa-film','fa-video','fa-photo-video'];
    const titles = ['产品展示-卡点版','数字人口播-新品发布','文生视频-品牌故事','爆款-情感叙事','产品教程-干货版','活动宣传-快节奏','客户见证-真实风','品牌形象-大气版'];
    gallery.innerHTML = Array.from({length:8},(_,i) => `<div class="work-item">
        <div class="work-thumb"><i class="fas ${icons[i]}"></i></div>
        <div class="work-info"><div class="work-name">${titles[i]}</div><div class="work-meta">${fmtDate(randInt(0,5),0)} · ${randInt(15,60)}秒 · ${['竖屏','横屏'][i%2]}</div></div>
    </div>`).join('');
}

// ---------- 通知中心 ----------
(function initNotifications() {
    const list = document.getElementById('notificationList');
    if (!list) return;
    const notifs = [
        {icon:'fa-map-marked-alt', bg:'#7c3aed', text:'地图获客任务完成：发现 86 个目标商家', time:'刚刚'},
        {icon:'fa-exclamation-triangle', bg:'#f59e0b', text:'直播间监控提醒："XX车行"在线人数突破 3000', time:'3分钟前'},
        {icon:'fa-user-plus', bg:'#10b981', text:'公转私成功转化：张先生 → 企业微信', time:'12分钟前'},
    ];
    list.innerHTML = notifs.map(n => `<div class="notification-item">
        <div class="notif-icon" style="background:${n.bg}"><i class="fas ${n.icon}"></i></div>
        <div class="notif-text"><div>${n.text}</div><div class="notif-time">${n.time}</div></div>
    </div>`).join('');
})();

// ---------- 全局搜索 ----------
document.getElementById('globalSearch')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) alert(`🔍 搜索：「${query}」\n\n（全局搜索功能将检索：客户数据、关键词库、聊天记录、文件资源等）`);
    }
});

// ---------- 认证与登录 ----------
let currentUser = null;

async function initAuth() {
    try {
        const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
        const j = await res.json().catch(() => ({ ok: false }));
        if (!res.ok || !j.ok || !j.user) {
            showAuthModal();
            return false;
        }
        currentUser = j.user;
        updateUserBadge();
        hideAuthModal();
        return true;
    } catch (e) {
        showAuthModal();
        return false;
    }
}

function showAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'flex';
}

function hideAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'none';
}

function updateUserBadge() {
    const nameEl = document.getElementById('currentUserName');
    if (nameEl) {
        const label = currentUser ? (currentUser.displayName || currentUser.username) : '管理员';
        nameEl.textContent = label;
    }
    const roleEl = document.getElementById('userRoleLabel');
    if (roleEl) {
        roleEl.textContent = currentUser && currentUser.role === 'admin' ? '管理员' : '销售';
    }
}

async function loginSubmit() {
    if (loginSubmit._busy) return;              // 防重复提交
    const username = document.getElementById('loginUsername')?.value.trim() || '';
    const password = document.getElementById('loginPassword')?.value || '';
    const status = document.getElementById('loginStatus');
    if (!username || !password) {
        if (status) status.textContent = '请输入用户名和密码';
        return;
    }
    loginSubmit._busy = true;
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.disabled = true;
    if (status) status.textContent = '登录中...';
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || '登录失败');
        currentUser = j.user;
        updateUserBadge();
        hideAuthModal();
        if (status) status.textContent = '';
        showToast('登录成功', 'success');
        initAfterAuth();                        // 登录后完成页面初始化（设置页事件、看板计数等）
    } catch (e) {
        if (status) status.textContent = e.message || '登录失败';
        showToast('登录失败：' + (e.message || '未知错误'), 'error');
    } finally {
        loginSubmit._busy = false;
        if (loginBtn) loginBtn.disabled = false;
    }
}

async function logoutSubmit() {
    try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (e) {}
    currentUser = null;
    updateUserBadge();
    showAuthModal();
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) loginPassword.value = '';
    showToast('已退出登录', 'info');
}

// ---------- 设置页：真实配置与数据管理 ----------
async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const j = await res.json();
        if (!j || !j.ok || !j.config) return;
        const cfg = j.config;

        const apiKey = document.getElementById('apiKeyInput');
        if (apiKey) apiKey.value = cfg.deepseekApiKey || '';

        const apiBaseUrl = document.getElementById('apiBaseUrlInput');
        if (apiBaseUrl) apiBaseUrl.value = cfg.deepseekBaseUrl || 'https://api.deepseek.com';

        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect) {
            const hasValue = Array.from(modelSelect.options).some(opt => opt.value === (cfg.deepseekModel || 'deepseek-chat'));
            modelSelect.value = hasValue ? (cfg.deepseekModel || 'deepseek-chat') : 'deepseek-chat';
        }

        const productName = document.getElementById('productNameInput');
        if (productName) productName.value = cfg.productName || '示例产品';

        const productDesc = document.getElementById('productDescInput');
        if (productDesc) productDesc.value = cfg.productDesc || '';

        const targetCustomer = document.getElementById('targetCustomerInput');
        if (targetCustomer) targetCustomer.value = cfg.targetCustomer || '';

        const productAdvantages = document.getElementById('productAdvantagesInput');
        if (productAdvantages) productAdvantages.value = cfg.productAdvantages || '';

        const dataStats = cfg.dataStats || {};
        const customerCount = document.getElementById('settingsCustomerCount');
        if (customerCount) customerCount.textContent = Number(dataStats.customers || 0).toLocaleString();

        const templateCount = document.getElementById('settingsTemplateCount');
        if (templateCount) templateCount.textContent = Number(dataStats.templates || 0).toLocaleString();

        const backupCount = document.getElementById('settingsBackupCount');
        if (backupCount) backupCount.textContent = Number(dataStats.backups || 0).toLocaleString();

        const hint = document.getElementById('configSourceHint');
        if (hint) {
            const src = j.config.configSource || {};
            const fromFile = src.deepseekApiKey === 'settings.json';
            hint.textContent = fromFile
                ? '（当前密钥来自「页面配置」，已覆盖 .env）'
                : '（当前密钥来自 .env 配置文件）';
        }
    } catch (e) {
        console.error('加载设置失败:', e);
    }
}

async function saveSettings() {
    const payload = {
        deepseekApiKey: document.getElementById('apiKeyInput')?.value || '',
        deepseekBaseUrl: document.getElementById('apiBaseUrlInput')?.value || 'https://api.deepseek.com',
        deepseekModel: document.getElementById('modelSelect')?.value || 'deepseek-chat',
        productName: document.getElementById('productNameInput')?.value || '',
        productDesc: document.getElementById('productDescInput')?.value || '',
        targetCustomer: document.getElementById('targetCustomerInput')?.value || '',
        productAdvantages: document.getElementById('productAdvantagesInput')?.value || ''
    };

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || '保存失败');
        showToast('配置已保存', 'success');
        await loadSettings();
    } catch (e) {
        showToast('保存失败：' + (e.message || '未知错误'), 'error');
    }
}

async function testApiConnection() {
    const resultEl = document.getElementById('apiTestResult');
    const apiKey = document.getElementById('apiKeyInput')?.value || '';
    const apiBaseUrl = document.getElementById('apiBaseUrlInput')?.value || 'https://api.deepseek.com';
    const model = document.getElementById('modelSelect')?.value || 'deepseek-chat';

    if (!apiKey.trim()) {
        if (resultEl) resultEl.innerHTML = '<span style="color:#dc2626">⚠️ 请先填写 DeepSeek API Key</span>';
        return;
    }

    if (resultEl) resultEl.innerHTML = '<span style="color:#3b82f6">⏳ 测试中...</span>';
    try {
        const res = await fetch('/api/settings/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deepseekApiKey: apiKey, deepseekBaseUrl: apiBaseUrl, deepseekModel: model })
        });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || '连接失败');
        if (resultEl) resultEl.innerHTML = '<span style="color:#10b981">✅ 连接成功</span>';
        showToast('DeepSeek 连接成功', 'success');
    } catch (e) {
        if (resultEl) resultEl.innerHTML = '<span style="color:#dc2626">❌ ' + escapeHtml(e.message || '连接失败') + '</span>';
        showToast('连接失败：' + (e.message || '未知错误'), 'error');
    }
}

async function exportAllData() {
    try {
        const res = await fetch('/api/settings/export', { method: 'POST' });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || '导出失败');

        if (j.filePath) {
            const downloadUrl = '/download?file=' + encodeURIComponent(j.filePath.replace(/\\/g, '/'));
            window.open(downloadUrl, '_blank');
        }
        showToast('导出成功，已生成备份文件', 'success');
        await loadSettings();
    } catch (e) {
        showToast('导出失败：' + (e.message || '未知错误'), 'error');
    }
}

async function clearAllCache() {
    try {
        const res = await fetch('/api/settings/clear-cache', { method: 'POST' });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || '清理失败');
        showToast('缓存已清理：' + (j.cleared || 0) + ' 个文件', 'success');
        await loadSettings();
    } catch (e) {
        showToast('清理失败：' + (e.message || '未知错误'), 'error');
    }
}

// ---------- 数据重置（自定义弹窗，规避嵌入式预览拦截原生 confirm/prompt） ----------
function openResetModal() {
    const input = document.getElementById('resetConfirmInput');
    const err = document.getElementById('resetError');
    const keep = document.getElementById('resetKeepUsers');
    if (input) input.value = '';
    if (err) { err.style.display = 'none'; err.textContent = ''; }
    if (keep) keep.checked = true;
    const modal = document.getElementById('resetModal');
    if (modal) modal.style.display = 'flex';
    if (input) setTimeout(() => input.focus(), 30);
}

function closeResetModal() {
    const modal = document.getElementById('resetModal');
    if (modal) modal.style.display = 'none';
}

function showResetError(msg) {
    const err = document.getElementById('resetError');
    if (!err) return;
    err.textContent = msg;
    err.style.display = 'block';
}

async function resetAllData() {
    const input = document.getElementById('resetConfirmInput');
    const token = (input ? input.value : '').trim();
    if (token !== 'RESET_ALL_DATA') {
        showResetError('确认口令不正确，请输入 RESET_ALL_DATA');
        if (input) input.focus();
        return;
    }
    const keepEl = document.getElementById('resetKeepUsers');
    const keepUsers = keepEl ? !!keepEl.checked : true;
    const btn = document.getElementById('resetConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = '重置中…'; }

    try {
        const res = await fetch('/api/settings/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: 'RESET_ALL_DATA', keepUsers })
        });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || '重置失败');
        closeResetModal();
        const d = j.deleted || {};
        const total = Object.keys(d).reduce((s, k) => s + (Number(d[k]) || 0), 0);
        showToast('数据已重置：清空 ' + total + ' 条记录' + (keepUsers ? '，登录账号已保留' : '') + '，备份已生成', 'success');
        await loadSettings();
        await refreshRemindBadge();
    } catch (e) {
        showResetError('重置失败：' + (e.message || '未知错误'));
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '确认重置'; }
    }
}

function bindSettingsEvents() {
    const saveApiConfigBtn = document.getElementById('saveApiConfigBtn');
    if (saveApiConfigBtn) saveApiConfigBtn.addEventListener('click', saveSettings);

    const saveProductBtn = document.getElementById('saveProductBtn');
    if (saveProductBtn) saveProductBtn.addEventListener('click', saveSettings);

    const testConnectionBtn = document.getElementById('testConnectionBtn');
    if (testConnectionBtn) testConnectionBtn.addEventListener('click', testApiConnection);

    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) exportDataBtn.addEventListener('click', exportAllData);

    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) clearCacheBtn.addEventListener('click', clearAllCache);

    const resetDataBtn = document.getElementById('resetDataBtn');
    if (resetDataBtn) resetDataBtn.addEventListener('click', openResetModal);
    const resetConfirmBtn = document.getElementById('resetConfirmBtn');
    if (resetConfirmBtn) resetConfirmBtn.addEventListener('click', resetAllData);
    const resetConfirmInput = document.getElementById('resetConfirmInput');
    if (resetConfirmInput) resetConfirmInput.addEventListener('keydown', e => { if (e.key === 'Enter') resetAllData(); });
}

// ---------- 登录表单事件绑定 ----------
// 【重要】必须与登录状态无关地执行：未登录时也要把「登录按钮 / 回车」绑上，
// 否则登录页按钮点了没反应（历史 bug：先 if (!authOk) return; 再绑定，导致无法登录）。
function bindLoginEvents() {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', loginSubmit);
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logoutSubmit);
    const loginUsername = document.getElementById('loginUsername');
    if (loginUsername) loginUsername.addEventListener('keydown', e => { if (e.key === 'Enter') loginSubmit(); });
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) loginPassword.addEventListener('keydown', e => { if (e.key === 'Enter') loginSubmit(); });
}

// ---------- 登录成功后的页面初始化 ----------
// 首屏已带有效会话、或用户在登录页手动登录成功，两种情况都要执行。
// 幂等：重复调用不会重复绑定设置页事件。
let _afterAuthInited = false;
function initAfterAuth() {
    if (_afterAuthInited) return;
    _afterAuthInited = true;
    navigateTo('dashboard');
    bindSettingsEvents();
    loadSettings();

    // 数字动画效果
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.querySelectorAll('.stat-number').forEach(el => {
                    const val = parseInt(el.textContent.replace(/,/g,''));
                    if(!isNaN(val)) animateCounter(el, val);
                });
            }
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('.stats-grid').forEach(g => observer.observe(g));
}

// ---------- 初始化 ----------
document.addEventListener('DOMContentLoaded', async () => {
    bindLoginEvents();                      // 先绑事件，再判断登录态
    const authOk = await initAuth();
    if (!authOk) return;                    // 未登录：停在登录页（此时登录按钮已可用）
    initAfterAuth();
});

function animateCounter(el, target) {
    let current = 0;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
        current += step;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = current.toLocaleString();
    }, 30);
}

console.log('🤖 AI超级员工系统 v2.0 加载完成 | 科航AI超级员工复刻版');

/* ================= 地图获客 (真实调用高德 Web 服务) ================= */
let mapCrawling = false;
let mapResults = [];

function mapToast(msg, type) {
  if (typeof toast === 'function') { toast(msg, type); return; }
  alert(msg);
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function startMapCrawl() {
  const keyword = (document.getElementById('mapKeyword').value || '').trim();
  const region = getSelectedRegion();
  const target = Math.min(parseInt(document.getElementById('mapTarget').value, 10) || 100, 1000);
  if (!keyword) { mapToast('请输入行业/关键词', 'warn'); return; }
  if (!region.adcode) { mapToast('请先逐级选择地区（至少到省级，可精确到县）', 'warn'); return; }

  mapCrawling = true;
  mapResults = [];
  initMap(); // 确保地图已初始化
  clearMap();
  if (region.adcode) drawDistrictBoundary(region.adcode);
  setMapRegionTag('采集中：' + region.label);
  setTimeout(() => { if (_map) _map.invalidateSize(); }, 100);

  const startBtn = document.querySelector('#subtab-map button[onclick="startMapCrawl()"]');
  if (startBtn) { startBtn.disabled = true; startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 采集中...'; }

  mapToast('开始地图获客：' + region.label + ' / ' + keyword, 'info');
  let page = 1;
  try {
    while (mapCrawling && mapResults.length < target && page <= 40) {
      const url = '/api/amap/poi?keyword=' + encodeURIComponent(keyword)
        + '&city=' + encodeURIComponent(region.adcode) + '&citylimit=true&page=' + page + '&offset=25';
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.error) { mapToast('高德接口：' + data.error, 'error'); break; }
      const pois = (data.pois || []).map(p => {
        const loc = (p.location || '').split(',');
        return {
          ...p,
          tel: typeof p.tel === 'string' ? p.tel : (p.tel ? String(p.tel) : ''),
          name: p.name || '',
          address: p.address || '',
          type: p.type || '',
          lng: parseFloat(loc[0]) || 0,
          lat: parseFloat(loc[1]) || 0
        };
      });
      if (!pois.length) break;
      mapResults = mapResults.concat(pois);
      if (mapResults.length > target) mapResults = mapResults.slice(0, target);
      renderMapRows(mapResults);
      pois.forEach(p => addMapMarker(p));
      const ib = document.getElementById('importMapBtn');
      if (ib) ib.disabled = false;
      fitMapToMarkers();
      updateMapStats();
      page++;
      await new Promise(r => setTimeout(r, 150));
    }
    if (mapCrawling) mapToast('✅ 地图获客完成，共采集 ' + mapResults.length + ' 家商家', 'success');
    setMapRegionTag('已采集：' + region.label + '（' + mapResults.length + ' 家）');
  } catch (e) {
    mapToast('采集失败：' + e.message, 'error');
  } finally {
    mapCrawling = false;
    if (startBtn) { startBtn.disabled = false; startBtn.innerHTML = '<i class="fas fa-play"></i> 开始地图获客'; }
  }
}

function stopMapCrawl() {
  if (!mapCrawling) { mapToast('当前没有进行中的采集任务', 'info'); return; }
  mapCrawling = false;
  mapToast('已停止采集，保留已采集的 ' + mapResults.length + ' 条', 'warn');
}

function mapView(i) { const p = mapResults[i]; if (p) mapToast('查看：' + (p.name || ''), 'info'); }
function mapAdd(i) { const p = mapResults[i]; if (p) mapToast('已加入线索池：' + (p.name || ''), 'success'); }

function renderMapRows(list) {
  const tb = document.getElementById('mapResultBody');
  if (!tb) return;
  if (!list || !list.length) {
    tb.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px 16px;color:#999;">
      <i class="fas fa-search" style="font-size:28px;margin-bottom:8px;display:block;opacity:.4"></i>
      暂无采集数据，请先选择地区和关键词，点击「开始采集」
    </td></tr>`;
    const head = document.getElementById('mapSelectAll');
    if (head) { head.checked = false; head.indeterminate = false; }
    updateMapStats();
    return;
  }
  tb.innerHTML = list.map((p, i) => {
    const hasPhone = !!(p.tel && String(p.tel).trim());
    return `<tr>
      <td><input type="checkbox" class="map-row-check" data-index="${i}" onchange="onMapCheckChange()"></td>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${escapeHtml(p.address || '-')}</td>
      <td>${hasPhone ? escapeHtml(p.tel) : '<span class="text-muted">未公开</span>'}</td>
      <td>${escapeHtml(p.type || '-')}</td>
      <td>-</td>
      <td>${p.rating ? escapeHtml(p.rating) : '-'}</td>
      <td><span class="badge ${hasPhone ? 'badge-success' : 'badge-muted'}">${hasPhone ? '可联系' : '待补全'}</span></td>
      <td>
        <button class="btn btn-xs btn-outline" onclick="mapView(${i})"><i class="fas fa-eye"></i></button>
        <button class="btn btn-xs btn-primary" onclick="mapAdd(${i})"><i class="fas fa-plus"></i></button>
      </td>
    </tr>`;
  }).join('');
  // 重置全选态与导入按钮文案
  const head = document.getElementById('mapSelectAll');
  if (head) { head.checked = false; head.indeterminate = false; }
  onMapCheckChange();
}

/* ===== 真实地图（Leaflet + 高德瓦片，GCJ-02坐标系）===== */
let _map = null, _markerLayer = null, _boundaryLayer = null, _mapReady = false, _useGcjTiles = false;

function gcj2wgs(lat, lng) {
  const PI = Math.PI, a = 6378245.0, ee = 0.00669342162296594323;
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lat, lng];
  const tLat = (x, y) => -100 + 2*x + 3*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x))
    + (20*Math.sin(6*x*PI) + 20*Math.sin(2*x*PI)) * 2/3
    + (20*Math.sin(y*PI) + 40*Math.sin(y/3*PI)) * 2/3
    + (160*Math.sin(y/12*PI) + 320*Math.sin(y*PI/30)) * 2/3;
  const tLng = (x, y) => 300 + x + 2*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x))
    + (20*Math.sin(6*x*PI) + 20*Math.sin(2*x*PI)) * 2/3
    + (20*Math.sin(x*PI) + 40*Math.sin(x/3*PI)) * 2/3
    + (150*Math.sin(x/12*PI) + 300*Math.sin(x/30*PI)) * 2/3;
  let dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35);
  const radLat = lat / 180 * PI;
  let magic = Math.sin(radLat); magic = 1 - ee*magic*magic;
  const sqrtmagic = Math.sqrt(magic);
  dLat = (dLat * 180) / ((a * (1 - ee)) / (magic * sqrtmagic) * PI);
  dLng = (dLng * 180) / (a / sqrtmagic * Math.cos(radLat) * PI);
  const mglat = lat + dLat, mglng = lng + dLng;
  return [lat*2 - mglat, lng*2 - mglng];
}

function initMap() {
  if (_mapReady || typeof L === 'undefined') return;
  const el = document.getElementById('mapView');
  if (!el) return;
  _map = L.map('mapView', { zoomControl: true }).setView([39.9, 116.4], 11);
  // 高德地图瓦片（GCJ-02坐标系，与高德POI坐标完全对齐，无需偏移转换）
  // 放大后显示道路、建筑物、POI标注；缩小显示大范围地名
  L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    minZoom: 3,
    subdomains: ['1', '2', '3', '4'],
    attribution: '&copy; 高德地图'
  }).addTo(_map);
  _markerLayer = L.layerGroup().addTo(_map);
  _boundaryLayer = L.layerGroup().addTo(_map);
  _useGcjTiles = true; // 标记使用高德瓦片，坐标不做偏移
  _mapReady = true;
  setTimeout(() => { if (_map) _map.invalidateSize(); }, 300);
  setTimeout(() => { if (_map) _map.invalidateSize(); }, 1000);
}

function clearMap() {
  if (_markerLayer) _markerLayer.clearLayers();
  if (_boundaryLayer) _boundaryLayer.clearLayers();
}

function addMapMarker(p) {
  if (!_map || !_markerLayer || !p.lng || !p.lat) return;
  // 高德瓦片是GCJ-02坐标系，POI坐标也是GCJ-02，无需转换
  const mlat = _useGcjTiles ? p.lat : gcj2wgs(p.lat, p.lng)[0];
  const mlng = _useGcjTiles ? p.lng : gcj2wgs(p.lat, p.lng)[1];
  const hasPhone = !!(p.tel && String(p.tel).trim());
  const m = L.circleMarker([mlat, mlng], {
    radius: 6, color: hasPhone ? '#e23a5e' : '#9aa0b5',
    fillColor: hasPhone ? '#e23a5e' : '#9aa0b5', fillOpacity: 0.85, weight: 1
  });
  m.bindPopup('<div style="min-width:190px"><strong>' + escapeHtml(p.name) + '</strong><br>'
    + '<span style="color:#666">' + escapeHtml(p.address || '') + '</span><br>'
    + (hasPhone ? '📞 ' + escapeHtml(p.tel) : '📞 未公开') + '<br>'
    + '<span style="color:#666">行业：' + escapeHtml(p.type || '') + '</span></div>');
  _markerLayer.addLayer(m);
}

function fitMapToMarkers() {
  if (!_map || !_markerLayer) return;
  const bs = [];
  _markerLayer.eachLayer(l => { if (l.getLatLng) bs.push(l.getLatLng()); });
  if (bs.length) _map.fitBounds(bs, { padding: [30, 30], maxZoom: 15 });
}

async function drawDistrictBoundary(adcode) {
  if (!_map || !_boundaryLayer) return;
  try {
    const data = await fetch('/api/amap/district?keywords=' + encodeURIComponent(adcode) + '&subdistrict=0&extensions=all').then(r => r.json());
    if (!data.ok) return;
    const polyline = data.polyline || (data.children && data.children[0] && data.children[0].polyline) || '';
    if (!polyline) return;
    polyline.split('|').forEach(ring => {
      const pts = ring.split(';').map(pt => {
        const c = pt.split(',').map(Number);
        // 高德瓦片用GCJ-02坐标，边界也是GCJ-02，无需转换
        return _useGcjTiles ? [c[1], c[0]] : gcj2wgs(c[1], c[0]);
      }).filter(a => a[0] && a[1]);
      if (pts.length > 1) {
        L.polygon(pts, { color: '#7c4dff', weight: 2, fillColor: '#7c4dff', fillOpacity: 0.06 }).addTo(_boundaryLayer);
      }
    });
    const bs = [];
    _boundaryLayer.eachLayer(l => { if (l.getBounds) bs.push(l.getBounds()); });
    if (bs.length && _markerLayer && _markerLayer.getLayers().length === 0) {
      _map.fitBounds(bs, { padding: [20, 20] });
    }
  } catch (e) { /* 边界绘制失败不影响主流程 */ }
}

function setMapRegionTag(t) {
  const el = document.getElementById('mapRegionTag');
  if (el) el.textContent = t;
}

/* ===== 省 / 市 / 区县级联选择 ===== */
function getSelectedRegion() {
  const p = document.getElementById('provinceSelect');
  const c = document.getElementById('citySelect');
  const co = document.getElementById('countySelect');
  if (co && co.value) return { adcode: co.value, label: co.options[co.selectedIndex].text, level: 'county' };
  if (c && c.value) return { adcode: c.value, label: c.options[c.selectedIndex].text, level: 'city' };
  if (p && p.value) return { adcode: p.value, label: p.options[p.selectedIndex].text, level: 'province' };
  return { adcode: '', label: '全国', level: '' };
}
function getRegionLabel() { return getSelectedRegion().label || '全部'; }

async function fillDistrictSelect(sel, keywords, subdistrict, placeholder) {
  sel.innerHTML = '<option value="">' + placeholder + '</option>';
  try {
    const data = await fetch('/api/amap/district?keywords=' + encodeURIComponent(keywords) + '&subdistrict=' + subdistrict + '&extensions=base').then(r => r.json());
    const list = (data.ok && data.children) ? data.children : [];
    list.forEach(d => {
      const o = document.createElement('option');
      o.value = d.adcode; o.textContent = d.name;
      sel.appendChild(o);
    });
    sel.disabled = false;
  } catch (e) { sel.disabled = true; }
}

async function loadProvinces() {
  await fillDistrictSelect(document.getElementById('provinceSelect'), '100000', '1', '省 / 直辖市');
}
async function loadCities(adcode) {
  const c = document.getElementById('citySelect'), co = document.getElementById('countySelect');
  co.innerHTML = '<option value="">区 / 县</option>'; co.disabled = true;
  if (!adcode) { c.innerHTML = '<option value="">市</option>'; c.disabled = true; return; }
  await fillDistrictSelect(c, adcode, '1', '市');
}
async function loadCounties(adcode) {
  const co = document.getElementById('countySelect');
  if (!adcode) { co.innerHTML = '<option value="">区 / 县</option>'; co.disabled = true; return; }
  await fillDistrictSelect(co, adcode, '1', '区 / 县');
}

function updateRegionCurrent() {
  const r = getSelectedRegion();
  const el = document.getElementById('regionCurrent');
  if (el) el.textContent = '已选：' + (r.label === '全国' ? '全国（请逐级选择，可精确到县）' : r.label);
}

async function initMapModule() {
  try { initMap(); } catch (e) { console.error('地图初始化跳过:', e); }
  // 每次进入地图获客页：重置结果为空状态（点"开始采集"后会重新填充）
  mapResults = [];
  renderMapRows([]);
  updateMapStats();
  const p = document.getElementById('provinceSelect');
  const c = document.getElementById('citySelect');
  const co = document.getElementById('countySelect');
  await loadProvinces();
  if (p) p.addEventListener('change', () => { loadCities(p.value); updateRegionCurrent(); });
  if (c) c.addEventListener('change', () => { loadCounties(c.value); updateRegionCurrent(); });
  if (co) co.addEventListener('change', updateRegionCurrent);
  updateRegionCurrent();
}
initMapModule();

function updateMapStats() {
  const found = mapResults.length;
  const phones = mapResults.filter(p => p.tel && String(p.tel).trim()).length;
  const rate = found ? Math.round(phones / found * 100) : 0;
  const fc = document.getElementById('mapFoundCount'), pc = document.getElementById('mapPhoneCount'), rc = document.getElementById('mapRate');
  if (fc) fc.textContent = found;
  if (pc) pc.textContent = phones;
  if (rc) rc.textContent = rate + '%';
  const tr = document.getElementById('mapTotalRecords');
  if (tr) tr.textContent = '共 ' + found + ' 条记录';
}

function exportMapCSV() {
  if (!mapResults.length) { mapToast('暂无可导出的数据，请先采集', 'warn'); return; }
  const headers = ['商户名称', '地址', '电话', '行业', '城市', '区县', '评分', '经度', '纬度'];
  const rows = mapResults.map(p => [p.name, p.address, p.tel, p.type, p.city, p.district, p.rating, p.lng, p.lat]);
  const csv = [headers].concat(rows).map(r => r.map(c => {
    const s = String(c == null ? '' : c).replace(/"/g, '""');
    return /[",\n]/.test(s) ? '"' + s + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '地图获客_' + getRegionLabel() + '_' + Date.now() + '.csv';
  a.click();
  mapToast('已导出 ' + mapResults.length + ' 条到 CSV', 'success');
}

/* ============================================================
   真实 AI 功能接入 (后端 /api/ai/generate -> DeepSeek)
   以下函数覆盖上面的模拟版本，调用真实接口并渲染结果
   ============================================================ */

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMd(s) {
    return s
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+?)`/g, '<code>$1</code>');
}

// 极简 Markdown 渲染器（标题/列表/引用/粗体/代码/分割线）
function renderMarkdown(md) {
    if (!md) return '';
    const lines = escapeHtml(md).split(/\r?\n/);
    let html = '', i = 0, inUl = false, inOl = false;
    const closeLists = () => { if (inUl) { html += '</ul>'; inUl = false; } if (inOl) { html += '</ol>'; inOl = false; } };
    while (i < lines.length) {
        const line = lines[i];
        if (/^```/.test(line)) {
            closeLists(); let code = ''; i++;
            while (i < lines.length && !/^```/.test(lines[i])) { code += lines[i] + '\n'; i++; }
            i++; html += '<pre><code>' + code + '</code></pre>'; continue;
        }
        const h = line.match(/^(#{1,4})\s+(.*)$/);
        if (h) { closeLists(); const lv = h[1].length; html += '<h' + lv + '>' + inlineMd(h[2]) + '</h' + lv + '>'; i++; continue; }
        if (/^---+$/.test(line)) { closeLists(); html += '<hr>'; i++; continue; }
        const bq = line.match(/^>\s?(.*)$/);
        if (bq) { closeLists(); html += '<blockquote>' + inlineMd(bq[1]) + '</blockquote>'; i++; continue; }
        const ul = line.match(/^[-*]\s+(.*)$/);
        if (ul) { if (!inUl) { closeLists(); html += '<ul>'; inUl = true; } if (inOl) { html += '</ol>'; inOl = false; } html += '<li>' + inlineMd(ul[1]) + '</li>'; i++; continue; }
        const ol = line.match(/^\d+[.)]\s+(.*)$/);
        if (ol) { if (!inOl) { closeLists(); html += '<ol>'; inOl = true; } if (inUl) { html += '</ul>'; inUl = false; } html += '<li>' + inlineMd(ol[1]) + '</li>'; i++; continue; }
        if (line.trim() === '') { closeLists(); i++; continue; }
        closeLists();
        let para = line; i++;
        while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|[-*]\s|\d+[.)]\s|>|---+|```)/.test(lines[i])) { para += '<br>' + lines[i]; i++; }
        html += '<p>' + inlineMd(para) + '</p>';
    }
    closeLists();
    return html;
}

function showToast(msg, type) {
    let c = document.querySelector('.toast-container');
    if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3200);
}

function getProduct() {
    const n = document.getElementById('productNameInput');
    return n ? n.value.trim() : '';
}

async function callApi(payload) {
    const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({ error: '返回非JSON' }));
    if (!res.ok) throw new Error(data.error || ('请求失败(' + res.status + ')'));
    return data;
}

// ---------- AI生成器 (企业智脑 / AI创作 共用) ----------
const AI_GEN_CONFIG = {
    zhinao: {
        title: '企业智脑 · AI生成', typeLabel: '生成类型', topicLabel: '主题 / 要求',
        types: [['content', '营销文案 / 公众号文章'], ['design', '设计创意方案'], ['analysis', '数据分析报告'], ['report', '工作汇报(日报/周报)'], ['team', '团队管理方案']],
        placeholder: '例如：写一段618大促的公众号推文开头'
    },
    chuangzuo: {
        title: 'AI创作 · 智能生成', typeLabel: '创作类型', topicLabel: '主题 / 素材',
        types: [['短视频脚本', '短视频分镜脚本'], ['朋友圈文案', '朋友圈种草文案'], ['数字人口播', '数字人口播稿'], ['带货文案', '电商带货文案'], ['小红书笔记', '小红书爆款笔记'], ['爆款标题', '吸睛爆款标题']],
        placeholder: '例如：二手车门店开业探店'
    }
};
let aiGenCategory = 'zhinao';

function openAiGen(mode, defaultType, prefillTopic) {
    aiGenCategory = mode;
    const cfg = AI_GEN_CONFIG[mode];
    document.getElementById('aiGenTitle').textContent = cfg.title;
    document.getElementById('aiGenTypeLabel').textContent = cfg.typeLabel;
    document.getElementById('aiGenTopicLabel').textContent = cfg.topicLabel;
    const sel = document.getElementById('aiGenType');
    sel.innerHTML = cfg.types.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('');
    if (defaultType) { for (const o of sel.options) { if (o.value === defaultType) { o.selected = true; break; } } }
    document.getElementById('aiGenTopic').value = (typeof prefillTopic === 'string' && prefillTopic) ? prefillTopic : '';
    document.getElementById('aiGenResult').innerHTML = '';
    document.getElementById('aiGenStatus').textContent = '';
    document.getElementById('aiGenModal').style.display = 'flex';
}

async function runAiGen() {
    const type = document.getElementById('aiGenType').value;
    const topic = document.getElementById('aiGenTopic').value.trim();
    const btn = document.getElementById('aiGenBtn');
    const status = document.getElementById('aiGenStatus');
    const result = document.getElementById('aiGenResult');
    if (!topic) { showToast('请先输入主题或要求', 'error'); return; }
    btn.disabled = true;
    status.innerHTML = '<span style="color:#3b82f6">⏳ 生成中...</span>';
    result.innerHTML = '';
    try {
        if (aiGenCategory === 'zhinao') {
            const data = await callApi({ category: 'zhinao', type, topic, product: getProduct() });
            result.innerHTML = '<div class="ai-md">' + renderMarkdown(data.content || '') + '</div>';
        } else {
            const data = await callApi({ category: 'chuangzuo', type, subject: topic, tone: '自然亲切', product: getProduct() });
            const cards = (data.scripts || []).map(s =>
                `<div class="gen-script-card"><div class="gs-title">${escapeHtml(s.title || '')}</div><div class="gs-content">${renderMarkdown(s.content || '')}</div></div>`
            ).join('') || '<p style="color:#9ca3af">无结果</p>';
            result.innerHTML = '<div class="ai-md">' + cards + '</div>';
            result.querySelectorAll('.gen-script-card').forEach(card => {
                card.style.cursor = 'pointer'; card.title = '点击复制文案';
                card.addEventListener('click', () => {
                    const txt = card.querySelector('.gs-content').innerText;
                    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => showToast('已复制文案', 'success'));
                });
            });
        }
        status.innerHTML = '<span style="color:#10b981">✅ 完成</span>';
        showToast('AI生成成功', 'success');
    } catch (e) {
        status.innerHTML = '<span style="color:#ef4444">❌ ' + escapeHtml(e.message) + '</span>';
        result.innerHTML = '<div class="ai-md" style="color:#ef4444">生成失败：' + escapeHtml(e.message) + '<br><br>请确认后端已启动（node server.js）且 .env 中的 DeepSeek Key 有效。</div>';
        showToast('生成失败：' + e.message, 'error');
    } finally { btn.disabled = false; }
}

// ---------- 公域拓客：AI拓词 ----------
async function expandKeywords() {
    const kw = document.getElementById('baseKeyword')?.value || '二手车买卖';
    const cloud = document.getElementById('keywordCloud');
    const tbody = document.getElementById('keywordResultBody');
    if (cloud) cloud.innerHTML = '<span class="keyword-chip">⏳ AI拓词中...</span>';
    try {
        const data = await callApi({ category: 'keyword', keyword: kw, platform: '抖音/小红书/快手', product: getProduct() });
        const kws = data.keywords || [];
        if (cloud) {
            cloud.innerHTML = kws.map((k, i) => {
                const sz = i < 5 ? 'size-lg' : i < 14 ? 'size-md' : 'size-sm';
                return `<span class="keyword-chip ${sz}">${escapeHtml(k)}</span>`;
            }).join('');
        }
        if (tbody) {
            tbody.innerHTML = kws.map(k =>
                `<tr><td><strong>${escapeHtml(k)}</strong></td><td>抖音 / 小红书 / 快手</td><td>${randInt(50, 5000)}</td><td>${randInt(10, 800)}</td><td><span style="color:${Math.random() > 0.5 ? '#059669' : '#f59e0b'}">${Math.random() > 0.5 ? '↑ 上升' : '↓ 下降'} ${randInt(1, 30)}%</span></td></tr>`
            ).join('');
        }
        showToast('AI拓词完成，共 ' + kws.length + ' 个关键词', 'success');
    } catch (e) {
        if (cloud) cloud.innerHTML = '<span class="keyword-chip" style="color:#ef4444">❌ ' + escapeHtml(e.message) + '</span>';
        showToast('拓词失败：' + e.message, 'error');
    }
}

// ---------- 法务专员：真实咨询 ----------
async function askLegalTopic(topic) {
    const container = document.getElementById('consultMessages');
    if (!container) return;
    container.innerHTML += `<div class="msg msg-received"><div><strong>咨询问题：</strong>${escapeHtml(topic)}</div><div class="msg-meta">刚刚</div></div>`;
    const loadingId = 'legalLoading' + Date.now();
    container.innerHTML += `<div class="msg msg-sent system-msg" id="${loadingId}" style="background:white;border:none;"><div style="color:#3b82f6">⏳ AI分析中...</div></div>`;
    container.scrollTop = container.scrollHeight;
    try {
        const data = await callApi({ category: 'legal', question: topic });
        document.getElementById(loadingId).innerHTML =
            `<div style="text-align:left"><h4 style="color:var(--primary);margin-bottom:8px;">📋 关于「${escapeHtml(topic)}」的法律意见</h4><div class="ai-md">${renderMarkdown(data.answer || '')}</div></div><div class="msg-meta">刚刚 · AI法律助手</div>`;
    } catch (e) {
        document.getElementById(loadingId).innerHTML = `<div style="color:#ef4444">❌ 生成失败：${escapeHtml(e.message)}<br>请确认后端已启动且 Key 有效。</div>`;
        showToast('法务咨询失败：' + e.message, 'error');
    }
    container.scrollTop = container.scrollHeight;
}
function askLegal() {
    const input = document.getElementById('legalQuestion');
    if (!input?.value.trim()) { showToast('请输入法律问题', 'error'); return; }
    askLegalTopic(input.value.trim());
    input.value = '';
}

// ---------- 企业智脑：打开生成器 ----------
function openZhinaoTool(tool) {
    const map = { content: 'content', design: 'design', analysis: 'analysis', report: 'report', team: 'team' };
    openAiGen('zhinao', map[tool] || 'content');
}

// ---------- 设置页：真实连接测试 ----------
async function testApiConnection() {
    const resultEl = document.getElementById('apiTestResult');
    if (resultEl) resultEl.innerHTML = '<span class="api-dot off"></span><span style="color:#3b82f6">⏳ 测试中...</span>';
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (data.ok && data.keyConfigured) {
            if (resultEl) resultEl.innerHTML = '<span class="api-dot on"></span><span style="color:#10b981">已连接 · 模型 ' + escapeHtml(data.model) + '</span>';
            showToast('DeepSeek 连接成功', 'success');
        } else {
            if (resultEl) resultEl.innerHTML = '<span class="api-dot off"></span><span style="color:#f59e0b">后端已连，但 Key 未配置</span>';
        }
    } catch (e) {
        if (resultEl) resultEl.innerHTML = '<span class="api-dot off"></span><span style="color:#ef4444">无法连接后端（请先 node server.js）</span>';
    }
}

// ---------- 启动时的 DOM 绑定（真实按钮） ----------
document.addEventListener('DOMContentLoaded', () => {
    // AI创作：4张卡片的生成按钮 -> 打开AI生成器
    const chuangzuoMap = [
        { type: '短视频脚本', field: 'input' },
        { type: '数字人口播', field: 'textarea' },
        { type: '短视频脚本', field: 'textarea' },
        { type: '爆款标题', field: 'select' }
    ];
    document.querySelectorAll('.chuangzuo-card').forEach((card, idx) => {
        const btn = card.querySelector('.btn-primary');
        if (!btn) return;
        const cfg = chuangzuoMap[idx] || { type: '短视频脚本' };
        const inp = card.querySelector(cfg.field);
        btn.addEventListener('click', () => {
            const prefill = inp ? inp.value.trim() : '';
            openAiGen('chuangzuo', cfg.type, prefill);
        });
    });

    // 自动检测后端连接
    testApiConnection();
});

// ================= 状态流转看板 (拖拽式) =================
let _kanbanStatuses = ['新客', '跟进中', '已成交', '已流失'];
let _kanbanCache = [];
let _dragId = null;

async function initKanban() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;
  board.innerHTML = '<div class="kanban-loading">加载中…</div>';
  await loadKanbanData();
}

async function loadKanbanData() {
  try {
    const data = await custApi('/api/customers?page=1&pageSize=200');
    if (data.error) { mapToast('看板加载失败：' + data.error, 'error'); return; }
    _kanbanCache = data.items || [];
    renderKanban();
  } catch (e) { mapToast('看板加载失败：' + e.message, 'error'); }
}

function buildKanbanSkeleton() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;
  board.innerHTML = _kanbanStatuses.map((s, i) => `
    <div class="kanban-col" data-status="${esc(s)}">
      <div class="kanban-col-head">
        <span class="kanban-col-title">${esc(s)}</span>
        <span class="kanban-col-count" id="kcount-${i}">0</span>
      </div>
      <div class="kanban-cards" id="kcol-${i}"
        ondragover="kanbanDragOver(event)"
        ondragleave="kanbanDragLeave(event)"
        ondrop="kanbanDrop(event, '${esc(s)}')"></div>
    </div>`).join('');
}

function renderKanban() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;
  if (!board.querySelector('.kanban-col')) buildKanbanSkeleton();
  const q = ((document.getElementById('kanbanSearch') || {}).value || '').trim().toLowerCase();
  const counts = {};
  _kanbanStatuses.forEach(s => counts[s] = 0);
  _kanbanStatuses.forEach((s, i) => {
    const col = document.getElementById('kcol-' + i);
    if (!col) return;
    const cards = (_kanbanCache || []).filter(c => c.status === s)
      .filter(c => !q || ((c.name || '') + ' ' + (c.phone || '') + ' ' + ((c.tags || []).join(' '))).toLowerCase().includes(q));
    counts[s] = cards.length;
    if (!cards.length) {
      col.innerHTML = '<div class="kanban-empty">拖拽客户到此</div>';
      return;
    }
    col.innerHTML = '';
    cards.forEach(c => {
      const wrap = document.createElement('div');
      wrap.innerHTML = buildKanbanCard(c);
      col.appendChild(wrap.firstElementChild);
    });
  });
  _kanbanStatuses.forEach((s, i) => { const el = document.getElementById('kcount-' + i); if (el) el.textContent = counts[s]; });
  const totalEl = document.getElementById('kanbanTotal'); if (totalEl) totalEl.textContent = (_kanbanCache || []).length;
}

function buildKanbanCard(c) {
  const tags = (c.tags || []).slice(0, 3).map(t => `<span class="kc-tag">${esc(t)}</span>`).join('');
  let score = '';
  if (c.ai && c.ai.score) {
    const sc = Number(c.ai.score) || 0;
    const cls = sc >= 80 ? 'kc-score-hi' : (sc >= 50 ? 'kc-score-mid' : 'kc-score-lo');
    score = `<span class="kc-score ${cls}">${sc}</span>`;
  }
  const owner = c.owner ? `<div class="kc-owner"><i class="fas fa-user"></i> ${esc(c.owner)}</div>` : '';
  const src = c.source ? `<span class="kc-src">${esc(c.source)}</span>` : '';
  return `<div class="kanban-card" draggable="true" data-id="${esc(c.id)}" onclick="kanbanCardClick('${esc(c.id)}')" ondragstart="kanbanDragStart(event,'${esc(c.id)}')">
    <div class="kc-top"><span class="kc-name">${esc(c.name || '未命名')}</span>${score}</div>
    <div class="kc-meta">${esc(c.phone || '无电话')} ${src}</div>
    ${tags ? `<div class="kc-tags">${tags}</div>` : ''}
    ${owner}
  </div>`;
}

function kanbanCardClick(id) { viewCust(id); }

function kanbanDragStart(e, id) {
  _dragId = id;
  e.dataTransfer.setData('text/plain', id);
  e.dataTransfer.effectAllowed = 'move';
  const el = e.currentTarget;
  setTimeout(() => el.classList.add('dragging'), 0);
}
function kanbanDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}
function kanbanDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
async function kanbanDrop(e, status) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const id = (e.dataTransfer.getData('text/plain')) || _dragId;
  _dragId = null;
  if (!id) return;
  const c = (_kanbanCache || []).find(x => x.id === id);
  if (!c) return;
  if (c.status === status) return; // 同列拖放，无需处理
  const prev = c.status;
  c.status = status;             // 乐观更新
  renderKanban();
  try {
    const data = await custApi('/api/customers/' + id, { method: 'PUT', body: JSON.stringify({ status }) });
    if (data.error) { c.status = prev; renderKanban(); mapToast('状态更新失败：' + data.error, 'error'); }
    else { showToast('已移动到「' + status + '」', 'success'); }
  } catch (err) {
    c.status = prev; renderKanban(); mapToast('状态更新失败：' + err.message, 'error');
  }
}

// ================= 话术模板库 (常用回复/话术模板, 一键插入) =================
let templatesCache = [];

async function initHuashu() {
  await loadTemplates();
  renderTemplates();
}

async function loadTemplates() {
  try {
    const res = await fetch('/api/templates');
    const data = await res.json();
    templatesCache = (data.templates || []);
  } catch (e) { templatesCache = []; }
  const sel = document.getElementById('hsCatFilter');
  if (sel) {
    const cats = Array.from(new Set(templatesCache.map(t => (t.category || '通用')).filter(Boolean)));
    const cur = sel.value;
    sel.innerHTML = '<option value="">全部分类</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    sel.value = cur;
  }
}

function renderTemplates() {
  const box = document.getElementById('hsList');
  if (!box) return;
  const kw = (document.getElementById('hsSearch') || {}).value || '';
  const cat = (document.getElementById('hsCatFilter') || {}).value || '';
  const q = kw.trim().toLowerCase();
  const list = templatesCache.filter(t => {
    const matchCat = !cat || (t.category || '通用') === cat;
    const matchKw = !q || (t.title || '').toLowerCase().includes(q) || (t.content || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q);
    return matchCat && matchKw;
  });
  if (!list.length) {
    box.innerHTML = '<div class="empty-cell"><i class="fas fa-book"></i><p>还没有模板。点击右上角「新建模板」添加常用话术吧。</p></div>';
    return;
  }
  box.innerHTML = list.map(t => `
    <div class="huashu-card">
      <div class="huashu-card-head">
        <div class="huashu-card-title">${esc(t.title || '未命名模板')}</div>
        <span class="huashu-cat">${esc(t.category || '通用')}</span>
      </div>
      <div class="huashu-card-content">${esc(t.content || '')}</div>
      <div class="huashu-card-actions">
        <button class="btn btn-xs btn-outline" onclick="copyTemplateContent('${t.id}')"><i class="fas fa-copy"></i> 复制</button>
        <button class="btn btn-xs btn-outline" onclick="editTemplate('${t.id}')"><i class="fas fa-edit"></i> 编辑</button>
        <button class="btn btn-xs btn-danger-ghost" onclick="deleteTemplate('${t.id}')"><i class="fas fa-trash"></i> 删除</button>
      </div>
    </div>`).join('');
}

function copyTemplateContent(id) {
  const t = templatesCache.find(x => x.id === id);
  copyText(t ? (t.content || '') : '');
}

function openTemplateForm(id) {
  const modal = document.getElementById('templateFormModal');
  if (!modal) return;
  const tid = document.getElementById('tfId');
  const title = document.getElementById('tfTitleInput');
  const cat = document.getElementById('tfCategory');
  const content = document.getElementById('tfContent');
  const head = document.getElementById('tfTitle');
  const t = id ? templatesCache.find(x => x.id === id) : null;
  tid.value = id || '';
  head.textContent = t ? '编辑模板' : '新建模板';
  title.value = t ? (t.title || '') : '';
  cat.value = t ? (t.category || '') : '';
  content.value = t ? (t.content || '') : '';
  modal.style.display = 'flex';
  if (title) setTimeout(() => title.focus(), 50);
}

function closeTemplateForm() {
  const modal = document.getElementById('templateFormModal');
  if (modal) modal.style.display = 'none';
}

async function saveTemplate() {
  const id = (document.getElementById('tfId') || {}).value || '';
  const title = (document.getElementById('tfTitleInput') || {}).value || '';
  const category = (document.getElementById('tfCategory') || {}).value || '通用';
  const content = (document.getElementById('tfContent') || {}).value || '';
  if (!content.trim()) { mapToast('模板内容不能为空', 'warn'); return; }
  try {
    const url = id ? ('/api/templates/' + id) : '/api/templates';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, category }) });
    const data = await res.json();
    if (!res.ok || data.error) { mapToast('保存失败：' + (data.error || res.status), 'error'); return; }
    mapToast(id ? '模板已更新' : '模板已创建', 'success');
    closeTemplateForm();
    await loadTemplates();
    renderTemplates();
  } catch (e) { mapToast('保存失败：' + e.message, 'error'); }
}

async function editTemplate(id) { openTemplateForm(id); }

async function deleteTemplate(id) {
  const t = templatesCache.find(x => x.id === id);
  if (!t) return;
  if (!(await showConfirm('确定删除模板「' + (t.title || '未命名') + '」？此操作不可撤销。', '删除模板'))) return;
  try {
    const res = await fetch('/api/templates/' + id, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || data.error) { mapToast('删除失败：' + (data.error || res.status), 'error'); return; }
    mapToast('已删除模板', 'success');
    await loadTemplates();
    renderTemplates();
  } catch (e) { mapToast('删除失败：' + e.message, 'error'); }
}

// ---- 私信获客：草稿填入 / 插入模板 / 复制最终回复 ----
function fillDraftToFinal(i, k) {
  const arr = sixinReplyCache[i] || [];
  const ta = document.getElementById('replyFinal-' + i);
  if (!ta) return;
  ta.value = (ta.value ? ta.value + '\n' : '') + (arr[k] || '');
  ta.focus();
  mapToast('已填入最终回复框', 'success');
}

function openTemplatePicker(i) {
  const modal = document.getElementById('templatePickerModal');
  if (!modal) return;
  modal.setAttribute('data-lead', i);
  renderTemplatePicker();
  modal.style.display = 'flex';
  const s = document.getElementById('tpSearch');
  if (s) { s.value = ''; setTimeout(() => s.focus(), 50); }
}

function closeTemplatePicker() {
  const modal = document.getElementById('templatePickerModal');
  if (modal) modal.style.display = 'none';
}

function renderTemplatePicker() {
  const box = document.getElementById('tpList');
  if (!box) return;
  const q = ((document.getElementById('tpSearch') || {}).value || '').trim().toLowerCase();
  const list = templatesCache.filter(t => !q || (t.title || '').toLowerCase().includes(q) || (t.content || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q));
  if (!list.length) {
    box.innerHTML = '<div class="empty-cell"><i class="fas fa-book"></i><p>暂无模板。可到「话术库」新建。</p></div>';
    return;
  }
  box.innerHTML = list.map(t => `
    <div class="tp-item" onclick="pickTemplate('${t.id}')">
      <div class="tp-item-head"><span class="tp-item-title">${esc(t.title || '未命名')}</span><span class="huashu-cat">${esc(t.category || '通用')}</span></div>
      <div class="tp-item-content">${esc(t.content || '')}</div>
    </div>`).join('');
}

function pickTemplate(tid) {
  const modal = document.getElementById('templatePickerModal');
  const i = modal ? (modal.getAttribute('data-lead') || '0') : '0';
  const t = templatesCache.find(x => x.id === tid);
  const ta = document.getElementById('replyFinal-' + i);
  if (t && ta) {
    ta.value = (ta.value ? ta.value + '\n' : '') + (t.content || '');
    ta.focus();
    mapToast('已插入模板「' + (t.title || '未命名') + '」', 'success');
  }
  closeTemplatePicker();
}

function copyFinalReply(i) {
  const ta = document.getElementById('replyFinal-' + i);
  if (!ta) return;
  copyText(ta.value);
}

// ================= 客户去重合并 =================
let _dedupData = null;

async function openDedupModal() {
  const modal = document.getElementById('dedupModal');
  const body = document.getElementById('dedupBody');
  if (!modal || !body) return;
  modal.style.display = 'flex';
  body.innerHTML = '<div class="dedup-loading"><i class="fas fa-spinner fa-spin"></i> 正在扫描重复客户…</div>';
  try {
    const d = await custApi('/api/customers/dedup');
    if (d.error) { body.innerHTML = '<div class="dedup-empty"><i class="fas fa-exclamation-triangle"></i><p>检测失败：' + esc(d.error) + '</p></div>'; return; }
    _dedupData = d.groups || [];
    renderDedup();
  } catch (e) {
    body.innerHTML = '<div class="dedup-empty"><i class="fas fa-exclamation-triangle"></i><p>检测失败：' + esc(e.message) + '</p></div>';
  }
}

function closeDedupModal() {
  const modal = document.getElementById('dedupModal');
  if (modal) modal.style.display = 'none';
}

function renderDedup() {
  const body = document.getElementById('dedupBody');
  if (!body) return;
  const groups = _dedupData || [];
  if (!groups.length) {
    body.innerHTML = '<div class="dedup-empty"><i class="fas fa-check-circle"></i><p>未发现重复客户，客户库很干净 🎉</p></div>';
    return;
  }
  const totalDup = groups.reduce((s, g) => s + g.members.length - 1, 0);
  let html = '<div class="dedup-summary">共发现 <b>' + groups.length + '</b> 组疑似重复，可合并 <b>' + totalDup + '</b> 条重复记录。每组请选择一条保留，其余将合并进来并删除。</div>';
  groups.forEach((g, gi) => {
    const fieldLabel = g.field === 'phone' ? '电话相同' : '名称相同';
    html += '<div class="dedup-group">';
    html += '<div class="dedup-group-head"><span class="dedup-group-tag">' + fieldLabel + '</span><span class="dedup-group-sub">本组 ' + g.members.length + ' 条，合并为 1 条</span></div>';
    html += '<div class="dedup-members">';
    g.members.forEach((m, mi) => {
      const checked = mi === 0 ? 'checked' : '';
      const ai = (m.ai && typeof m.ai.score === 'number') ? '<span class="dm-score">' + m.ai.score + '</span>' : '';
      const aiLevel = (m.ai && m.ai.level) ? '<span class="dm-level">' + esc(m.ai.level) + '</span>' : '';
      const tags = (m.tags || []).map(t => '<span class="dm-tag">' + esc(t) + '</span>').join('');
      const last = (m.followups && m.followups.length) ? esc(String(m.followups[0].content || '').slice(0, 36)) : '—';
      html += '<label class="dedup-member">';
      html += '<input type="radio" name="keep_' + gi + '" value="' + esc(m.id) + '" ' + checked + '>';
      html += '<div class="dm-info">';
      html += '<div class="dm-line1"><b>' + esc(m.name || '(无名客户)') + '</b><span class="dm-phone">' + esc(m.phone || '无电话') + '</span>' + ai + aiLevel + '</div>';
      html += '<div class="dm-line2"><span class="dm-status">' + esc(m.status || '') + '</span><span class="dm-source">' + esc(m.source || '') + '</span>' + tags + '</div>';
      html += '<div class="dm-line3">最近跟进：' + last + '</div>';
      html += '</div></label>';
    });
    html += '</div>';
    html += '<div class="dedup-actions"><button class="btn btn-sm btn-primary" onclick="mergeGroup(' + gi + ')"><i class="fas fa-compress-arrows-alt"></i> 合并这组</button></div>';
    html += '</div>';
  });
  body.innerHTML = html;
}

async function mergeGroup(gi) {
  const g = _dedupData && _dedupData[gi];
  if (!g) return;
  const radios = document.getElementsByName('keep_' + gi);
  let keepId = null;
  const mergeIds = [];
  g.members.forEach(m => {
    const isKeep = Array.from(radios).some(r => r.checked && r.value === m.id);
    if (isKeep) keepId = m.id; else mergeIds.push(m.id);
  });
  if (!keepId) { mapToast('请先为每组选择一条保留记录', 'warn'); return; }
  try {
    const d = await custApi('/api/customers/merge', { method: 'POST', body: JSON.stringify({ keepId, mergeIds }) });
    if (d.error) { mapToast('合并失败：' + d.error, 'error'); return; }
    const cnt = (d.removedIds && d.removedIds.length) || mergeIds.length;
    mapToast('已合并，删除 ' + cnt + ' 条重复记录', 'success');
    const dd = await custApi('/api/customers/dedup');
    _dedupData = dd.groups || [];
    renderDedup();
    loadCustomers();
  } catch (e) { mapToast('合并失败：' + e.message, 'error'); }
}
