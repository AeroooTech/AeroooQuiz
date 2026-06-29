// ===========================================================================
// audio.js — central audio controller for AeroooQuiz.
//
// Two independent systems, each with its own persisted volume (0..1):
//   MUSIC  → the intro + looping background <audio> elements
//   SFX    → procedural sound effects synthesised with the Web Audio API
//            (no asset files needed; tuned soft/retro to fit City Pop).
//
// Music: play intro during the intro animation, fade it out, then start the
// background loop (never overlapping). Volume via setVolume()/the music slider.
//
// SFX: sfx('correct' | 'tick' | 'reveal' | 'streak' | 'pause' | 'resume' |
//       'purchase' | 'shop'). All routed through one gain node, so the SFX
// slider (setSfxVolume) controls them all at once. To add a sound, add a case
// in sfx() below using _note(freq, whenSec, durSec, waveform, gain).
//
// To swap the MUSIC, just point the two <audio> elements at other files
// (see public/index.html) — no code change needed here.
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

    // SFX
    let sv = parseFloat(localStorage.getItem('aerooo.sfx'));
    this.sfxVolume = Number.isFinite(sv) ? clamp(sv, 0, 1) : 0.6;
    this.ctx = null;       // Web Audio context (created on the first gesture)
    this.sfxGain = null;   // master gain for all SFX → driven by the SFX slider
  }

  /** Effective MUSIC level after the mute switch (0 when muted). */
  get level() { return this.muted ? 0 : this.volume; }

  // ---- public control surface (wired to the sliders/mute button) ----------
  setVolume(v) {
    this.volume = clamp(v, 0, 1);   // exact 0..1 mapping ⇒ slider 0%..100% works fully
    if (this.volume > 0) this.muted = false;
    this._persist();
    this._applyLive(); // update whichever track is currently audible
  }

  setSfxVolume(v) {
    this.sfxVolume = clamp(v, 0, 1);
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
    localStorage.setItem('aerooo.sfx', String(this.sfxVolume));
  }
  getSfxVolume() { return this.sfxVolume; }

  toggleMute() {
    this.muted = !this.muted;
    this._persist();
    this._applyLive();
  }

  isSilent() { return this.muted || this.volume === 0; }

  // ---- SFX engine (Web Audio synth) ---------------------------------------
  /** Create/resume the audio context. Call on the first user gesture. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    const lp = this.ctx.createBiquadFilter(); // soften the highs → friendlier tone
    lp.type = 'lowpass'; lp.frequency.value = 5200;
    this.sfxGain.connect(lp).connect(this.ctx.destination);
  }

  /** Schedule one soft note. */
  _note(freq, whenSec, durSec, type = 'sine', gain = 0.4) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + whenSec;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + durSec + 0.03);
  }

  /** Play a named SFX. No-op until unlock() ran or if SFX volume is 0. */
  sfx(name, opt = {}) {
    if (!this.ctx || this.sfxVolume <= 0) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    switch (name) {
      case 'tick':     this._note(opt.freq || 880, 0, 0.08, 'sine', 0.32); break;
      case 'correct':  [659.25, 783.99, 987.77].forEach((f, i) => this._note(f, i * 0.06, 0.18, 'triangle', 0.4)); break;
      case 'wrong':    this._note(220, 0, 0.22, 'sine', 0.32); this._note(164.81, 0.07, 0.28, 'sine', 0.3); break;
      case 'reveal':   this._note(523.25, 0, 0.16, 'triangle', 0.3); this._note(659.25, 0.05, 0.2, 'triangle', 0.3); break;
      case 'streak':   [523.25, 587.33, 698.46, 783.99, 1046.5].forEach((f, i) => this._note(f, i * 0.07, 0.22, 'triangle', 0.4)); break;
      case 'pause':    this._note(523.25, 0, 0.18, 'sine', 0.34); this._note(392, 0.09, 0.24, 'sine', 0.3); break;
      case 'resume':   this._note(392, 0, 0.16, 'sine', 0.3); this._note(523.25, 0.08, 0.22, 'sine', 0.34); break;
      case 'purchase': this._note(784, 0, 0.1, 'triangle', 0.4); this._note(1046.5, 0.07, 0.16, 'triangle', 0.4); break;
      case 'shop':     [659.25, 880, 1318.5].forEach((f, i) => this._note(f, i * 0.08, 0.26, 'sine', 0.3)); break;
    }
  }

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
    // Start directly at the target level (no fade-in). A lingering fade timer
    // would otherwise keep overwriting bgEl.volume and make the music slider
    // feel like it "doesn't reach" 0%/100%.
    this.bgEl.volume = this.level;
    this.bgEl.play().catch(() => { /* will start on next gesture */ });
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
