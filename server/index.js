import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { matchFreeText, parseNumber } from './questions.js';
import { buildRound, getBank, counts, addQuestion, updateQuestion, deleteQuestion } from './questionStore.js';
import { CATEGORIES } from './trivia.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

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
  wager:     { type: 'multiple',    score: 'wager',   time: 20, wager: true, startScore: 1000 }
};
const MODES = Object.keys(MODE_CONFIG);

// Wager mode: fraction of the stake LOST on a wrong answer.
// 1 = lose the whole stake, 0.5 = lose half, 0 = lose nothing. Change freely.
const WAGER_LOSS_FACTOR = 1;

// Teams a player can belong to. Add more ids here (and a matching colour in the
// client CSS / TEAM_LABEL) to support more than two teams.
const TEAMS = ['red', 'blue', 'green', 'yellow'];
const REVEAL_MS = 4200;

const DEFAULT_SETTINGS = {
  mode: 'classic', category: 0, difficulty: 'any', amount: 10, questionTime: 20,
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
    timer: null, revealTimer: null,
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
    wager: 0, lastGain: 0, lastCorrect: false, streak: 0, connected: true
  };
}

function publicPlayers(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id, name: p.name, icon: p.icon, score: p.score, alive: p.alive, team: p.team,
    streak: p.streak, connected: p.connected, isHost: p.id === room.hostId, hasAnswered: p.answered
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
}

function startGame(room) {
  if (room.state !== 'lobby' && room.state !== 'ended') return;
  const cfg = MODE_CONFIG[room.settings.mode];

  for (const p of room.players.values()) {
    p.score = cfg.startScore || 0;
    p.alive = true; p.answer = null; p.answerText = ''; p.answered = false;
    p.answerTime = 0; p.wager = 0; p.lastGain = 0; p.lastCorrect = false; p.streak = 0;
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
    p.wager = 0; p.lastGain = 0; p.lastCorrect = false;
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
      const correct = q.type === 'freetext'
        ? matchFreeText(p.answerText || '', q.accept)
        : (p.answered && p.answer === q.correctIndex);
      p.lastCorrect = correct;

      if (cfg.score === 'wager') {
        const w = p.wager || 0;
        if (correct) { p.score += w; p.lastGain = w; }
        else { const loss = Math.min(Math.round(w * WAGER_LOSS_FACTOR), p.score); p.score -= loss; p.lastGain = -loss; }
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
  // shown/sounded on the client only when settings.streaks is on.
  for (const p of players) {
    if (cfg.elim && !p.alive) continue;
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

  room.revealTimer = setTimeout(() => nextQuestion(room), REVEAL_MS);
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
    if (CATEGORIES.some((c) => c.id === Number(settings.category))) s.category = Number(settings.category);
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
