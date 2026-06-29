// Fetches and normalizes questions from the Open Trivia DB (https://opentdb.com).
// Questions are requested with `encode=url3986` so we can safely decode them with
// decodeURIComponent instead of dealing with HTML entities.

const API_BASE = 'https://opentdb.com/api.php';

// Subset of OpenTDB category ids exposed in the lobby UI. id 0 = "Any category".
export const CATEGORIES = [
  { id: 0, key: 'any' },
  { id: 9, key: 'general' },
  { id: 17, key: 'science' },
  { id: 18, key: 'computers' },
  { id: 19, key: 'maths' },
  { id: 21, key: 'sports' },
  { id: 22, key: 'geography' },
  { id: 23, key: 'history' },
  { id: 11, key: 'film' },
  { id: 12, key: 'music' },
  { id: 15, key: 'videogames' },
  { id: 27, key: 'animals' }
];

const decode = (s) => decodeURIComponent(s);

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch a batch of normalized questions.
 * @param {object} opts
 * @param {number} opts.amount   1..50
 * @param {number} opts.category OpenTDB category id (0 = any)
 * @param {string} opts.difficulty 'any' | 'easy' | 'medium' | 'hard'
 * @returns {Promise<Array<{question, answers, correctIndex, category, difficulty}>>}
 */
export async function fetchQuestions({ amount = 10, category = 0, difficulty = 'any' } = {}) {
  const params = new URLSearchParams({
    amount: String(Math.min(Math.max(amount, 1), 50)),
    type: 'multiple',
    encode: 'url3986'
  });
  if (category && category !== 0) params.set('category', String(category));
  if (difficulty && difficulty !== 'any') params.set('difficulty', difficulty);

  const url = `${API_BASE}?${params.toString()}`;

  // OpenTDB rate-limits to ~1 request / 5s per IP. Retry a couple of times.
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OpenTDB HTTP ${res.status}`);
      const data = await res.json();

      // response_code: 0 ok, 1 no results, 2 invalid param, 5 rate limited
      if (data.response_code === 5) {
        await sleep(5500);
        continue;
      }
      if (data.response_code === 1) {
        throw new Error('NO_RESULTS');
      }
      if (data.response_code !== 0 || !Array.isArray(data.results)) {
        throw new Error(`OpenTDB response_code ${data.response_code}`);
      }

      return data.results.map((q) => {
        const correct = decode(q.correct_answer);
        const incorrect = q.incorrect_answers.map(decode);
        const answers = shuffle([correct, ...incorrect]);
        return {
          question: decode(q.question),
          answers,
          correctIndex: answers.indexOf(correct),
          category: decode(q.category),
          difficulty: q.difficulty
        };
      });
    } catch (err) {
      lastError = err;
      if (err.message === 'NO_RESULTS') break;
      await sleep(1200);
    }
  }
  throw lastError || new Error('Failed to fetch questions');
}
