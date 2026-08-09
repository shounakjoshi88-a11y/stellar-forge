import { qrCells } from "../FakeQR.js";
import { TICKET_ART, INK, CARD, PAPER, ORANGE, INK_SOFT } from "./ticketContent.js";

/**
 * TicketStatic — the required non-WebGL fallback for the hero ticket object.
 *
 * It renders a flat illustration that looks like a screenshot of <Ticket3D>:
 * the same thick black frame, cream body, dashed tear line, decal content, and a
 * hard-offset black shadow (zero blur — matches every 2D shadow in the UI).
 *
 * Rendered behind a faux-3D perspective transform so it echoes the resting tilt
 * of the live object without any GPU cost. Shares qrCells with the 3D decal so
 * the QR block is pixel-identical between the two.
 */
export function TicketStatic({ className }: { className?: string }) {
  const cells = qrCells(TICKET_ART.qrSeed);

  // SVG coordinate space mirrors the canvas texture (800x500).
  const W = 400;
  const H = 250;
  const stubX = 305; // tear boundary
  const stubCX = (stubX + W) / 2;

  return (
    <div className={`flex items-center justify-end pr-8 lg:pr-20 h-full w-full ${className ?? ""}`}>
      <div className="w-full max-w-md lg:max-w-xl aspect-[1.6/1]">
        <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        style={{ filter: "drop-shadow(8px 8px 0 #1c1813)" }}
        role="img"
        aria-label="Tech Innovation Summit admission ticket"
      >
        {/* Cream body */}
        <rect x="3" y="3" width={W - 6} height={H - 6} rx="4" ry="4" fill={CARD} />

        {/* Dashed tear line */}
        <line
          x1={stubX}
          y1="6"
          x2={stubX}
          y2={H - 6}
          stroke={INK}
          strokeWidth="2.5"
          strokeDasharray="8 7"
        />

        {/* Perforation holes at the tear line ends */}
        <circle cx={stubX} cy="7" r="4" fill={PAPER} />
        <circle cx={stubX} cy={H - 7} r="4" fill={PAPER} />

        {/* Top mono label */}
        <text x="23" y="38" fontFamily="IBM Plex Mono, monospace" fontWeight="700" fontSize="15" fill={ORANGE}>
          {TICKET_ART.topLabel}
        </text>

        {/* Title lines */}
        <text x="23" y="95" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="32" fill={INK}>
          {TICKET_ART.titleLines[0]}
        </text>
        <text x="23" y="132" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="32" fill={INK}>
          {TICKET_ART.titleLines[1]}
        </text>
        <text x="23" y="169" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="32" fill={INK}>
          {TICKET_ART.titleLines[2]}
        </text>

        {/* Meta lines */}
        <text x="23" y="216" fontFamily="IBM Plex Mono, monospace" fontSize="13.5" fill={INK_SOFT}>
          {TICKET_ART.date}
        </text>
        <text x="23" y="235" fontFamily="IBM Plex Mono, monospace" fontSize="13.5" fill={INK_SOFT}>
          {TICKET_ART.location}
        </text>

        {/* Stub: rotated "TEAR HERE" */}
        <text
          x={stubCX}
          y="68"
          fontFamily="IBM Plex Mono, monospace"
          fontWeight="700"
          fontSize="16"
          fill={ORANGE}
          textAnchor="middle"
          transform={`rotate(-90 ${stubCX} 68)`}
        >
          {TICKET_ART.tearLabel}
        </text>

        {/* Stub: QR block */}
        <g transform={`translate(${stubCX - 32.5} 118)`}>
          {cells.map((dark, i) => {
            const x = (i % 25) * 2.6;
            const y = Math.floor(i / 25) * 2.6;
            return dark ? <rect key={i} x={x} y={y} width="2.6" height="2.6" fill={INK} /> : null;
          })}
        </g>

        {/* Stub: NO-001 */}
        <text
          x={stubCX}
          y="236"
          fontFamily="IBM Plex Mono, monospace"
          fontWeight="700"
          fontSize="14"
          fill={INK}
          textAnchor="middle"
        >
          {TICKET_ART.stubNo}
        </text>

        {/* Thick black frame on top (the neubrutalist border — same as the 3D Edges) */}
        <rect
          x="3"
          y="3"
          width={W - 6}
          height={H - 6}
          rx="4"
          ry="4"
          fill="none"
          stroke={INK}
          strokeWidth="6"
        />
      </svg>
      </div>
    </div>
  );
}