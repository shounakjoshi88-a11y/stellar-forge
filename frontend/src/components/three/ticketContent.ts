// Single source of truth for the hero ticket stub art. Both the 3D decal texture
// (canvas) and the static SVG fallback draw from this — they stay pixel-identical.

export const TICKET_ART = {
  // Top mono label (orange, like the 2D hero "ADMIT ONE · TECH")
  topLabel: "ADMIT ONE · TECH",
  // Display-type title, uppercase (the .display class upper-cases in CSS)
  titleLines: ["TECH", "INNOVATION", "SUMMIT"],
  // Mono meta lines (ink-soft)
  date: "TUE · SEP 15 2026",
  location: "CONVENTION CENTER · HALL A",
  // Stub side
  tearLabel: "TEAR HERE",
  stubNo: "NO-001",
  qrSeed: "TECH-SUMMIT-2026",
  // Bottom strip
  bottomLabel: "SCAN AT DOOR · NO REFUNDS · BRING ID",
} as const;

// Exact brand palette — no new hues for "depth".
export const INK = "#1c1813";
export const CARD = "#fffdf6";
export const PAPER = "#f4efe4";
export const ORANGE = "#ff4d00";
export const INK_SOFT = "#6f6757";

export const MONO_STACK = '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace';
export const DISPLAY_STACK = '"Bricolage Grotesque", "Arial Black", "Arial Bold", sans-serif';
