---
name: sound-design
description: "Use this skill whenever adding, editing, or reasoning about any audio on StellarForge — click sounds, hover feedback, success/error tones, sounds synced to Motion/GSAP animations, ambient audio. Trigger this before writing any code that plays audio, imports Tone.js or the Web Audio API, or touches a click/hover/animation handler that a prompt asks to 'add sound to.' Read alongside interactive-ui-skill.md (motion timing) and 3d-elements-skill.md if a sound is tied to a 3D interaction — sound should sync to the same trigger points those skills already define, not invent new ones."
---

# StellarForge Sound Design Skill

## Read this first: sound is opt-in by default, not a given

Unlike motion, which most users simply see, sound is intrusive if it's wrong — a click sound
firing unexpectedly in a quiet room, at work, or on a phone in someone's pocket is actively
bad, not just suboptimal. **Every session starts muted by default** unless the person
explicitly turns sound on, or has previously turned it on (persisted preference). Sound is
never the assumed state the way visual design is. This one decision governs almost everything
below — build the mute-by-default architecture first, add sounds second.

This is also new territory not covered by `interactive-ui-skill.md` at all — that skill
handles motion timing and performance; this skill covers what plays, when, how loud, and how
it's gated. Where a sound is tied to an existing animation (a `<StampIn>` entrance, a
`<TicketPunch>` hover, a 3D load-in spring settle), the *sound's timing follows the
animation's timing* — sync to the visual event, don't create a second independent timing
system.

---

## Design direction: sound that matches the paper aesthetic

The visual identity is print/zine — cream paper texture, dotted grain, torn perforation
edges, hand-set typography. It's tactile, but it's a *soft* tactile world: paper, ink, card
stock — not machinery. Sound should follow that exact material, not a harder "mechanical"
register (no gears, no metal clicks, no stamp-press thuds) — the paper itself is the whole
sound design brief.

**Target palette: soft, paper-based, quiet.** Think:
- **Click/tap feedback:** a very soft paper tap — closer to a fingertip tapping card stock,
  or the tiniest paper-flick, than any kind of mechanical click. Short (under ~100ms), low
  in volume, rounded rather than sharp-transient. No percussive "clunk," no digital "beep."
- **Success (registration complete, ticket issued):** a light paper-rustle or a soft single
  page-turn sound — reads as "the ticket is now in your hand," not "a machine did something."
  Pairs with the "You're in! Ticket #0042 generated" toast and confetti moment.
- **Error/blocked (event full, form invalid):** a very soft, short, muted sound — think a
  gentle paper crease or a quiet dull tap, not a buzzer and not a hard denial thud. Should
  feel like "not quite" rather than "rejected."
- **Hover (desktop only, matching the base skill's hover-gating):** default to no hover sound
  at all. If one is ever added, it should be barely-there — the faintest paper-shift, well
  below the click sound in both volume and presence.
- **Ticket tear (hero scroll moment):** a genuine soft paper-tear sound, synced to the GSAP
  ScrollTrigger perforation animation — this is still the standout moment, but keep the tear
  itself gentle and short rather than a big dramatic rip. It's a perforated tear-line
  designed to come apart easily, not paper being forcibly torn.
- **Marquee/ticker:** no continuous sound, ever — unchanged from before.

**What to explicitly avoid:** anything with a hard transient or metallic ring (mechanical
clicks, stamp-thuds, typewriter-key sounds, ticket-punch clunks), anything synthesized or
digital-sounding, anything musical/tonal, anything that loops. If a sound could belong to a
vending machine, an arcade game, or a keyboard, it's wrong for this — every sound should
sound like it came from handling paper: soft, a little airy, low-volume, over quickly.

---

## Library and technical approach

- **Native Web Audio API for the primary synthesis path** (see the synthesis section above)
  — no library needed at all for the four core paper sounds, since they're generated live
  from code. This is the default for this project.
- **Howler.js**, only if the fallback route is ever used (real generated/recorded audio
  files instead of synthesis) — handles preloading, sprite-sheet packing, and mobile
  audio-unlock quirks better than hand-rolled file-loading code. Not needed at all if
  synthesis alone covers the palette, which is the expected outcome here.
- **Tone.js** (already available in this environment) is unlikely to be needed for either
  path — it's built for musical/scheduled synthesis, and this palette is closer to short
  noise-based foley, which the raw Web Audio API primitive above already covers directly.
- **Sprite sheet, not individual files — fallback route only.** If the fallback (generated/
  recorded audio files) is ever used, pack all short interaction sounds into a single audio
  sprite (one file, timestamped regions) rather than many small files — cuts network
  requests and avoids per-sound loading latency on first play. Howler supports sprites
  natively (`sprite: { tap: [0, 100], rustle: [150, 370], ... }`). Not applicable to the
  synthesis path, which has no files to pack.
- **Preload, if using files, once and lazily after first interaction** — don't block initial
  page load on audio. Kick off the load either on first user gesture (which you need anyway
  for mobile audio unlock, see below) or during idle time after the page is interactive.
  Synthesized sounds have no load step at all — the `AudioContext` itself is created lazily
  on first gesture instead (same unlock requirement, no asset loading).

```bash
# Only needed for the fallback file-based route — skip entirely if synthesis covers everything
npm install howler
```

```tsx
// lib/sound.ts — fallback sketch, only relevant if real audio files are introduced later
import { Howl } from 'howler';

let sprite: Howl | null = null;

export function initSoundFiles() {
  if (sprite) return;
  sprite = new Howl({
    src: ['/audio/ui-sprite.webm', '/audio/ui-sprite.mp3'], // webm primary, mp3 fallback
    sprite: {
      tap: [0, 100],
      rustle: [150, 370],
      crease: [550, 250],
      tear: [850, 500],
    },
    volume: 0.25, // see volume guidance below — never default to full volume
  });
}

export function playSoundFile(name: 'tap' | 'rustle' | 'crease' | 'tear') {
  if (!isSoundEnabled()) return; // respect the mute state, always, no exceptions
  sprite?.play(name);
}
```

## How the sounds actually get made: synthesize, don't source

A coding model (LongCat, DeepSeek, whichever) cannot literally generate an audio waveform as
output — it writes text/code, not audio. There are two real routes to getting actual sound
into the app, and they lead to very different amounts of work:

**Primary approach — procedural synthesis via the Web Audio API.** Paper sounds are, at the
signal level, just shaped noise: a tap, a rustle, a tear are all broadband noise run through
a filter and a short volume envelope, not musical tones from an oscillator. This is something
the Web Audio API can generate live, in a handful of lines, with **zero audio files, zero
licensing questions, and effectively zero bytes added to the bundle.** This is the default
approach for every sound in this skill — reach for a real audio file only if a synthesized
version genuinely isn't convincing enough once you've heard it in context (see fallback
below).

The instruction to give the model: **every sound in this palette is filtered noise with an
envelope — vary filter cutoff, decay time, and noise "grain," don't reach for oscillators or
tonal synthesis.** This is a narrow, well-defined technique, which plays to a coding model's
strength at precisely implementing a specified method rather than needing to invent taste.

```js
// lib/paperSounds.ts — core synthesis primitive, every sound below is a variant of this
let ctx: AudioContext | null = null;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

function playFilteredNoise({
  durationMs,
  filterType = 'bandpass' as BiquadFilterType,
  frequency,
  Q = 0.7,
  volume,
  attackMs = 2,
}: {
  durationMs: number;
  filterType?: BiquadFilterType;
  frequency: number;
  Q?: number;
  volume: number;
  attackMs?: number;
}) {
  const audioCtx = getCtx();
  const bufferSize = Math.floor(audioCtx.sampleRate * (durationMs / 1000));
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1; // white noise; the filter shapes its color below
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = Q;

  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  const attackSec = attackMs / 1000;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + attackSec); // quick soft attack, never a hard click-in
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  noise.connect(filter).connect(gain).connect(audioCtx.destination);
  noise.start(now);
  noise.stop(now + durationMs / 1000 + 0.02);
}
```

### The four paper-sound recipes

Each of these is the same primitive above with different parameters — this is deliberate,
it's what keeps the whole palette feeling like one consistent material instead of four
unrelated sounds:

```js
// Soft tap — click/success-adjacent micro-feedback
export function playPaperTap() {
  playFilteredNoise({ durationMs: 70, filterType: 'bandpass', frequency: 2200, Q: 0.6, volume: 0.22, attackMs: 1 });
}

// Rustle — success moments, a slightly longer, airier texture
export function playPaperRustle() {
  playFilteredNoise({ durationMs: 220, filterType: 'highpass', frequency: 1400, Q: 0.4, volume: 0.18, attackMs: 8 });
}

// Crease — error/blocked, duller and shorter, lower cutoff so it reads "muted" not "bright"
export function playPaperCrease() {
  playFilteredNoise({ durationMs: 90, filterType: 'lowpass', frequency: 900, Q: 0.5, volume: 0.2, attackMs: 2 });
}

// Tear — the hero scroll moment, longer with a pitch-ish sweep for texture:
// layer two filtered-noise bursts with a slight timing offset for a "coming apart" feel
export function playPaperTear() {
  playFilteredNoise({ durationMs: 260, filterType: 'bandpass', frequency: 3000, Q: 0.5, volume: 0.2, attackMs: 3 });
  setTimeout(() => {
    playFilteredNoise({ durationMs: 180, filterType: 'highpass', frequency: 1800, Q: 0.4, volume: 0.15, attackMs: 2 });
  }, 60); // second layer lands slightly after the first, mimicking a tear's uneven edge
}
```

Tuning knobs to hand the model explicitly, so it adjusts parameters instead of reaching for
a different technique when a sound doesn't feel right yet:
- **Brighter/sharper** → raise `frequency` and/or use `bandpass`/`highpass`.
- **Duller/softer** → lower `frequency` and/or use `lowpass`.
- **Longer/airier** → increase `durationMs` and `attackMs` (a slower attack removes any
  click-in transient, which is what separates "soft paper" from "digital blip").
- **Punchier vs. smoother** → `Q` — lower Q is smoother/broader, higher Q is more resonant
  and can start to sound synthetic fast; stay under ~1.0 for anything in this palette.

### Fallback — generated audio files, only if synthesis isn't convincing enough

If, after hearing the synthesized versions in the actual app, they feel too thin or
obviously synthetic, the next step is generating real short audio clips with a dedicated
text-to-sound-effect tool (e.g. ElevenLabs Sound Effects) — described in plain language,
e.g. "soft paper tap on card stock, no reverb, under 100ms, no music." This is a separate
step done outside the coding agent: generate a handful of candidate clips, pick the best
ones, drop them in `/audio/`, and only then hand them to the coding model to wire into the
Howler sprite setup described earlier in this document. In that case the coding model's job
becomes integration only — loading, sprite-packing, gating behind mute state — not sound
generation, since it genuinely can't do that part itself.

---



1. **Muted by default, every session, until the person opts in.** Persist the preference
   (localStorage-equivalent for this stack, or your existing settings storage) so it's
   remembered — but the *first-ever* visit is silent. Never auto-play any sound, including a
   "welcome" sound, before an explicit user gesture toggles sound on.

2. **One explicit, always-visible mute/unmute control.** Not buried in a settings menu three
   levels deep — a small, on-brand icon toggle (fits the monospace/bordered-badge visual
   language already in the nav) visible wherever sound-producing interactions exist. The
   person should never have to guess how to turn it off.

3. **Never fight the OS.** Respect the device's silent/mute switch and system volume — don't
   use any Web Audio trick to bypass hardware mute (and on iOS Safari/WebView, you generally
   can't anyway, which is the correct behavior, not a bug to work around).

4. **Volume ceiling, always conservative — softer still than a typical UI sound kit.** Default
   sprite volume around 0.2–0.3 (lower than a usual interaction-sound default), never 1.0 —
   these should sit almost below conscious notice, felt more than heard. A person who's
   turned sound on is opting into the faintest paper-texture reinforcement, not a soundscape.

5. **Every sound-producing interaction must work identically with sound off.** Sound is
   reinforcement, never the only signal. A click that only "feels complete" via audio and
   looks unfinished without it is a design bug — the visual state change (button press,
   toast, color change) must always fully carry the interaction on its own.

6. **No sound longer than ~300ms for any micro-interaction**, and no looping sound anywhere
   in the app (ties directly to the "no continuous marquee sound" rule above and to the base
   UI skill's "max 2 continuously-running animations" philosophy — continuous audio is even
   more fatiguing than continuous motion).

7. **Debounce rapid-fire triggers.** If someone double-clicks, rapidly hovers a list, or
   scrolls past the tear-point multiple times, don't stack/overlap the same sound repeatedly
   — either let the current instance finish before retriggering, or explicitly cut it short
   and restart cleanly (Howler's `stop()` before `play()`), never let two instances of the
   same one-shot overlap and phase.

8. **Mobile audio unlock, handled once, cleanly.** iOS/Android WebViews require a user
   gesture before any audio context can play — this applies equally to synthesis (creating/
   resuming the shared `AudioContext`) and to the fallback file route. Initialize/unlock the
   audio context on the *first* tap anywhere in the app (a common pattern: a one-time
   `pointerdown` listener on `document` that creates or resumes the `AudioContext` and
   immediately removes itself) rather than trying to preemptively play-and-catch-the-error on
   load, which just produces console noise for no benefit.

9. **File size discipline — moot if synthesizing, still worth stating.** With procedural
   synthesis, there are no audio files at all, so this concern mostly disappears. If the
   fallback file-based route is ever used, target well under 200KB total (compressed, e.g.
   `.webm`/opus) for every sound in the app combined — this ships as an Android APK, where
   every MB matters for install size and cold-start.

---

## Sync with existing motion (the actual point of this skill)

Sound should never be its own independent system — it rides on top of animation trigger
points that `interactive-ui-skill.md` and `3d-elements-skill.md` already define. Map sounds
to existing moments rather than inventing new interaction points:

| Existing visual trigger (from other skills) | Sound |
|---|---|
| `<StampIn>` entrance (badges, headlines) | Soft paper-settle sound, timed to the spring's moment of impact (the overshoot settle point), not the start of the animation — despite the component's name, keep the paired sound paper-soft, not stamp-hard |
| `<TicketPunch>` hover reveal (desktop) | Default off — only add a barely-there paper-shift if it clearly improves the moment |
| Touch `:active` tap-scale on cards | Very soft paper-tap, timed to the scale-down, not the return spring |
| Ticket-tear-on-scroll (GSAP ScrollTrigger) | Gentle paper-tear sound, scrubbed loosely with scroll velocity the same way the visual tear is — quiet at slow scroll, more present at fast scroll, silent if scrolled back upward |
| Shared layout transition, card → detail (`layoutId`) | No sound — this transition is fast and continuous; a sound here would land at an arbitrary point mid-animation and feel disconnected |
| Registration success + confetti burst | Soft page-turn/rustle, fired at the same moment confetti triggers, not before or after |
| Registration failure (event full, 409) | Quiet paper-crease sound, fired at the same moment the "Fully Booked" UI flip happens |
| 3D ticket-stub load-in spring settle | Same soft paper-settle family as `<StampIn>`, timed to the spring's settle point — reinforces that the 3D object is "the same kind of thing" as the 2D moments |
| Command palette open/close (`⌘K`) | A very soft paper-tap, optional, low priority |
| Marquee, ambient background elements, continuous animations of any kind | **No sound, ever** |

The rule of thumb: **if a visual moment already has a deliberate, named entrance/exit
animation, it's a candidate for sound. If it's continuous or ambient, it isn't.**

---

## Accessibility and inclusivity

- Sound must never be the *only* channel carrying information (covered above, worth
  repeating as a hard accessibility requirement, not just a UX nicety) — screen reader users,
  deaf/hard-of-hearing users, and anyone with sound off must get the complete experience.
- The mute toggle itself needs a clear accessible label (`aria-label="Mute sound effects"` /
  `"Unmute sound effects"`, state reflected via `aria-pressed`), not just an icon-only button
  with no text alternative.
- Avoid any sound with sudden sharp high-frequency content (harsh "dings," sibilant clicks) —
  uncomfortable for people with hyperacusis/sound sensitivity and generally unpleasant on
  repeat regardless. The soft/mechanical/analog direction above naturally avoids this, which
  is another reason to stay disciplined about it rather than drifting toward brighter,
  punchier "gamey" sounds over time.

---

## Capacitor / Android WebView checklist

- [ ] Confirm the audio sprite actually plays after the mobile unlock gesture inside the
      packaged APK, not just in a mobile-emulated desktop browser — WebView audio-unlock
      behavior doesn't always match Chrome-for-Android exactly.
- [ ] Confirm the app's audio respects the phone's ringer/silent switch and doesn't play
      through a media-style audio session that ignores it (this is a common platform-level
      gotcha, worth an explicit test on a real device with the silent switch engaged).
- [ ] Confirm backgrounding the app (switching apps, screen lock) doesn't leave any sound
      queued to fire unexpectedly on return, and doesn't hold an active audio session that
      drains battery while backgrounded.
- [ ] Confirm the mute preference persists correctly across app restarts inside the WebView's
      storage, not just in a browser tab's session.
- [ ] Test with the phone actually at a mid-range hardware tier and real headphones/speaker —
      sounds designed and volume-balanced on a laptop speaker often read as too loud or too
      thin on phone hardware; do a final volume pass on-device, not just in the browser.

---

## Anti-patterns to actively avoid

- **Any sound that plays automatically before user interaction** — no welcome chime, no
  page-load sound, ever, regardless of mute state. Sound only ever fires in direct response
  to something the person did.
- **Generic UI sound kits** (default Material/iOS-style click packs, free stock "UI SFX"
  packs full of bright digital blips) — instantly reads as templated/AI-generated the same
  way uniform fade-in-on-scroll does in the base UI skill's anti-pattern list. Every sound
  should sound like actual paper being handled, not a synthesized stand-in for it.
- **Sound as the primary feedback for anything** — always a layer on top of a visual state
  change that already fully communicates the outcome on its own.
- **Looping/ambient audio anywhere** — no background music, no continuous ambient bed, no
  looping marquee sound. This product doesn't have a soundtrack, it has moments.
- **Escalating volume or pitch to indicate importance** — resist the temptation to make
  "bigger" moments (e.g. successful checkout vs. a small click) louder or more dramatic.
  Keep the whole palette in the same quiet, consistent, analog register — consistency reads
  as intentional design; volume-as-emphasis reads as a game UI.
- **A mute toggle that's hard to find or doesn't visibly reflect its own state** — the
  toggle itself is part of the trust contract; it needs to be obviously there and obviously
  correct at a glance.
