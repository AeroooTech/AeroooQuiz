import { t, setLang, getLang, TRANSLATIONS } from './i18n.js';
import { BRAND } from './brand.js';
import { AudioManager } from './audio.js';

/* global io */
const socket = io();

// ---------------------------------------------------------------------------
// Static option lists (mirrors server constants)
// ---------------------------------------------------------------------------
// === Game modes ============================================================
// The order here is the order of the cards. "teams" is intentionally NOT a mode
// any more — Teams vs. FFA is a separate toggle (see state.teamMode).
// To ADD A MODE: add its id here, an icon below in MODE_META, the i18n keys
// `mode_<id>` + `mode_<id>_desc` (i18n.js), a default time in MODE_TIME, and a
// matching entry in the server's MODE_CONFIG.
const MODES = ['classic', 'speed', 'survival', 'hilo', 'text', 'estimate', 'trueblitz', 'wager'];

// Per-mode card icon (emoji keeps it dependency-free and on-style). Name +
// description come from i18n (mode_<id> / mode_<id>_desc).
const MODE_META = {
  classic:   { icon: '🎯' },
  speed:     { icon: '🏁' },
  survival:  { icon: '💀' },
  hilo:      { icon: '📈' },
  text:      { icon: '⌨️' },
  estimate:  { icon: '🔢' },
  trueblitz: { icon: '⚡' },
  wager:     { icon: '🎰' }
};

// Sensible default time-per-question per mode (host can still change it).
const MODE_TIME = { classic: 20, speed: 20, survival: 20, hilo: 15, text: 30, estimate: 30, trueblitz: 10, wager: 20 };
const WAGER_OPTIONS = [100, 250, 500];

// === Player avatars ========================================================
// City Pop avatar images in public/avatars/. To ADD AN ICON: drop a PNG in that
// folder and add an { id, img } entry — it appears in the picker automatically.
const PLAYER_ICONS = [
  { id: 'cassette',   img: 'avatars/01_cassette.png' },
  { id: 'palm',       img: 'avatars/02_palm.png' },
  { id: 'skyline',    img: 'avatars/03_skyline.png' },
  { id: 'vinyl',      img: 'avatars/04_vinyl.png' },
  { id: 'boombox',    img: 'avatars/05_boombox.png' },
  { id: 'car',        img: 'avatars/06_car.png' },
  { id: 'cocktail',   img: 'avatars/07_cocktail.png' },
  { id: 'headphones', img: 'avatars/08_headphones.png' },
  { id: 'cat',        img: 'avatars/09_cat.png' },
  { id: 'mic',        img: 'avatars/10_mic.png' }
];
const ICON_SRC = Object.fromEntries(PLAYER_ICONS.map((i) => [i.id, i.img]));
const DEFAULT_ICON = 'palm';
// Render an avatar as an <img>. Unknown/legacy ids fall back to the default.
function avatarHtml(id, cls = 'av-img') {
  const src = ICON_SRC[id] || ICON_SRC[DEFAULT_ICON];
  return `<img class="${cls}" src="${src}" alt="" />`;
}

const STREAK_MIN = 3; // consecutive correct answers before a 🔥 streak shows
const DIFFICULTIES = ['any', 'easy', 'medium', 'hard'];
const CATEGORIES = [
  { id: 0, key: 'any' }, { id: 9, key: 'general' }, { id: 17, key: 'science' },
  { id: 18, key: 'computers' }, { id: 19, key: 'maths' }, { id: 21, key: 'sports' },
  { id: 22, key: 'geography' }, { id: 23, key: 'history' }, { id: 11, key: 'film' },
  { id: 12, key: 'music' }, { id: 15, key: 'videogames' }, { id: 27, key: 'animals' }
];
const TEAMS = ['red', 'blue', 'green', 'yellow'];
const TEAM_LABEL = { red: 'team_red', blue: 'team_blue', green: 'team_green', yellow: 'team_yellow' };

// ---------------------------------------------------------------------------
// Client state
// ---------------------------------------------------------------------------
const state = {
  you: null,
  code: null,
  hostId: null,
  settings: null,
  players: [],
  mode: 'classic',
  icon: localStorage.getItem('aerooo.icon') || 'palm', // chosen avatar id (persisted)
  // game
  myAnswer: null,
  answered: false,
  myWager: 0,
  questionData: null,
  reveal: null,
  timerInterval: null,
  paused: false,
  myStreak: 0,
  shopCatalog: null
};

// Pick the field of a {de,en} object for the current UI language.
const L = (obj) => (!obj ? '' : (obj[getLang()] ?? obj.en ?? obj.de ?? ''));

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  $(`#screen-${id}`).classList.add('active');
}

const isHost = () => state.you && state.you === state.hostId;

// ---------------------------------------------------------------------------
// i18n application
// ---------------------------------------------------------------------------
function applyStaticI18n() {
  document.documentElement.lang = getLang();
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  $$('.lang-btn').forEach((b) => b.classList.toggle('active', b.dataset.lang === getLang()));
}

function rerenderDynamic() {
  // Re-render whatever screen is currently showing so live language change works.
  populateSelects();
  renderModeCards();   // mode card names/descriptions are translated
  renderIconPicker();
  if (state.settings) syncSettingsToUI();
  renderPlayers();
  renderTeamPicker();
  updateModeDesc();
  if ($('#screen-game').classList.contains('active') && state.questionData) {
    renderQuestionStatics();
    const d = state.questionData;
    if (d.options) {
      $$('.answer-btn').forEach((b, i) => {
        const span = b.querySelector('.atext');
        if (span && d.options[i]) span.textContent = L(d.options[i]);
        const hl = b.querySelector('.hl-val');
        if (hl && state.reveal?.values) hl.textContent = `${state.reveal.values[i]} ${L(state.reveal.unit)}`;
      });
    }
    const ti = $('#textInput'); if (ti) ti.placeholder = t('yourAnswerPh');
    const ni = $('#numInput'); if (ni) ni.placeholder = t('yourGuessPh');
    const sb = $('#textForm button'); if (sb) sb.textContent = t('submitAnswer');
    const wl = $('.wager-label'); if (wl) wl.textContent = t('setWager');
    const allin = $('.wager-chip.allin'); if (allin) allin.textContent = `${t('wagerAllIn')} · ${allin.dataset.w}`;
    renderLiveScores(state.players);
    if (state.reveal) applyReveal(state.reveal);
  }
}

$('#langSwitch').addEventListener('click', (e) => {
  const btn = e.target.closest('.lang-btn');
  if (!btn) return;
  setLang(btn.dataset.lang);
  applyStaticI18n();
  rerenderDynamic();
});

// ---------------------------------------------------------------------------
// Populate select dropdowns
// ---------------------------------------------------------------------------
function populateSelects() {
  const catSel = $('#categorySelect');
  const diffSel = $('#difficultySelect');
  catSel.innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${t('cat_' + c.key)}</option>`).join('');
  diffSel.innerHTML = DIFFICULTIES.map((d) => `<option value="${d}">${t('diff_' + d)}</option>`).join('');
  refreshAllSelects();
}

// The currently selected mode lives on the highlighted card (host) or in the
// synced settings (everyone else).
function getSelectedMode() {
  return $('#modeCards .mode-card.selected')?.dataset.mode || state.settings?.mode || 'classic';
}

function updateModeDesc() {
  $('#modeDesc').textContent = t('mode_' + getSelectedMode() + '_desc');
}

// ---------------------------------------------------------------------------
// Custom styled dropdowns
// Each native <select> stays in the DOM as the source of truth (and keeps
// emitting `change`); we layer a styled trigger + listbox on top of it.
// ---------------------------------------------------------------------------
const ENHANCED_SELECTS = ['categorySelect', 'difficultySelect'];
const cselects = new Map();

const isSelectDisabled = (select) => select.matches(':disabled');

function closeAllMenus(except) {
  cselects.forEach((api) => {
    if (api === except) return;
    api.wrap.classList.remove('open');
    api.trigger.setAttribute('aria-expanded', 'false');
  });
}

function toggleMenu(api, open) {
  if (open) closeAllMenus(api);
  api.wrap.classList.toggle('open', open);
  api.trigger.setAttribute('aria-expanded', String(open));
  if (open) {
    const target = api.menu.querySelector('.cselect-option.sel') || api.menu.querySelector('.cselect-option');
    target?.focus();
  }
}

function enhanceSelect(id) {
  const select = document.getElementById(id);
  if (!select || cselects.has(id)) return;
  select.classList.add('enhanced');

  const wrap = document.createElement('div');
  wrap.className = 'cselect';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'cselect-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = '<span class="cselect-label"></span><span class="cselect-arrow" aria-hidden="true"></span>';
  const menu = document.createElement('ul');
  menu.className = 'cselect-menu';
  menu.setAttribute('role', 'listbox');
  wrap.append(trigger, menu);
  select.after(wrap);

  const api = { select, wrap, trigger, menu };
  cselects.set(id, api);

  trigger.addEventListener('click', () => {
    if (isSelectDisabled(select)) return;
    toggleMenu(api, !wrap.classList.contains('open'));
  });
  trigger.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && !wrap.classList.contains('open')) {
      e.preventDefault();
      if (!isSelectDisabled(select)) toggleMenu(api, true);
    }
  });

  menu.addEventListener('click', (e) => {
    const opt = e.target.closest('.cselect-option');
    if (!opt) return;
    select.value = opt.dataset.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    refreshSelect(id);
    toggleMenu(api, false);
    trigger.focus();
  });
  menu.addEventListener('keydown', (e) => {
    const opts = [...menu.querySelectorAll('.cselect-option')];
    const i = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(i + 1, opts.length - 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); opts[Math.max(i - 1, 0)]?.focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.activeElement.click(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { toggleMenu(api, false); trigger.focus(); }
  });

  refreshSelect(id);
}

function refreshSelect(id) {
  const api = cselects.get(id);
  if (!api) return;
  const { select, trigger, menu, wrap } = api;
  const selected = select.options[select.selectedIndex];
  trigger.querySelector('.cselect-label').textContent = selected ? selected.textContent : '';
  menu.innerHTML = [...select.options].map((o, i) =>
    `<li class="cselect-option ${o.selected ? 'sel' : ''}" role="option" tabindex="-1"` +
    ` aria-selected="${o.selected}" data-value="${escapeHtml(o.value)}" style="--d:${i * 22}ms">` +
    `${escapeHtml(o.textContent)}</li>`
  ).join('');
  const disabled = isSelectDisabled(select);
  trigger.disabled = disabled;
  wrap.classList.toggle('disabled', disabled);
}

function refreshAllSelects() { ENHANCED_SELECTS.forEach(refreshSelect); }

// ---------------------------------------------------------------------------
// HOME
// ---------------------------------------------------------------------------
$('#createBtn').addEventListener('click', () => {
  const name = $('#nameInput').value.trim();
  if (!name) return showHomeError('nameRequired');
  socket.emit('createRoom', { name, icon: state.icon }, handleJoinResponse);
});

$('#joinBtn').addEventListener('click', () => {
  const name = $('#nameInput').value.trim();
  const code = $('#codeInput').value.trim().toUpperCase();
  if (!name) return showHomeError('nameRequired');
  if (!code) return showHomeError('roomNotFound');
  socket.emit('joinRoom', { name, code, icon: state.icon }, handleJoinResponse);
});

// --- Avatar picker (home) — rendered from PLAYER_ICONS, selection persisted. --
function renderIconPicker() {
  // Heal a stored id that no longer exists (e.g. an old emoji avatar).
  if (!ICON_SRC[state.icon]) { state.icon = DEFAULT_ICON; localStorage.setItem('aerooo.icon', state.icon); }
  const grid = $('#iconGrid');
  grid.innerHTML = PLAYER_ICONS.map((ic) =>
    `<button type="button" class="icon-tile ${ic.id === state.icon ? 'sel' : ''}"
       role="radio" aria-checked="${ic.id === state.icon}" data-icon="${ic.id}">${avatarHtml(ic.id, 'tile-img')}</button>`
  ).join('');
}
$('#iconGrid').addEventListener('click', (e) => {
  const tile = e.target.closest('.icon-tile');
  if (!tile) return;
  state.icon = tile.dataset.icon;
  localStorage.setItem('aerooo.icon', state.icon);
  renderIconPicker();
  // If we're already in a lobby, tell the server about the new avatar.
  if (state.code) socket.emit('setIcon', { icon: state.icon });
});

$('#codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#joinBtn').click(); });
$('#nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#createBtn').click(); });

function showHomeError(code) {
  $('#homeError').textContent = t('err_' + code);
}

function handleJoinResponse(res) {
  if (res?.error) return showHomeError(res.error);
  state.you = res.you;
  state.code = res.code;
  $('#homeError').textContent = '';
  showScreen('lobby');
}

// ---------------------------------------------------------------------------
// LOBBY
// ---------------------------------------------------------------------------
$('#copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(state.code);
    const btn = $('#copyBtn');
    btn.textContent = t('copied');
    setTimeout(() => { btn.textContent = t('copy'); }, 1500);
  } catch { /* clipboard may be blocked; ignore */ }
});

$('#leaveBtn').addEventListener('click', () => {
  socket.emit('leaveRoom');
  resetToHome();
});

function resetToHome() {
  state.code = null;
  state.you = null;
  showScreen('home');
}

// Host edits settings -> push to server. The mode comes from the selected card,
// the Teams/FFA flag from the toggle.
function pushSettings() {
  if (!isHost()) return;
  socket.emit('updateSettings', {
    mode: getSelectedMode(),
    teamMode: $('#teamToggle .active')?.dataset.teamMode === 'teams',
    streaks: $('#streakToggle .active')?.dataset.streaks === 'on',
    category: Number($('#categorySelect').value),
    difficulty: $('#difficultySelect').value,
    amount: Number($('#amountInput').value),
    questionTime: Number($('#timeInput').value)
  });
}

// --- Mode cards (lobby) ------------------------------------------------------
// Build the card grid from MODES + MODE_META; name/description come from i18n.
function renderModeCards() {
  const sel = getSelectedMode();
  $('#modeCards').innerHTML = MODES.map((m) =>
    `<button type="button" class="mode-card ${m === sel ? 'selected' : ''}"
       role="radio" aria-checked="${m === sel}" data-mode="${m}">
       <span class="mode-ic">${MODE_META[m].icon}</span>
       <span class="mode-name">${t('mode_' + m)}</span>
       <span class="mode-sub">${t('mode_' + m + '_desc')}</span>
     </button>`
  ).join('');
}
function setModeSelected(mode) {
  $$('#modeCards .mode-card').forEach((c) => {
    const on = c.dataset.mode === mode;
    c.classList.toggle('selected', on);
    c.setAttribute('aria-checked', on);
  });
  updateModeDesc();
}
$('#modeCards').addEventListener('click', (e) => {
  const card = e.target.closest('.mode-card');
  if (!card || !isHost()) return;
  setModeSelected(card.dataset.mode);
  if (MODE_TIME[card.dataset.mode]) $('#timeInput').value = MODE_TIME[card.dataset.mode];
  pushSettings();
});

// --- Teams / FFA toggle ------------------------------------------------------
function setTeamMode(on) {
  $$('#teamToggle button').forEach((b) => b.classList.toggle('active', (b.dataset.teamMode === 'teams') === on));
  renderTeamPicker();
}
$('#teamToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || !isHost()) return;
  setTeamMode(btn.dataset.teamMode === 'teams');
  pushSettings();
});

// --- Streaks on/off toggle ---------------------------------------------------
function setStreaks(on) {
  $$('#streakToggle button').forEach((b) => b.classList.toggle('active', (b.dataset.streaks === 'on') === on));
}
$('#streakToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || !isHost()) return;
  setStreaks(btn.dataset.streaks === 'on');
  pushSettings();
});

['#categorySelect', '#difficultySelect', '#amountInput', '#timeInput'].forEach((sel) => {
  $(sel).addEventListener('change', () => { updateModeDesc(); pushSettings(); });
});

$('#startBtn').addEventListener('click', () => socket.emit('startGame'));

function syncSettingsToUI() {
  const s = state.settings;
  if (!s) return;
  setModeSelected(s.mode);
  setTeamMode(!!s.teamMode);
  setStreaks(s.streaks !== false);
  $('#categorySelect').value = String(s.category);
  $('#difficultySelect').value = s.difficulty;
  $('#amountInput').value = s.amount;
  $('#timeInput').value = s.questionTime;
  refreshAllSelects();
}

// Render the room code as a split-flap board. Only rebuild (and re-trigger the
// flip animation) when the code actually changes, so player joins don't re-flap.
function renderRoomCode(code) {
  const el = $('#roomCodeDisplay');
  if (el.dataset.code === code) return;
  el.dataset.code = code;
  el.innerHTML = [...code]
    .map((ch, i) => `<span class="flap" style="animation-delay:${i * 90}ms">${escapeHtml(ch)}</span>`)
    .join('');
}

function renderPlayers() {
  const list = $('#playerList');
  $('#playerCount').textContent = state.players.length;
  const teamMode = state.settings?.teamMode;
  list.innerHTML = state.players.map((p) => {
    const youBadge = p.id === state.you ? `<span class="badge you">${t('you')}</span>` : '';
    const hostBadge = p.isHost ? `<span class="badge">${t('host')}</span>` : '';
    const teamTag = teamMode && p.team
      ? `<span class="tag-team ${p.team}">${t(TEAM_LABEL[p.team])}</span>` : '';
    return `<li>
      <span class="dot ${p.connected ? 'on' : ''}"></span>
      <span class="p-avatar">${avatarHtml(p.icon)}</span>
      <span class="pname">${escapeHtml(p.name)}</span>
      ${teamTag}${youBadge}${hostBadge}
    </li>`;
  }).join('');
}

function renderTeamPicker() {
  const picker = $('#teamPicker');
  // Only relevant when the Teams play style is active.
  const isTeams = !!state.settings?.teamMode;
  picker.classList.toggle('hidden', !isTeams);
  if (!isTeams) return;
  const me = state.players.find((p) => p.id === state.you);
  // TEAMS.slice(0, 2) = two teams. Raise the count (and add colours in CSS) for more.
  $('#teamButtons').innerHTML = TEAMS.slice(0, 2).map((team) =>
    `<button class="${team} ${me?.team === team ? 'sel' : ''}" data-team="${team}">${t(TEAM_LABEL[team])}</button>`
  ).join('');
}

$('#teamButtons').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn) socket.emit('joinTeam', { team: btn.dataset.team });
});

function applyHostControls() {
  const host = isHost();
  $('#settingsFieldset').disabled = !host;
  $('#startBtn').style.display = host ? 'block' : 'none';
  $('#waitMsg').style.display = host ? 'none' : 'block';
  refreshAllSelects();
}

// ---------------------------------------------------------------------------
// Socket: lobby updates
// ---------------------------------------------------------------------------
socket.on('roomUpdate', (data) => {
  state.code = data.code;
  state.hostId = data.hostId;
  state.settings = data.settings;
  state.players = data.players;
  state.mode = data.settings.mode;

  renderRoomCode(data.code);
  syncSettingsToUI();
  renderPlayers();
  renderTeamPicker();
  applyHostControls();

  if (data.state === 'lobby' || data.state === 'ended') {
    if (!$('#screen-game').classList.contains('active') &&
        !$('#screen-over').classList.contains('active')) {
      showScreen('lobby');
    }
  }
});

socket.on('gameLoading', () => { stopTimer(); showScreen('loading'); });

socket.on('gameError', (data) => {
  showScreen('lobby');
  alert(t('err_' + (data.code || 'fetchFailed')));
});

// ---------------------------------------------------------------------------
// GAME
// ---------------------------------------------------------------------------
socket.on('gameStarted', (data) => {
  state.mode = data.mode;
  displayedScores.clear(); // fresh count-up baseline for the new game
  state.myStreak = 0;
});

// Distribution bars (A/B/C/D) on each answer button after the reveal.
function renderAnswerCounts(data) {
  if (!data.answerCounts) return;
  const total = data.answerCounts.reduce((a, b) => a + b, 0) || 1;
  $$('#answersGrid .answer-btn').forEach((b, i) => {
    const c = data.answerCounts[i] || 0;
    b.style.setProperty('--pct', `${Math.round((c / total) * 100)}%`);
    b.classList.add('dist');
    let badge = b.querySelector('.ans-count');
    if (!badge) { badge = document.createElement('span'); badge.className = 'ans-count'; b.appendChild(badge); }
    badge.textContent = c;
  });
}

socket.on('question', (data) => {
  state.questionData = data;
  state.mode = data.mode;
  state.myAnswer = null;
  state.answered = false;
  state.myWager = 0;
  state.reveal = null;
  state.players = data.players;
  // Seed displayed scores so the first reveal counts up from the pre-reveal value.
  data.players.forEach((p) => { if (!displayedScores.has(p.id)) displayedScores.set(p.id, p.score); });
  $('#revealDetail').style.display = 'none';

  // reset pause UI for the new question
  state.paused = false;
  $('#pauseOverlay').classList.add('hidden');
  $('#pauseBtn').textContent = '⏸';
  $('#pauseBtn').classList.toggle('hidden', !isHost()); // only the host sees Pause

  clearInterval(shopInterval); // in case we came straight from the shop

  showScreen('game');
  renderQuestionStatics();
  renderInputs();
  renderItemBar();              // show owned power-ups
  renderLiveScores(data.players);
  startTimer(data.time);

  const me = data.players.find((p) => p.id === state.you);
  if (state.mode === 'survival' && me && !me.alive) setStatus('eliminated', 'bad');
  else setStatus('', '');
});

// --- Host pause / resume -----------------------------------------------------
$('#pauseBtn').addEventListener('click', () => {
  if (!isHost()) return;
  socket.emit(state.paused ? 'resumeGame' : 'pauseGame');
});
// Resume control lives INSIDE the overlay (the overlay covers the top pause button).
$('#resumeBtn').addEventListener('click', () => { if (isHost()) socket.emit('resumeGame'); });

socket.on('paused', () => {
  state.paused = true;
  freezeTimer();
  $('#pauseOverlay').classList.remove('hidden');
  $('#pauseBtn').textContent = '▶';
  // Host sees a Resume button; everyone else sees "waiting for host".
  $('#resumeBtn').classList.toggle('hidden', !isHost());
  $('#waitResume').classList.toggle('hidden', isHost());
  audio.sfx('pause');
});

socket.on('resumed', (data) => {
  state.paused = false;
  $('#pauseOverlay').classList.add('hidden');
  $('#pauseBtn').textContent = '⏸';
  audio.sfx('resume');
  resumeTimer(data.time); // continue the bar from where it was, over the remaining time
});

// ---------------------------------------------------------------------------
// Shop + power-ups (wager mode)
// ---------------------------------------------------------------------------
const ITEM_ICON = { fifty: '✂️', skip: '⏭️' };
let shopInterval = 0;

socket.on('shopOpen', (data) => {
  state.shopCatalog = data.items;   // [{id, price, effect, name{de,en}, desc{de,en}}]
  state.players = data.players;
  showScreen('shop');
  audio.sfx('shop');
  $('#shopContinueBtn').classList.toggle('hidden', !isHost());
  renderShop();
  clearInterval(shopInterval);
  let remaining = data.time;
  $('#shopTimer').textContent = remaining;
  shopInterval = setInterval(() => {
    remaining -= 1;
    $('#shopTimer').textContent = Math.max(0, remaining);
    if (remaining <= 0) clearInterval(shopInterval);
  }, 1000);
});

socket.on('shopUpdate', (data) => { state.players = data.players; renderShop(); });

function renderShop() {
  const me = state.players.find((p) => p.id === state.you);
  const pts = me ? me.score : 0;
  $('#shopPoints').textContent = pts;
  $('#shopItems').innerHTML = (state.shopCatalog || []).map((item) => {
    const ownedCount = (me?.items || []).filter((x) => x === item.id).length;
    const afford = pts >= item.price;
    return `<div class="shop-item">
      <div class="shop-ic">${ITEM_ICON[item.id] || '🎁'}</div>
      <div class="shop-info">
        <div class="shop-name">${escapeHtml(L(item.name))}${ownedCount ? ` <span class="owned-badge">×${ownedCount}</span>` : ''}</div>
        <div class="shop-desc">${escapeHtml(L(item.desc))}</div>
      </div>
      <button class="btn shop-buy ${afford ? 'primary' : ''}" data-item="${item.id}" ${afford ? '' : 'disabled'}>
        <span class="mono">${item.price}</span> · ${afford ? t('buy') : t('notEnough')}
      </button>
    </div>`;
  }).join('');
}

$('#shopItems').addEventListener('click', (e) => {
  const btn = e.target.closest('.shop-buy');
  if (!btn || btn.disabled) return;
  socket.emit('buyItem', { itemId: btn.dataset.item });
  audio.sfx('purchase');
});
$('#shopContinueBtn').addEventListener('click', () => { if (isHost()) socket.emit('closeShop'); });

// --- Power-up bar during a question -----------------------------------------
function renderItemBar() {
  const bar = $('#itemBar');
  const me = state.players.find((p) => p.id === state.you);
  const items = me?.items || [];
  if (!items.length || state.answered) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
  const counts = {};
  items.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
  const cat = state.shopCatalog || [];
  bar.classList.remove('hidden');
  bar.innerHTML = Object.entries(counts).map(([id, n]) => {
    const label = cat.find((i) => i.id === id)?.name;
    return `<button class="item-chip" data-item="${id}" title="${escapeHtml(label ? L(label) : id)}">
      ${ITEM_ICON[id] || '🎁'}${n > 1 ? `<span class="item-n">×${n}</span>` : ''}</button>`;
  }).join('');
}

$('#itemBar').addEventListener('click', (e) => {
  const btn = e.target.closest('.item-chip');
  if (!btn || state.answered) return;
  socket.emit('useItem', { itemId: btn.dataset.item });
});

socket.on('playerItems', (data) => { state.players = data.players; renderItemBar(); renderLiveScores(data.players); });

socket.on('itemUsed', (data) => {
  audio.sfx('purchase');
  if (data.itemId === 'fifty' && Array.isArray(data.remove)) {
    data.remove.forEach((i) => {
      const b = document.querySelector(`.answer-btn[data-i="${i}"]`);
      if (b) { b.classList.add('removed'); b.disabled = true; }
    });
  } else if (data.itemId === 'skip') {
    state.answered = true;
    $$('.answer-btn').forEach((b) => (b.disabled = true));
    setStatus('skipped', 'dim');
  }
  renderItemBar();
});

function renderQuestionStatics() {
  const d = state.questionData;
  if (!d) return;
  $('#qProgress').textContent = t('questionOf', d.index + 1, d.total);
  const catTxt = d.catKey ? t('cat_' + d.catKey) : '';
  $('#qCategory').textContent = `${catTxt} · ${t('diff_' + d.diff)}`;
  $('#questionText').textContent = L(d.prompt);
}

// Build the answer UI based on the question type.
function renderInputs() {
  const d = state.questionData;
  const grid = $('#answersGrid');
  const me = state.players.find((p) => p.id === state.you);
  const spectating = state.mode === 'survival' && me && !me.alive;

  renderWager(d);

  if (d.options) {
    // choice types: multiple / truefalse / higherlower
    grid.className = 'answers' + (d.options.length === 2 ? ' duo' : '');
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    grid.innerHTML = d.options.map((opt, i) => {
      const key = d.type === 'higherlower' ? (i + 1) : letters[i];
      const hl = d.type === 'higherlower' ? '<span class="hl-val"></span>' : '';
      return `<button class="answer-btn" data-i="${i}">
        <span class="ix">${key}</span><span class="atext">${escapeHtml(L(opt))}</span>${hl}
      </button>`;
    }).join('');
    grid.querySelectorAll('.answer-btn').forEach((btn) => {
      btn.addEventListener('click', () => submitChoice(Number(btn.dataset.i)));
    });
  } else {
    // free input: freetext / estimate
    const isNum = d.type === 'estimate';
    grid.className = 'answers single';
    grid.innerHTML = `<form class="text-answer" id="textForm">
      <input type="text" id="${isNum ? 'numInput' : 'textInput'}" autocomplete="off"
             ${isNum ? 'inputmode="decimal"' : 'maxlength="40"'} />
      <button class="btn primary" type="submit">${t('submitAnswer')}</button>
    </form>`;
    const input = $(isNum ? '#numInput' : '#textInput');
    input.placeholder = isNum ? t('yourGuessPh') : t('yourAnswerPh');
    $('#textForm').addEventListener('submit', (e) => {
      e.preventDefault();
      isNum ? submitFree({ number: input.value, text: input.value }) : submitFree({ text: input.value });
    });
    if (!spectating) setTimeout(() => input.focus(), 60);
  }

  if (spectating) disableInputs();
}

function disableInputs() {
  $$('#answersGrid button, #answersGrid input, .wager-chip').forEach((el) => (el.disabled = true));
}

function renderWager(d) {
  const bar = $('#wagerBar');
  if (!d.wager) { bar.classList.add('hidden'); state.myWager = 0; return; }
  const me = state.players.find((p) => p.id === state.you);
  const max = Math.max(0, me ? me.score : 1000);
  const opts = WAGER_OPTIONS.filter((w) => w <= max);
  bar.classList.remove('hidden');
  bar.innerHTML = `<span class="wager-label">${t('setWager')}</span>` +
    opts.map((w) => `<button class="wager-chip" data-w="${w}">${w}</button>`).join('') +
    `<button class="wager-chip allin" data-w="${max}">${t('wagerAllIn')} · ${max}</button>`;
  bar.querySelectorAll('.wager-chip').forEach((c) => {
    c.addEventListener('click', () => {
      if (state.answered) return;
      state.myWager = Number(c.dataset.w);
      bar.querySelectorAll('.wager-chip').forEach((x) => x.classList.remove('sel'));
      c.classList.add('sel');
    });
  });
  const first = bar.querySelector('.wager-chip');
  if (first) { first.classList.add('sel'); state.myWager = Number(first.dataset.w); }
}

function submitChoice(index) {
  if (state.answered) return;
  state.answered = true;
  state.myAnswer = index;
  $$('.answer-btn').forEach((b, i) => {
    b.disabled = true;
    if (i === index) b.classList.add('selected');
  });
  $('#wagerBar').querySelectorAll('.wager-chip').forEach((c) => (c.disabled = true));
  renderItemBar(); // hide power-ups once locked in
  setStatus('locked', 'dim');
  socket.emit('submitAnswer', { index, wager: state.myWager });
}

function submitFree(payload) {
  if (state.answered) return;
  const raw = String(payload.text || '').trim();
  if (!raw) return;
  state.answered = true;
  state.myAnswer = raw;
  const form = $('#textForm');
  form.querySelectorAll('input, button').forEach((el) => (el.disabled = true));
  form.classList.add('locked');
  renderItemBar();
  setStatus('locked', 'dim');
  socket.emit('submitAnswer', payload);
}

socket.on('playerAnswered', (data) => {
  state.players = data.players;
  renderLiveScores(data.players);
});

socket.on('reveal', (data) => {
  stopTimer();
  state.players = data.players;
  state.reveal = data;

  audio.sfx('reveal'); // subtle chime as the answers/distribution are revealed

  const choiceTypes = ['multiple', 'truefalse', 'higherlower'];
  if (choiceTypes.includes(data.type)) {
    $$('.answer-btn').forEach((b, i) => {
      b.disabled = true;
      const hl = b.querySelector('.hl-val');
      if (hl && data.values) { hl.textContent = `${data.values[i]} ${L(data.unit)}`; b.classList.add('revealed'); }
      if (i === data.correctIndex) b.classList.add('correct');
      else if (i === state.myAnswer) b.classList.add('wrong');
    });
    renderAnswerCounts(data); // A/B/C/D distribution bars
  } else {
    const myRes = (data.results || []).find((r) => r.id === state.you);
    const form = $('#textForm');
    if (form) {
      if (data.type === 'estimate') { if (myRes?.correct) form.classList.add('correct'); }
      else form.classList.add(myRes?.correct ? 'correct' : 'wrong');
    }
  }

  applyReveal(data);
  renderLiveScores(state.players);
  animateScoreboard(); // count the points up + tick sound

  // Personal feedback sound (streak takes priority over a normal "correct").
  const myRes = (data.results || []).find((r) => r.id === state.you);
  const me = state.players.find((p) => p.id === state.you);
  const myStreak = me?.streak || 0;
  if (state.settings?.streaks && myRes?.correct && myStreak >= STREAK_MIN && myStreak > (state.myStreak || 0)) {
    setTimeout(() => audio.sfx('streak'), 240);
  } else if (myRes) {
    setTimeout(() => audio.sfx(myRes.correct ? 'correct' : 'wrong'), 200);
  }
  state.myStreak = myStreak;
});

// Status line + detail line shown on reveal (re-runnable for live language switch).
function applyReveal(data) {
  const me = state.players.find((p) => p.id === state.you);
  const res = (data.results || []).find((r) => r.id === state.you);

  if (state.mode === 'survival' && me && !me.alive && !state.answered) {
    setStatus('eliminated', 'bad');
  } else if (data.type === 'estimate') {
    if (res?.correct) setStatus('closestWin', 'good');
    else setStatus('youAnswered', 'dim', state.myAnswer ?? t('noAnswer'));
  } else if (res?.correct) {
    setStatus('correct', 'good');
  } else if (!state.answered) {
    setStatus('timeUp', 'bad');
  } else {
    setStatus('wrong', 'bad');
  }

  const detail = $('#revealDetail');
  let txt = '';
  if (data.type === 'estimate') {
    txt = `${t('correctAnswerWas')} ${data.correctValue} ${L(data.unit)}`;
  } else if (data.type === 'freetext') {
    txt = `${t('correctAnswerWas')} ${L(data.correctText)}`;
    if (state.myAnswer) txt += ` · ${t('youAnswered', state.myAnswer)}`;
  } else if (data.type === 'higherlower') {
    const opt = state.questionData?.options?.[data.correctIndex];
    const val = data.values ? ` · ${data.values[data.correctIndex]} ${L(data.unit)}` : '';
    txt = `${t('correctAnswerWas')} ${L(opt)}${val}`;
  }
  detail.textContent = txt;
  detail.style.display = txt ? 'block' : 'none';
}

function setStatus(key, cls, ...args) {
  const el = $('#gameStatus');
  el.className = 'status' + (cls ? ' ' + cls : '');
  el.textContent = key ? t(key, ...args) : '';
}

// Displayed (animated) score per player id — lets the number count up smoothly
// instead of snapping to the new value.
const displayedScores = new Map();
let scoreRAF = 0;
let tickTimer = 0;

function renderLiveScores(players) {
  const teamMode = state.settings?.teamMode;
  const streaksOn = state.settings?.streaks;
  const sorted = [...players].sort((a, b) => b.score - a.score);
  $('#liveScores').innerHTML = sorted.map((p) => {
    const shown = displayedScores.has(p.id) ? displayedScores.get(p.id) : p.score;
    const tdot = teamMode && p.team ? `<span class="tdot ${p.team}"></span>` : '';
    const streak = (streaksOn && p.streak >= STREAK_MIN) ? `<span class="streak-badge">🔥${p.streak}</span>` : '';
    const cls = ['score-chip'];
    if (p.hasAnswered) cls.push('answered');
    if (state.mode === 'survival' && !p.alive) cls.push('dead');
    return `<span class="${cls.join(' ')}" data-id="${p.id}">${tdot}<span class="chip-av">${avatarHtml(p.icon)}</span>${escapeHtml(p.name)}${streak} <span class="sc">${shown}</span></span>`;
  }).join('');
}

// Tween every player's displayed score from its current value to the new target.
// While any score is rising, a soft "tick" SFX plays and stops cleanly at the end.
function animateScoreboard() {
  const els = {};
  $$('#liveScores .score-chip').forEach((chip) => { els[chip.dataset.id] = chip.querySelector('.sc'); });
  const from = {}, to = {};
  let anyUp = false;
  state.players.forEach((p) => {
    from[p.id] = displayedScores.has(p.id) ? displayedScores.get(p.id) : p.score;
    to[p.id] = p.score;
    if (to[p.id] > from[p.id]) anyUp = true;
  });

  cancelAnimationFrame(scoreRAF);
  clearInterval(tickTimer);

  const dur = 750, t0 = performance.now();
  if (anyUp) {
    let n = 0;
    tickTimer = setInterval(() => audio.sfx('tick', { freq: 720 + (n++ % 8) * 38 }), 65);
  }
  const stepFn = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3); // easeOutCubic — fast then settles
    state.players.forEach((p) => {
      const val = Math.round(from[p.id] + (to[p.id] - from[p.id]) * e);
      displayedScores.set(p.id, val);
      if (els[p.id]) els[p.id].textContent = val;
    });
    if (k < 1) { scoreRAF = requestAnimationFrame(stepFn); }
    else { clearInterval(tickTimer); state.players.forEach((p) => displayedScores.set(p.id, p.score)); }
  };
  scoreRAF = requestAnimationFrame(stepFn);
}

// Timer
function startTimer(seconds) {
  stopTimer();
  const bar = $('#timerBar');
  const num = $('#timerNum');
  let remaining = seconds;
  bar.style.transition = 'none';
  bar.style.width = '100%';
  num.textContent = remaining;
  num.classList.remove('low');
  // force reflow then animate
  void bar.offsetWidth;
  bar.style.transition = `width ${seconds}s linear`;
  bar.style.width = '0%';

  state.timerInterval = setInterval(() => {
    remaining -= 1;
    num.textContent = Math.max(0, remaining);
    num.classList.toggle('low', remaining <= 5 && remaining > 0);
    if (remaining <= 0) stopTimer();
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
  $('#timerNum').classList.remove('low');
}

// Freeze the timer bar at its current position (on pause).
function freezeTimer() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
  const bar = $('#timerBar');
  const w = getComputedStyle(bar).width; // current animated px width
  bar.style.transition = 'none';
  bar.style.width = w;
}

// Continue the bar from its frozen position down to 0 over the remaining seconds.
function resumeTimer(seconds) {
  const bar = $('#timerBar');
  const num = $('#timerNum');
  void bar.offsetWidth; // commit the frozen width before transitioning
  bar.style.transition = `width ${seconds}s linear`;
  bar.style.width = '0%';
  let remaining = seconds;
  num.textContent = remaining;
  num.classList.toggle('low', remaining <= 5 && remaining > 0);
  state.timerInterval = setInterval(() => {
    remaining -= 1;
    num.textContent = Math.max(0, remaining);
    num.classList.toggle('low', remaining <= 5 && remaining > 0);
    if (remaining <= 0) stopTimer();
  }, 1000);
}

// ---------------------------------------------------------------------------
// GAME OVER
// ---------------------------------------------------------------------------
socket.on('gameOver', (data) => {
  stopTimer();
  showScreen('over');
  const banner = $('#winnerBanner');
  const list = $('#leaderboardList');

  // Team mode → one row per team; FFA → one row per player (with avatar).
  if (data.teamMode) {
    banner.textContent = data.winnerTeam ? t('teamWins', t(TEAM_LABEL[data.winnerTeam])) : '';
    list.innerHTML = data.leaderboard.map((row) =>
      `<li>
        <span class="lname"><span class="tdot ${row.team}"></span> ${t(TEAM_LABEL[row.team])}</span>
        <span class="lscore">${row.score} ${t('points')}</span>
      </li>`
    ).join('');
  } else {
    const top = data.leaderboard[0];
    banner.innerHTML = top ? `🏆 ${escapeHtml(t('winner'))}: ${avatarHtml(top.icon)} ${escapeHtml(top.name)}` : '';
    list.innerHTML = data.leaderboard.map((row) => {
      const dead = data.mode === 'survival' && !row.alive ? ' style="opacity:.6"' : '';
      return `<li${dead}>
        <span class="lname"><span class="p-avatar">${avatarHtml(row.icon)}</span> ${escapeHtml(row.name)}</span>
        <span class="lscore">${row.score} ${t('points')}</span>
      </li>`;
    }).join('');
  }
});

$('#playAgainBtn').addEventListener('click', () => {
  if (isHost()) socket.emit('startGame');
  else showScreen('lobby');
});
$('#toLobbyBtn').addEventListener('click', () => showScreen('lobby'));

// ---------------------------------------------------------------------------
// Connection status
// ---------------------------------------------------------------------------
socket.on('disconnect', () => {
  if (state.code) {
    setStatus('', '');
    showHomeError('disconnected');
  }
});

socket.on('connect', () => { /* connected */ });

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
applyStaticI18n();
populateSelects();
ENHANCED_SELECTS.forEach(enhanceSelect);
renderModeCards();   // game-mode card grid
renderIconPicker();  // avatar grid on the home screen
updateModeDesc();

// Close any open custom dropdown when clicking elsewhere.
document.addEventListener('click', (e) => {
  if (!e.target.closest('.cselect')) closeAllMenus();
});

// ---------------------------------------------------------------------------
// Branding — render the AeroooQuiz name everywhere from the single BRAND const.
// ---------------------------------------------------------------------------
function renderBrand() {
  document.title = BRAND.full;
  // Intro logo is two-tone (part1 = magenta, part2 = cyan via the <span>).
  $('#introLogo').innerHTML = `${BRAND.part1}<span>${BRAND.part2}</span>`;
  // Top-bar brand + home wordmark use the i18n key "appTitle" (set to BRAND.full
  // in i18n.js) and are filled by applyStaticI18n().
}

// ---------------------------------------------------------------------------
// Intro animation + music
//
// Tuning knobs — change these to swap timing/feel without touching the logic:
//   INTRO_DURATION  how long the reveal animation runs before the music cross.
//   INTRO_FADE      how long the intro track takes to fade out.
// Swap the actual audio FILES in index.html (#introAudio / #bgAudio).
// ---------------------------------------------------------------------------
const INTRO_DURATION = 4200; // ms
const INTRO_FADE = 1100;     // ms

const intro = $('#intro');
const audio = new AudioManager({
  introEl: $('#introAudio'),
  bgEl: $('#bgAudio'),
  defaultVolume: 0.4
});

// --- Volume UI: independent MUSIC + SFX sliders, both persisted. --------------
const volSlider = $('#volSlider');
const sfxSlider = $('#sfxSlider');
const muteBtn = $('#muteBtn');
function updateMusicUI() {
  volSlider.value = Math.round(audio.volume * 100);
  sfxSlider.value = Math.round(audio.getSfxVolume() * 100);
  muteBtn.textContent = audio.isSilent() ? '🔇' : '🔊';
  muteBtn.classList.toggle('off', audio.isSilent());
}
// IMPORTANT: never write back to the slider's own value during its `input`
// event — that interrupts the drag and stops it reaching the extremes. We only
// update the mute icon here; the full sync (updateMusicUI) runs on init/mute.
volSlider.addEventListener('input', () => {
  audio.setVolume(volSlider.value / 100);
  muteBtn.textContent = audio.isSilent() ? '🔇' : '🔊';
  muteBtn.classList.toggle('off', audio.isSilent());
});
sfxSlider.addEventListener('input', () => {
  audio.setSfxVolume(sfxSlider.value / 100);
  audio.sfx('tick', { freq: 760 }); // tiny preview so you can hear the level
});
muteBtn.addEventListener('click', () => { audio.toggleMute(); updateMusicUI(); });
updateMusicUI();

// --- Intro flow --------------------------------------------------------------
let introDone = false;

// Step 1: the click is the gesture that unlocks audio. Play the intro track and
// kick off the reveal animation (driven by the .playing class in styles.css).
function startIntroSequence() {
  if (intro.classList.contains('playing')) return;
  intro.classList.add('playing');
  audio.unlock();      // create the Web Audio context from this user gesture (SFX)
  audio.playIntro();
  setTimeout(finishIntro, INTRO_DURATION);
}

// Step 2 + 3: fade the intro music out, then start the looping background, and
// dissolve the overlay into the app. Idempotent so the skip-click can't double-run it.
function finishIntro() {
  if (introDone) return;
  introDone = true;
  audio.crossToBackground(INTRO_FADE); // fade intro out → then loop background
  intro.classList.add('out');
  setTimeout(() => { intro.style.display = 'none'; }, 900);
}

$('#enterBtn').addEventListener('click', startIntroSequence);
// Let an impatient player skip the rest of the intro by clicking the backdrop.
intro.addEventListener('click', (e) => {
  if (intro.classList.contains('playing') && !e.target.closest('#enterBtn')) finishIntro();
});

renderBrand();
