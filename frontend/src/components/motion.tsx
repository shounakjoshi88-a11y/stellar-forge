import { motion, useReducedMotion, useMotionValue, animate } from "motion/react";
import type { ReactNode, MouseEvent } from "react";
import { useEffect, useState } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery.js";

/** Tween a number change (count-up/down) — transform/opacity only, reduced-motion aware. */
export function CountUp({
  value,
  duration = 0.6,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: "easeOut" });
    const unsub = mv.on("change", (v) => setDisplay(Math.round(v)));
    return () => {
      controls.stop();
      unsub();
    };
  }, [value, reduce, duration, mv]);

  return <span className={className}>{display}</span>;
}

/** Reveal on scroll-into-view — opacity + translateY only. Pass delay to stagger. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: reduce ? 0 : 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Ink-stamp entrance: overshooting snap, never a smooth ease. */
export function StampIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={className}
      initial={{ scale: 1.15, rotate: -3, opacity: 0 }}
      animate={{ scale: 1, rotate: -5, opacity: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", bounce: 0.35, duration: 0.6, delay }
      }
      style={{ display: "inline-block" }}
    >
      {children}
    </motion.span>
  );
}

/** Desktop-only CTA: nudges a few px toward the cursor. No-op on touch. */
export function MagneticButton({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const reduce = useReducedMotion();
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (!finePointer || reduce) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / 6;
    const y = (e.clientY - rect.top - rect.height / 2) / 6;
    setOffset({ x, y });
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

/** Ticket motif hover: dashed punch-hole ring appears in a corner (desktop).
 *  Touch gets a quick scale-down on press via CSS. */
export function TicketPunch({
  children,
  className,
  corner = "top-right",
}: {
  children: ReactNode;
  className?: string;
  corner?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}) {
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  if (!finePointer) return <div className={`ticket-punch ${className ?? ""}`}>{children}</div>;

  const cornerClass: Record<string, string> = {
    "top-right": "top-3 right-3",
    "top-left": "top-3 left-3",
    "bottom-right": "bottom-3 right-3",
    "bottom-left": "bottom-3 left-3",
  };

  return (
    <div className={`ticket-punch relative ${className ?? ""}`}>
      {children}
      <motion.span
        aria-hidden
        initial={{ opacity: 0, scale: 0.6 }}
        whileHover={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        className={`absolute ${cornerClass[corner]} w-7 h-7 rounded-full border-2 border-dashed border-orange pointer-events-none`}
      />
    </div>
  );
}