import { Suspense, useEffect, useRef } from "react";
import { PerspectiveCamera } from "@react-three/drei";
import { invalidate } from "@react-three/fiber";
import { Scene3D } from "./Scene3D.js";
import { Ticket3D } from "./Ticket3D.js";
import { TicketStatic } from "./TicketStatic.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Ticket3DScene — the lazy-loaded hero object.
 *
 * Wraps the single allowed <Canvas> (via <Scene3D>) around the 3D ticket and
 * provides the SVG fallback. Rendered in a tall container by the parent
 * (Landing) so the scissor can fall from above the ticket.
 *
 * The Falling Scissor is driven by scroll: a ScrollTrigger on the hero section
 * maps scroll progress (0→1) into a ref that Ticket3D reads every frame,
 * triggering R3F invalidation for liquid 60/120fps WebGL updates.
 */
export function Ticket3DScene({ className }: { className?: string }) {
  const scrollProgressRef = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const hero = document.querySelector<HTMLElement>("[data-fsc-hero]");
    if (!hero) return;

    const st = ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6,
      onUpdate: (self) => {
        scrollProgressRef.current = self.progress;
        invalidate();
      },
    });

    return () => { st.kill(); };
  }, []);

  return (
    <Suspense fallback={<TicketStatic className={className} />}>
      <Scene3D fallback={<TicketStatic className={className} />} className={className}>
        <PerspectiveCamera makeDefault position={[0, 0, 5.1]} fov={40} />
        <hemisphereLight intensity={1.1} color="#fffdf6" groundColor="#d6ceb8" />
        <Ticket3D scrollProgressRef={scrollProgressRef} />
      </Scene3D>
    </Suspense>
  );
}

