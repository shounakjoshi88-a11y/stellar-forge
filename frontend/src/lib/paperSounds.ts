// paperSounds.ts — StellarForge sound design (see sound-design-skill.md).
//
// PRIMARY material: a real recorded paper tear-off, "I tear off a sheet of
// paper", recorded by Joseph SARDIN (48k/24-bit, studio) and released under
// CC0 / public domain via LaSonotheque / BigSoundBank ("Torn paper #9",
// sound 3246). It ships as two tiny sprite slices, mp3 (38 KB) + ogg (11 KB),
// and is decoded once and cached after the first user gesture (never blocks
// load, never plays before interaction).
//
// FALLBACK material: the original procedural pipeline — filtered white-noise
// with a short envelope, synthesized live with the Web Audio API. It only runs
// if the real clip can't be fetched/decoded (offline / very old WebView).
//
// Everything is opt-in — every session starts MUTED unless the person
// previously enabled it (persisted). The AudioContext is created/resumed lazily
// on the first user gesture (iOS/mobile WebView unlock) and only when sound is
// actually on.

let ctx: AudioContext | null = null;
let enabled: boolean | null = null; // null = not yet decided (defaults to muted)
let lastPlayedAt = 0;

// One ~1s pre-rendered white-noise buffer, shared by the synth fallback only.
// Built lazily on the first synthetic tear, reused forever.
let noiseBuffer: AudioBuffer | null = null;

// The one live tear controller. A new tear never overlaps an old one — its
// voices are cut off and fully disconnected before the next controller starts.
let liveTear: TearAudioController | null = null;

const STORAGE_KEY = "stellarforge.sound";
const RATE_LIMIT_MS = 45; // debounce rapid-fire triggers (skill rule 7)

// The quiet physical ceiling this module ever reaches — the whole tear reads
// "just below conscious notice" (skill rule 4: sprite ~0.2–0.3, never 1.0).
const MASTER_VOLUME = 0.5;

// --- recorded real material (CC0 — LaSonotheque #3246 "Torn paper") ---

const RIP_MP3_URL = "/audio/paper-tear.mp3";
const RIP_OGG_URL = "/audio/paper-tear.ogg";

let ripBuffer: AudioBuffer | null = null;
let ripLoadState: "idle" | "loading" | "done" | "failed" = "idle";

async function fetchRip(url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok || !ctx) return null;
    const ab = await res.arrayBuffer();
    return await ctx.decodeAudioData(ab);
  } catch {
    return null;
  }
}

// Preload the real tear once, lazily after the first user gesture. Tries the
// smaller mp3 first, falls back to ogg; any failure quietly keeps the synth
// fallback for the tear (never an audible error).
export function preloadRipSample(): void {
  if (ripLoadState !== "idle" || !ctx || typeof fetch === "undefined") return;
  ripLoadState = "loading";
  void (async () => {
    const buf = (await fetchRip(RIP_MP3_URL)) ?? (await fetchRip(RIP_OGG_URL));
    ripBuffer = buf;
    ripLoadState = buf ? "done" : "failed";
  })();
}

// --- preference state (persisted, muted-by-default) ---

export function isSoundEnabled(): boolean {
  if (enabled === null) {
    try {
      enabled = localStorage.getItem(STORAGE_KEY) === "on";
    } catch {
      enabled = false;
    }
  }
  return enabled;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* private mode — session-only mute is fine */
  }
}

export function isSoundSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) != null
  );
}

// The AudioContext must be created/resumed inside a user gesture on mobile. Any
// user click on the site unlocks it once, harmless when no sound ever plays.
// First unlock also kicks off the one-time fetch of the recorded tear material.
export function unlockAudio(): AudioContext | null {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!ctx && AC) {
    ctx = new AC();
    preloadRipSample();
  }
  if (ctx?.state === "suspended") void ctx.resume();
  return ctx;
}

// Shared noise bed used by the synthesized fallback. ~1.0s of white noise, looped.
function getNoiseBuffer(): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  if (!ctx) throw new Error("AudioContext unavailable");
  const sr = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(sr), sr);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

// Core primitive — every fallback one-shot is a variation of this.
function playFilteredNoise(opts: {
  durationMs: number;
  filterType?: BiquadFilterType;
  frequency: number;
  freqEnd?: number; // if set, the filter sweeps DOWN here over the duration (a rip's pitch-drop)
  Q?: number;
  volume: number;
  attackMs?: number;
}): void {
  if (!isSoundEnabled() || !ctx) return;
  const {
    durationMs,
    filterType = "bandpass",
    frequency,
    freqEnd,
    Q = 0.7,
    volume,
    attackMs = 2,
  } = opts;

  const bufferSize = Math.floor(ctx.sampleRate * (durationMs / 1000));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, ctx.currentTime);
  if (freqEnd != null && freqEnd !== frequency) {
    // Linear sweep in Hz — exponential would fly past sub-audio on a short rip.
    filter.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + durationMs / 1000);
  }
  filter.Q.value = Q;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const attackSec = attackMs / 1000;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + attackSec);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + durationMs / 1000 + 0.02);
}

type PaperSound = () => void;

// Debounce only the one-shot entry points; the tear controller below must
// never be debounced — cutting it mid-timeline would desync the rip.
function debounced(fn: PaperSound): PaperSound {
  return () => {
    const now = performance.now();
    if (now - lastPlayedAt < RATE_LIMIT_MS) return;
    lastPlayedAt = now;
    if (!isSoundEnabled()) return;
    fn();
  };
}

// Soft tap — a fingertip on card stock. Low-Q lowpass noise; dull "fth" of
// compressed paper, no resonant ring.
export const playPaperTap = debounced(() => {
  playFilteredNoise({ durationMs: 80, filterType: "lowpass", frequency: 850, Q: 0.4, volume: 0.22, attackMs: 3 });
});

// Scissor snip — the two crisp ticks of a blade pair closing, then a quick
// paper slice. Short, dry and papery (no metal ring): one hard-ish bandpass
// "press" and a softer trailing slice, both well under the ~300ms rule.
export const playPaperCut = debounced(() => {
  if (!ctx) return;
  playFilteredNoise({ durationMs: 40, filterType: "bandpass", frequency: 3000, Q: 2.2, volume: 0.22, attackMs: 1 });
  setTimeout(() => {
    playFilteredNoise({ durationMs: 90, filterType: "bandpass", frequency: 1700, Q: 0.7, volume: 0.18, attackMs: 2 });
  }, 48);
});

// THE ONE DOCUMENTED METALLIC EXCEPTION (sound-design-skill.md):
//
// The FallingScissor hero prop. The palette is strictly paper-only everywhere
// else; this single "hero prop" moment gets one short soft-metallic snip,
// explicitly carved out so it must NEVER be used as precedent for more metal
// sounds elsewhere. It keeps its volume under the palette ceiling, its second
// click is pure paper-slice, and the two hits together stay well under 300ms.
export const playMetalSnip = debounced(() => {
  if (!ctx) return;
  // the sharp steel "press" — higher Q than any paper sound, still dry (no ring-tail)
  playFilteredNoise({ durationMs: 42, filterType: "bandpass", frequency: 2600, Q: 2.4, volume: 0.14, attackMs: 1 });
  setTimeout(() => {
    // the paper slice that follows — back in the palette's own material
    playFilteredNoise({ durationMs: 110, filterType: "bandpass", frequency: 1700, Q: 0.8, volume: 0.16, attackMs: 2 });
  }, 46);
});

// ---------------------------------------------------------------------------
// TearAudioController — one controller, two materials:
//
//   REAL  (ripBuffer loaded): the CC0 recorded paper-tear-off plays as a
//         single-shot source. Its playback speed is scrubbed with the visual
//         progress so the audio snils the picture, and it fades out over the
//         very last 10%. Nothing is synthesized — the recording carries its own
//         fibers, transient snap and finish.
//
//   SYNTH (fallback): the old pipeline — one shared pre-looped noise buffer
//         drives two parallel "fiber" chains (bed + scrimble) plus a small
//         stochastic crackle scheduler.
//
// update(progress) is always called from the GSAP timeline onUpdate (60fps) so
// audio and picture stay locked regardless of speed/duration.
// ---------------------------------------------------------------------------

// Deterministic PRNG so every fallback crackle scatter is reproducible.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Crackle {
  p: number;      // progress 0..1 within the rip this burst should land (spread 0.05→0.9)
  freq: number;   // bandpass centre, 1.8–6kHz
  q: number;
  gain: number;
  durMs: number;  // 6–14ms — one fiber snap, over fast
  offset: number; // start offset into the shared noise buffer (phase variety)
  pan: number;
  scheduled: boolean;
}

const CRACKLE_COUNT = 18;
const CRACKLE_CAP = 6; // keep simultaneous one-shots small

function buildCracklePlan(): Crackle[] {
  const rnd = mulberry32(0x575f72); // deterministic seed — reproducible scatter
  const plan: Crackle[] = [];
  for (let i = 0; i < CRACKLE_COUNT; i++) {
    // Spread neatly across the continuous rip; the last fibers (p ≈ 0.85) are
    // louder + brighter — the strongest snaps right before the tear-off.
    const p = 0.05 + ((i + 0.25 + rnd() * 0.7) / CRACKLE_COUNT) * 0.85;
    const hot = Math.min(1, Math.max(0, (p - 0.6) / 0.25));
    plan.push({
      p,
      freq: Math.min(6000, 1800 + rnd() * 3600 + hot * 700),
      q: 0.7 + rnd() * 0.7,
      gain: 0.03 + rnd() * 0.05 + hot * 0.03,
      durMs: 6 + rnd() * 8,
      offset: rnd() * 0.9,
      pan: (rnd() - 0.5) * 0.6,
      scheduled: false,
    });
  }
  return plan.sort((a, b) => a.p - b.p);
}

export class TearAudioController {
  private readonly audioCtx: AudioContext;
  private readonly real: boolean;
  private readonly buffer: AudioBuffer; // real material (rip) or synth noise
  private readonly crackles: Crackle[] = ripBuffer ? [] : buildCracklePlan();

  // real path
  private ripSource: AudioBufferSourceNode | null = null;
  private ripFilter: BiquadFilterNode | null = null;
  private ripGain: GainNode | null = null;

  // synth path
  private masterGain: GainNode | null = null;
  private bedSource: AudioBufferSourceNode | null = null;
  private highpass: BiquadFilterNode | null = null;
  private bedFilter: BiquadFilterNode | null = null;
  private bedPan: StereoPannerNode | null = null;
  private bedGain: GainNode | null = null;
  private scrimSource: AudioBufferSourceNode | null = null;
  private scrimFilter: BiquadFilterNode | null = null;
  private scrimPan: StereoPannerNode | null = null;
  private scrimGain: GainNode | null = null;

  private liveCrackles: {
    source: AudioBufferSourceNode;
    filter: BiquadFilterNode;
    pan: StereoPannerNode;
    gain: GainNode;
  }[] = [];
  private stopTimeout: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  constructor() {
    const c = unlockAudio();
    if (!c) throw new Error("AudioContext unavailable");
    this.audioCtx = c;
    this.real = ripBuffer != null;
    this.buffer = ripBuffer ?? getNoiseBuffer();
  }

  /** The rip "presence" through the main event (0..1 → per-mode), used only by {@link update}. */
  private signature(p: number): number {
    if (p < 0.04) return p / 0.04; // snap-in
    if (p < 0.9) return 1;         // full sustain through the paper
    return Math.max(0, 1 - (p - 0.9) / 0.1); // tear-off fade
  }

  /** Begin the rip. `now` is the audio-context time to anchor the attack to. */
  start(now = 0) {
    if (!isSoundEnabled() || this.started) return;
    this.started = true;
    const t0 = now > 0 ? now : this.audioCtx.currentTime;

    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = MASTER_VOLUME;
    this.masterGain.connect(this.audioCtx.destination);

    // ---- REAL: the recorded CC0 tear-off. One shot — the recording carries
    // the whole rip; update() only nudges speed + the exit fade. ----
    if (this.real) {
      const src = this.audioCtx.createBufferSource();
      src.buffer = this.buffer;
      src.loop = false;
      const hp = this.audioCtx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 90; // kill any DC/rumble floor from the recording
      const gain = this.audioCtx.createGain();
      const attack = this.audioCtx.currentTime;
      gain.gain.value = 0.0001;
      gain.gain.setTargetAtTime(0.34, attack, 0.02);
      src.connect(hp).connect(gain).connect(this.masterGain);
      src.start(t0);

      this.ripSource = src;
      this.ripFilter = hp;
      this.ripGain = gain;
      return;
    }

    // ---- Fallback SYNTH: loop → highpass → bandpass sweep → pan −0.25 ----
    this.bedSource = this.audioCtx.createBufferSource();
    this.bedSource.buffer = this.buffer;
    this.bedSource.loop = true;
    this.highpass = this.audioCtx.createBiquadFilter();
    this.highpass.type = "highpass";
    this.highpass.frequency.value = 180;
    this.highpass.Q.value = 0.7;
    this.bedFilter = this.audioCtx.createBiquadFilter();
    this.bedFilter.type = "bandpass";
    this.bedFilter.frequency.value = 2600;
    this.bedFilter.Q.value = 0.8;
    this.bedPan = this.audioCtx.createStereoPanner();
    this.bedPan.pan.value = -0.25;
    this.bedGain = this.audioCtx.createGain();
    this.bedGain.gain.value = 0.0001;
    this.bedSource
      .connect(this.highpass)
      .connect(this.bedFilter)
      .connect(this.bedPan)
      .connect(this.bedGain)
      .connect(this.masterGain);
    this.bedSource.start(t0);

    // ---- Scrimble: second looped voice, slightly detuned, pan +0.25 ----
    this.scrimSource = this.audioCtx.createBufferSource();
    this.scrimSource.buffer = this.buffer;
    this.scrimSource.loop = true;
    this.scrimSource.playbackRate.value = 0.96;
    this.scrimFilter = this.audioCtx.createBiquadFilter();
    this.scrimFilter.type = "bandpass";
    this.scrimFilter.frequency.value = 1500;
    this.scrimFilter.Q.value = 0.8;
    this.scrimPan = this.audioCtx.createStereoPanner();
    this.scrimPan.pan.value = 0.25;
    this.scrimGain = this.audioCtx.createGain();
    this.scrimGain.gain.value = 0.0001;
    this.scrimSource
      .connect(this.scrimFilter)
      .connect(this.scrimPan)
      .connect(this.scrimGain)
      .connect(this.masterGain);
    this.scrimSource.start(t0);

    // 80–150ms attack ramp so the two beds never click in.
    const a = this.audioCtx.currentTime;
    this.bedGain.gain.setValueAtTime(0.0001, a);
    this.bedGain.gain.setTargetAtTime(0.16, a, 0.045);
    this.scrimGain.gain.setValueAtTime(0.0001, a);
    this.scrimGain.gain.setTargetAtTime(0.05, a, 0.05);
  }

  /**
   * Drive audio parameters from GSAP timeline progress (0→1). Called every
   * frame inside the timeline's onUpdate. Real material: only speed + exit
   * fade. Synth material: every filter param is re-anchored with
   * cancelScheduledValues + setValueAtTime before its setTargetAtTime.
   */
  update(progress: number) {
    if (!this.started) return;
    const p = Math.min(1, Math.max(0, progress));
    const now = this.audioCtx.currentTime;

    // ---- REAL path ----
    if (this.real) {
      if (this.ripSource) {
        // 0.96 → 1.03 — a hair of speed-tension with the motion, never a pitch wobble.
        this.ripSource.playbackRate.value = 0.96 + p * 0.07;
      }
      if (this.ripGain) {
        this.ripGain.gain.cancelScheduledValues(now);
        this.ripGain.gain.setTargetAtTime(0.34 * this.signature(p), now, 0.012);
      }
      return;
    }

    // ---- Fallback SYNTH path ----
    let bedFreq: number, bedQ: number, bedVol: number;
    let scrimFreq: number, scrimVol: number;

    if (p < 0.05) {
      const k = p / 0.05;
      bedFreq = 2600;
      bedQ = 0.8;
      bedVol = 0.15 * Math.min(1, k * 1.3);
      scrimFreq = 1500;
      scrimVol = 0.04 * k;
    } else if (p < 0.85) {
      const p2 = (p - 0.05) / 0.8;
      bedFreq = 2200 - p2 * 1400;
      bedQ = 0.6 + 0.15 * Math.sin(p * 20);
      bedVol = 0.1 + 0.12 * Math.pow(Math.sin(Math.PI * p2), 1.25);
      scrimFreq = 1500 + 900 * Math.sin(p2 * Math.PI * 5);
      scrimVol = 0.055 * Math.pow(Math.sin(Math.PI * p2), 1.4);
    } else if (p < 0.95) {
      const p3 = (p - 0.85) / 0.1;
      bedFreq = 500 + p3 * 500;
      bedQ = 0.7 + 0.25 * p3;
      bedVol = (0.13 + 0.05 * p3) * (1 - p3 * 0.6);
      scrimFreq = 1400 - p3 * 500;
      scrimVol = 0.05 * (1 - p3);
    } else {
      bedFreq = 1000;
      bedQ = 0.95;
      bedVol = 0.0001;
      scrimFreq = 900;
      scrimVol = 0.0001;
    }

    if (this.bedFilter && this.bedGain) {
      const f = this.bedFilter.frequency;
      f.cancelScheduledValues(now);
      f.setValueAtTime(f.value, now);
      f.setTargetAtTime(bedFreq, now, 0.06);
      const q = this.bedFilter.Q;
      q.cancelScheduledValues(now);
      q.setValueAtTime(q.value, now);
      q.setTargetAtTime(bedQ, now, 0.06);
      const g = this.bedGain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.setTargetAtTime(bedVol, now, 0.03);
    }
    if (this.scrimFilter && this.scrimGain) {
      const f = this.scrimFilter.frequency;
      f.cancelScheduledValues(now);
      f.setValueAtTime(f.value, now);
      f.setTargetAtTime(scrimFreq, now, 0.06);
      const g = this.scrimGain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.setTargetAtTime(scrimVol, now, 0.03);
    }

    // Micro-crackle scheduler (synth fallback only — the recording carries its own).
    for (const c of this.crackles) {
      if (c.scheduled || c.p > p) continue;
      if (this.liveCrackles.length > CRACKLE_CAP) break;
      c.scheduled = true;
      const lead = Math.min(0.05, Math.max(0.01, (c.p - p) * 0.95));
      this.spawnCrackle(c, now + lead);
    }
  }

  /** One short fiber snap: its own bandpass through a slight pan. Dispose fast. */
  private spawnCrackle(c: Crackle, when: number) {
    const master = this.masterGain;
    if (!master) return;
    const ctxNow = this.audioCtx;
    const source = ctxNow.createBufferSource();
    source.buffer = this.buffer;
    const filter = ctxNow.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = c.freq;
    filter.Q.value = c.q;
    const pan = ctxNow.createStereoPanner();
    pan.pan.value = c.pan;
    const gain = ctxNow.createGain();
    const dur = c.durMs / 1000;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, c.gain), when + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    source.connect(filter).connect(pan).connect(gain).connect(master);
    source.start(when, c.offset);
    source.stop(when + dur + 0.02);

    const live = { source, filter, pan, gain };
    this.liveCrackles.push(live);
    source.onended = () => {
      this.liveCrackles = this.liveCrackles.filter((n) => n !== live);
      try { source.disconnect(); } catch {}
      try { filter.disconnect(); } catch {}
      try { pan.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };
  }

  /** End the rip: hard cut either path, kill pending one-shots, settle softly. */
  stop() {
    if (!this.started) return;
    this.started = false;
    if (liveTear === this) liveTear = null;

    const now = this.audioCtx.currentTime;
    if (this.real) {
      if (this.ripGain) {
        this.ripGain.gain.cancelScheduledValues(now);
        this.ripGain.gain.setTargetAtTime(0.0001, now, 0.02);
      }
    } else {
      if (this.bedGain) {
        this.bedGain.gain.cancelScheduledValues(now);
        this.bedGain.gain.setTargetAtTime(0.0001, now, 0.02);
      }
      if (this.scrimGain) {
        this.scrimGain.gain.cancelScheduledValues(now);
        this.scrimGain.gain.setTargetAtTime(0.0001, now, 0.02);
      }
      for (const c of this.liveCrackles) {
        try { c.source.stop(); } catch {}
        try { c.source.disconnect(); } catch {}
        try { c.filter.disconnect(); } catch {}
        try { c.pan.disconnect(); } catch {}
        try { c.gain.disconnect(); } catch {}
      }
      this.liveCrackles = [];
    }

    if (this.stopTimeout) clearTimeout(this.stopTimeout);
    // Let the ~20ms cut land, then actually stop the looped sources.
    this.stopTimeout = setTimeout(() => {
      try { this.ripSource?.stop(); } catch {}
      try { this.bedSource?.stop(); } catch {}
      try { this.scrimSource?.stop(); } catch {}
      this.disconnectAll();
      this.stopTimeout = null;
    }, 120);

    playPaperSettle();
  }

  private disconnectAll() {
    try { this.ripSource?.disconnect(); } catch {}
    try { this.ripFilter?.disconnect(); } catch {}
    try { this.ripGain?.disconnect(); } catch {}
    try { this.bedSource?.disconnect(); } catch {}
    try { this.highpass?.disconnect(); } catch {}
    try { this.bedFilter?.disconnect(); } catch {}
    try { this.bedPan?.disconnect(); } catch {}
    try { this.bedGain?.disconnect(); } catch {}
    try { this.scrimSource?.disconnect(); } catch {}
    try { this.scrimFilter?.disconnect(); } catch {}
    try { this.scrimPan?.disconnect(); } catch {}
    try { this.scrimGain?.disconnect(); } catch {}
    try { this.masterGain?.disconnect(); } catch {}
    this.ripSource = null;
    this.ripFilter = null;
    this.ripGain = null;
    this.bedSource = null;
    this.highpass = null;
    this.bedFilter = null;
    this.bedPan = null;
    this.bedGain = null;
    this.scrimSource = null;
    this.scrimFilter = null;
    this.scrimPan = null;
    this.scrimGain = null;
    this.masterGain = null;
  }
}

// Entry points from the React side.
//
// The controller itself is deliberately NOT debounced — debouncing would cut
// it mid-rip and desync the tear. Overlap is guarded instead (a new tear stops
// the previous controller's nodes), and the one-shot sounds stay debounced.
export function playPaperTear(): TearAudioController | null {
  if (!isSoundEnabled()) return null;
  // Always called inside a user gesture (ticket click). The once-only unlock in
  // Layout listens on `window` (bubble) and would fire AFTER React's synthetic
  // handler on the very first tap of a session, so create/resume the context
  // here too — otherwise a pre-enabled sound session drops the first tear.
  unlockAudio();
  if (!ctx) return null;
  if (liveTear) liveTear.stop(); // never let two controllers' beds overlap
  const tear = new TearAudioController();
  liveTear = tear;
  tear.start();
  return tear;
}

export function stopPaperTear(): void {
  if (liveTear) {
    liveTear.stop();
    liveTear = null;
  }
}

// Soft settle thump — the stub rests after the rip. Very quiet; the real
// moment is the tear-off itself, not this.
export const playPaperSettle = debounced(() => {
  playFilteredNoise({ durationMs: 180, filterType: "lowpass", frequency: 200, Q: 0.6, volume: 0.1, attackMs: 5 });
});

// Snap-back — un-tear. A single quick dull snap, much softer than the rip.
export const playPaperSnapBack = debounced(() => {
  playFilteredNoise({ durationMs: 90, filterType: "lowpass", frequency: 1200, Q: 0.4, volume: 0.08, attackMs: 2 });
});