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
document.getElementById('notesViewBtn').onclick = () => switchView('notes');
document.getElementById('tasksViewBtn').onclick = () => switchView('tasks');
function switchView(v){
  document.getElementById('notesView').classList.toggle('active', v === 'notes');
  document.getElementById('tasksView').classList.toggle('active', v === 'tasks');
  document.getElementById('notesViewBtn').classList.toggle('active', v === 'notes');
  document.getElementById('tasksViewBtn').classList.toggle('active', v === 'tasks');
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
  let captain = phone ? captains.find(c => (c.phone||'').trim() === phone) : null;
  if(!captain && !phone) captain = captains.find(c => c.name.trim() === name && !c.phone);
  if(captain){
    if(captain.name !== name) await api(`captains?id=eq.${captain.id}`, { method:'PATCH', body: JSON.stringify({ name }) });
    return captain.id;
  }
  const created = await api('captains', { method:'POST', headers:{ Prefer:'return=representation' }, body: JSON.stringify({ name, phone: phone || null }) });
  captains.push(created[0]);
  return created[0].id;
}

async function loadAll(){
  try{
    captains = await api('captains?select=id,name,phone');
    notes = await api('captain_notes?select=*&order=created_at.desc');
    tasks = await api('tasks?select=*&order=updated_at.desc');
    team = await api('team_members?select=*&order=name.asc');
    setConnection(true, 'متصل — البيانات تتزامن أونلاين');
    document.getElementById('saveNoteBtn').disabled = false;
    document.getElementById('saveTaskBtn').disabled = false;
    renderTeamChips();
    renderNotes();
    renderTasks();
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
document.querySelectorAll('#notePresets .note-chip').forEach(chip => {
  chip.onclick = () => {
    nContent.value = nContent.value.trim() ? `${nContent.value.trim()}\n${chip.textContent}` : chip.textContent;
    nContent.focus();
  };
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
const tPhone = document.getElementById('tPhone');
const tPhoneHint = document.getElementById('tPhoneHint');
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

tPhone.addEventListener('input', () => {
  const phone = tPhone.value.trim();
  const match = phone ? captains.find(c => (c.phone||'').trim() === phone) : null;
  if(match){
    tPhoneHint.textContent = `✓ كابتن موجود: ${match.name}`;
    tPhoneHint.classList.add('match');
    if(!tName.value.trim()) tName.value = match.name;
  } else {
    tPhoneHint.textContent = ''; tPhoneHint.classList.remove('match');
  }
});

saveTaskBtn.onclick = async () => {
  const name = tName.value.trim();
  if(!name){ tName.focus(); return; }
  const description = tDesc.value.trim();
  if(!description){ tDesc.focus(); return; }
  const phone = tPhone.value.trim();

  saveTaskBtn.disabled = true;
  try{
    const captainId = await findOrCreateCaptain(name, phone);
    await api('tasks', {
      method: 'POST',
      body: JSON.stringify({
        captain_id: captainId, description, assigned_to: selectedAssignee || null,
        due_date: selectedTaskDate || null, status: 'pending',
      }),
    });
    tasks = await api('tasks?select=*&order=updated_at.desc');
    tName.value=''; tPhone.value=''; tDesc.value=''; taskDateEl.value=''; selectedTaskDate=''; tPhoneHint.textContent='';
    renderTasks();
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
    if(t){ t.status = newStatus; t.updated_at = new Date().toISOString(); }
    renderTasks();
    toast(newStatus === 'done' ? 'تم إنجاز المهمة' : 'تمت إعادة فتح المهمة', 'success');
  }catch(e){ toast('تعذر تحديث المهمة', 'error'); }
}
document.getElementById('taskSearch').oninput = renderTasks;

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
