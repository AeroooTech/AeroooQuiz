// ===========================================================================
// brand.js — SINGLE SOURCE OF TRUTH for the product name.
//
// To rebrand the whole app, change `full` (and the two logo halves) here.
// Everything visible — page title, top-bar brand, home wordmark and the intro
// logo — is rendered from these values (see renderBrand() in main.js).
//
// NOTE: the admin panel is a separate mini-app; its name lives in
// public/admin/admin.js (const BRAND) — keep the two in sync when renaming.
// ===========================================================================
export const BRAND = {
  full: 'AeroooQuiz',
  // The logo is shown two-tone (neon magenta + cyan). Split the name however
  // you like; both halves are concatenated for the plain-text title.
  part1: 'Aerooo',
  part2: 'Quiz',
  tagline: { de: 'Online-Multiplayer-Quiz', en: 'Online Multiplayer Quiz' }
};
