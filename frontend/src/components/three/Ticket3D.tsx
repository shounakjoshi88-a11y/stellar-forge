import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { useThree, useFrame, type ThreeEvent } from "@react-three/fiber";
import gsap from "gsap";
import { qrCells } from "../FakeQR.js";
import {
  playPaperTear,
  playPaperTap,
  playPaperSnapBack,
  stopPaperTear,
  type TearAudioController,
} from "../../lib/paperSounds.js";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import {
  TICKET_ART,
  INK,
  CARD,
  PAPER,
  ORANGE,
  INK_SOFT,
  MONO_STACK,
  DISPLAY_STACK,
} from "./ticketContent.js";

const DECAL_W = 800;
const DECAL_H = 500;
const STUB_X = 610;

// 3D layout
const TICKET_W = 1.6;
const TEAR_LINE_X = -TICKET_W / 2 + (STUB_X / DECAL_W) * TICKET_W;
const MAIN_W = TEAR_LINE_X - -TICKET_W / 2;
const STUB_W = TICKET_W / 2 - TEAR_LINE_X;
const MAIN_CX = -TICKET_W / 2 + MAIN_W / 2;
const STUB_CX = TEAR_LINE_X + STUB_W / 2;
const STUB_LOCAL_CX = STUB_CX - TEAR_LINE_X;

const BODY_H = 0.93;
const BODY_DEPTH = 0.03;
const MAIN_RADIUS = 0.014;
const STRIP_RADIUS = 0.012;
const Z = 0.016;

const SHADOW = { x: 0.16, y: -0.15, z: -0.05 };

function cropTexture(src: HTMLCanvasElement, x: number, y: number, w: number, h: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d context unavailable");
  g.drawImage(src, x, y, w, h, 0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

const STRIPS = 4;
const STRIP_H = BODY_H / STRIPS;

function makeTicketTextures(): {
  main: THREE.CanvasTexture;
  strips: THREE.CanvasTexture[];
} {
  const c = document.createElement("canvas");
  c.width = DECAL_W;
  c.height = DECAL_H;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d context unavailable");

  g.fillStyle = CARD;
  g.fillRect(0, 0, DECAL_W, DECAL_H);

  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.strokeRect(4, 4, DECAL_W - 8, DECAL_H - 8);

  const mono = (size: number, weight = 600) => `${weight} ${size}px ${MONO_STACK}`;
  const display = (size: number) => `800 ${size}px ${DISPLAY_STACK}`;

  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.setLineDash([16, 14]);
  g.beginPath();
  g.moveTo(STUB_X, 6);
  g.lineTo(STUB_X, DECAL_H - 6);
  g.stroke();
  g.setLineDash([]);

  for (const y of [14, DECAL_H - 14]) {
    g.fillStyle = PAPER;
    g.beginPath();
    g.arc(STUB_X, y, 10, 0, Math.PI * 2);
    g.fill();
  }

  // Reinforced grommet at the tear-line midpoint
  const grommetY = DECAL_H / 2;
  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(STUB_X, grommetY, 15, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = PAPER;
  g.beginPath();
  g.arc(STUB_X, grommetY, 7, 0, Math.PI * 2);
  g.fill();

  const stubCX = (STUB_X + DECAL_W) / 2;

  g.fillStyle = ORANGE;
  g.font = mono(30, 700);
  g.fillText(TICKET_ART.topLabel, 46, 74);

  g.fillStyle = INK;
  let ty = 178;
  for (const line of TICKET_ART.titleLines) {
    g.font = display(64);
    g.fillText(line, 46, ty);
    ty += 74;
  }

  g.fillStyle = INK_SOFT;
  g.font = mono(27);
  g.fillText(TICKET_ART.date, 46, 432);
  g.fillText(TICKET_ART.location, 46, 470);

  g.save();
  g.translate(stubCX, 128);
  g.rotate(-Math.PI / 2);
  g.textAlign = "center";
  g.fillStyle = ORANGE;
  g.font = mono(32, 700);
  g.fillText(TICKET_ART.tearLabel, 0, 0);
  g.restore();

  const cells = qrCells(TICKET_ART.qrSeed);
  const cell = 5.2;
  const side = cell * 25;
  const qx0 = stubCX - side / 2;
  const qy0 = 226;
  for (let y = 0; y < 25; y++) {
    for (let x = 0; x < 25; x++) {
      if (!cells[y * 25 + x]) continue;
      g.fillStyle = INK;
      g.fillRect(qx0 + x * cell, qy0 + y * cell, cell, cell);
    }
  }

  g.textAlign = "center";
  g.fillStyle = INK;
  g.font = mono(28, 700);
  g.fillText(TICKET_ART.stubNo, stubCX, 466);

  return {
    main: cropTexture(c, 0, 0, STUB_X, DECAL_H),
    strips: Array.from({ length: STRIPS }, (_, i) => {
      const eh = DECAL_H / STRIPS;
      return cropTexture(c, STUB_X, DECAL_H - (i + 1) * eh, DECAL_W - STUB_X, eh);
    }),
  };
}

/** Resting pose — a small fixed tilt, echoing the 2D sticker-rotation device. */
const REST = { x: 0.04, y: -0.18, z: 0.02 };
const MAX_TILT = 0.12;

const TEAR_ROTATIONS = [0, 0.3, 0.43, 0.58];
const TEAR_DIAGS = [0, -0.04, -0.08, -0.12];
const SPRING_BOUNCE = 0.05;
const TORN_LEAN_Z = -0.07;
const REST_LEAN_Z = 0;

// ---------------------------------------------------------------------------
// THE FALLING SCISSOR — scroll-driven hero moment.
//
// STORY (falling_scissor_story/falling-scissor-story.md):
//  1. A scissor hangs from a thread SOMEWHERE ABOVE the page — out of frame.
//  2. As the visitor scrolls, it FALLS INTO VIEW — not instantly, but the
//     way something on a string actually falls, gathering speed.
//  3. It reaches the ticket's perforation and starts to cut, blades tracking
//     along the dotted tear-line, the ticket separating underneath.
//  4. Mid-cut the thread runs out of slack. The fall STOPS DEAD — a real
//     jerk. The arrested momentum goes SIDEWAYS: the scissor swings out on
//     its thread like a pendulum, arcs back, swings again a little smaller,
//     again smaller still, and settles into a faint, slowing sway — hanging
//     there, mid-air, HALF A CUT BEHIND.
//  5. Scrolling back up REVERSES: the thread draws TAUT again and pulls the
//     scissor back up out of frame, the perforation closing behind it.
//
// Scroll progress (0..1) maps to the phases:
//   0.00-0.30  FALL:   scissor drops in from ABOVE the frame, gathering
//                      speed (cubic ease-in), thread pays out slack.
//   0.30-0.60  CUT:    blades bite the tear line, track top→midpoint at
//                      increasing speed. Stub peels ~half. Thread slack
//                      drains away until it is almost taut.
//   0.60-0.68  JERK:   slack GONE — thready TOUT. Sudden stop, a real snap:
//                      small upward yank, jolt, blades jam, snap FX.
//   0.68-1.00  SWING:  real-time pendulum on the taut thread from the anchor
//                      — big arc, then smaller, smaller, faint sway; stub
//                      stays HALF CUT. Scroll-back reverses all of it.
// ---------------------------------------------------------------------------

// The ticket sits in the lower-center of the frame. The scissor starts ABOVE
// the visible area — "somewhere above the page", as the story puts it — and
// falls into view as the visitor scrolls.

// Position offset to sit the ticket cleanly on the right side of the hero section (clear of left text)
const TICKET_OFFSET_X = 2.1;

// Scissor rest position — high above top of ticket inside 3D group (100% out of frame at rest)
const SCISSOR_REST_Y = 2.40;
// Thread anchor — where the thread is tied high above inside 3D group
const THREAD_ANCHOR_Y = 3.40;
// Perforation top (blades first bite the ticket's tear line here)
const PERF_TOP_Y = 0.465;
// Perforation midpoint (the grommet — thread runs out here, mid-cut)
const PERF_MID_Y = 0.04;
// Thread length once fully taut: anchor to the scissor handle-end at the
// midpoint of the cut. The handle-end sits at PERF_MID_Y + SCISSOR_HANDLE_OFFSET.
const THREAD_TAUT_LENGTH = THREAD_ANCHOR_Y - (PERF_MID_Y + SCISSOR_HANDLE_OFFSET);

// The scissor's handle-end offset above its origin (where the thread attaches).
const SCISSOR_HANDLE_OFFSET = 0.12;

// Current scroll-driven phase boundaries (progress 0..1)
const P_FALL_END = 0.22; //  0.00–0.22 falling smoothly into view from above frame, gathering speed
const P_CUT_END = 0.65;  //  0.22–0.65 cutting top→midpoint, thread slack runs out deliberately
const P_JERK_END = 0.75; //  0.65–0.75 thread runs out — dead stop, the jerk
//  0.75–1.00 pendulum continues on the taut thread, decaying into a sway

// Blade spread values
const BLADE_REST = { b1: 0.5, b2: -0.5 };
const BLADE_OPEN = { b1: 1.0, b2: -1.0 };
const BLADE_SNIP = { b1: 0.2, b2: -0.2 };
const BLADE_JAM = { b1: 0.08, b2: -0.08 };

// Blade geometry — sized relative to the ticket (ticket height = 0.93)
const BLADES = { tip: 0.5, shaft: 0.045 };

function makeBladeShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.04, 0.02);
  s.lineTo(0.04, 0.02);
  s.lineTo(0.012, -0.48);
  s.lineTo(-0.008, -0.50);
  s.closePath();
  return s;
}

function makeBladeSpineShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.035, 0.02);
  s.lineTo(0.01, 0.02);
  s.lineTo(0.002, -0.48);
  s.closePath();
  return s;
}

function StripChain({
  index,
  refs,
  strips,
  depth,
}: {
  index: number;
  refs: MutableRefObject<(THREE.Group | null)[]>;
  strips: THREE.CanvasTexture[];
  depth: number;
}) {
  return (
    <group ref={(el) => { refs.current[index] = el; }}>
      <RoundedBox args={[STUB_W, STRIP_H + 0.02, BODY_DEPTH]} radius={STRIP_RADIUS} position={[STUB_LOCAL_CX, STRIP_H / 2, 0]}>
        <meshBasicMaterial color={CARD} toneMapped={false} side={THREE.DoubleSide} />
      </RoundedBox>
      <mesh position={[STUB_LOCAL_CX, STRIP_H / 2, Z]}>
        <planeGeometry args={[STUB_W, STRIP_H]} />
        <meshBasicMaterial map={strips[index]} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {depth > 0 && (
        <group position={[0, STRIP_H, 0]}>
          <StripChain index={index + 1} refs={refs} strips={strips} depth={depth - 1} />
        </group>
      )}
    </group>
  );
}

// Cartoon FX
const PUFFS = 6;
const LINES = 8;

const PUFF_OFFSETS = [
  { x: 0, y: 0, ang: 0 },
  { x: 0.09, y: 0.05, ang: 0.6 },
  { x: -0.08, y: 0.06, ang: -0.5 },
  { x: 0.06, y: -0.07, ang: 2.8 },
  { x: -0.07, y: -0.06, ang: 3.6 },
  { x: 0.1, y: -0.03, ang: 1.2 },
];
const LINE_ANGLES = [-0.9, -0.5, -0.18, 0.12, 0.4, 0.75, 1.15, 1.6];
const LINE_OFFS = [
  { x: 0, y: 0.02 },
  { x: 0.02, y: 0.05 },
  { x: 0.04, y: 0.02 },
  { x: 0.03, y: -0.04 },
  { x: 0, y: -0.06 },
  { x: -0.03, y: -0.03 },
  { x: -0.04, y: 0.03 },
  { x: -0.02, y: 0.06 },
];

function makePuffTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d context unavailable");
  const col = new THREE.Color(color);
  const rgba = (a: number) =>
    `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${a})`;
  const rad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  rad.addColorStop(0, rgba(0.95));
  rad.addColorStop(0.55, rgba(0.5));
  rad.addColorStop(1, rgba(0));
  g.fillStyle = rad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRingTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d context unavailable");
  g.strokeStyle = color;
  g.lineWidth = 10;
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStarShape(outer: number, inner: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

export interface Ticket3DHandle {
  setScrollProgress: (p: number) => void;
}

export function Ticket3D({ scrollProgressRef }: { scrollProgressRef: React.RefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  const stripRefs = useRef<(THREE.Group | null)[]>(Array(STRIPS).fill(null));
  const shadowRef = useRef<THREE.Mesh>(null);
  const stubGroupRef = useRef<THREE.Group>(null);
  const tearTl = useRef<gsap.core.Timeline | null>(null);
  const tearAudioRef = useRef<TearAudioController | null>(null);

  // Scissor refs
  const scissorsRef = useRef<THREE.Group>(null);
  const blade1Ref = useRef<THREE.Group>(null);
  const blade2Ref = useRef<THREE.Group>(null);
  const threadRef = useRef<THREE.Mesh>(null);
  const threadKneeRef = useRef<THREE.Mesh>(null);

  // Cartoon FX refs
  const puffRefs = useRef<(THREE.Mesh | null)[]>(Array(PUFFS).fill(null));
  const lineRefs = useRef<(THREE.Mesh | null)[]>(Array(LINES).fill(null));
  const ringRef = useRef<THREE.Mesh>(null);
  const starRef = useRef<THREE.Mesh>(null);

  const invalidate = useThree((s) => s.invalidate);
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const torn = useRef(false);

  // Scroll progress (0..1) — the single driver for the entire animation
  // (passed from parent, but also kept locally for frame checks)
  const localProgress = useRef(0);

  useFrame((state) => {
    if (gsap.globalTimeline.isActive()) invalidate();
    // Drive animation from scroll progress + clock time
    const p = scrollProgressRef.current;
    const timeSec = state.clock.getElapsedTime();
    if (Math.abs(p - localProgress.current) > 0.0001 || p > 0.001) {
      localProgress.current = p;
      updateFromScroll(p, timeSec);
    }
    // Keep frame loop invalidating whenever scissor is active (p > 0.001) so continuous sway renders smoothly
    if (p > 0.001) {
      invalidate();
    }
  });

  const { main, strips } = useMemo(() => makeTicketTextures(), []);
  const bladeGeom = useMemo(() => new THREE.ShapeGeometry(makeBladeShape()), []);
  const pinGeom = useMemo(() => new THREE.CylinderGeometry(0.014, 0.014, 0.18, 12), []);
  const threadGeom = useMemo(() => new THREE.CylinderGeometry(0.006, 0.006, 1, 8), []);
  const puffTex = useMemo(() => makePuffTexture(CARD), []);
  const ringTex = useMemo(() => makeRingTexture(INK), []);
  const puffGeom = useMemo(() => new THREE.CircleGeometry(0.085, 24), []);
  const lineGeom = useMemo(() => new THREE.PlaneGeometry(0.028, 0.42), []);
  const ringGeom = useMemo(() => new THREE.CircleGeometry(0.34, 48), []);
  const starGeom = useMemo(() => new THREE.ShapeGeometry(makeStarShape(0.12, 0.05)), []);

  const puffMats = useMemo(
    () =>
      Array.from(
        { length: PUFFS },
        () =>
          new THREE.MeshBasicMaterial({
            map: puffTex,
            transparent: true,
            opacity: 0,
            toneMapped: false,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
      ),
    [puffTex]
  );
  const lineMats = useMemo(
    () =>
      Array.from(
        { length: LINES },
        () =>
          new THREE.MeshBasicMaterial({
            color: INK,
            transparent: true,
            opacity: 0,
            toneMapped: false,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
      ),
    []
  );
  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: ringTex,
        transparent: true,
        opacity: 0,
        toneMapped: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [ringTex]
  );
  const starMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: INK,
        transparent: true,
        opacity: 0,
        toneMapped: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    []
  );

  // Thread material — bright red, unlit, always visible (depthTest off so it
  // never gets occluded by the scissor or ticket geometry)
  const threadMat = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: "#e2231a",
      toneMapped: false,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    }),
    []
  );

  useEffect(() => () => {
    tearTl.current?.kill();
    tearTl.current = null;
    stopPaperTear();
    tearAudioRef.current = null;
    gsap.globalTimeline.getChildren().forEach((t) => {
      if ((t.targets?.() ?? []).some((o: unknown) => o === puffRefs.current[0] || o === ringRef.current || o === starRef.current)) {
        t.kill();
      }
    });
    main.dispose();
    strips.forEach((t) => t.dispose());
    bladeGeom.dispose();
    pinGeom.dispose();
    threadGeom.dispose();
    puffTex.dispose();
    ringTex.dispose();
    puffGeom.dispose();
    lineGeom.dispose();
    ringGeom.dispose();
    starGeom.dispose();
    puffMats.forEach((m) => m.dispose());
    lineMats.forEach((m) => m.dispose());
    ringMat.dispose();
    starMat.dispose();
    threadMat.dispose();
  }, [main, strips, bladeGeom, pinGeom, threadGeom, puffTex, ringTex, puffGeom, lineGeom, ringGeom, starGeom, puffMats, lineMats, ringMat, starMat, threadMat]);

  // Load-in animation
  useEffect(() => {
    const g = groupRef.current;
    const sh = shadowRef.current;
    if (!g) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        g.rotation,
        { x: 0.3, y: -0.9, z: 0.12 },
        { x: REST.x, y: REST.y, z: REST.z, duration: 1.05, ease: "back.out(1.4)", onUpdate: invalidate }
      );
      gsap.fromTo(
        g.position,
        { y: 0.34 },
        { y: 0, duration: 0.85, ease: "power3.out", onUpdate: invalidate }
      );
      gsap.fromTo(
        g.scale,
        { x: 1.22, y: 0.78, z: 1.22 },
        { x: 1, y: 1, z: 1, duration: 0.9, ease: "elastic.out(1, 0.55)", onUpdate: invalidate }
      );
      if (sh) {
        gsap.fromTo(sh.position, { z: 0.1 }, { z: SHADOW.z, duration: 0.8, delay: 0.12, ease: "power2.out", onUpdate: invalidate });
      }
    });
    return () => ctx.revert();
  }, [invalidate]);

  // Ticket remains stationary and grounded at rest (Skill rule: no continuous drift/floating)

  // Helper: position a thread segment mesh between two 3D points.
  // The thread is a thin cylinder; we place it at the midpoint, rotate it to
  // span from (ax,ay) to (bx,by), and scale its length to match.
  // renderOrder ensures it draws on top of everything (depthTest is off).
  const updateSegment = (
    mesh: THREE.Mesh | null,
    ax: number, ay: number, bx: number, by: number, z: number
  ) => {
    if (!mesh) return;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dx, -dy);
    mesh.visible = len > 0.003;
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, z);
    mesh.rotation.set(0, 0, angle);
    mesh.scale.set(1, Math.max(0.003, len), 1);
    mesh.renderOrder = 999;
  };

  // Scissor initial state — hanging from thread above ticket.
  // The thread ties to the HANDLE END of the scissor (offset above its origin),
  // so the scissor hangs naturally with blades pointing down. Thread is slack
  // at rest (coiled above), pays out as the scissor falls.
  useEffect(() => {
    const s = scissorsRef.current;
    const b1 = blade1Ref.current;
    const b2 = blade2Ref.current;
    if (s) {
      s.visible = true;
      s.position.set(TEAR_LINE_X, SCISSOR_REST_Y, 0.35);
      s.scale.set(0.85, 0.85, 0.85);
      s.rotation.set(0, 0, 0);
    }
    if (b1) { b1.rotation.z = BLADE_REST.b1; }
    if (b2) { b2.rotation.z = BLADE_REST.b2; }
    // Position thread from anchor to handle-end
    drawThread(TEAR_LINE_X, THREAD_ANCHOR_Y, TEAR_LINE_X, SCISSOR_REST_Y + SCISSOR_HANDLE_OFFSET, 0.35, 0.05);
    invalidate();
  }, [invalidate]);

// ---------------------------------------------------------------------------
  // THE MAIN SCROLL-DRIVEN UPDATE — called every frame with progress 0..1
  //
  // The STORY, faithfully:
  //   1. The scissor hangs ABOVE the page on a red THREAD (out of frame).
  //   2. As the visitor scrolls it FALLS INTO VIEW, gathering speed; the
  //      thread slaiques from the distant anchor.
  //   3. At the perforation it starts to CUT — blades track the dotted
  //      tear-line downward while the stub parts underneath. The paying-out
  //      thread gets shorter and shorter... it is about to run out.
  //   4. MID-CUT the slack is GONE. The fall stops DEAD — a real jerk, a
  //      taut-string stop: a snap up, jolt. The thread hangs straight.
  //   5. The arrested momentum goes sideways — the scissor SWINGS on its
  //      thread like a pendulum. Arcs out, swings back, a little smaller,
  //      smaller still, then faint sway. It hangs there, mid-air, half a
  //      cut behind.
  //   6. Scrolling back up reverses everything — the thread tautens and
  //      draws the scissor back up out of the frame; the cut closes.
  // ---------------------------------------------------------------------------

  const prevProgressRef = useRef(0);

  // Draw the thread from the fixed anchor (A) down to the scissor handle-end
  // (B). "sag" is the droop of the slack thread (0 = straight/taut). The droop
  // falls to the LEFT, so the slack visibly bows out of the frame.
  const drawThread = (
    ax: number, ay: number, bx: number, by: number, z: number, sag: number
  ) => {
    const tA = threadRef.current;
    const tB = threadKneeRef.current;
    if (!tA || !tB) return;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-4;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const kx = mx + (dy / len) * sag;
    const ky = my - (dx / len) * sag;
    updateSegment(tA, ax, ay, kx, ky, z);
    updateSegment(tB, kx, ky, bx, by, z);
    tA.renderOrder = 999;
    tB.renderOrder = 999;
  };

  /** Whether this frame is scrolling back UP the page (the reverse moment). */
  const isRewinding = (p: number) => {
    const rw = p < prevProgressRef.current - 0.0005;
    prevProgressRef.current = p;
    return rw;
  };

  const updateFromScroll = (p: number, timeSec = 0) => {
    const s = scissorsRef.current;
    const b1 = blade1Ref.current;
    const b2 = blade2Ref.current;
    const stub = stubGroupRef.current;
    if (!s || !b1 || !b2 || !stub) return;

    localProgress.current = p;
    const rewinding = isRewinding(p);

    const restStub = () => {
      for (let i = 1; i < STRIPS; i++) {
        const ref = stripRefs.current[i];
        if (ref) { ref.rotation.x = 0; ref.rotation.z = 0; }
      }
      stub.rotation.set(0, 0, 0);
      stub.position.set(TEAR_LINE_X, 0, 0);
      torn.current = false;
      if (tearAudioRef.current) {
        stopPaperTear();
        tearAudioRef.current = null;
      }
    };

    if (p <= 0.002) {
      // === REST — 100% hidden out of frame above the page ===
      const sy = SCISSOR_REST_Y;
      s.visible = false;
      if (threadRef.current) threadRef.current.visible = false;
      if (threadKneeRef.current) threadKneeRef.current.visible = false;
      s.position.set(TEAR_LINE_X, sy, 0.02);
      s.rotation.set(0, 0, 0);
      s.scale.set(0.85, 0.85, 0.85);
      b1.rotation.z = BLADE_REST.b1;
      b2.rotation.z = BLADE_REST.b2;
      restStub();
      invalidate();
      return;
    }

    s.visible = true;

    if (p < P_FALL_END) {
      // === PHASE 1: THE FALL — drops into view from high above the frame in 3D
      const t = (p - 0.002) / (P_FALL_END - 0.002); // 0→1
      const ease = t * t * t;
      const sy = SCISSOR_REST_Y + (PERF_TOP_Y - SCISSOR_REST_Y) * ease;
      s.position.set(TEAR_LINE_X, sy, 0.02);
      s.rotation.set(0, 0, 0);
      s.scale.set(0.85, 0.85, 0.85);

      // Gentle flutter on the descent
      const flutter = Math.sin(t * Math.PI * 3) * 0.12;
      b1.rotation.z = BLADE_REST.b1 + flutter;
      b2.rotation.z = BLADE_REST.b2 - flutter;

      // Thread pays out — slack, sagging to the left in 3D
      const sag = rewinding ? 0 : 0.12 * Math.sin(t * Math.PI * 0.8);
      drawThread(TEAR_LINE_X, THREAD_ANCHOR_Y, TEAR_LINE_X, sy + SCISSOR_HANDLE_OFFSET, 0.02, sag);

      restStub();
      invalidate();
      return;
    }

    if (p < P_CUT_END) {
      // === PHASE 2: THE CUT — blades bite through 3D paper plane and track tear-line
      const t = (p - P_FALL_END) / (P_CUT_END - P_FALL_END); // 0→1

      if (!tearAudioRef.current && !reducedMotion) {
        tearAudioRef.current = playPaperTear();
      }
      if (tearAudioRef.current) {
        tearAudioRef.current.update(t);
      }

      const y = PERF_TOP_Y + (PERF_MID_Y - PERF_TOP_Y) * t;
      s.position.set(TEAR_LINE_X, y, 0.02);
      s.rotation.set(0, 0, 0);
      s.scale.set(0.85, 0.85, 0.85);

      // Blades chatter rhythmically as they bite the paper
      const cutCycle = Math.sin(t * Math.PI * 4);
      const bladeBase = BLADE_SNIP.b1 + (BLADE_OPEN.b1 - BLADE_SNIP.b1) * (0.5 + 0.5 * cutCycle);
      b1.rotation.z = bladeBase;
      b2.rotation.z = -bladeBase;

      // Thread — slack drains away
      const sag = rewinding ? 0 : 0.09 * Math.pow(1 - t, 1.6);
      drawThread(TEAR_LINE_X, THREAD_ANCHOR_Y, TEAR_LINE_X, y + SCISSOR_HANDLE_OFFSET, 0.02, sag);

      // Stub parts beneath the blades in 3D
      const peelAmount = t * 0.5;
      for (let i = 1; i < STRIPS; i++) {
        const ref = stripRefs.current[i];
        if (ref) {
          ref.rotation.x = TEAR_ROTATIONS[i] * peelAmount;
          ref.rotation.z = TEAR_DIAGS[i] * peelAmount;
        }
      }
      stub.rotation.set(0, 0, TORN_LEAN_Z * t * 0.3);
      stub.position.set(TEAR_LINE_X, 0, 0.02 * t);

      torn.current = true;
      invalidate();
      return;
    }

    if (p < P_JERK_END) {
      // === PHASE 3: THE JERK — thread yanks taut in 3D mid-cut
      const t = (p - P_CUT_END) / (P_JERK_END - P_CUT_END); // 0→1

      if (tearAudioRef.current) {
        stopPaperTear();
        tearAudioRef.current = null;
      }
      if (t < 0.05 && !reducedMotion) {
        void import("../../lib/paperSounds.js").then((m) => m.playMetalSnip());
      }

      const whipY = Math.sin(Math.min(1, t * 2.5) * Math.PI) * 0.05 * (1 - t);
      s.position.set(TEAR_LINE_X, PERF_MID_Y + whipY, 0.02);

      const jolt = Math.sin(Math.min(1, t * 3.0) * Math.PI) * 0.12 * (1 - t);
      s.rotation.set(0, 0, jolt);

      const jamVib = Math.sin(t * Math.PI * 12) * 0.02 * (1 - t);
      b1.rotation.z = BLADE_JAM.b1 + jamVib;
      b2.rotation.z = BLADE_JAM.b2 - jamVib;

      drawThread(TEAR_LINE_X, THREAD_ANCHOR_Y, TEAR_LINE_X, PERF_MID_Y + SCISSOR_HANDLE_OFFSET, 0.02, 0);

      const peelAmount = 0.5 + t * 0.06;
      for (let i = 1; i < STRIPS; i++) {
        const ref = stripRefs.current[i];
        if (ref) {
          ref.rotation.x = TEAR_ROTATIONS[i] * peelAmount;
          ref.rotation.z = TEAR_DIAGS[i] * peelAmount;
        }
      }
      stub.rotation.set(0, 0, TORN_LEAN_Z * (0.3 + t * 0.12));
      stub.position.set(TEAR_LINE_X, 0, 0.03 * (0.5 + t));

      torn.current = true;
      invalidate();
      return;
    }

    // === PHASE 4: 3D DAMPED PENDULUM & LIVE AMBIENT SWAY ===
    const t = (p - P_JERK_END) / (1 - P_JERK_END); // 0→1

    const scrollTheta = 0.45 * Math.exp(-2.2 * t) * Math.sin(t * 2.4 * Math.PI);
    const ambientSway = 0.025 * Math.sin(timeSec * 2.2);
    const theta = scrollTheta + ambientSway;

    const hx = TEAR_LINE_X + THREAD_TAUT_LENGTH * Math.sin(theta);
    const hy = THREAD_ANCHOR_Y - THREAD_TAUT_LENGTH * Math.cos(theta);

    const sx = hx - SCISSOR_HANDLE_OFFSET * Math.sin(theta);
    const sy = hy + SCISSOR_HANDLE_OFFSET * Math.cos(theta);
    s.position.set(sx, sy, 0.02);
    s.rotation.set(0, 0, theta);

    drawThread(TEAR_LINE_X, THREAD_ANCHOR_Y, hx, hy, 0.02, 0);

    const vib = Math.sin(timeSec * 6) * 0.008 * Math.exp(-2.2 * t);
    b1.rotation.z = BLADE_JAM.b1 + vib;
    b2.rotation.z = BLADE_JAM.b2 - vib;

    const peelAmount = 0.56;
    for (let i = 1; i < STRIPS; i++) {
      const ref = stripRefs.current[i];
      if (ref) {
        ref.rotation.x = TEAR_ROTATIONS[i] * peelAmount;
        ref.rotation.z = TEAR_DIAGS[i] * peelAmount;
      }
    }
    stub.rotation.set(0, 0, TORN_LEAN_Z * 0.42);
    stub.position.set(TEAR_LINE_X, 0, 0.05);

    torn.current = true;
    invalidate();
  };

  // Nothing needed — useFrame drives updateFromScroll directly

  // Desktop cursor-proximity tilt
  const easeToRotation = (r: Partial<typeof REST>, duration = 0.3) => {
    const g = groupRef.current;
    if (!g) return;
    gsap.to(g.rotation, {
      x: r.x ?? g.rotation.x,
      y: r.y ?? g.rotation.y,
      z: r.z ?? g.rotation.z,
      duration,
      ease: "power2.out",
      overwrite: "auto",
      onUpdate: invalidate,
    });
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!finePointer) return;
    if (localProgress.current > 0.05) return; // no tilt during/after cut
    const canvas = e.nativeEvent.target as Element | null;
    const rect = canvas?.getBoundingClientRect?.();
    if (!rect || rect.width === 0) return;
    const nx = ((e.nativeEvent.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.nativeEvent.clientY - rect.top) / rect.height) * 2 - 1;
    easeToRotation({
      x: REST.x - ny * MAX_TILT,
      y: REST.y + nx * MAX_TILT,
      z: REST.z + nx * 0.04,
    }, 0.4);
    const g = groupRef.current;
    if (g) gsap.to(g.position, { y: 0.14, duration: 0.4, ease: "power2.out", overwrite: "auto", onUpdate: invalidate });
    if (shadowRef.current) gsap.to(shadowRef.current.position, { x: 0.05, y: -0.05, duration: 0.4, ease: "power2.out", overwrite: "auto", onUpdate: invalidate });
  };

  const onPointerLeave = () => {
    if (localProgress.current > 0.05) return;
    easeToRotation(REST, 0.6);
    const g = groupRef.current;
    if (g) gsap.to(g.position, { y: 0.06, duration: 0.6, ease: "power2.out", overwrite: "auto", onUpdate: invalidate });
    if (shadowRef.current) gsap.to(shadowRef.current.position, { x: SHADOW.x, y: SHADOW.y, duration: 0.6, ease: "power2.out", overwrite: "auto", onUpdate: invalidate });
  };

  // Click triggers a small bounce (fun interaction)
  const onPointerDown = () => {
    const g = groupRef.current;
    if (!g) return;
    gsap.fromTo(g.scale,
      { x: 0.97, y: 0.97, z: 0.97 },
      { x: 1, y: 1, z: 1, duration: 0.5, ease: "back.out(3)", onUpdate: invalidate }
    );
  };

  return (
    <group position={[TICKET_OFFSET_X, 0, 0]}>
      <group
        ref={groupRef}
        rotation={[REST.x, REST.y, REST.z]}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerLeave}
        onPointerDown={onPointerDown}
      >
        <RoundedBox ref={shadowRef} args={[TICKET_W, BODY_H, 0.01]} radius={0.004} position={[SHADOW.x, SHADOW.y, SHADOW.z]}>
          <meshBasicMaterial color={INK} toneMapped={false} />
        </RoundedBox>

        <RoundedBox args={[MAIN_W, BODY_H, BODY_DEPTH]} radius={MAIN_RADIUS} position={[MAIN_CX, 0, 0]}>
          <meshBasicMaterial color={CARD} toneMapped={false} />
        </RoundedBox>
        <mesh position={[MAIN_CX, 0, Z]}>
          <planeGeometry args={[MAIN_W, BODY_H]} />
          <meshBasicMaterial map={main} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>

        <group ref={stubGroupRef} position={[TEAR_LINE_X, 0, 0]}>
          <group position={[0, -BODY_H / 2, 0]}>
            <StripChain index={0} refs={stripRefs} strips={strips} depth={STRIPS - 1} />
          </group>
        </group>

        {puffMats.map((m, i) => (
          <mesh key={`puff-${i}`} ref={(el) => { puffRefs.current[i] = el; }} geometry={puffGeom} material={m} visible={false} />
        ))}
        {lineMats.map((m, i) => (
          <mesh key={`line-${i}`} ref={(el) => { lineRefs.current[i] = el; }} geometry={lineGeom} material={m} visible={false} />
        ))}
        {/* Thread — inside 3D group so it tilts and aligns with 3D ticket depth */}
        <mesh ref={threadRef} geometry={threadGeom} material={threadMat} visible={false} renderOrder={999} />
        <mesh ref={threadKneeRef} geometry={threadGeom} material={threadMat} visible={false} renderOrder={999} />

        {/* The Falling Scissor — High Detail 3D Crafted Shears straddling paper plane in Z */}
        <group
          ref={scissorsRef}
          visible={false}
          scale={0.85}
        >
          {/* Upper Blade (front of 3D paper plane) */}
          <group ref={blade1Ref} rotation={[0, 0, BLADE_REST.b1]}>
            <mesh geometry={bladeGeom} position={[0, 0, 0.016]}>
              <meshBasicMaterial color="#e2e8f0" toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.11, 0.016]}>
              <torusGeometry args={[0.045, 0.014, 12, 24]} />
              <meshBasicMaterial color={ORANGE} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.11, 0.016]}>
              <torusGeometry args={[0.032, 0.005, 8, 20]} />
              <meshBasicMaterial color="#1e293b" toneMapped={false} />
            </mesh>
          </group>

          {/* Lower Blade (behind 3D paper plane) */}
          <group ref={blade2Ref} rotation={[0, 0, BLADE_REST.b2]}>
            <mesh geometry={bladeGeom} position={[0, 0, -0.016]}>
              <meshBasicMaterial color="#cbd5e1" toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.11, -0.016]}>
              <torusGeometry args={[0.045, 0.014, 12, 24]} />
              <meshBasicMaterial color={ORANGE} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.11, -0.016]}>
              <torusGeometry args={[0.032, 0.005, 8, 20]} />
              <meshBasicMaterial color="#1e293b" toneMapped={false} />
            </mesh>
          </group>

          {/* Gold Pivot Screw Cap */}
          <mesh geometry={pinGeom} rotation={[Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color="#f59e0b" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.024]}>
            <cylinderGeometry args={[0.024, 0.024, 0.008, 16]} />
            <meshBasicMaterial color="#fbbf24" toneMapped={false} />
          </mesh>

          {/* Knot at handle top where thread attaches */}
          <mesh position={[0, 0.16, 0.01]} renderOrder={999}>
            <sphereGeometry args={[0.016, 12, 12]} />
            <meshBasicMaterial color="#ef4444" toneMapped={false} depthTest={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
