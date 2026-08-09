import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";

/**
 * Scene3D — the ONLY place a WebGL <Canvas> is ever allowed to mount in this app.
 *
 * Skill (3d-elements-skill.md) mandates: exactly one Canvas mounted at a time,
 * ever. This component enforces it with a module-level singleton counter, and
 * encapsulates the rest of the non-negotiables:
 *
 *  - IntersectionObserver-gated mount (unmounts, not hides, when off-screen —
 *    a scrolled-out WebGL context is still running its render loop otherwise)
 *  - `frameloop="demand"` — nothing renders when nothing is changing
 *  - `dpr={[1, 1.5]}` — never let a phone's 3x DPR pay for a hero object
 *  - `<PerformanceMonitor>` with a quality step-down (drops pixel ratio)
 *  - `gl={{ powerPreference: "low-power", antialias: false }}` — decorative hero,
 *    not a game; MSAA is pay-with-no-visible-benefit at this size
 *  - reduced-motion → static fallback, never even attempts to mount WebGL
 *  - WebGL context loss (common under Android WebView memory pressure) →
 *    static fallback, not a dead black box
 */

const isDev = process.env.NODE_ENV !== "production";

// Module-level singleton: if a second Canvas ever mounts, something is wrong.
let activeCanvasCount = 0;

interface Scene3DProps {
  children: ReactNode;
  fallback: ReactNode;
  className?: string;
}

export function Scene3D({ children, fallback, className }: Scene3DProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Start "in view" so the hero canvas mounts immediately — otherwise the static
  // fallback shows until the IntersectionObserver fires and user's very first
  // click silently lands on a non-interactive image (the classic "click twice").
  const [inView, setInView] = useState(true);
  const [renderable, setRenderable] = useState(true); // flipped off by context loss / mount errors
  const [dprCap, setDprCap] = useState(1.5);

  // Track visibility so we can tear the context down entirely off-screen.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // WebGL context loss — mobile WebViews reclaim contexts aggressively.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setRenderable(false);
    };
    const onContextRestored = () => setRenderable(true);
    el.addEventListener("webglcontextlost", onContextLost, true);
    el.addEventListener("webglcontextrestored", onContextRestored, true);
    return () => {
      el.removeEventListener("webglcontextlost", onContextLost, true);
      el.removeEventListener("webglcontextrestored", onContextRestored, true);
    };
  }, []);

  const show3D = renderable && inView && !reducedMotion;

  // Singleton accounting: only count while the Canvas is actually mounted.
  useEffect(() => {
    if (!show3D) return;
    activeCanvasCount++;
    if (activeCanvasCount > 1) {
      console.error(
        `Scene3D: ${activeCanvasCount} Canvas(es) mounted. The 3D skill allows exactly one at a time.`
      );
    }
    return () => {
      activeCanvasCount = Math.max(0, activeCanvasCount - 1);
    };
  }, [show3D]);

  const onCanvasError = useCallback(() => setRenderable(false), []);
  const onPerformanceDecline = useCallback(() => setDprCap(1), []);
  const onPerformanceIncline = useCallback(() => setDprCap(1.5), []);

  return (
    <div ref={wrapRef} className={className}>
      {show3D ? (
        <ErrorBoundary fallback={fallback} onFail={onCanvasError}>
          <Canvas
            dpr={[1, dprCap]}
            frameloop="demand"
            gl={{ powerPreference: "low-power", antialias: false }}
            style={{ background: "transparent" }}
            onCreated={({ gl }) => {
              // Polygon budget sanity check — see skill rule #4.
              if (isDev) {
                setTimeout(() => console.log("Scene3D triangles:", gl.info.render.triangles), 1500);
              }
            }}
            onError={onCanvasError}
          >
            <PerformanceMonitor onDecline={onPerformanceDecline} onIncline={onPerformanceIncline}>
              {children}
            </PerformanceMonitor>
          </Canvas>
        </ErrorBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onFail: () => void;
}

// An exception while building the scene (bad GPU enum, driver quirk…) must render
// the static fallback, never white-screen the hero.
class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.error("Scene3D mount failed:", err);
    this.props.onFail();
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}