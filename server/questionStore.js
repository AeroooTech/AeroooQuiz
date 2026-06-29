// Writable question bank. Seeds a JSON file from the built-in defaults on first
// run, then the admin panel reads/writes that file. Mount server/data as a
// Docker volume to keep edits across redeploys.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { QUESTIONS, buildRound as buildRoundFromBank } from './questions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.QUIZ_DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'questions.json');

export const TYPES = ['multiple', 'truefalse', 'higherlower', 'freetext', 'estimate'];

let bank = null;
let nextId = 1;

const genId = (type) => `${type}-${Date.now().toString(36)}-${(nextId++).toString(36)}`;

function withIds(raw) {
  const out = {};
  for (const type of TYPES) {
    out[type] = (raw[type] || []).map((q) => ({ id: q.id || genId(type), ...q }));
  }
  return out;
}

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      bank = {};
      for (const type of TYPES) bank[type] = parsed[type] || [];
      return;
    }
  } catch (e) {
    console.error('[questionStore] failed to read, using defaults:', e.message);
  }
  bank = withIds(QUESTIONS);
  save();
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(bank, null, 2));
  } catch (e) {
    console.error('[questionStore] failed to write:', e.message);
  }
}

export function getBank() {
  if (!bank) load();
  return bank;
}

export function buildRound(type, opts) {
  return buildRoundFromBank(getBank(), type, opts);
}

export function counts() {
  const b = getBank();
  return Object.fromEntries(TYPES.map((t) => [t, b[t].length]));
}

// ---------------------------------------------------------------------------
// Validation — keep questions well-formed before they reach a live game.
// ---------------------------------------------------------------------------
const lang = (o) => o && typeof o === 'object' && (o.de || o.en);

export function validate(type, q) {
  if (!TYPES.includes(type)) return 'Unbekannter Fragetyp';
  if (!lang(q.prompt) && type !== 'higherlower') return 'Frage (prompt) fehlt';
  if (type === 'multiple') {
    if (!lang(q.correct)) return 'Richtige Antwort fehlt';
    if (!q.wrong || !Array.isArray(q.wrong.de) || !Array.isArray(q.wrong.en) ||
        q.wrong.de.length !== 3 || q.wrong.en.length !== 3) return 'Genau 3 falsche Antworten (de & en) nötig';
  } else if (type === 'truefalse') {
    if (typeof q.answer !== 'boolean') return 'answer muss true/false sein';
  } else if (type === 'higherlower') {
    if (!lang(q.prompt)) return 'Vergleichsfrage (prompt) fehlt';
    if (!lang(q.a) || !lang(q.b)) return 'Beide Optionen (a & b) nötig';
    if (!Number.isFinite(+q.aValue) || !Number.isFinite(+q.bValue)) return 'aValue & bValue müssen Zahlen sein';
  } else if (type === 'freetext') {
    if (!lang(q.display)) return 'Anzeige-Antwort (display) fehlt';
    if (!q.accept || (!Array.isArray(q.accept.de) && !Array.isArray(q.accept.en))) return 'Akzeptierte Antworten fehlen';
  } else if (type === 'estimate') {
    if (!Number.isFinite(+q.value)) return 'value muss eine Zahl sein';
  }
  return null;
}

function clean(type, q) {
  const out = { cat: q.cat || 'general', diff: q.diff || 'medium' };
  if (type !== 'higherlower') out.prompt = q.prompt;
  if (type === 'multiple') { out.correct = q.correct; out.wrong = q.wrong; }
  else if (type === 'truefalse') out.answer = !!q.answer;
  else if (type === 'higherlower') {
    out.prompt = q.prompt; out.unit = q.unit || { de: '', en: '' };
    out.a = q.a; out.aValue = +q.aValue; out.b = q.b; out.bValue = +q.bValue;
  } else if (type === 'freetext') { out.display = q.display; out.accept = q.accept; }
  else if (type === 'estimate') { out.value = +q.value; out.unit = q.unit || { de: '', en: '' }; }
  return out;
}

export function addQuestion(type, q) {
  const err = validate(type, q);
  if (err) return { error: err };
  const item = { id: genId(type), ...clean(type, q) };
  getBank()[type].push(item);
  save();
  return { item };
}

export function updateQuestion(id, q) {
  const b = getBank();
  for (const type of TYPES) {
    const idx = b[type].findIndex((x) => x.id === id);
    if (idx >= 0) {
      const err = validate(type, q);
      if (err) return { error: err };
      b[type][idx] = { id, ...clean(type, q) };
      save();
      return { item: b[type][idx], type };
    }
  }
  return { error: 'Frage nicht gefunden' };
}

export function deleteQuestion(id) {
  const b = getBank();
  for (const type of TYPES) {
    const idx = b[type].findIndex((x) => x.id === id);
    if (idx >= 0) { const [removed] = b[type].splice(idx, 1); save(); return { item: removed }; }
  }
  return { error: 'Frage nicht gefunden' };
}
