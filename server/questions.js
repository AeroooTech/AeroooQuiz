// Curated bilingual (DE/EN) question bank + selection/matching helpers.
// Every question carries both languages so the client can switch live.
//
// Types:
//   multiple    – 4 options, one correct
//   truefalse   – statement that is true or false
//   higherlower – two items; pick the one with the higher value
//   freetext    – type the answer (matched fuzzily against accepted answers)
//   estimate    – type a number; closest guesses win

export const QUESTIONS = {
  multiple: [
    { cat: 'geography', diff: 'easy',
      prompt: { de: 'Was ist die Hauptstadt von Australien?', en: 'What is the capital of Australia?' },
      correct: { de: 'Canberra', en: 'Canberra' },
      wrong: { de: ['Sydney', 'Melbourne', 'Perth'], en: ['Sydney', 'Melbourne', 'Perth'] } },
    { cat: 'geography', diff: 'easy',
      prompt: { de: 'Welcher ist der größte Ozean der Erde?', en: 'Which is the largest ocean on Earth?' },
      correct: { de: 'Pazifik', en: 'Pacific Ocean' },
      wrong: { de: ['Atlantik', 'Indischer Ozean', 'Arktischer Ozean'], en: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'] } },
    { cat: 'science', diff: 'easy',
      prompt: { de: 'Wofür steht das chemische Symbol „O"?', en: 'What does the chemical symbol "O" stand for?' },
      correct: { de: 'Sauerstoff', en: 'Oxygen' },
      wrong: { de: ['Gold', 'Wasserstoff', 'Osmium'], en: ['Gold', 'Hydrogen', 'Osmium'] } },
    { cat: 'science', diff: 'medium',
      prompt: { de: 'Wie viele Planeten hat unser Sonnensystem?', en: 'How many planets are in our solar system?' },
      correct: { de: '8', en: '8' },
      wrong: { de: ['9', '7', '10'], en: ['9', '7', '10'] } },
    { cat: 'general', diff: 'medium',
      prompt: { de: 'Wer malte „Die Sternennacht"?', en: 'Who painted "The Starry Night"?' },
      correct: { de: 'Vincent van Gogh', en: 'Vincent van Gogh' },
      wrong: { de: ['Pablo Picasso', 'Claude Monet', 'Salvador Dalí'], en: ['Pablo Picasso', 'Claude Monet', 'Salvador Dalí'] } },
    { cat: 'animals', diff: 'easy',
      prompt: { de: 'Welches ist das schnellste Landtier?', en: 'Which is the fastest land animal?' },
      correct: { de: 'Gepard', en: 'Cheetah' },
      wrong: { de: ['Löwe', 'Gazelle', 'Pferd'], en: ['Lion', 'Gazelle', 'Horse'] } },
    { cat: 'animals', diff: 'easy',
      prompt: { de: 'Welches ist das größte Säugetier?', en: 'Which is the largest mammal?' },
      correct: { de: 'Blauwal', en: 'Blue whale' },
      wrong: { de: ['Afrikanischer Elefant', 'Giraffe', 'Pottwal'], en: ['African elephant', 'Giraffe', 'Sperm whale'] } },
    { cat: 'science', diff: 'medium',
      prompt: { de: 'Welches Gas nehmen Pflanzen bei der Fotosynthese auf?', en: 'Which gas do plants absorb during photosynthesis?' },
      correct: { de: 'Kohlenstoffdioxid', en: 'Carbon dioxide' },
      wrong: { de: ['Sauerstoff', 'Stickstoff', 'Wasserstoff'], en: ['Oxygen', 'Nitrogen', 'Hydrogen'] } },
    { cat: 'geography', diff: 'medium',
      prompt: { de: 'Welches ist das flächenmäßig größte Land der Welt?', en: 'Which is the largest country by area?' },
      correct: { de: 'Russland', en: 'Russia' },
      wrong: { de: ['Kanada', 'China', 'USA'], en: ['Canada', 'China', 'USA'] } },
    { cat: 'science', diff: 'easy',
      prompt: { de: 'Was ist die härteste natürliche Substanz?', en: 'What is the hardest natural substance?' },
      correct: { de: 'Diamant', en: 'Diamond' },
      wrong: { de: ['Gold', 'Eisen', 'Quarz'], en: ['Gold', 'Iron', 'Quartz'] } },
    { cat: 'history', diff: 'medium',
      prompt: { de: 'In welchem Jahr endete der Zweite Weltkrieg?', en: 'In which year did World War II end?' },
      correct: { de: '1945', en: '1945' },
      wrong: { de: ['1939', '1918', '1950'], en: ['1939', '1918', '1950'] } },
    { cat: 'general', diff: 'easy',
      prompt: { de: 'Wie viele Seiten hat ein Sechseck?', en: 'How many sides does a hexagon have?' },
      correct: { de: '6', en: '6' },
      wrong: { de: ['5', '7', '8'], en: ['5', '7', '8'] } }
  ],

  truefalse: [
    { cat: 'general', diff: 'easy',
      prompt: { de: 'Honig verdirbt niemals.', en: 'Honey never spoils.' }, answer: true },
    { cat: 'animals', diff: 'easy',
      prompt: { de: 'Ein Oktopus hat drei Herzen.', en: 'An octopus has three hearts.' }, answer: true },
    { cat: 'science', diff: 'medium',
      prompt: { de: 'Der Eiffelturm kann im Sommer höher werden.', en: 'The Eiffel Tower can grow taller in summer.' }, answer: true },
    { cat: 'animals', diff: 'easy',
      prompt: { de: 'Fledermäuse sind blind.', en: 'Bats are blind.' }, answer: false },
    { cat: 'general', diff: 'easy',
      prompt: { de: 'Goldfische haben nur ein Drei-Sekunden-Gedächtnis.', en: 'Goldfish have only a three-second memory.' }, answer: false },
    { cat: 'science', diff: 'medium',
      prompt: { de: 'Schall ist schneller als Licht.', en: 'Sound travels faster than light.' }, answer: false },
    { cat: 'geography', diff: 'medium',
      prompt: { de: 'Die Sahara ist die größte Wüste der Welt.', en: 'The Sahara is the largest desert in the world.' }, answer: false },
    { cat: 'geography', diff: 'easy',
      prompt: { de: 'Der Mount Everest ist der höchste Berg über dem Meeresspiegel.', en: 'Mount Everest is the tallest mountain above sea level.' }, answer: true },
    { cat: 'general', diff: 'easy',
      prompt: { de: 'Blitze schlagen nie zweimal an derselben Stelle ein.', en: 'Lightning never strikes the same place twice.' }, answer: false },
    { cat: 'science', diff: 'medium',
      prompt: { de: 'Wasser besteht aus Wasserstoff und Sauerstoff.', en: 'Water is made of hydrogen and oxygen.' }, answer: true }
  ],

  higherlower: [
    { cat: 'geography', diff: 'medium',
      prompt: { de: 'Was ist höher?', en: 'Which is taller?' }, unit: { de: 'm', en: 'm' },
      a: { de: 'Eiffelturm', en: 'Eiffel Tower' }, aValue: 330,
      b: { de: 'Tokyo Tower', en: 'Tokyo Tower' }, bValue: 333 },
    { cat: 'geography', diff: 'easy',
      prompt: { de: 'Welcher Berg ist höher?', en: 'Which mountain is taller?' }, unit: { de: 'm', en: 'm' },
      a: { de: 'Mount Everest', en: 'Mount Everest' }, aValue: 8849,
      b: { de: 'K2', en: 'K2' }, bValue: 8611 },
    { cat: 'geography', diff: 'medium',
      prompt: { de: 'Wer hat mehr Einwohner?', en: 'Which has more people?' }, unit: { de: 'Mio.', en: 'million' },
      a: { de: 'China', en: 'China' }, aValue: 1411,
      b: { de: 'Indien', en: 'India' }, bValue: 1428 },
    { cat: 'geography', diff: 'easy',
      prompt: { de: 'Welches Gebäude ist höher?', en: 'Which building is taller?' }, unit: { de: 'm', en: 'm' },
      a: { de: 'Burj Khalifa', en: 'Burj Khalifa' }, aValue: 828,
      b: { de: 'Empire State Building', en: 'Empire State Building' }, bValue: 443 },
    { cat: 'animals', diff: 'easy',
      prompt: { de: 'Was ist schneller?', en: 'Which is faster?' }, unit: { de: 'km/h', en: 'km/h' },
      a: { de: 'Gepard', en: 'Cheetah' }, aValue: 110,
      b: { de: 'Windhund', en: 'Greyhound' }, bValue: 70 },
    { cat: 'animals', diff: 'medium',
      prompt: { de: 'Was ist schwerer?', en: 'Which is heavier?' }, unit: { de: 'kg', en: 'kg' },
      a: { de: 'Afrikanischer Elefant', en: 'African elephant' }, aValue: 6000,
      b: { de: 'Nilpferd', en: 'Hippopotamus' }, bValue: 1500 },
    { cat: 'geography', diff: 'medium',
      prompt: { de: 'Welcher Fluss ist länger?', en: 'Which river is longer?' }, unit: { de: 'km', en: 'km' },
      a: { de: 'Nil', en: 'Nile' }, aValue: 6650,
      b: { de: 'Amazonas', en: 'Amazon' }, bValue: 6400 },
    { cat: 'science', diff: 'medium',
      prompt: { de: 'Was ist weiter von der Sonne entfernt?', en: 'Which is farther from the Sun?' }, unit: { de: 'Mio. km', en: 'million km' },
      a: { de: 'Mars', en: 'Mars' }, aValue: 228,
      b: { de: 'Venus', en: 'Venus' }, bValue: 108 },
    { cat: 'science', diff: 'easy',
      prompt: { de: 'Was hat den höheren Siedepunkt?', en: 'Which has the higher boiling point?' }, unit: { de: '°C', en: '°C' },
      a: { de: 'Wasser', en: 'Water' }, aValue: 100,
      b: { de: 'Ethanol', en: 'Ethanol' }, bValue: 78 },
    { cat: 'geography', diff: 'hard',
      prompt: { de: 'Welches Land hat die größere Fläche?', en: 'Which country has the larger area?' }, unit: { de: 'Mio. km²', en: 'million km²' },
      a: { de: 'Russland', en: 'Russia' }, aValue: 17,
      b: { de: 'Kanada', en: 'Canada' }, bValue: 10 }
  ],

  freetext: [
    { cat: 'geography', diff: 'easy',
      prompt: { de: 'Wie heißt die Hauptstadt von Frankreich?', en: 'What is the capital of France?' },
      display: { de: 'Paris', en: 'Paris' },
      accept: { de: ['paris'], en: ['paris'] } },
    { cat: 'science', diff: 'easy',
      prompt: { de: 'Welcher ist der größte Planet unseres Sonnensystems?', en: 'What is the largest planet in our solar system?' },
      display: { de: 'Jupiter', en: 'Jupiter' },
      accept: { de: ['jupiter'], en: ['jupiter'] } },
    { cat: 'science', diff: 'medium',
      prompt: { de: 'Was ist das chemische Symbol für Gold?', en: 'What is the chemical symbol for gold?' },
      display: { de: 'Au', en: 'Au' },
      accept: { de: ['au'], en: ['au'] } },
    { cat: 'general', diff: 'medium',
      prompt: { de: 'Wer schrieb „Romeo und Julia"?', en: 'Who wrote "Romeo and Juliet"?' },
      display: { de: 'William Shakespeare', en: 'William Shakespeare' },
      accept: { de: ['shakespeare', 'william shakespeare'], en: ['shakespeare', 'william shakespeare'] } },
    { cat: 'general', diff: 'easy',
      prompt: { de: 'Wie heißt die Währung Japans?', en: 'What is the currency of Japan?' },
      display: { de: 'Yen', en: 'Yen' },
      accept: { de: ['yen', 'japanischer yen'], en: ['yen', 'japanese yen'] } },
    { cat: 'general', diff: 'medium',
      prompt: { de: 'Wer malte die Mona Lisa?', en: 'Who painted the Mona Lisa?' },
      display: { de: 'Leonardo da Vinci', en: 'Leonardo da Vinci' },
      accept: { de: ['leonardo da vinci', 'da vinci', 'leonardo'], en: ['leonardo da vinci', 'da vinci', 'leonardo'] } },
    { cat: 'animals', diff: 'easy',
      prompt: { de: 'Welches ist das höchste Tier der Welt?', en: 'What is the tallest animal in the world?' },
      display: { de: 'Giraffe', en: 'Giraffe' },
      accept: { de: ['giraffe'], en: ['giraffe'] } },
    { cat: 'science', diff: 'easy',
      prompt: { de: 'Welcher Planet wird der „Rote Planet" genannt?', en: 'Which planet is called the "Red Planet"?' },
      display: { de: 'Mars', en: 'Mars' },
      accept: { de: ['mars', 'der mars'], en: ['mars'] } },
    { cat: 'science', diff: 'easy',
      prompt: { de: 'Wie nennt man gefrorenes Wasser?', en: 'What do you call frozen water?' },
      display: { de: 'Eis', en: 'Ice' },
      accept: { de: ['eis'], en: ['ice'] } },
    { cat: 'geography', diff: 'medium',
      prompt: { de: 'Wie heißt der längste Fluss Deutschlands?', en: 'What is the longest river in Germany?' },
      display: { de: 'Rhein', en: 'Rhine' },
      accept: { de: ['rhein', 'der rhein'], en: ['rhine', 'the rhine'] } }
  ],

  estimate: [
    { cat: 'geography', diff: 'medium', value: 8849, unit: { de: 'Meter', en: 'meters' },
      prompt: { de: 'Wie hoch ist der Mount Everest (in Metern)?', en: 'How tall is Mount Everest (in meters)?' } },
    { cat: 'science', diff: 'medium', value: 206, unit: { de: 'Knochen', en: 'bones' },
      prompt: { de: 'Wie viele Knochen hat ein erwachsener Mensch?', en: 'How many bones does an adult human have?' } },
    { cat: 'science', diff: 'hard', value: 299792, unit: { de: 'km/s', en: 'km/s' },
      prompt: { de: 'Wie schnell ist das Licht (in km pro Sekunde)?', en: 'How fast is light (in km per second)?' } },
    { cat: 'geography', diff: 'medium', value: 195, unit: { de: 'Länder', en: 'countries' },
      prompt: { de: 'Wie viele Länder gibt es ungefähr auf der Welt?', en: 'Roughly how many countries are there in the world?' } },
    { cat: 'science', diff: 'hard', value: 384400, unit: { de: 'km', en: 'km' },
      prompt: { de: 'Wie weit ist der Mond von der Erde entfernt (in km)?', en: 'How far is the Moon from Earth (in km)?' } },
    { cat: 'history', diff: 'medium', value: 1989, unit: { de: '', en: '' },
      prompt: { de: 'In welchem Jahr fiel die Berliner Mauer?', en: 'In which year did the Berlin Wall fall?' } },
    { cat: 'general', diff: 'easy', value: 88, unit: { de: 'Tasten', en: 'keys' },
      prompt: { de: 'Wie viele Tasten hat ein Standard-Klavier?', en: 'How many keys does a standard piano have?' } },
    { cat: 'science', diff: 'medium', value: 118, unit: { de: 'Elemente', en: 'elements' },
      prompt: { de: 'Wie viele Elemente hat das Periodensystem?', en: 'How many elements are in the periodic table?' } },
    { cat: 'geography', diff: 'hard', value: 21196, unit: { de: 'km', en: 'km' },
      prompt: { de: 'Wie lang ist die Chinesische Mauer ungefähr (in km)?', en: 'Roughly how long is the Great Wall of China (in km)?' } },
    { cat: 'animals', diff: 'medium', value: 30, unit: { de: 'Meter', en: 'meters' },
      prompt: { de: 'Wie lang kann ein Blauwal werden (in Metern)?', en: 'How long can a blue whale grow (in meters)?' } }
  ]
};

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------
function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a shuffled round of normalized questions for a given type.
 * @param {string} type    one of QUESTIONS keys
 * @param {object} opts    { amount, category, difficulty }
 * @returns {Array} normalized round objects (include answer keys, server-side only)
 */
export function buildRound(bank, type, { amount = 10, category = 0, difficulty = 'any' } = {}) {
  let pool = (bank && bank[type]) || [];

  // category here is the OpenTDB-style id mapping; we filter by our cat keys.
  if (category && category !== 0) {
    const key = CATEGORY_ID_TO_KEY[category];
    if (key) pool = pool.filter((q) => q.cat === key);
  }
  if (difficulty && difficulty !== 'any') {
    const filtered = pool.filter((q) => q.diff === difficulty);
    if (filtered.length >= 3) pool = filtered; // keep enough to play
  }

  const picked = shuffle(pool).slice(0, Math.min(amount, pool.length));
  return picked.map((q) => normalize(type, q));
}

export const CATEGORY_ID_TO_KEY = {
  9: 'general', 17: 'science', 18: 'general', 19: 'science',
  21: 'general', 22: 'geography', 23: 'history', 11: 'general',
  12: 'general', 15: 'general', 27: 'animals'
};

function normalize(type, q) {
  if (type === 'multiple') {
    const correct = q.correct;
    const opts = [correct, ...q.wrong.de.map((_, i) => ({ de: q.wrong.de[i], en: q.wrong.en[i] }))];
    const order = shuffle(opts.map((_, i) => i));
    const options = order.map((i) => opts[i]);
    return { type, prompt: q.prompt, options, correctIndex: order.indexOf(0), cat: q.cat, diff: q.diff };
  }
  if (type === 'truefalse') {
    const options = [{ de: 'Wahr', en: 'True' }, { de: 'Falsch', en: 'False' }];
    return { type, prompt: q.prompt, options, correctIndex: q.answer ? 0 : 1, cat: q.cat, diff: q.diff };
  }
  if (type === 'higherlower') {
    const options = [q.a, q.b];
    return {
      type, prompt: q.prompt, options,
      correctIndex: q.aValue >= q.bValue ? 0 : 1,
      values: [q.aValue, q.bValue], unit: q.unit, cat: q.cat, diff: q.diff
    };
  }
  if (type === 'freetext') {
    return { type, prompt: q.prompt, accept: q.accept, display: q.display, cat: q.cat, diff: q.diff };
  }
  if (type === 'estimate') {
    return { type, prompt: q.prompt, value: q.value, unit: q.unit, cat: q.cat, diff: q.diff };
  }
  return q;
}

// ---------------------------------------------------------------------------
// Free-text matching
// ---------------------------------------------------------------------------
export function normalizeText(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9äöüß ]/gi, ' ')
    .replace(/\b(der|die|das|the|a|an|le|la)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

/** True if `answer` matches any accepted answer (both languages), allowing small typos. */
export function matchFreeText(answer, acceptObj) {
  const guess = normalizeText(answer);
  if (!guess) return false;
  const accepted = [...(acceptObj.de || []), ...(acceptObj.en || [])].map(normalizeText);
  for (const a of accepted) {
    if (guess === a) return true;
    // allow 1 typo for longer answers
    if (a.length > 4 && levenshtein(guess, a) <= 1) return true;
  }
  return false;
}

/** Parse a number out of free-form text ("1.989", "1989 ", "ca. 200"). */
export function parseNumber(text) {
  const cleaned = String(text).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
