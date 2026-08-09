---
name: 3d-elements
description: "Use this skill whenever adding, editing, or reasoning about any 3D/WebGL element on StellarForge — hero objects, interactive meshes, particle effects, 3D transitions. This is a SEPARATE, STRICTER skill from interactive-ui — 3D is far more expensive than CSS/Motion animation and has its own failure modes on Android WebView. Trigger this before writing any Three.js/React Three Fiber code, before importing @react-three/fiber or @react-three/drei, or before any prompt mentioning '3D', 'WebGL', 'mesh', 'Canvas' (the R3F one, not HTML canvas), 'Three.js', or 'depth'. Read this in addition to interactive-ui-skill.md, not instead of it — the base performance rules (transform/opacity only, reduced-motion, touch-vs-hover) still apply to anything 2D happening around the 3D scene."
---

# StellarForge 3D Elements Skill

## Read this first: 3D is not "more animation," it's a different risk category

Everything in `interactive-ui-skill.md` was written assuming CSS transforms and Motion/GSAP —
cheap, well-optimized browser primitives. WebGL is a different beast: it owns its own GPU
context, its own render loop, its own memory (geometries, materials, textures all live on the
GPU until explicitly disposed), and none of the browser's normal layout/paint optimizations
apply to it. A single badly-scoped 3D scene can do more damage to frame rate and battery than
every 2D animation on the rest of the site combined.

**The rule that governs everything below: exactly one `<Canvas>` mounted at any given time,
anywhere in the app, full stop.** Not one per page — one, period, across the whole session.
If a second 3D moment is ever justified later, the first one must fully unmount and dispose
before the second mounts. This is non-negotiable and should be enforced in code (a single
global "3D scene owner" context/singleton), not just by convention — don't trust that nobody
will accidentally add a second `<Canvas>` six months from now.

This app ships as an Android APK via Capacitor. **WebGL inside Android WebView is meaningfully
weaker than desktop Chrome and even weaker than Chrome-for-Android proper** — don't assume
what looks smooth in your browser dev tools survives the WebView wrapper. Test in an actual
packaged build, on an actual mid-range device, before calling any 3D work "done." This is
tested separately from — and in addition to — the CPU 4x throttle test in the base UI skill.

---

## Design direction: how 3D fits the ticket-office aesthetic

The existing visual identity is print/zine — flat, dotted paper texture, monospace labels,
ticket-stub motifs. Photorealistic 3D (PBR materials, soft shadows, environment reflections)
actively fights this aesthetic and also happens to be the most expensive rendering path
available. Good news: the cheap path and the on-brand path are the same path.

**Target look: low-poly, flat/toon-shaded, screen-printed object floating in flat space** —
think a die-cut paper ticket stub rendered as a stylized 3D object, not a realistic ticket
photographed in a lightbox. Concretely:

- **Materials:** `MeshToonMaterial` or `MeshBasicMaterial` with baked-in flat color regions.
  Never `MeshStandardMaterial` or `MeshPhysicalMaterial` for hero objects — PBR materials
  pull in expensive lighting math for a payoff (realism) that actively works against the
  print aesthetic.
- **Lighting:** one `<hemisphereLight>` or one `<directionalLight>`, no shadows
  (`shadow-mapSize` off entirely — shadow maps are one of the single most expensive things
  you can turn on in real-time WebGL). If you want the object to read as "grounded," fake it
  with a flat blurred ellipse sprite underneath rather than a real shadow map.
- **Geometry:** low-poly, faceted (flat-shaded normals, not smoothed) — this is both cheaper
  *and* more in-aesthetic than smooth high-poly geometry. A ticket stub, a badge, a die/coin —
  simple extruded or beveled shapes read better here than anything organic or high-detail.
- **Color:** pull directly from the existing cream/orange/black palette — don't let the 3D
  object introduce a new color language. Flat orange faces, black outline/edge accents
  (`<Edges>` from drei gives you a cheap outlined-illustration look that matches print/zine
  design far better than realistic shading).
- **Texture:** if you texture at all, use the same dotted-paper/halftone texture already in
  the 2D design system, mapped flat onto faces — reinforces the "this is the same object
  language as the rest of the site" feeling instead of 3D feeling bolted on.

The goal is that someone screenshotting the hero section shouldn't be able to immediately tell
"oh, that one part is a 3D engine" — it should look like the natural extension of the poster
aesthetic into a floating object, not a tech demo interrupting a print design.

### Exact brand tokens (pulled from the live UI — don't approximate these)

The current UI is a **neubrutalist print/ticket aesthetic**, more specific than generic
"flat design." Match these exactly, not approximately:

- **Palette (fixed, small, don't extend it):** cream/off-white paper background (with a
  visible dotted texture), near-black for text/borders/primary shapes, one orange accent
  (primary CTA / highlight), one lime-yellow-green accent (secondary tag/badge color), one
  blue accent (tertiary tag color, e.g. "UPCOMING" badges). That's the whole palette. The 3D
  object's materials should be built from exactly these five colors — no gradients, no new
  hues invented for "depth."
- **Borders: thick, solid, black, uniform-width.** Every card, button, badge, and the hero
  ticket illustration itself has a heavy black outline. In 3D, this means `<Edges>` (drei)
  with a thick black line material on every mesh — this is not optional polish, it's the
  single most important visual match to the existing UI. A 3D object without this outline
  will read as "from a different app" immediately, no matter how correct the shading is.
- **Shadows: hard-offset, not soft-blurred.** Look at the buttons and cards — the shadow is
  a flat, solid-color block offset a fixed distance behind the element (e.g. black shadow
  offset down-right behind an orange button), with zero blur radius. This is a defining trait
  of the whole UI and it directly informs the 3D fake-shadow approach already specified above:
  **the "grounding" element under the 3D object should be a flat, hard-edged offset shape
  (a solid ellipse or matching silhouette, offset like the 2D shadows, no gaussian blur)**,
  not a soft blurred blob. A soft shadow under the 3D object will look like it's from a
  different, more generic design system than everything around it.
- **Rotation as a design device, used sparingly and deliberately.** Badges like "LIMITED" and
  "ISSUE NO: 001" sit at a small fixed rotation (a few degrees), not dynamically animated —
  it's a static styling choice, like a sticker slapped on at an angle. If the 3D object uses
  any resting rotation, treat it the same way: a small fixed offset from dead-center-facing,
  not something that continuously drifts or wanders.
- **Typography energy, translated to the object:** bold, heavy, high-contrast black-on-cream
  headlines paired with small bordered monospace all-caps labels (see "ISSUE NO: 001",
  "SCAN TO ENTER"). If the 3D object carries any text/label (e.g. a "NO-001" stub number,
  like the real hero ticket has), render it as a flat decal/texture in the same monospace,
  all-caps, high-contrast style — not a 3D-extruded text mesh, which would look like a
  completely different design tradition (more "app icon" than "printed ticket").

### The highest-value first object: a 3D version of the existing hero ticket stub

The current hero already features a ticket-stub illustration (torn perforation line, corner
rivets/circles, QR code corner, "SCAN TO ENTER" label, "LIMITED" tag). **The single best use
of 3D here is turning that exact object into a lightly-dimensional, gently-tilting 3D version
of itself** — same layout, same tear-line, same QR corner, same badge — rather than inventing
a new floating object. This is deliberately the lowest-risk, highest-payoff choice:

- It reuses a design the user has already approved, so there's no new aesthetic judgment call
  to get right — just a faithful 3D translation of something that's already correct.
- It reads as "the ticket got real" rather than "a 3D thing appeared next to the ticket,"
  which is a much stronger, more intentional-feeling moment for a ticketing product
  specifically.
- It naturally limits scope creep — there's no ambiguity about "what should the 3D object be,"
  which is usually where these prompts go wrong.

Build it as a thin extruded card (bevelled edges, not a flat plane) with the front face
textured/decaled to match the real ticket layout, thick black `<Edges>` outline, resting at a
small fixed tilt (echoing the sticker-rotation device above), with the cursor-proximity tilt
(desktop only) and load-in spring settle described later in this document layered on top.

---

## Library stack

- **`@react-three/fiber`** — declarative Three.js in React. Non-negotiable choice over raw
  Three.js: keeps scene graph reviewable as JSX, keeps disposal tied to component lifecycle
  instead of manual imperative cleanup that's easy to forget.
- **`@react-three/drei`** — use its helpers instead of hand-rolling: `<Edges>`, `<Center>`,
  `<Bounds>`, `<Html>` (for any DOM overlay anchored to a 3D point), `<PerformanceMonitor>`
  (see adaptive quality below), `<Preload>`.
- **Do NOT add:** `@react-three/postprocessing`, `@react-three/rapier` (physics), or any
  particle-system library, without an explicit separate conversation first. These are the
  fastest ways to blow the performance budget and none are needed for a "one nice hero
  object" scope. If a future prompt asks for these, stop and confirm scope before proceeding.

```bash
npm install three @react-three/fiber @react-three/drei
```

---

## Non-negotiable performance rules

1. **One `<Canvas>` in the entire app, ever mounted, at a time.** See above — this is the
   single most important rule in this document.

2. **Dispose on unmount, always.** R3F disposes geometries/materials automatically on
   unmount *if they were created via JSX* (`<boxGeometry />` inside the component tree) —
   but any geometry/material/texture created imperatively (`new THREE.BoxGeometry()`,
   loaded textures via `useLoader`) must be verified to dispose correctly. When in doubt,
   wrap the scene in an `IntersectionObserver`-gated mount (same pattern as `<Reveal>` in
   the base skill) so it unmounts — not just hides — when scrolled out of view. A 3D scene
   with `display: none` applied to its container is *still running its render loop* unless
   you explicitly pause it — CSS visibility does nothing to a WebGL context.

3. **Cap the render loop, don't let it run unbounded.** Default R3F renders every frame
   forever (`frameloop="always"`). For anything that isn't continuously interactive, set
   `frameloop="demand"` on `<Canvas>` and manually call `invalidate()` only when something
   actually changes (on hover-move, on scroll-tied update, on spring settle). A static or
   slowly-idling hero object has no business rendering 60fps forever in the background.

4. **Polygon budget: under 50,000 triangles for the entire scene**, ideally far under that
   for a single hero object (a stylized ticket-stub mesh should comfortably fit in the
   low thousands). Check `renderer.info.render.triangles` in dev and log it — don't guess.

5. **Cap device pixel ratio.** `<Canvas dpr={[1, 1.5]}>` — never let it default to a phone's
   full DPR (often 3x on modern Android devices). Rendering at 3x resolution for a hero
   object nobody can appreciate the extra sharpness of is pure wasted GPU cost.

6. **No shadow maps, no post-processing, no bloom/glow shaders** for v1. Every one of these
   is individually capable of halving your frame rate on a mid-range Android GPU. If the
   design genuinely needs a glow effect, fake it with a blurred sprite/plane behind the
   object (cheap, 2D, no shader compilation cost) rather than real bloom post-processing.

7. **Texture size ceiling: 1024×1024 max, compressed where possible** (`.ktx2` via
   `KTX2Loader` if texture use grows; plain `.webp`/`.png` under 1024px is fine for v1's
   scope). Never load 4K textures for a small on-screen 3D object — it's memory cost with
   zero visible benefit at that display size.

8. **Adaptive quality via `<PerformanceMonitor>` (drei).** Wrap the scene so that if drei
   detects sustained low frame rate, it can step down quality (disable a secondary effect,
   drop dpr) automatically rather than staying pinned to a setting that's visibly stuttering
   on that specific device. This is cheap insurance against the range of Android GPUs you
   can't individually test.

9. **WebGL context loss must be handled, not ignored.** Mobile WebViews reclaim GPU contexts
   under memory pressure more aggressively than desktop browsers. Listen for
   `webglcontextlost` and show the static fallback (see below) rather than a broken black box.

---

## Mandatory fallback path

3D must never be a single point of failure for the page rendering at all. Every 3D element
needs a static fallback:

- **WebGL unsupported or context creation fails:** render a static illustration (SVG or
  PNG, matching the object's flat/toon look — ideally an actual rendered screenshot of the
  3D object itself, so the fallback and the real thing look identical) instead of the
  `<Canvas>`. Detect via R3F's `onCreated`/error boundary around the Canvas, not manual
  feature-sniffing.
- **Low-end device / reduced motion / battery saver:** same static fallback, gated the same
  way `prefers-reduced-motion` gates 2D animation in the base skill — if the user has
  reduced motion on, don't even attempt to mount `<Canvas>`, go straight to the static image.
- **Below a viewport-size threshold (optional, worth considering):** on small phones in
  portrait, consider skipping the 3D hero and using the static version by default — the
  interactive payoff of a hover-tilt effect is close to zero on a device that can't hover
  anyway, and you save the GPU/battery cost entirely for the majority of your eventual
  mobile users.

The fallback is not a "nice to have" — treat "3D fails to mount" as an expected, routine
code path that gets tested, not an edge case that gets discovered in production.

---

## Interaction rules (builds on base skill's touch-vs-hover split)

- **Desktop (`(hover: hover) and (pointer: fine)`):** cursor-proximity tilt is acceptable
  *for the single hero object only* — subtle, capped rotation range (a few degrees, not a
  dramatic swing), using `frameloop="demand"` + `invalidate()` on pointer move rather than
  a continuous render loop.
- **Touch:** no drag-to-rotate, no gyroscope-tilt gimmicks. A simple settle animation on
  load and a light `:active`-style scale/bounce on tap is enough — matches the "touch gets
  its own simpler feedback" principle from the base skill. Gyroscope-based 3D tilt in
  particular drains battery fast and rarely reads as intentional rather than gimmicky.
- **Load-in animation:** a single spring settle (matches `<StampIn>`'s energy — snap into
  place with slight overshoot, not a smooth ease) is the right amount of motion. No
  continuous idle rotation by default — that's a permanent animation running forever, which
  eats directly into the base skill's "max 2 continuously-running animations" budget for the
  entire page, not just the 3D section.
- **Scroll-tied behavior, if used at all:** GSAP ScrollTrigger can drive a 3D object's
  rotation/position tied to scroll progress (consistent with how the base skill already uses
  GSAP for scroll-velocity work) — but this must use `frameloop="demand"` +
  `invalidate()` synced to the scroll callback, never a free-running render loop just in
  case scroll happens.

---

## Reusable primitive to build once

**`<Scene3D>`** — the one and only Canvas wrapper for the whole app. Encapsulates:
- Singleton enforcement (throws/warns in dev if a second instance tries to mount)
- `IntersectionObserver`-gated mount/unmount
- `frameloop="demand"` by default, with an `invalidate` helper exposed to children
- `dpr={[1, 1.5]}`
- `<PerformanceMonitor>` wrapping, with a quality-step-down callback
- WebGL-unsupported / context-lost fallback rendering (`fallback` prop — pass the static
  image/SVG here)
- `prefers-reduced-motion` short-circuit to fallback before even attempting mount

Every future 3D moment goes through this component. Nobody hand-rolls a second `<Canvas>`.

```tsx
// components/Scene3D.tsx — sketch, not final implementation
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useState, useRef, useEffect } from 'react';

let sceneInstanceActive = false; // singleton guard

export function Scene3D({ children, fallback, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [supported, setSupported] = useState(true);
  const reducedMotion = useReducedMotionSafe(); // existing helper from base skill

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.1 });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  if (reducedMotion || !supported || !inView) {
    return <div ref={containerRef} className={className}>{fallback}</div>;
  }

  if (process.env.NODE_ENV === 'development' && sceneInstanceActive) {
    console.error('Scene3D: a second instance tried to mount. Only one Canvas allowed at a time.');
  }

  return (
    <div ref={containerRef} className={className}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop="demand"
        onCreated={() => { sceneInstanceActive = true; }}
        onError={() => setSupported(false)}
        gl={{ powerPreference: 'low-power', antialias: false }}
      >
        <PerformanceMonitor onDecline={() => {/* step down quality */}}>
          {children}
        </PerformanceMonitor>
      </Canvas>
    </div>
  );
}
```

Note `antialias: false` and `powerPreference: 'low-power'` in the sketch above — both are
deliberate: MSAA antialiasing is another real cost for marginal visual gain on a small
low-poly object, and `low-power` hints the browser/OS to prefer battery over max performance,
which is the correct default for a decorative hero element, not a game.

---

## Capacitor / Android WebView checklist (in addition to the base skill's checklist)

- [ ] Test the actual packaged APK on a real mid-range Android device — desktop Chrome
      WebGL performance tells you very little about WebView WebGL performance.
- [ ] Confirm `webglcontextlost` fallback actually triggers and displays correctly — force
      it by backgrounding the app for an extended period or opening several other GPU-heavy
      apps, then returning.
- [ ] Confirm the singleton rule holds during route transitions — navigating away from and
      back to the hero page should cleanly unmount and remount, not stack a second context.
- [ ] Battery check: leave the hero page open for 5+ minutes, confirm frame rate/render
      calls actually drop to near-zero (via `frameloop="demand"`) rather than continuing to
      render every frame with nothing changing on screen.
- [ ] Confirm the reduced-motion path skips `<Canvas>` mounting entirely in the WebView too
      — some WebViews report `prefers-reduced-motion` differently than the same device's
      standalone browser; test explicitly, don't assume parity with desktop testing.
- [ ] Confirm total JS bundle size impact — `three` + `@react-three/fiber` + `@react-three/drei`
      add real weight; verify this chunk is code-split and lazy-loaded only on the page that
      needs it, not included in the initial bundle for the whole app.

---

## Anti-patterns to actively avoid

- **3D per-card in any list/grid** (event browse grid, ticket list) — N simultaneous WebGL
  contexts is an instant, severe performance failure. If you want a "3D-ish" touch on cards,
  fake depth with layered flat elements + shadow/parallax (2D, cheap) instead — see the base
  skill's `<TicketPunch>` pattern, which already achieves a tactile feel without WebGL.
- **Photorealistic materials/lighting** — fights the print aesthetic and is the most
  expensive rendering path available; there is no version of this that's both on-brand and
  cheap.
- **Soft/blurred shadows under the 3D object** — the entire UI uses hard-offset, zero-blur
  shadows (see brand tokens above). A soft blurred shadow is a small detail that will still
  visibly clash with every button and card on the same page.
- **Missing or thin black outlines on the 3D object** — every other shape in this UI has a
  heavy, uniform black border. A 3D object without a matching thick outline will look
  imported from a different product, no matter how correct its color palette is.
- **Inventing a new object instead of extending the existing ticket-stub illustration** — the
  hero already has a strong, specific, on-brand visual anchor. A generic floating shape
  (an abstract blob, a generic geometric form) is strictly worse than a 3D version of the
  ticket that's already there.
- **Continuous idle rotation as the default state** — a permanently-spinning object reads as
  a tech demo, not a considered design choice, and permanently burns the "2 continuous
  animations" budget on something decorative.
- **Gyroscope/device-orientation-driven tilt** — battery-expensive, rarely feels intentional,
  and unreliable across the range of Android devices you'll actually ship to.
- **Loading the 3D bundle on every page "just in case it's needed later"** — code-split hard,
  only the specific hero page pays the bundle-size and parse-time cost.
- **Skipping the static fallback because "WebGL basically always works now"** — it doesn't,
  reliably, inside a wrapped WebView under memory pressure, which is exactly your deployment
  target. Build the fallback path first, treat it as required, not optional polish.
