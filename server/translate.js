// ===========================================================================
// translate.js — pluggable text translation for imported questions.
//
// Provider order:
//   1. DeepL   — if DEEPL_API_KEY is set (best quality, batched). Free keys end
//                in ":fx" and use the api-free host.
//   2. MyMemory — free, no key needed (per-text, slower) → works out of the box.
//
// To add ANOTHER provider, write an async function (texts[]) => translated[]
// and pick it in translateBatch(). Failures fall back to the original text, so
// an import never breaks just because translation is unavailable.
// ===========================================================================

const DEEPL_KEY = process.env.DEEPL_API_KEY || '';
const DEEPL_HOST = DEEPL_KEY.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';

export function activeProvider() {
  return DEEPL_KEY ? 'deepl' : 'mymemory';
}

/**
 * Translate an array of strings, preserving order/length.
 * @returns {Promise<string[]>} translated strings (original text on failure)
 */
export async function translateBatch(texts, target = 'DE', source = 'EN') {
  if (!texts.length) return [];
  try {
    return DEEPL_KEY
      ? await deeplBatch(texts, target, source)
      : await myMemoryBatch(texts, target, source);
  } catch (err) {
    console.error('[translate] failed, keeping original text:', err.message);
    return texts.slice();
  }
}

async function deeplBatch(texts, target, source) {
  const out = [];
  for (let i = 0; i < texts.length; i += 50) { // DeepL allows up to 50 texts/request
    const chunk = texts.slice(i, i + 50);
    const params = new URLSearchParams();
    params.set('auth_key', DEEPL_KEY);
    params.set('target_lang', target);
    if (source) params.set('source_lang', source);
    chunk.forEach((t) => params.append('text', t));
    const res = await fetch(`${DEEPL_HOST}/v2/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    if (!res.ok) throw new Error(`DeepL HTTP ${res.status}`);
    const data = await res.json();
    out.push(...data.translations.map((t) => t.text));
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function myMemoryBatch(texts, target, source) {
  const out = [];
  for (const text of texts) {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source.toLowerCase()}|${target.toLowerCase()}`;
      const res = await fetch(url);
      const data = await res.json();
      out.push(data?.responseData?.translatedText || text);
    } catch {
      out.push(text);
    }
    await sleep(120); // be polite to the free endpoint
  }
  return out;
}
