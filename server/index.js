import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { matchFreeText, parseNumber } from './questions.js';
import { buildRound, getBank, counts, addQuestion, updateQuestion, deleteQuestion, TYPES } from './questionStore.js';
import { CATEGORIES, fetchQuestions } from './trivia.js';
import { translateBatch, activeProvider } from './translate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '256kb' }));
// Serve the client with revalidation so players never run a STALE cached build
// after a redeploy (a cached old main.js was why new features like the shop only
// appeared for some players). `no-cache` = may cache but must revalidate via ETag.
app.use(express.static(path.join(__dirname, '..', 'public'), {
  etag: true,
  setHeaders: (res, filePath) => {
    if (/\.(html|js|css)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
  }
}));

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Admin API — password login -> bearer token, question CRUD, live rooms.
// Set ADMIN_PASSWORD in the environment (defaults to "admin" with a warning).
// ---------------------------------------------------------------------------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
if (ADMIN_PASSWORD === 'admin') {
  console.warn('[admin] WARNING: ADMIN_PASSWORD not set — using default "admin". Set it before exposing the panel!');
}
const adminTokens = new Map(); // token -> expiry timestamp
const TOKEN_TTL = 1000 * 60 * 60 * 8; // 8h

function issueToken() {
  const token = crypto.randomBytes(24).toString('hex');
  adminTokens.set(token, Date.now() + TOKEN_TTL);
  return token;
}
function validToken(token) {
  const exp = adminTokens.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { adminTokens.delete(token); return false; }
  return true;
}
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!validToken(token)) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.post('/admin/api/login', (req, res) => {
  const pw = String(req.body?.password ?? '');
  // constant-time-ish comparison
  const a = Buffer.from(pw);
  const b = Buffer.from(ADMIN_PASSWORD);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return res.status(401).json({ error: 'wrong-password' });
  res.json({ token: issueToken() });
});

app.get('/admin/api/questions', requireAdmin, (req, res) => {
  res.json({ bank: getBank(), counts: counts() });
});
app.post('/admin/api/questions', requireAdmin, (req, res) => {
  const { type, question } = req.body || {};
  const result = addQuestion(type, question || {});
  if (result.error) return res.status(400).json(result);
  res.json(result);
});
app.put('/admin/api/questions/:id', requireAdmin, (req, res) => {
  const result = updateQuestion(req.params.id, req.body?.question || {});
  if (result.error) return res.status(400).json(result);
  res.json(result);
});
app.delete('/admin/api/questions/:id', requireAdmin, (req, res) => {
  const result = deleteQuestion(req.params.id);
  if (result.error) return res.status(404).json(result);
  res.json(result);
});
app.get('/admin/api/rooms', requireAdmin, (req, res) => {
  res.json({ rooms: adminRoomSummaries() });
});

// Bulk import: an array of questions of one type. Each is validated; valid ones
// are added, invalid ones returned with their reason. Body: { type, questions:[] }
app.post('/admin/api/import', requireAdmin, (req, res) => {
  const { type, questions } = req.body || {};
  if (!TYPES.includes(type)) return res.status(400).json({ error: 'Unbekannter Fragetyp' });
  if (!Array.isArray(questions)) return res.status(400).json({ error: 'questions muss ein Array sein' });
  let added = 0;
  const errors = [];
  questions.forEach((q, i) => {
    const r = addQuestion(type, q);
    if (r.error) errors.push({ index: i, error: r.error });
    else added += 1;
  });
  res.json({ added, failed: errors.length, errors: errors.slice(0, 20), counts: counts() });
});

// Import from the public Open Trivia DB (https://opentdb.com) as multiple-choice
// questions. English-only, so de == en. Body: { amount, category, difficulty }
// To add ANOTHER public source later, add a sibling endpoint that maps the
// external format to addQuestion('multiple', {...}) the same way.
app.post('/admin/api/import-opentdb', requireAdmin, async (req, res) => {
  try {
    const translate = !!req.body?.translate;
    const fetched = await fetchQuestions({
      amount: Math.min(Math.max(Number(req.body?.amount) || 10, 1), 50),
      category: Number(req.body?.category) || 0,
      difficulty: ['easy', 'medium', 'hard'].includes(req.body?.difficulty) ? req.body.difficulty : 'any'
    });

    // Normalise to {question, correct, wrong[3], diff}; drop malformed ones.
    const items = fetched.map((q) => ({
      question: q.question,
      correct: q.answers[q.correctIndex],
      wrong: q.answers.filter((_, i) => i !== q.correctIndex).slice(0, 3),
      diff: q.difficulty || 'medium'
    })).filter((it) => it.wrong.length === 3);

    // Optionally translate EN → DE. We flatten every string (5 per question:
    // prompt + correct + 3 wrong) into one batch, then map the results back.
    let de = null;
    if (translate) {
      const flat = [];
      items.forEach((it) => flat.push(it.question, it.correct, ...it.wrong));
      de = await translateBatch(flat, 'DE', 'EN');
    }

    let added = 0;
    items.forEach((it, idx) => {
      const b = idx * 5;
      const r = addQuestion('multiple', {
        cat: 'general', diff: it.diff,
        prompt:  { de: translate ? de[b] : it.question,     en: it.question },
        correct: { de: translate ? de[b + 1] : it.correct,  en: it.correct },
        wrong:   { de: translate ? de.slice(b + 2, b + 5) : [...it.wrong], en: [...it.wrong] }
      });
      if (!r.error) added += 1;
    });

    res.json({ added, translated: translate, provider: translate ? activeProvider() : null, counts: counts() });
  } catch (err) {
    const code = err.message === 'NO_RESULTS' ? 'Keine Fragen für diese Auswahl' : 'Laden von OpenTDB fehlgeschlagen';
    res.status(502).json({ error: code });
  }
});

// ---------------------------------------------------------------------------
// Modes — each maps to a question type and a scoring rule.
// NOTE: "teams" is NO LONGER a mode. Team vs. free-for-all (FFA) is an
// orthogonal toggle (settings.teamMode) that works WITH any mode below.
// To add a mode: add an entry here (type + score rule + flags) and a card in
// the client (MODE_META / i18n keys mode_<id> + mode_<id>_desc).
// ---------------------------------------------------------------------------
const MODE_CONFIG = {
  classic:   { type: 'multiple',    score: 'flat',    time: 20 },
  speed:     { type: 'multiple',    score: 'speed',   time: 20 },
  survival:  { type: 'multiple',    score: 'flat',    time: 20, elim: true },
  hilo:      { type: 'higherlower', score: 'flat',    time: 15 },
  text:      { type: 'freetext',    score: 'speed',   time: 30 },
  estimate:  { type: 'estimate',    score: 'closest', time: 30 },
  trueblitz: { type: 'truefalse',   score: 'speed',   time: 10 },
  wager:     { type: 'multiple',    score: 'wager',   time: 20, wager: true, startScore: 1000, shop: true }
};
const MODES = Object.keys(MODE_CONFIG);

// Wager mode: fraction of the stake LOST on a wrong answer.
// 1 = lose the whole stake, 0.5 = lose half, 0 = lose nothing. Change freely.
const WAGER_LOSS_FACTOR = 1;
// Wager mode safety net: a player at 0 points who answers correctly gains at
// least this much (so losing everything once isn't game-over). Set 0 to disable.
const WAGER_COMEBACK = 100;

// ---------------------------------------------------------------------------
// Shop (wager mode only). A shop phase opens after every SHOP_EVERY questions
// (but not at the very end). Add/space items here — `effect` drives behaviour.
// ---------------------------------------------------------------------------
const SHOP_EVERY = 3;       // open the shop after every 3 questions
const SHOP_DURATION = 22;   // seconds the shop stays open
const SHOP_ITEMS = [
  { id: 'fifty', price: 300, effect: 'fifty',
    name: { de: '50/50-Joker', en: '50/50' },
    desc: { de: 'Entfernt zwei falsche Antworten bei einer Frage.', en: 'Removes two wrong answers on a question.' } },
  { id: 'skip', price: 250, effect: 'skip',
    name: { de: 'Frage überspringen', en: 'Skip question' },
    desc: { de: 'Überspringe eine Frage ohne Punktverlust.', en: 'Skip a question with no point loss.' } }
];
const shopItem = (id) => SHOP_ITEMS.find((i) => i.id === id);

// Teams a player can belong to. Add more ids here (and a matching colour in the
// client CSS / TEAM_LABEL) to support more than two teams.
const TEAMS = ['red', 'blue', 'green', 'yellow'];
const REVEAL_MS = 4200;

// CATEGORY KEYS the question bank actually uses (must match q.cat in the bank
// and cat_<key> in i18n). 'any' = no filter. Add a key here + tag questions
// with it + add a cat_<key> i18n string to introduce a new category.
const GAME_CATEGORIES = ['any', 'general', 'science', 'geography', 'history', 'animals'];

const DEFAULT_SETTINGS = {
  mode: 'classic', category: 'any', difficulty: 'any', amount: 10, questionTime: 20,
  teamMode: false, // false = Alle gegen alle (FFA), true = Teams
  streaks: true    // show/sound streaks for consecutive correct answers
};

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------
const rooms = new Map();

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom(hostId) {
  const code = makeCode();
  const room = {
    code, hostId, state: 'lobby',
    settings: { ...DEFAULT_SETTINGS },
    players: new Map(),
    questions: [], currentIndex: -1, questionStartedAt: 0,
    timer: null, revealTimer: null, shopTimer: null,
    paused: false, remainingMs: 0
  };
  rooms.set(code, room);
  return room;
}

// Player data model. `icon` is an icon id from the client's PLAYER_ICONS list
// (see public/js/main.js); `team` only matters when settings.teamMode is on.
function newPlayer(id, name, team, icon) {
  return {
    id, name, icon, score: 0, alive: true, team,
    answer: null, answerText: '', answered: false, answerTime: 0,
    wager: 0, lastGain: 0, lastCorrect: false, streak: 0,
    items: [], skipped: false, connected: true
  };
}

function publicPlayers(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id, name: p.name, icon: p.icon, score: p.score, alive: p.alive, team: p.team,
    streak: p.streak, items: p.items, connected: p.connected, isHost: p.id === room.hostId, hasAnswered: p.answered
  }));
}

function broadcastLobby(room) {
  io.to(room.code).emit('roomUpdate', {
    code: room.code, hostId: room.hostId, state: room.state,
    settings: room.settings, players: publicPlayers(room)
  });
}

function teamScores(room) {
  const totals = {};
  for (const p of room.players.values()) {
    if (!p.team) continue;
    totals[p.team] = (totals[p.team] || 0) + p.score;
  }
  return totals;
}

// Snapshot of all active rooms for the admin live view.
function adminRoomSummaries() {
  return [...rooms.values()].map((room) => ({
    code: room.code,
    mode: room.settings.mode,
    state: room.state,
    questionIndex: Math.max(0, room.currentIndex + 1),
    totalQuestions: room.questions.length,
    players: [...room.players.values()].map((p) => ({
      name: p.name, score: p.score, connected: p.connected, alive: p.alive
    }))
  }));
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------
function clearRoomTimers(room) {
  if (room.timer) { clearTimeout(room.timer); room.timer = null; }
  if (room.revealTimer) { clearTimeout(room.revealTimer); room.revealTimer = null; }
  if (room.shopTimer) { clearTimeout(room.shopTimer); room.shopTimer = null; }
}

function startGame(room) {
  if (room.state !== 'lobby' && room.state !== 'ended') return;
  const cfg = MODE_CONFIG[room.settings.mode];

  for (const p of room.players.values()) {
    p.score = cfg.startScore || 0;
    p.alive = true; p.answer = null; p.answerText = ''; p.answered = false;
    p.answerTime = 0; p.wager = 0; p.lastGain = 0; p.lastCorrect = false; p.streak = 0;
    p.items = []; p.skipped = false;
  }

  room.questions = buildRound(cfg.type, {
    amount: room.settings.amount,
    category: room.settings.category,
    difficulty: room.settings.difficulty
  });

  if (!room.questions.length) {
    room.state = 'lobby';
    io.to(room.code).emit('gameError', { code: 'noQuestions' });
    broadcastLobby(room);
    return;
  }

  room.currentIndex = -1;
  io.to(room.code).emit('gameStarted', { total: room.questions.length, mode: room.settings.mode });
  nextQuestion(room);
}

const activePlayerCount = (room) => [...room.players.values()].filter((p) => p.alive).length;

function nextQuestion(room) {
  clearRoomTimers(room);
  room.paused = false;
  room.currentIndex += 1;
  const cfg = MODE_CONFIG[room.settings.mode];

  const noMore = room.currentIndex >= room.questions.length;
  const survivalOver = cfg.elim && activePlayerCount(room) <= 1 && room.players.size > 1;
  if (noMore || survivalOver) return endGame(room);

  const q = room.questions[room.currentIndex];
  for (const p of room.players.values()) {
    p.answer = null; p.answerText = ''; p.answered = false; p.answerTime = 0;
    p.wager = 0; p.lastGain = 0; p.lastCorrect = false; p.skipped = false;
  }

  room.state = 'question';
  room.questionStartedAt = Date.now();

  io.to(room.code).emit('question', {
    type: q.type,
    index: room.currentIndex,
    total: room.questions.length,
    time: room.settings.questionTime,
    mode: room.settings.mode,
    wager: !!cfg.wager,
    prompt: q.prompt,
    options: q.options || null,
    unit: q.unit || null,
    catKey: q.cat,
    diff: q.diff,
    players: publicPlayers(room)
  });

  room.timer = setTimeout(() => revealAnswer(room), room.settings.questionTime * 1000);
}

function revealAnswer(room) {
  clearRoomTimers(room);
  if (room.state !== 'question') return;
  room.state = 'reveal';

  const cfg = MODE_CONFIG[room.settings.mode];
  const q = room.questions[room.currentIndex];
  const totalMs = room.settings.questionTime * 1000;
  const players = [...room.players.values()];

  if (cfg.score === 'closest') {
    const answered = players.filter((p) => p.answered && typeof p.answer === 'number');
    answered.sort((a, b) => Math.abs(a.answer - q.value) - Math.abs(b.answer - q.value));
    const n = answered.length;
    answered.forEach((p, rank) => {
      const exact = p.answer === q.value;
      const pts = exact ? 1000 : Math.max(50, Math.round(1000 * (n - rank) / n));
      p.score += pts; p.lastGain = pts; p.lastCorrect = rank === 0;
    });
  } else {
    for (const p of players) {
      if (cfg.elim && !p.alive) continue;
      if (p.skipped) { p.lastGain = 0; p.lastCorrect = false; continue; } // skip item: neutral, no wager loss
      const correct = q.type === 'freetext'
        ? matchFreeText(p.answerText || '', q.accept)
        : (p.answered && p.answer === q.correctIndex);
      p.lastCorrect = correct;

      if (cfg.score === 'wager') {
        const w = p.wager || 0;
        if (correct) {
          // COMEBACK rule: a broke player (0 pts) who answers correctly always
          // gets at least WAGER_COMEBACK, so nobody is permanently stuck at 0.
          const gain = (p.score === 0 && w < WAGER_COMEBACK) ? WAGER_COMEBACK : w;
          p.score += gain; p.lastGain = gain;
        } else {
          const loss = Math.min(Math.round(w * WAGER_LOSS_FACTOR), p.score);
          p.score -= loss; p.lastGain = -loss;
        }
      } else if (correct) {
        let pts = 100;
        if (cfg.score === 'speed') {
          const rem = Math.max(0, totalMs - p.answerTime);
          pts = Math.round(500 + 500 * (rem / totalMs));
        }
        p.score += pts; p.lastGain = pts;
      } else {
        p.lastGain = 0;
        if (cfg.elim) p.alive = false;
      }
    }
  }

  // Streaks: increment on a correct answer, reset on a miss. Tracked always;
  // shown/sounded on the client only when settings.streaks is on. A skipped
  // question leaves the streak untouched.
  for (const p of players) {
    if (cfg.elim && !p.alive) continue;
    if (p.skipped) continue;
    p.streak = p.lastCorrect ? (p.streak || 0) + 1 : 0;
  }

  // Answer distribution (choice types only): how many picked each option.
  let answerCounts = null;
  if (q.options) {
    answerCounts = q.options.map(() => 0);
    for (const p of players) {
      if (p.answered && typeof p.answer === 'number' && p.answer >= 0 && p.answer < answerCounts.length) {
        answerCounts[p.answer]++;
      }
    }
  }

  io.to(room.code).emit('reveal', {
    type: q.type,
    mode: room.settings.mode,
    correctIndex: q.correctIndex ?? null,
    values: q.values || null,
    correctText: q.display || null,
    correctValue: q.value ?? null,
    unit: q.unit || null,
    answerCounts,
    players: publicPlayers(room),
    teamScores: teamScores(room),
    results: players.map((p) => ({
      id: p.id, answerText: p.answerText, gained: p.lastGain, correct: p.lastCorrect
    }))
  });

  room.revealTimer = setTimeout(() => afterReveal(room), REVEAL_MS);
}

// After a reveal: open the shop on a shop boundary (wager mode), else continue.
function afterReveal(room) {
  const cfg = MODE_CONFIG[room.settings.mode];
  const done = room.currentIndex + 1;                 // questions completed
  const moreLeft = done < room.questions.length;
  if (cfg.shop && moreLeft && done % SHOP_EVERY === 0) openShop(room);
  else nextQuestion(room);
}

function openShop(room) {
  clearRoomTimers(room);
  room.state = 'shop';
  io.to(room.code).emit('shopOpen', {
    items: SHOP_ITEMS,
    time: SHOP_DURATION,
    players: publicPlayers(room)
  });
  room.shopTimer = setTimeout(() => nextQuestion(room), SHOP_DURATION * 1000);
}

function maybeAllAnswered(room) {
  if (room.state !== 'question') return;
  const cfg = MODE_CONFIG[room.settings.mode];
  const relevant = [...room.players.values()].filter(
    (p) => p.connected && (!cfg.elim || p.alive)
  );
  if (relevant.length > 0 && relevant.every((p) => p.answered)) revealAnswer(room);
}

function endGame(room) {
  clearRoomTimers(room);
  room.state = 'ended';
  const cfg = MODE_CONFIG[room.settings.mode];
  const teamMode = room.settings.teamMode; // team aggregation is a toggle, not a mode
  const players = [...room.players.values()];

  let leaderboard, winnerTeam = null;
  if (teamMode) {
    // Team mode: sum each player's score into their team's total.
    const totals = teamScores(room);
    leaderboard = Object.entries(totals).map(([team, score]) => ({ team, score }))
      .sort((a, b) => b.score - a.score);
    winnerTeam = leaderboard[0]?.team || null;
  } else {
    // FFA: every player ranked individually.
    leaderboard = players
      .map((p) => ({ id: p.id, name: p.name, icon: p.icon, score: p.score, alive: p.alive, team: p.team }))
      .sort((a, b) => {
        if (cfg.elim && a.alive !== b.alive) return a.alive ? -1 : 1;
        return b.score - a.score;
      });
  }

  io.to(room.code).emit('gameOver', { mode: room.settings.mode, teamMode, leaderboard, winnerTeam });
  broadcastLobby(room);
}

// ---------------------------------------------------------------------------
// Sockets
// ---------------------------------------------------------------------------
const sanitizeName = (name) => String(name || '').trim().slice(0, 20);
// Accept any short, safe icon id; the client maps it to an avatar (and falls
// back to a default if unknown), so the server doesn't need the icon list.
const sanitizeIcon = (icon) => String(icon || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 20) || 'star';

function clampWager(player, raw) {
  let w = Math.round(Number(raw));
  if (!Number.isFinite(w)) w = 100;
  return Math.max(0, Math.min(w, player.score));
}

io.on('connection', (socket) => {
  socket.data.roomCode = null;

  socket.on('createRoom', ({ name, icon }, cb) => {
    const playerName = sanitizeName(name);
    if (!playerName) return cb?.({ error: 'nameRequired' });
    const room = createRoom(socket.id);
    room.players.set(socket.id, newPlayer(socket.id, playerName, TEAMS[0], sanitizeIcon(icon)));
    socket.join(room.code);
    socket.data.roomCode = room.code;
    cb?.({ code: room.code, you: socket.id });
    broadcastLobby(room);
  });

  socket.on('joinRoom', ({ code, name, icon }, cb) => {
    const playerName = sanitizeName(name);
    if (!playerName) return cb?.({ error: 'nameRequired' });
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return cb?.({ error: 'roomNotFound' });
    if (room.state !== 'lobby' && room.state !== 'ended') return cb?.({ error: 'gameInProgress' });
    if (room.players.size >= 12) return cb?.({ error: 'roomFull' });

    const counts = Object.fromEntries(TEAMS.map((t) => [t, 0]));
    for (const p of room.players.values()) if (p.team) counts[p.team]++;
    const team = TEAMS.slice(0, 2).sort((a, b) => counts[a] - counts[b])[0];

    room.players.set(socket.id, newPlayer(socket.id, playerName, team, sanitizeIcon(icon)));
    socket.join(room.code);
    socket.data.roomCode = room.code;
    cb?.({ code: room.code, you: socket.id });
    broadcastLobby(room);
  });

  // Let a player change their avatar from the lobby.
  socket.on('setIcon', ({ icon }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) { player.icon = sanitizeIcon(icon); broadcastLobby(room); }
  });

  socket.on('updateSettings', (settings) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return;
    if (room.state !== 'lobby' && room.state !== 'ended') return;
    const s = room.settings;
    if (MODES.includes(settings.mode)) s.mode = settings.mode;
    if (GAME_CATEGORIES.includes(settings.category)) s.category = settings.category; // category is a key now
    if (['any', 'easy', 'medium', 'hard'].includes(settings.difficulty)) s.difficulty = settings.difficulty;
    if (Number.isFinite(+settings.amount)) s.amount = Math.min(Math.max(Math.round(+settings.amount), 3), 30);
    if (Number.isFinite(+settings.questionTime)) s.questionTime = Math.min(Math.max(Math.round(+settings.questionTime), 5), 90);
    if (typeof settings.teamMode === 'boolean') s.teamMode = settings.teamMode; // Teams vs. FFA toggle
    if (typeof settings.streaks === 'boolean') s.streaks = settings.streaks;
    broadcastLobby(room);
  });

  socket.on('joinTeam', ({ team }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !TEAMS.includes(team)) return;
    if (room.state !== 'lobby' && room.state !== 'ended') return;
    const player = room.players.get(socket.id);
    if (player) { player.team = team; broadcastLobby(room); }
  });

  socket.on('startGame', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id || room.players.size < 1) return;
    startGame(room);
  });

  // Host pauses the running question: freeze the timer (remember the remaining
  // time) and block answers until resumed.
  socket.on('pauseGame', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return;
    if (room.state !== 'question' || room.paused) return;
    const elapsed = Date.now() - room.questionStartedAt;
    room.remainingMs = Math.max(0, room.settings.questionTime * 1000 - elapsed);
    clearTimeout(room.timer); room.timer = null;
    room.paused = true;
    io.to(room.code).emit('paused');
  });

  socket.on('resumeGame', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id || !room.paused) return;
    room.paused = false;
    // Shift the start time so answerTime (speed scoring) stays correct.
    room.questionStartedAt = Date.now() - (room.settings.questionTime * 1000 - room.remainingMs);
    room.timer = setTimeout(() => revealAnswer(room), room.remainingMs);
    io.to(room.code).emit('resumed', { time: Math.ceil(room.remainingMs / 1000) });
  });

  socket.on('submitAnswer', (payload = {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.state !== 'question' || room.paused) return; // no input while paused
    const player = room.players.get(socket.id);
    if (!player || !player.connected || player.answered) return;
    const cfg = MODE_CONFIG[room.settings.mode];
    if (cfg.elim && !player.alive) return;
    const q = room.questions[room.currentIndex];

    if (q.type === 'freetext') {
      player.answer = String(payload.text || '');
      player.answerText = player.answer.slice(0, 40);
    } else if (q.type === 'estimate') {
      const n = parseNumber(payload.number ?? payload.text ?? '');
      if (n === null) return; // ignore unparseable estimate, let them retry
      player.answer = n;
      player.answerText = String(payload.text ?? n).slice(0, 20);
    } else {
      player.answer = Number(payload.index);
      player.answerText = q.options?.[player.answer] ? 'opt' : '';
    }
    if (cfg.wager) player.wager = clampWager(player, payload.wager);

    player.answered = true;
    player.answerTime = Date.now() - room.questionStartedAt;

    io.to(room.code).emit('playerAnswered', { id: socket.id, players: publicPlayers(room) });
    maybeAllAnswered(room);
  });

  // --- Shop ----------------------------------------------------------------
  socket.on('buyItem', ({ itemId }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.state !== 'shop') return;
    const player = room.players.get(socket.id);
    const item = shopItem(itemId);
    if (!player || !item || player.score < item.price) return;
    player.score -= item.price;
    player.items.push(item.id);
    io.to(room.code).emit('shopUpdate', { players: publicPlayers(room) });
  });

  // Host closes the shop early.
  socket.on('closeShop', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id || room.state !== 'shop') return;
    nextQuestion(room);
  });

  // Use a single-use power-up during a question.
  socket.on('useItem', ({ itemId }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.state !== 'question') return;
    const player = room.players.get(socket.id);
    if (!player) return;
    const idx = player.items.indexOf(itemId);
    if (idx < 0) return;
    const q = room.questions[room.currentIndex];

    if (itemId === 'fifty') {
      if (q.type !== 'multiple' || player.answered) return;
      // Remove two random WRONG options for this player (keep correct + 1 wrong).
      const wrong = q.options.map((_, i) => i).filter((i) => i !== q.correctIndex);
      for (let i = wrong.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [wrong[i], wrong[j]] = [wrong[j], wrong[i]]; }
      const remove = wrong.slice(0, 2);
      player.items.splice(idx, 1);
      socket.emit('itemUsed', { itemId, remove });               // only the buyer
      io.to(room.code).emit('playerItems', { players: publicPlayers(room) });
    } else if (itemId === 'skip') {
      if (player.answered) return;
      player.items.splice(idx, 1);
      player.answered = true; player.skipped = true; player.answer = null;
      socket.emit('itemUsed', { itemId });
      io.to(room.code).emit('playerAnswered', { id: socket.id, players: publicPlayers(room) });
      maybeAllAnswered(room);
    }
  });

  socket.on('leaveRoom', () => handleLeave(socket));
  socket.on('disconnect', () => handleLeave(socket));
});

function handleLeave(socket) {
  const room = rooms.get(socket.data.roomCode);
  if (!room) return;
  const player = room.players.get(socket.id);
  if (!player) return;

  if (room.state === 'lobby' || room.state === 'ended') room.players.delete(socket.id);
  else player.connected = false;

  socket.leave(room.code);
  socket.data.roomCode = null;

  if (room.hostId === socket.id) {
    const next = [...room.players.values()].find((p) => p.connected);
    room.hostId = next ? next.id : null;
  }

  if (room.players.size === 0 || [...room.players.values()].every((p) => !p.connected)) {
    clearRoomTimers(room);
    rooms.delete(room.code);
    return;
  }

  broadcastLobby(room);
  maybeAllAnswered(room);
}

server.listen(PORT, () => console.log(`QuizGame server running at http://localhost:${PORT}`));
