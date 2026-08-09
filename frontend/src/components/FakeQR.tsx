import { useMemo } from "react";

// Deterministic pseudo-random from a string seed (mulberry32).
function hashSeed(str: string): number {
  let h = 1779033703;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRID = 25;

/**
 * Deterministic QR-look cells for a seed (finders + seeded noise). Shared by the
 * DOM FakeQR and the canvas/SVG ticket art so every instance matches exactly.
 */
export function qrCells(seed: string, grid = GRID): boolean[] {
  const rnd = mulberry32(hashSeed(seed));
  const out: boolean[] = [];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      out.push(rnd() < 0.5);
    }
  }
  // Stamp the three finder patterns on top (7x7: outer ring dark, then
  // light margin, 3x3 center dark) so the noise reads as a QR at a glance.
  const finder = (fx: number, fy: number) => {
    for (let y = fy; y < fy + 7; y++) {
      for (let x = fx; x < fx + 7; x++) {
        if (x < 0 || y < 0 || x >= grid || y >= grid) continue;
        const ring = Math.max(Math.abs(x - (fx + 3)), Math.abs(y - (fy + 3)));
        out[y * grid + x] = ring === 3 || ring === 1;
      }
    }
  };
  finder(1, 1);
  finder(grid - 8, 1);
  finder(1, grid - 8);
  return out;
}

/**
 * FAKE QR — decorative only, NOT scannable. Looks like a real QR at a glance
 * (three finder squares + seeded noise) but encodes nothing. Used on ticket
 * stubs and mockups where a real code isn't needed; the gate scanners read
 * the real TicketQR component instead.
 */
export function FakeQR({ seed = "stellar-forge", className }: { seed?: string; className?: string }) {
  const cells = useMemo(() => qrCells(seed), [seed]);

  return (
    <div className={`inline-grid border-2 border-ink bg-card ${className ?? ""}`} style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }} aria-hidden="true">
      {cells.map((dark, i) => (
        <span key={i} className={dark ? "bg-ink" : "bg-card"} style={{ aspectRatio: "1" }} />
      ))}
    </div>
  );
}
