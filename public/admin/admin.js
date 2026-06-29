'use strict';

const API = '/admin/api';
let token = sessionStorage.getItem('adminToken') || null;
let bank = {};
let counts = {};
let activeType = 'multiple';
let editorType = 'multiple';
let editingId = null;
let roomsTimer = null;

const TYPES = ['multiple', 'truefalse', 'higherlower', 'freetext', 'estimate'];
const TYPE_LABELS = { multiple: 'Multiple Choice', truefalse: 'Wahr/Falsch', higherlower: 'Höher/Tiefer', freetext: 'Freitext', estimate: 'Schätzfrage' };
const CATS = ['general', 'science', 'geography', 'history', 'animals'];
const CAT_LABELS = { general: 'Allgemein', science: 'Wissenschaft', geography: 'Geografie', history: 'Geschichte', animals: 'Tiere' };
const DIFFS = ['easy', 'medium', 'hard'];
const DIFF_LABELS = { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer' };
const STATE_LABELS = { lobby: 'Lobby', loading: 'Lädt', question: 'Läuft', reveal: 'Auflösung', ended: 'Beendet' };

// Field schema per question type (drives the editor form).
const SCHEMA = {
  multiple: [
    { key: 'prompt', label: 'Frage', kind: 'bi' },
    { key: 'correct', label: 'Richtige Antwort', kind: 'bi' },
    { key: 'wrong', label: 'Falsche Antworten (genau 3)', kind: 'wrong' }
  ],
  truefalse: [
    { key: 'prompt', label: 'Aussage', kind: 'bi' },
    { key: 'answer', label: 'Aussage ist WAHR', kind: 'bool' }
  ],
  higherlower: [
    { key: 'prompt', label: 'Vergleichsfrage (z.B. „Was ist höher?")', kind: 'bi' },
    { key: 'a', label: 'Option 1', kind: 'bi' },
    { key: 'aValue', label: 'Wert von Option 1 (Zahl)', kind: 'num' },
    { key: 'b', label: 'Option 2', kind: 'bi' },
    { key: 'bValue', label: 'Wert von Option 2 (Zahl)', kind: 'num' },
    { key: 'unit', label: 'Einheit (z.B. „m", „kg")', kind: 'bi' }
  ],
  freetext: [
    { key: 'prompt', label: 'Frage', kind: 'bi' },
    { key: 'display', label: 'Angezeigte richtige Antwort', kind: 'bi' },
    { key: 'accept', label: 'Akzeptierte Antworten (mit Komma trennen)', kind: 'accept' }
  ],
  estimate: [
    { key: 'prompt', label: 'Frage', kind: 'bi' },
    { key: 'value', label: 'Richtiger Wert (Zahl)', kind: 'num' },
    { key: 'unit', label: 'Einheit (z.B. „Meter")', kind: 'bi' }
  ]
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); $('#' + id).classList.add('active'); }

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) }
  });
  if (res.status === 401) { logout(); throw new Error('unauthorized'); }
  return res;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch(API + '/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: $('#pwInput').value })
  });
  if (!res.ok) { $('#loginErr').textContent = 'Falsches Passwort.'; return; }
  const data = await res.json();
  token = data.token;
  sessionStorage.setItem('adminToken', token);
  $('#loginErr').textContent = '';
  $('#pwInput').value = '';
  enterDashboard();
});

function logout() {
  token = null;
  sessionStorage.removeItem('adminToken');
  if (roomsTimer) { clearInterval(roomsTimer); roomsTimer = null; }
  show('screen-login');
}
$('#logoutBtn').addEventListener('click', logout);

async function enterDashboard() {
  show('screen-admin');
  try {
    await loadQuestions();
  } catch { return; }
  loadRooms();
  if (roomsTimer) clearInterval(roomsTimer);
  roomsTimer = setInterval(loadRooms, 3000);
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------
async function loadQuestions() {
  const res = await api('/questions');
  const data = await res.json();
  bank = data.bank;
  counts = data.counts;
  buildTabs();
  renderQuestions();
}

function buildTabs() {
  $('#typeTabs').innerHTML = TYPES.map((t) =>
    `<button class="tab ${t === activeType ? 'active' : ''}" data-type="${t}">${TYPE_LABELS[t]} <b>${counts[t] ?? 0}</b></button>`
  ).join('');
  $('#typeTabs').querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', () => { activeType = b.dataset.type; buildTabs(); renderQuestions(); });
  });
}

function summary(type, q) {
  if (type === 'higherlower') return `${esc(q.a?.de)} ⇄ ${esc(q.b?.de)} · ${esc(q.prompt?.de)}`;
  if (type === 'truefalse') return `${esc(q.prompt?.de)} → <b>${q.answer ? 'WAHR' : 'FALSCH'}</b>`;
  if (type === 'estimate') return `${esc(q.prompt?.de)} → <b>${esc(q.value)} ${esc(q.unit?.de)}</b>`;
  if (type === 'freetext') return `${esc(q.prompt?.de)} → <b>${esc(q.display?.de)}</b>`;
  return `${esc(q.prompt?.de)} → <b>${esc(q.correct?.de)}</b>`;
}

function renderQuestions() {
  const list = bank[activeType] || [];
  $('#questionList').innerHTML = list.length
    ? list.map((q) => `
        <div class="q-row">
          <span class="q-meta">${CAT_LABELS[q.cat] || q.cat || '–'} · ${DIFF_LABELS[q.diff] || q.diff || '–'}</span>
          <span class="q-text">${summary(activeType, q)}</span>
          <span class="q-actions">
            <button class="icon-btn edit" data-id="${q.id}">✎</button>
            <button class="icon-btn del" data-id="${q.id}">🗑</button>
          </span>
        </div>`).join('')
    : '<p class="muted">Noch keine Fragen dieses Typs.</p>';

  $('#questionList').querySelectorAll('.edit').forEach((b) =>
    b.addEventListener('click', () => openEditor(activeType, (bank[activeType] || []).find((q) => q.id === b.dataset.id))));
  $('#questionList').querySelectorAll('.del').forEach((b) =>
    b.addEventListener('click', () => deleteQuestion(b.dataset.id)));
}

async function deleteQuestion(id) {
  if (!confirm('Diese Frage wirklich löschen?')) return;
  const res = await api('/questions/' + id, { method: 'DELETE' });
  if (res.ok) await loadQuestions();
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
$('#addBtn').addEventListener('click', () => openEditor(activeType, null));
$('#closeEditor').addEventListener('click', closeEditor);
$('#cancelEditor').addEventListener('click', closeEditor);

function openEditor(type, q) {
  editorType = type;
  editingId = q ? q.id : null;
  $('#editorTitle').textContent = (q ? 'Frage bearbeiten' : 'Neue Frage') + ' · ' + TYPE_LABELS[type];
  $('#editorErr').textContent = '';

  $('#catField').innerHTML = CATS.map((c) => `<option value="${c}">${CAT_LABELS[c]}</option>`).join('');
  $('#diffField').innerHTML = DIFFS.map((d) => `<option value="${d}">${DIFF_LABELS[d]}</option>`).join('');
  $('#catField').value = q?.cat || 'general';
  $('#diffField').value = q?.diff || 'medium';

  $('#dynamicFields').innerHTML = SCHEMA[type].map((f) => fieldHtml(f, q)).join('');
  $('#editorModal').classList.remove('hidden');
}

function closeEditor() { $('#editorModal').classList.add('hidden'); }

function biField(key, label, deVal, enVal) {
  return `<div class="field"><span>${label}</span>
    <div class="row2">
      <input data-f="${key}.de" placeholder="Deutsch" value="${esc(deVal)}" />
      <input data-f="${key}.en" placeholder="English" value="${esc(enVal)}" />
    </div></div>`;
}

function fieldHtml(f, q) {
  const v = q || {};
  if (f.kind === 'bi') return biField(f.key, f.label, v[f.key]?.de, v[f.key]?.en);
  if (f.kind === 'num') return `<div class="field"><span>${f.label}</span><input type="text" inputmode="decimal" data-f="${f.key}" value="${esc(v[f.key])}" /></div>`;
  if (f.kind === 'bool') return `<label class="field check"><input type="checkbox" data-f="${f.key}" ${v.answer ? 'checked' : ''} /><span>${f.label}</span></label>`;
  if (f.kind === 'wrong') {
    const de = v.wrong?.de || ['', '', ''];
    const en = v.wrong?.en || ['', '', ''];
    return `<div class="field"><span>${f.label}</span>` +
      [0, 1, 2].map((i) => `<div class="row2">
        <input data-f="wrong.de.${i}" placeholder="Falsch ${i + 1} (DE)" value="${esc(de[i])}" />
        <input data-f="wrong.en.${i}" placeholder="Wrong ${i + 1} (EN)" value="${esc(en[i])}" />
      </div>`).join('') + `</div>`;
  }
  if (f.kind === 'accept') {
    const de = (v.accept?.de || []).join(', ');
    const en = (v.accept?.en || []).join(', ');
    return `<div class="field"><span>${f.label}</span>
      <div class="row2">
        <input data-f="accept.de" placeholder="z.B. paris, die hauptstadt (DE)" value="${esc(de)}" />
        <input data-f="accept.en" placeholder="e.g. paris (EN)" value="${esc(en)}" />
      </div></div>`;
  }
  return '';
}

function collectForm() {
  const get = (sel) => $(`[data-f="${sel}"]`);
  const q = { cat: $('#catField').value, diff: $('#diffField').value };
  const bi = (key) => ({ de: get(key + '.de').value.trim(), en: get(key + '.en').value.trim() });

  for (const f of SCHEMA[editorType]) {
    if (f.kind === 'bi') q[f.key] = bi(f.key);
    else if (f.kind === 'num') q[f.key] = get(f.key).value.trim().replace(',', '.');
    else if (f.kind === 'bool') q[f.key] = get(f.key).checked;
    else if (f.kind === 'wrong') q.wrong = {
      de: [0, 1, 2].map((i) => get('wrong.de.' + i).value.trim()),
      en: [0, 1, 2].map((i) => get('wrong.en.' + i).value.trim())
    };
    else if (f.kind === 'accept') q.accept = {
      de: get('accept.de').value.split(',').map((s) => s.trim()).filter(Boolean),
      en: get('accept.en').value.split(',').map((s) => s.trim()).filter(Boolean)
    };
  }
  return q;
}

$('#editorForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = collectForm();
  const path = editingId ? '/questions/' + editingId : '/questions';
  const method = editingId ? 'PUT' : 'POST';
  const body = editingId ? { question } : { type: editorType, question };
  const res = await api(path, { method, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { $('#editorErr').textContent = data.error || 'Speichern fehlgeschlagen.'; return; }
  closeEditor();
  await loadQuestions();
});

// ---------------------------------------------------------------------------
// Live rooms
// ---------------------------------------------------------------------------
async function loadRooms() {
  try {
    const res = await api('/rooms');
    const { rooms } = await res.json();
    renderRooms(rooms);
  } catch { /* token may have expired; logout already handled */ }
}

function renderRooms(rooms) {
  const el = $('#roomsList');
  $('#liveDot').classList.toggle('on', rooms.length > 0);
  if (!rooms.length) { el.innerHTML = '<p class="muted">Gerade keine aktiven Spiele.</p>'; return; }
  el.innerHTML = rooms.map((r) => {
    const progress = (r.state === 'question' || r.state === 'reveal') ? `Frage ${r.questionIndex}/${r.totalQuestions} · ` : '';
    const players = [...r.players].sort((a, b) => b.score - a.score)
      .map((p) => `<span class="pl ${p.connected ? '' : 'off'}">${esc(p.name)} <b>${p.score}</b></span>`).join('');
    return `<div class="room">
      <div class="room-top">
        <span class="code">${esc(r.code)}</span>
        <span class="mode">${esc(r.mode)}</span>
        <span class="state s-${r.state}">${STATE_LABELS[r.state] || r.state}</span>
      </div>
      <div class="room-meta">${progress}${r.players.length} Spieler</div>
      <div class="room-players">${players || '<span class="muted">–</span>'}</div>
    </div>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Import (public Open Trivia DB + bulk JSON)
// ---------------------------------------------------------------------------
const OTDB_CATS = [
  { id: 0, label: 'Beliebig' }, { id: 9, label: 'Allgemeinwissen' }, { id: 17, label: 'Wissenschaft' },
  { id: 18, label: 'Computer' }, { id: 19, label: 'Mathematik' }, { id: 21, label: 'Sport' },
  { id: 22, label: 'Geografie' }, { id: 23, label: 'Geschichte' }, { id: 11, label: 'Film' },
  { id: 12, label: 'Musik' }, { id: 15, label: 'Videospiele' }, { id: 27, label: 'Tiere' }
];
const IMPORT_EXAMPLES = {
  multiple: [{ cat: 'general', diff: 'easy', prompt: { de: 'Frage?', en: 'Question?' }, correct: { de: 'Richtig', en: 'Right' }, wrong: { de: ['A', 'B', 'C'], en: ['A', 'B', 'C'] } }],
  truefalse: [{ cat: 'general', diff: 'easy', prompt: { de: 'Eine Aussage.', en: 'A statement.' }, answer: true }],
  higherlower: [{ cat: 'general', diff: 'medium', prompt: { de: 'Was ist größer?', en: 'Which is bigger?' }, a: { de: 'A', en: 'A' }, aValue: 10, b: { de: 'B', en: 'B' }, bValue: 5, unit: { de: '', en: '' } }],
  freetext: [{ cat: 'general', diff: 'easy', prompt: { de: 'Frage?', en: 'Question?' }, display: { de: 'Antwort', en: 'Answer' }, accept: { de: ['antwort'], en: ['answer'] } }],
  estimate: [{ cat: 'general', diff: 'medium', prompt: { de: 'Wie viele?', en: 'How many?' }, value: 42, unit: { de: 'Stück', en: 'pcs' } }]
};

function setupImport() {
  $('#otdbCategory').innerHTML = OTDB_CATS.map((c) => `<option value="${c.id}">${c.label}</option>`).join('');
  $('#otdbDiff').innerHTML = [['any', 'Beliebig'], ['easy', 'Leicht'], ['medium', 'Mittel'], ['hard', 'Schwer']]
    .map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  $('#importType').innerHTML = TYPES.map((t) => `<option value="${t}">${TYPE_LABELS[t]}</option>`).join('');
}

$('#otdbBtn').addEventListener('click', async () => {
  const out = $('#otdbResult');
  out.textContent = 'Lädt…'; out.className = 'import-result';
  try {
    const res = await api('/import-opentdb', { method: 'POST', body: JSON.stringify({
      amount: $('#otdbAmount').value, category: $('#otdbCategory').value, difficulty: $('#otdbDiff').value
    }) });
    const data = await res.json();
    if (!res.ok) { out.textContent = data.error || 'Fehler'; out.classList.add('err'); return; }
    out.textContent = `✓ ${data.added} Fragen importiert.`; out.classList.add('ok');
    await loadQuestions();
  } catch { out.textContent = 'Netzwerkfehler'; out.classList.add('err'); }
});

$('#jsonExampleLink').addEventListener('click', (e) => {
  e.preventDefault();
  $('#importJson').value = JSON.stringify(IMPORT_EXAMPLES[$('#importType').value], null, 2);
});

$('#importBtn').addEventListener('click', async () => {
  const out = $('#importResult');
  out.className = 'import-result';
  let questions;
  try { questions = JSON.parse($('#importJson').value); }
  catch { out.textContent = 'Ungültiges JSON.'; out.classList.add('err'); return; }
  if (!Array.isArray(questions)) { out.textContent = 'JSON muss ein Array sein.'; out.classList.add('err'); return; }
  try {
    const res = await api('/import', { method: 'POST', body: JSON.stringify({ type: $('#importType').value, questions }) });
    const data = await res.json();
    if (!res.ok) { out.textContent = data.error || 'Fehler'; out.classList.add('err'); return; }
    out.textContent = `✓ ${data.added} importiert${data.failed ? `, ${data.failed} fehlerhaft (${data.errors.map((x) => `#${x.index}: ${x.error}`).join('; ')})` : ''}.`;
    out.classList.add(data.failed ? 'err' : 'ok');
    await loadQuestions();
  } catch { out.textContent = 'Netzwerkfehler'; out.classList.add('err'); }
});

// Close modal on backdrop click / Escape
$('#editorModal').addEventListener('click', (e) => { if (e.target.id === 'editorModal') closeEditor(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEditor(); });
setupImport();

// ---------------------------------------------------------------------------
// Boot — resume session if a token is stored.
// ---------------------------------------------------------------------------
if (token) enterDashboard(); else show('screen-login');
