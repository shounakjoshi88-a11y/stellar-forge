import { useEffect } from "react";
import Lenis from "lenis";
import { useMediaQuery } from "./useMediaQuery.js";

// Only smooth-scroll on fine-pointer (desktop). Touch devices keep native
// momentum scroll — layering Lenis on top of Android WebView touch is jank-prone.
export function useLenis() {
  const isDesktop = useMediaQuery("(hover: hover) and (pointer: fine)");

  useEffect(() => {
    if (!isDesktop) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true, syncTouch: false });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const id = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, [isDesktop]);
}