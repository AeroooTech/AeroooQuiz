// ===========================================================================
// audio.js — central music controller for AeroooQuiz.
//
// Responsibilities:
//   • play the INTRO track during the intro animation
//   • smoothly FADE the intro track out when the intro ends
//   • then start the looping BACKGROUND track (menu + game)
//   • guarantee the two tracks never overlap
//   • drive the volume slider + mute button, persisted to localStorage
//
// To swap the music, just point the two <audio> elements at other files
// (see public/index.html) — no code change needed here. To change fade timing,
// pass different values to playIntro()/crossToBackground() from main.js.
// ===========================================================================

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class AudioManager {
  /**
   * @param {object} cfg
   * @param {HTMLAudioElement} cfg.introEl  the intro <audio> element
   * @param {HTMLAudioElement} cfg.bgEl     the looping background <audio> element
   * @param {number} cfg.defaultVolume      0..1, used when nothing is stored yet
   */
  constructor({ introEl, bgEl, defaultVolume = 0.4 }) {
    this.introEl = introEl;
    this.bgEl = bgEl;
    this.bgStarted = false;
    this._fadeTimer = 0;

    let v = parseFloat(localStorage.getItem('aerooo.vol'));
    this.volume = Number.isFinite(v) ? clamp(v, 0, 1) : defaultVolume;
    this.muted = localStorage.getItem('aerooo.muted') === '1';
  }

  /** Effective level after the mute switch (0 when muted). */
  get level() { return this.muted ? 0 : this.volume; }

  // ---- public control surface (wired to the slider/mute button) -----------
  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.volume > 0) this.muted = false;
    this._persist();
    this._applyLive(); // update whichever track is currently audible
  }

  toggleMute() {
    this.muted = !this.muted;
    this._persist();
    this._applyLive();
  }

  isSilent() { return this.muted || this.volume === 0; }

  // ---- intro → background flow --------------------------------------------

  /** 1) Start the intro music (call this from the user's click gesture). */
  playIntro() {
    this.introEl.currentTime = 0;
    this.introEl.volume = this.level;
    return this.introEl.play().catch(() => { /* blocked until a gesture */ });
  }

  /**
   * 2) + 3) Fade the intro track out over `fadeMs`, then start the looping
   * background track. Sequential on purpose — the intro is fully silenced and
   * paused before the background begins, so the two never overlap.
   */
  async crossToBackground(fadeMs = 1100) {
    await this._fade(this.introEl, this.introEl.volume, 0, fadeMs);
    this.introEl.pause();
    this._startBackground();
  }

  _startBackground() {
    if (this.bgStarted) return;
    this.bgStarted = true;
    this.bgEl.loop = true;
    this.bgEl.volume = 0;
    this.bgEl.play()
      .then(() => this._fade(this.bgEl, 0, this.level, 600)) // gentle fade-in
      .catch(() => { /* will catch on next gesture */ });
  }

  // ---- internals -----------------------------------------------------------
  _applyLive() {
    // Apply the new level to the track that is currently playing.
    if (this.bgStarted) this.bgEl.volume = this.level;
    else if (!this.introEl.paused) this.introEl.volume = this.level;
  }

  _persist() {
    localStorage.setItem('aerooo.vol', String(this.volume));
    localStorage.setItem('aerooo.muted', this.muted ? '1' : '0');
  }

  /**
   * Linear volume fade. Uses setInterval (not requestAnimationFrame) so fades
   * keep running even when the browser tab is backgrounded. Returns a Promise.
   */
  _fade(el, from, to, ms) {
    return new Promise((resolve) => {
      clearInterval(this._fadeTimer);
      el.volume = clamp(from, 0, 1);
      if (ms <= 0) { el.volume = clamp(to, 0, 1); return resolve(); }
      const steps = Math.max(1, Math.round(ms / 30));
      let i = 0;
      this._fadeTimer = setInterval(() => {
        i += 1;
        el.volume = clamp(from + (to - from) * (i / steps), 0, 1);
        if (i >= steps) { clearInterval(this._fadeTimer); resolve(); }
      }, ms / steps);
    });
  }
}
