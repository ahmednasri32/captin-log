/* ============================================================
   config.js — إعدادات الاتصال بـ Supabase
   ============================================================ */
const SUPABASE_URL = 'https://mjelywusygupbhguppxl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bdEAOsPd9-s5t3tq11xweQ_BQ9ZieBD';
const REST = `${SUPABASE_URL}/rest/v1`;
const AUTH = `${SUPABASE_URL}/auth/v1`;
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

/* ============================================================
   ui-toast.js — إشعارات نجاح/خطأ بدل alert()
   ============================================================ */
function toast(message, type = 'info', duration = 3500){
  let stack = document.getElementById('toastStack');
  if(!stack){
    stack = document.createElement('div');
    stack.id = 'toastStack';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const prefix = type === 'success' ? '✓ ' : type === 'error' ? '✕ ' : '';
  el.textContent = prefix + message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

/* ============================================================
   auth.js — تسجيل الدخول/الخروج، تجديد الجلسة، الخمول
   ============================================================ */
let accessToken = sessionStorage.getItem('cl_access_token') || null;
let refreshToken = sessionStorage.getItem('cl_refresh_token') || null;
let inactivityTimer = null;
let refreshTimer = null;

function authHeaders(){
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
}
function showApp(){
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appRoot').style.display = 'block';
  resetInactivityTimer();
  loadAll();
}
function showLogin(msg){
  document.getElementById('appRoot').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'block';
  clearTimeout(inactivityTimer);
  if(msg){
    const err = document.getElementById('loginError');
    err.textContent = msg;
    err.style.display = 'block';
  }
}
function doLogout(msg){
  accessToken = null; refreshToken = null;
  clearTimeout(refreshTimer);
  sessionStorage.removeItem('cl_access_token');
  sessionStorage.removeItem('cl_refresh_token');
  showLogin(msg || null);
}
function resetInactivityTimer(){
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    doLogout('تم تسجيل خروجك تلقائيًا بعد ٣٠ دقيقة من عدم النشاط، سجّل الدخول مرة أخرى');
  }, INACTIVITY_LIMIT_MS);
}
['mousemove','keydown','click','touchstart','scroll'].forEach(evt => {
  document.addEventListener(evt, () => { if(accessToken) resetInactivityTimer(); });
});

async function refreshSession(){
  if(!refreshToken) return false;
  try{
    const res = await fetch(`${AUTH}/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if(!res.ok) return false;
    const data = await res.json();
    accessToken = data.access_token; refreshToken = data.refresh_token;
    sessionStorage.setItem('cl_access_token', accessToken);
    sessionStorage.setItem('cl_refresh_token', refreshToken);
    scheduleRefresh(data.expires_in || 3600);
    return true;
  }catch(e){ return false; }
}
function scheduleRefresh(expiresInSeconds){
  clearTimeout(refreshTimer);
  const delay = Math.max((expiresInSeconds - 120) * 1000, 15000);
  refreshTimer = setTimeout(async () => {
    const ok = await refreshSession();
    if(!ok) doLogout('انتهت الجلسة، سجّل الدخول مرة أخرى');
  }, delay);
}

document.getElementById('loginBtn').onclick = async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errBox = document.getElementById('loginError');
  errBox.style.display = 'none';
  if(!email || !password) return;
  try{
    const res = await fetch(`${AUTH}/token?grant_type=password`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if(!res.ok){ errBox.textContent = 'بيانات الدخول غير صحيحة'; errBox.style.display = 'block'; return; }
    const data = await res.json();
    accessToken = data.access_token; refreshToken = data.refresh_token;
    sessionStorage.setItem('cl_access_token', accessToken);
    sessionStorage.setItem('cl_refresh_token', refreshToken);
    scheduleRefresh(data.expires_in || 3600);
    showApp();
  }catch(e){ errBox.textContent = 'تعذر الاتصال، حاول مرة أخرى'; errBox.style.display = 'block'; }
};
document.getElementById('logoutBtn').onclick = () => doLogout();

/* ============================================================
   api.js — الاتصال بـ Supabase REST + حالة الاتصال
   ============================================================ */
async function api(path, options = {}){
  let res = await fetch(`${REST}/${path}`, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  if(res.status === 401){
    const refreshed = await refreshSession();
    if(refreshed) res = await fetch(`${REST}/${path}`, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
    if(!refreshed || res.status === 401){ doLogout('انتهت الجلسة، سجّل الدخول مرة أخرى'); throw new Error('unauthorized'); }
  }
  if(!res.ok){ const t = await res.text().catch(()=>''); throw new Error(`${res.status} ${t}`); }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
function setConnection(ok, msg){
  document.getElementById('statusDot').classList.toggle('off', !ok);
  document.getElementById('statusText').textContent = msg;
}

/* ============================================================
   main.js — التبديل بين العرضين + التمهيد
   ============================================================ */
document.getElementById('dashViewBtn').onclick = () => switchView('dash');
document.getElementById('captainsViewBtn').onclick = () => switchView('captains');
document.getElementById('notesViewBtn').onclick = () => switchView('notes');
document.getElementById('tasksViewBtn').onclick = () => switchView('tasks');
function switchView(v){
  ['dash','captains','notes','tasks'].forEach(name => {
    document.getElementById(`${name}View`).classList.toggle('active', v === name);
    document.getElementById(`${name}ViewBtn`).classList.toggle('active', v === name);
  });
  if(v === 'dash') renderDashboard();
  if(v === 'captains') renderCaptainsTable();
}

/* ============================================================
   state.js — الحالة المشتركة + دوال مساعدة
   ============================================================ */
let captains = [];
let notes = [];
let tasks = [];
let team = [];
let selectedAssignee = null;
let selectedTaskDate = '';
let taskStatusFilter = 'pending';
let activeProfileCaptainId = null;

const STATUS_OPTIONS = [
  { id:'new', label:'جديد' },
  { id:'awaiting_contact', label:'بانتظار التواصل' },
  { id:'contacted', label:'تم التواصل' },
  { id:'awaiting_registration', label:'بانتظار التسجيل' },
  { id:'awaiting_documents', label:'بانتظار الوثائق' },
  { id:'awaiting_inspection', label:'بانتظار المعاينة' },
  { id:'ready_activate', label:'جاهز للتفعيل' },
  { id:'active', label:'نشط' },
  { id:'inactive', label:'غير نشط' },
  { id:'stopped', label:'متوقف' },
  { id:'needs_followup', label:'يحتاج متابعة' },
];
function statusLabel(id){ const s = STATUS_OPTIONS.find(x => x.id === id); return s ? s.label : id; }

function localDateStr(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function todayStr(){ return localDateStr(new Date()); }
function addDaysStr(n){ const d = new Date(); d.setDate(d.getDate()+n); return localDateStr(d); }
function nextWeekdayStr(targetDay){
  const d = new Date();
  const diff = (targetDay - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}
function formatDate(dateStr){
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric' });
}
function formatDateTime(iso){
  return new Date(iso).toLocaleString('ar-EG', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}
function escapeHtml(str){ const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function captainOf(entity){ return captains.find(x => x.id === entity.captain_id) || { name:'—', phone:'' }; }

async function findOrCreateCaptain(name, phone){
  let captain = phone ? captains.find(c => (c.phone||'').trim() === phone) : captains.find(c => c.name.trim() === name);
  if(captain){
    if(phone && captain.name !== name) await api(`captains?id=eq.${captain.id}`, { method:'PATCH', body: JSON.stringify({ name }) });
    return captain.id;
  }
  const created = await api('captains', { method:'POST', headers:{ Prefer:'return=representation' }, body: JSON.stringify({ name, phone: phone || null, status: 'new' }) });
  captains.push(created[0]);
  await logActivity(created[0].id, 'captain_created', { name });
  return created[0].id;
}

async function logActivity(captainId, eventType, details){
  try{
    await api('activity_logs', { method:'POST', body: JSON.stringify({ captain_id: captainId, event_type: eventType, details: details || {} }) });
  }catch(e){ /* غير حرج لتجربة المستخدم */ }
}

async function loadAll(){
  try{
    captains = await api('captains?select=*');
    notes = await api('captain_notes?select=*&order=created_at.desc');
    tasks = await api('tasks?select=*&order=updated_at.desc');
    team = await api('team_members?select=*&order=name.asc');
    const customStatuses = await api('custom_statuses?select=*');
    customStatuses.forEach(cs => {
      if(!STATUS_OPTIONS.some(s => s.id === cs.id)) STATUS_OPTIONS.push({ id: cs.id, label: cs.label });
    });
    renderStatusSelectOptions();
    setConnection(true, 'متصل — البيانات تتزامن أونلاين');
    document.getElementById('saveNoteBtn').disabled = false;
    document.getElementById('saveTaskBtn').disabled = false;
    renderTeamChips();
    renderNotes();
    renderTasks();
    populateFilters();
    renderDashboard();
  }catch(e){
    setConnection(false, 'تعذر الاتصال بقاعدة البيانات');
    document.getElementById('saveNoteBtn').disabled = true;
    document.getElementById('saveTaskBtn').disabled = true;
    toast('تعذر الاتصال بقاعدة البيانات', 'error');
  }
}

/* ============================================================
   notes.js — الملاحظات (سجل متسلسل)
   ============================================================ */
const nName = document.getElementById('nName');
const nPhone = document.getElementById('nPhone');
const nPhoneHint = document.getElementById('nPhoneHint');
const nContent = document.getElementById('nContent');
const saveNoteBtn = document.getElementById('saveNoteBtn');

nPhone.addEventListener('input', () => {
  const phone = nPhone.value.trim();
  const match = phone ? captains.find(c => (c.phone||'').trim() === phone) : null;
  if(match){
    nPhoneHint.textContent = `✓ كابتن موجود: ${match.name}`;
    nPhoneHint.classList.add('match');
    if(!nName.value.trim()) nName.value = match.name;
  } else {
    nPhoneHint.textContent = ''; nPhoneHint.classList.remove('match');
  }
});

saveNoteBtn.onclick = async () => {
  const name = nName.value.trim();
  if(!name){ nName.focus(); return; }
  const content = nContent.value.trim();
  if(!content){ nContent.focus(); return; }
  const phone = nPhone.value.trim();

  saveNoteBtn.disabled = true;
  try{
    const captainId = await findOrCreateCaptain(name, phone);
    const created = await api('captain_notes', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ captain_id: captainId, content }),
    });
    notes = [created[0], ...notes];
    nName.value=''; nPhone.value=''; nContent.value=''; nPhoneHint.textContent='';
    renderNotes();
    await api(`captains?id=eq.${captainId}`, { method:'PATCH', body: JSON.stringify({ last_contact_at: new Date().toISOString() }) });
    const capRef = captains.find(x => x.id === captainId);
    if(capRef) capRef.last_contact_at = new Date().toISOString();
    await logActivity(captainId, 'note_added', { snippet: content.slice(0, 80) });
    toast('تم حفظ الملاحظة بنجاح', 'success');
  }catch(e){
    toast('تعذر حفظ الملاحظة، تحقق من الاتصال', 'error');
  }finally{
    saveNoteBtn.disabled = false;
  }
};

function renderNotes(){
  const q = document.getElementById('noteSearch').value.trim().toLowerCase();
  let items = notes.filter(n => {
    const cap = captainOf(n);
    return !q || cap.name.toLowerCase().includes(q) || (cap.phone||'').includes(q);
  });
  const feedEl = document.getElementById('noteFeed');
  document.getElementById('noteCount').textContent = items.length ? `${items.length} ملاحظة` : '';
  if(items.length === 0){ feedEl.innerHTML = `<div class="empty">لا توجد ملاحظات بعد</div>`; return; }

  feedEl.innerHTML = '';
  items.forEach(n => {
    const cap = captainOf(n);
    const entry = document.createElement('div');
    entry.className = 'note-entry';
    entry.innerHTML = `
      <div class="note-top">
        <div>
          <span class="note-name">${escapeHtml(cap.name)}</span>
          ${cap.phone ? `<span class="note-phone"> — ${escapeHtml(cap.phone)}</span>` : ''}
        </div>
        <div class="note-date">${formatDateTime(n.created_at)}</div>
      </div>
      <div class="note-content">${escapeHtml(n.content)}</div>
      <button class="note-del" data-id="${n.id}">حذف</button>
    `;
    feedEl.appendChild(entry);
  });
  feedEl.querySelectorAll('.note-del').forEach(btn => {
    btn.onclick = async () => {
      if(!confirm('حذف هذي الملاحظة نهائيًا؟')) return;
      try{
        await api(`captain_notes?id=eq.${btn.dataset.id}`, { method:'DELETE' });
        notes = notes.filter(n => n.id !== btn.dataset.id);
        renderNotes();
        toast('تم حذف الملاحظة', 'success');
      }catch(e){ toast('تعذر حذف الملاحظة', 'error'); }
    };
  });
}
document.getElementById('noteSearch').oninput = renderNotes;

/* ============================================================
   team.js — إدارة أعضاء الفريق
   ============================================================ */
const teamRow = document.getElementById('teamRow');
const newTeamBox = document.getElementById('newTeamBox');
function renderTeamChips(){
  teamRow.innerHTML = '';
  team.forEach(m => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (selectedAssignee === m.id ? ' active' : '');
    chip.innerHTML = `${escapeHtml(m.name)}<span class="chip-x" data-id="${m.id}" title="إزالة من الفريق">×</span>`;
    chip.onclick = (ev) => {
      if(ev.target.classList.contains('chip-x')) return;
      selectedAssignee = selectedAssignee === m.id ? null : m.id;
      newTeamBox.classList.remove('open');
      renderTeamChips();
    };
    chip.querySelector('.chip-x').onclick = async (ev) => {
      ev.stopPropagation();
      if(!confirm(`إزالة "${m.name}" من الفريق؟`)) return;
      try{
        await api(`team_members?id=eq.${m.id}`, { method:'DELETE' });
        team = team.filter(x => x.id !== m.id);
        if(selectedAssignee === m.id) selectedAssignee = null;
        renderTeamChips(); renderTasks();
        toast('تمت إزالة العضو من الفريق', 'success');
      }catch(err){ toast('تعذر الحذف', 'error'); }
    };
    teamRow.appendChild(chip);
  });
  const addChip = document.createElement('div');
  addChip.className = 'chip add';
  addChip.textContent = '+ عضو جديد';
  addChip.onclick = () => newTeamBox.classList.toggle('open');
  teamRow.appendChild(addChip);
}
document.getElementById('addTeamConfirm').onclick = async () => {
  const input = document.getElementById('newTeamName');
  const val = input.value.trim();
  if(!val) { input.focus(); return; }
  try{
    const created = await api('team_members', { method:'POST', headers:{ Prefer:'return=representation' }, body: JSON.stringify({ name: val }) });
    team.push(created[0]);
    selectedAssignee = created[0].id;
    input.value = '';
    newTeamBox.classList.remove('open');
    renderTeamChips(); renderTasks();
    toast('تمت إضافة العضو للفريق', 'success');
  }catch(err){ toast('تعذر الإضافة، ربما الاسم مكرر', 'error'); }
};

/* ============================================================
   tasks.js — المهام مصنّفة حسب عضو الفريق
   ============================================================ */
const tName = document.getElementById('tName');
const tDesc = document.getElementById('tDesc');
const taskDateEl = document.getElementById('taskDate');
const saveTaskBtn = document.getElementById('saveTaskBtn');

document.querySelectorAll('#datePresets .preset-chip[data-preset]').forEach(chip => {
  chip.onclick = () => { selectedTaskDate = chip.dataset.preset === 'today' ? todayStr() : addDaysStr(1); taskDateEl.value = selectedTaskDate; };
});
document.querySelectorAll('#datePresets .preset-chip[data-day]').forEach(chip => {
  chip.onclick = () => { selectedTaskDate = nextWeekdayStr(parseInt(chip.dataset.day, 10)); taskDateEl.value = selectedTaskDate; };
});
document.getElementById('clearTaskDate').onclick = () => { selectedTaskDate = ''; taskDateEl.value = ''; };
taskDateEl.addEventListener('input', () => { selectedTaskDate = taskDateEl.value; });

saveTaskBtn.onclick = async () => {
  const name = tName.value.trim();
  if(!name){ tName.focus(); return; }
  const description = tDesc.value.trim();
  if(!description){ tDesc.focus(); return; }

  saveTaskBtn.disabled = true;
  try{
    const captainId = await findOrCreateCaptain(name, '');
    await api('tasks', {
      method: 'POST',
      body: JSON.stringify({
        captain_id: captainId, description, assigned_to: selectedAssignee || null,
        due_date: selectedTaskDate || null, status: 'pending',
      }),
    });
    tasks = await api('tasks?select=*&order=updated_at.desc');
    tName.value=''; tDesc.value=''; taskDateEl.value=''; selectedTaskDate='';
    renderTasks();
    await logActivity(captainId, 'task_created', { description });
    toast('تم حفظ المهمة بنجاح', 'success');
  }catch(e){
    toast('تعذر حفظ المهمة، تحقق من الاتصال', 'error');
  }finally{
    saveTaskBtn.disabled = false;
  }
};

document.getElementById('pendingToggle').onclick = () => setTaskStatusFilter('pending');
document.getElementById('doneToggle').onclick = () => setTaskStatusFilter('done');
function setTaskStatusFilter(v){
  taskStatusFilter = v;
  document.getElementById('pendingToggle').classList.toggle('active', v === 'pending');
  document.getElementById('doneToggle').classList.toggle('active', v === 'done');
  renderTasks();
}

function isTaskOverdue(t){ return t.due_date && t.due_date < todayStr() && t.status === 'pending'; }

function renderTasks(){
  const q = document.getElementById('taskSearch').value.trim().toLowerCase();
  let items = tasks.filter(t => t.status === taskStatusFilter);
  items = items.filter(t => {
    const cap = captainOf(t);
    return !q || cap.name.toLowerCase().includes(q) || (cap.phone||'').includes(q);
  });

  const groupsEl = document.getElementById('taskGroups');
  document.getElementById('taskCount').textContent = items.length ? `${items.length} مهمة` : '';
  if(items.length === 0){ groupsEl.innerHTML = `<div class="empty">لا توجد مهام هنا</div>`; return; }

  const groups = new Map();
  team.forEach(m => groups.set(m.id, []));
  groups.set('unassigned', []);
  items.forEach(t => {
    const key = t.assigned_to && groups.has(t.assigned_to) ? t.assigned_to : 'unassigned';
    groups.get(key).push(t);
  });

  const orderedKeys = [...team.map(m => m.id), 'unassigned'].filter(k => groups.get(k).length > 0);

  groupsEl.innerHTML = '';
  orderedKeys.forEach(key => {
    const memberName = key === 'unassigned' ? 'غير مسندة' : team.find(m => m.id === key).name;
    const groupTasks = [...groups.get(key)].sort((a,b) => {
      if(taskStatusFilter === 'pending') return (a.due_date || '9999').localeCompare(b.due_date || '9999');
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

    const section = document.createElement('div');
    section.className = 'member-group';
    const overdueCount = groupTasks.filter(isTaskOverdue).length;
    section.innerHTML = `
      <div class="member-header">
        <div class="member-title">👤 ${escapeHtml(memberName)}</div>
        <div class="member-count">${groupTasks.length} مهمة${overdueCount ? ` — ${overdueCount} متأخرة` : ''}</div>
      </div>
      <div class="list" id="list-${key}"></div>
    `;
    groupsEl.appendChild(section);

    const listEl = section.querySelector('.list');
    groupTasks.forEach(t => {
      const cap = captainOf(t);
      const overdue = isTaskOverdue(t);
      const card = document.createElement('div');
      card.className = 'card' + (overdue ? ' overdue' : '') + (t.status === 'done' ? ' done' : '');
      const dateStr = new Date(t.updated_at).toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric' });
      const dueHtml = t.due_date
        ? `<div class="task-line ${overdue ? 'overdue' : ''}">📅 ${overdue ? 'متأخرة — ' : ''}${formatDate(t.due_date)}</div>`
        : `<div class="task-line">بدون تاريخ محدد</div>`;
      const actionButtons = t.status === 'pending'
        ? `<button data-action="done" data-id="${t.id}" class="go-done">تم الإنجاز</button><button data-action="delete" data-id="${t.id}" class="danger">حذف</button>`
        : `<button data-action="reopen" data-id="${t.id}">إعادة فتح</button><button data-action="delete" data-id="${t.id}" class="danger">حذف</button>`;

      card.innerHTML = `
        <div class="card-top">
          <div>
            <div class="name">${escapeHtml(cap.name)}</div>
            ${cap.phone ? `<div class="phone">${escapeHtml(cap.phone)}</div>` : ''}
          </div>
        </div>
        <div class="desc">${escapeHtml(t.description)}</div>
        ${dueHtml}
        <div class="meta">
          <div class="date">${dateStr}</div>
          <div class="actions">${actionButtons}</div>
        </div>
      `;
      listEl.appendChild(card);
    });
  });

  groupsEl.querySelectorAll('button[data-action]').forEach(btn => {
    btn.onclick = () => handleTaskAction(btn.dataset.action, btn.dataset.id);
  });
}

async function handleTaskAction(action, id){
  if(action === 'delete'){
    if(!confirm('حذف هذي المهمة نهائيًا؟')) return;
    try{
      await api(`tasks?id=eq.${id}`, { method:'DELETE' });
      tasks = tasks.filter(t => t.id !== id);
      renderTasks();
      toast('تم حذف المهمة', 'success');
    }catch(e){ toast('تعذر حذف المهمة', 'error'); }
    return;
  }
  const newStatus = action === 'done' ? 'done' : 'pending';
  try{
    await api(`tasks?id=eq.${id}`, { method:'PATCH', body: JSON.stringify({ status:newStatus, updated_at:new Date().toISOString() }) });
    const t = tasks.find(x => x.id === id);
    if(t){
      t.status = newStatus; t.updated_at = new Date().toISOString();
      if(newStatus === 'done') await logActivity(t.captain_id, 'task_completed', { description: t.description });
    }
    renderTasks();
    toast(newStatus === 'done' ? 'تم إنجاز المهمة' : 'تمت إعادة فتح المهمة', 'success');
  }catch(e){ toast('تعذر تحديث المهمة', 'error'); }
}
document.getElementById('taskSearch').oninput = renderTasks;

document.getElementById('copyTodayBtn').onclick = () => {
  const t = todayStr();
  const relevant = tasks.filter(x => x.status === 'pending' && (!x.due_date || x.due_date <= t));
  if(relevant.length === 0){ toast('لا توجد مهام اليوم أو متأخرة', 'info'); return; }

  const groups = new Map();
  team.forEach(m => groups.set(m.id, []));
  groups.set('unassigned', []);
  relevant.forEach(x => {
    const key = x.assigned_to && groups.has(x.assigned_to) ? x.assigned_to : 'unassigned';
    groups.get(key).push(x);
  });

  let text = `📋 مهام اليوم ${formatDate(t)}\n`;
  [...team.map(m => m.id), 'unassigned'].forEach(key => {
    const items = groups.get(key);
    if(items.length === 0) return;
    const memberName = key === 'unassigned' ? 'غير مسندة' : team.find(m => m.id === key).name;
    text += `\n👤 ${memberName}:\n`;
    items.forEach(x => {
      const cap = captainOf(x);
      const overdue = isTaskOverdue(x) ? ' ⚠️ متأخرة' : '';
      text += `- ${cap.name}${cap.phone ? ' (' + cap.phone + ')' : ''}: ${x.description}${overdue}\n`;
    });
  });

  navigator.clipboard.writeText(text).then(() => {
    toast('تم نسخ مهام اليوم — الصقها بالواتساب', 'success');
  }).catch(() => {
    toast('تعذر النسخ التلقائي، انسخ النص يدويًا', 'error');
  });
};

/* ============================================================
   dashboard.js — لوحة التحكم
   ============================================================ */
function renderDashboard(){
  const t = todayStr();
  const pendingTasks = tasks.filter(x => x.status === 'pending');
  const overdueTasks = pendingTasks.filter(x => x.due_date && x.due_date < t);
  const todayTasks = pendingTasks.filter(x => x.due_date === t);
  const doneThisWeek = tasks.filter(x => x.status === 'done' && (Date.now() - new Date(x.updated_at).getTime())/86400000 <= 7);
  const notesToday = notes.filter(n => n.created_at.slice(0,10) === t);

  const stats = [
    { icon:'👥', n: captains.length, l: 'إجمالي الكباتن' },
    { icon:'✨', n: captains.filter(c => c.status === 'new').length, l: 'كباتن جدد' },
    { icon:'✅', n: captains.filter(c => c.status === 'active').length, l: 'كباتن نشطون', cls:'ok' },
    { icon:'⚠️', n: captains.filter(c => c.status === 'needs_followup').length, l: 'يحتاجون متابعة', cls:'warn' },
    { icon:'📅', n: todayTasks.length, l: 'مهام اليوم' },
    { icon:'⏰', n: overdueTasks.length, l: 'مهام متأخرة', cls:'warn' },
    { icon:'✔️', n: doneThisWeek.length, l: 'مهام مكتملة (٧ أيام)', cls:'ok' },
    { icon:'📝', n: notesToday.length, l: 'ملاحظات اليوم' },
  ];
  const grid = document.getElementById('statGrid');
  grid.innerHTML = stats.map(s => `
    <div class="stat-card ${s.cls||''}">
      <div class="icon">${s.icon}</div>
      <div class="n">${s.n}</div>
      <div class="l">${s.l}</div>
    </div>
  `).join('');
}

/* ============================================================
   captains.js — جدول الكباتن + الفلاتر
   ============================================================ */
function populateFilters(){
  const statusSel = document.getElementById('statusFilter');
  statusSel.innerHTML = '<option value="">كل الحالات</option>' +
    STATUS_OPTIONS.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
  const assignedSel = document.getElementById('assignedFilter');
  assignedSel.innerHTML = '<option value="">كل المسؤولين</option>' +
    team.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
}
document.getElementById('captainSearch').oninput = renderCaptainsTable;
document.getElementById('statusFilter').onchange = renderCaptainsTable;
document.getElementById('assignedFilter').onchange = renderCaptainsTable;

function renderCaptainsTable(){
  const q = document.getElementById('captainSearch').value.trim().toLowerCase();
  const statusF = document.getElementById('statusFilter').value;
  const assignedF = document.getElementById('assignedFilter').value;

  let items = captains.filter(c => {
    if(q && !(c.name.toLowerCase().includes(q) || (c.phone||'').includes(q))) return false;
    if(statusF && c.status !== statusF) return false;
    if(assignedF && c.assigned_to !== assignedF) return false;
    return true;
  });
  items = [...items].sort((a,b) => (b.last_contact_at||b.created_at||'').localeCompare(a.last_contact_at||a.created_at||''));

  document.getElementById('captainCount').textContent = items.length ? `${items.length} كابتن` : '';
  const tableEl = document.getElementById('captainTable');
  if(items.length === 0){ tableEl.innerHTML = `<div class="empty">لا يوجد كباتن مطابقين</div>`; return; }

  tableEl.innerHTML = items.map(c => {
    const member = team.find(m => m.id === c.assigned_to);
    const lastContact = c.last_contact_at ? formatDate(c.last_contact_at.slice(0,10)) : 'لا يوجد';
    return `
      <div class="cap-row" data-id="${c.id}">
        <div class="cap-info">
          <div class="name">${escapeHtml(c.name)}</div>
          <div class="phone">${c.phone ? escapeHtml(c.phone) : '—'} · آخر تواصل: ${lastContact}</div>
        </div>
        <div class="cap-side">
          ${member ? `<span class="hint">${escapeHtml(member.name)}</span>` : ''}
          <span class="status-badge ${c.status}">${statusLabel(c.status)}</span>
        </div>
      </div>`;
  }).join('');

  tableEl.querySelectorAll('.cap-row').forEach(row => {
    row.onclick = () => openProfile(row.dataset.id);
  });
}

/* ============================================================
   profile.js — ملف الكابتن والحالة وسجل النشاط
   ============================================================ */
const profileStatusEl = document.getElementById('profileStatus');
function renderStatusSelectOptions(){
  profileStatusEl.innerHTML = STATUS_OPTIONS.map(s => `<option value="${s.id}">${escapeHtml(s.label)}</option>`).join('');
}
renderStatusSelectOptions();

async function openProfile(id){
  const c = captains.find(x => x.id === id);
  if(!c) return;
  activeProfileCaptainId = id;
  document.getElementById('profileName').textContent = c.name;
  document.getElementById('profilePhone').textContent = c.phone || 'بدون رقم جوال';
  profileStatusEl.value = c.status;
  const assignedSel = document.getElementById('profileAssigned');
  assignedSel.innerHTML = '<option value="">بدون تحديد</option>' + team.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  assignedSel.value = c.assigned_to || '';
  document.getElementById('profileMeta').textContent =
    `أُضيف بتاريخ ${formatDate((c.created_at||'').slice(0,10) || todayStr())}`;
  document.getElementById('profileOverlay').classList.add('open');
  await loadTimeline(id);
}
document.getElementById('closeProfile').onclick = () => {
  document.getElementById('profileOverlay').classList.remove('open');
  activeProfileCaptainId = null;
};
document.getElementById('profileOverlay').onclick = (ev) => {
  if(ev.target.id === 'profileOverlay'){ document.getElementById('profileOverlay').classList.remove('open'); activeProfileCaptainId = null; }
};

profileStatusEl.onchange = async () => {
  const id = activeProfileCaptainId;
  if(!id) return;
  const c = captains.find(x => x.id === id);
  const from = c.status;
  const to = profileStatusEl.value;
  try{
    await api(`captains?id=eq.${id}`, { method:'PATCH', body: JSON.stringify({ status: to }) });
    await api('captain_status_history', { method:'POST', body: JSON.stringify({ captain_id: id, from_status: from, to_status: to }) });
    await logActivity(id, 'status_changed', { from: statusLabel(from), to: statusLabel(to) });
    c.status = to;
    renderCaptainsTable(); renderDashboard(); loadTimeline(id);
    toast('تم تحديث الحالة', 'success');
  }catch(e){ toast('تعذر تحديث الحالة', 'error'); profileStatusEl.value = from; }
};

document.getElementById('profileAssigned').onchange = async (ev) => {
  const id = activeProfileCaptainId;
  if(!id) return;
  const memberId = ev.target.value || null;
  try{
    await api(`captains?id=eq.${id}`, { method:'PATCH', body: JSON.stringify({ assigned_to: memberId }) });
    const c = captains.find(x => x.id === id);
    if(c) c.assigned_to = memberId;
    renderCaptainsTable();
    toast('تم تحديث المسؤول', 'success');
  }catch(e){ toast('تعذر التحديث', 'error'); }
};

document.getElementById('addStatusToggle').onclick = () => {
  document.getElementById('newStatusBox').classList.toggle('open');
};
document.getElementById('addStatusConfirm').onclick = async () => {
  const input = document.getElementById('newStatusLabel');
  const label = input.value.trim();
  if(!label) { input.focus(); return; }
  const id = 'c_' + Date.now().toString(36);
  try{
    await api('custom_statuses', { method:'POST', body: JSON.stringify({ id, label }) });
    STATUS_OPTIONS.push({ id, label });
    renderStatusSelectOptions();
    populateFilters();
    profileStatusEl.value = id;
    input.value = '';
    document.getElementById('newStatusBox').classList.remove('open');
    toast('تمت إضافة الحالة الجديدة', 'success');
  }catch(e){ toast('تعذر إضافة الحالة، ربما الاسم مكرر', 'error'); }
};

document.getElementById('deleteCaptainBtn').onclick = async () => {
  const id = activeProfileCaptainId;
  if(!id) return;
  const c = captains.find(x => x.id === id);
  if(!confirm(`حذف الكابتن "${c.name}" نهائيًا؟ سيُحذف معه كل ملاحظاته ومهامه وسجله بالكامل، ولا يمكن التراجع.`)) return;
  try{
    await api(`captains?id=eq.${id}`, { method:'DELETE' });
    captains = captains.filter(x => x.id !== id);
    notes = notes.filter(n => n.captain_id !== id);
    tasks = tasks.filter(t => t.captain_id !== id);
    document.getElementById('profileOverlay').classList.remove('open');
    activeProfileCaptainId = null;
    renderCaptainsTable(); renderDashboard(); renderNotes(); renderTasks();
    toast('تم حذف الكابتن نهائيًا', 'success');
  }catch(e){ toast('تعذر الحذف', 'error'); }
};

const ACTIVITY_LABELS = {
  captain_created: () => 'إضافة الكابتن',
  note_added: d => `إضافة ملاحظة: ${d.snippet || ''}`,
  task_created: d => `إنشاء مهمة: ${d.description || ''}`,
  task_completed: d => `إكمال مهمة: ${d.description || ''}`,
  status_changed: d => `تغيير الحالة من "${d.from}" إلى "${d.to}"`,
};
async function loadTimeline(id){
  const el = document.getElementById('profileTimeline');
  el.innerHTML = '<div class="empty">جاري التحميل...</div>';
  try{
    const events = await api(`activity_logs?captain_id=eq.${id}&select=*&order=created_at.desc&limit=50`);
    if(events.length === 0){ el.innerHTML = '<div class="empty">لا يوجد نشاط بعد</div>'; return; }
    el.innerHTML = events.map(e => {
      const label = ACTIVITY_LABELS[e.event_type] ? ACTIVITY_LABELS[e.event_type](e.details || {}) : e.event_type;
      return `<div class="timeline-item"><div class="timeline-time">${formatDateTime(e.created_at)}</div><div>${escapeHtml(label)}</div></div>`;
    }).join('');
  }catch(e){ el.innerHTML = '<div class="empty">تعذر تحميل السجل</div>'; }
}

/* ============================================================
   نسخة احتياطية + التمهيد
   ============================================================ */
document.getElementById('exportBtn').onclick = () => {
  const backup = { captains, notes, tasks, team, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `captains-backup-${todayStr()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('تم تنزيل النسخة الاحتياطية', 'success');
};

if(accessToken){
  refreshSession().then(ok => { if(ok) showApp(); else doLogout(); });
} else {
  showLogin();
}
