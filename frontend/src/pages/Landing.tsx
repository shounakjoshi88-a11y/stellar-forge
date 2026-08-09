import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import { Reveal, StampIn, MagneticButton, CountUp } from "../components/motion.js";
import { LiveFeedTicker } from "../components/LiveFeedTicker.js";
import { useRealtimeRefresh } from "../hooks/useLive.js";
import { API_URL } from "../config.js";

// The 3D bundle (~three + R3F + drei) is only paid by the hero page.
const Ticket3DScene = lazy(() => import("../components/three/Ticket3DScene.js").then((m) => ({ default: m.Ticket3DScene })));
// Static SVG fallback for the Suspense boundary — matches the 3D object exactly.
const TicketStatic = lazy(() => import("../components/three/TicketStatic.js").then((m) => ({ default: m.TicketStatic })));

gsap.registerPlugin(ScrollTrigger);

export function Landing() {
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({ eventsListed: 0, ticketsIssued: 0, doorsOpened: 0, categories: 0 });

  const loadStats = () => {
    axios
      .get(`${API_URL}/events/stats`)
      .then((res) => setStats(res.data))
      .catch(() => {
        /* header stays at zero if the API is down */
      });
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Realtime: the LIVE numbers tick the moment a registration, cancel, scan or
  // event change happens anywhere — no refresh, no polling.
  useRealtimeRefresh(loadStats);

  useEffect(() => {
    const el = marqueeRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const track = el.querySelector<HTMLDivElement>(".marquee-track");
    if (!track) return;
    track.style.animation = "none";

    const ctx = gsap.context(() => {
      gsap.set(track, { xPercent: 0 });
      const spin = gsap.to(track, {
        xPercent: -50,
        duration: 24,
        ease: "none",
        repeat: -1,
      });
      const pace = { timeScale: 1 };

      ScrollTrigger.create({
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          const speed = Math.abs(self.getVelocity() / 1000);
          const target = gsap.utils.clamp(1, 3.5, 1 + speed * 2);
          // Smoothly ramp the speed multiplier so the marquee glides, not jumps.
          gsap.to(pace, {
            timeScale: target,
            duration: 0.4,
            ease: "power2.out",
            overwrite: "auto",
            onUpdate: () => spin.timeScale(pace.timeScale),
          });
        },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <div>
      {/* HERO — a pinned stage. The outer section is very tall so the Falling
          Scissor story unrolls over a LOT of scrolling (slowly, deliberately);
          the sticky inner stage keeps the 3D scene + hero copy on screen the
          whole time while the scroll distance gives the animation room to
          fall, cut, jerk and swing. */}
      <section className="relative h-[180vh]" data-fsc-hero>
        {/* Sticky stage: exactly viewport height, pinned while the tall
            section scrolls past. Canvas sits full-bleed behind, hero copy on
            top and left; the canvas keeps pointer events so the ticket's
            hover-tilt still works. */}
        <div className="sticky top-0 overflow-hidden" style={{ height: "100vh" }}>
          <div className="absolute inset-0 z-0">
            <Suspense fallback={null}>
              <Ticket3DScene className="w-full h-full" />
            </Suspense>
          </div>

          <div className="relative z-10 h-full flex items-center max-w-7xl mx-auto px-4 pointer-events-none">
            <div className="w-full grid lg:grid-cols-[1fr_1.25fr] gap-14 items-center pointer-events-none">
              <div className="pointer-events-auto">
                <div className="flex items-center gap-4 mb-8">
                  <StampIn className="stamp text-orange">Issue No. 001</StampIn>
                  <span className="label-mono text-ink-soft">FALL / WINTER SEASON</span>
                </div>

                <h1 className="display text-[clamp(2.5rem,8vw,7rem)] leading-[0.95] mb-8">
                  Come.
                  <br />
                  Get
                  <br />
                  <span className="relative inline-block">
                    Ticket&shy;ed.
                    <span className="absolute -bottom-2 left-0 w-full h-4 bg-lime border-2 border-ink -z-10" />
                  </span>
                </h1>

                <p className="text-lg md:text-xl text-ink-soft max-w-xl leading-relaxed mb-10">
                  One headquarters for every event worth attending. Browse the season, grab
                  your pass, and we'll keep the door open for you.
                </p>

                <div className="flex flex-wrap gap-5">
                  <MagneticButton className="btn btn-ink">
                    <Link to="/events" className="flex items-center gap-2">
                      Browse Events <ArrowRight className="w-4 h-4" />
                    </Link>
                  </MagneticButton>
                  <Link to="/login" className="btn btn-ghost">
                    Get Your Pass
                  </Link>
                </div>

                {/* Live gate counter — compact, low visual weight */}
                <div className="mt-12 pt-5 border-t-2 border-dashed border-ink/60 max-w-md">
                  <LiveFeedTicker compact />
                </div>
              </div>

              {/* Invisible spacer — reserves the right-column space so the
                  ticket renders in the right half of the stage. */}
              <div className="block pointer-events-none h-[50vh]" />
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE (velocity-reactive) */}
      <section className="marquee bg-ink text-paper py-3" ref={marqueeRef}>
        <div className="marquee-track label-mono">
          {[...Array(3)].map((_, i) => (
            <span key={i} className="flex items-center gap-3">
              <span className="text-orange">★</span> WORKSHOPS
              <span className="text-orange">★</span> SUMMITS
              <span className="text-orange">★</span> FESTIVALS
              <span className="text-orange">★</span> MEETUPS
              <span className="text-orange">★</span> EXHIBITIONS
              <span className="text-orange">★</span> CONFERENCES
            </span>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="flex items-end justify-between mb-14">
          <StampIn className="display text-4xl md:text-5xl">How it works</StampIn>
          <span className="label-mono text-ink-soft hidden sm:block">3 EASY STEPS / ZERO HASSLE</span>
        </div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-6">
          {[
            {
              n: "01",
              title: "Browse the season",
              desc: "Search, filter and flip through every event we're running — tech, design, arts and beyond.",
              color: "bg-orange",
            },
            {
              n: "02",
              title: "Grab your pass",
              desc: "Register in seconds. Your ticket lands instantly with a scannable QR and stub.",
              color: "bg-blue",
            },
            {
              n: "03",
              title: "Show up, get counted",
              desc: "Track your streak, watch countdowns, and build a history of every event you attended.",
              color: "bg-lime",
            },
          ].map((f, i) => (
            <Reveal key={f.n} delay={i * 0.1} className={i % 2 === 1 ? "md:translate-y-8" : ""}>
              <div className="paper-card paper-card-press p-8">
                <div className={`w-14 h-14 ${f.color} border-2 border-ink flex items-center justify-center font-display font-extrabold text-xl text-ink mb-8 shadow-[3px_3px_0_#1c1813]`}>
                  {f.n}
                </div>
                <h3 className="display text-xl mb-3">{f.title}</h3>
                <p className="text-ink-soft leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* LIVE NUMBERS */}
      <section className="border-y-2 border-ink bg-paper-2">
        <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { v: stats.eventsListed, l: "Events on the board" },
            { v: stats.ticketsIssued, l: "Passes issued" },
            { v: stats.doorsOpened, l: "Doors opened" },
            { v: stats.categories, l: "Scenes covered" },
          ].map((s, i) => (
            <Reveal key={s.l} delay={i * 0.08} className="text-center">
              <p className="display text-5xl md:text-6xl mb-2">
                <CountUp value={s.v} />
              </p>
              <p className="label-mono text-ink-soft">{s.l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 py-28 text-center">
        <StampIn className="stamp text-blue mb-8">LAST CALL</StampIn>
        <Reveal>
          <h2 className="display text-5xl md:text-7xl max-w-3xl mx-auto mb-10">
            Don't be the one who missed it
          </h2>
        </Reveal>
        <MagneticButton className="btn btn-orange text-lg">
          <Link to="/login" className="flex items-center gap-2">
            Start Your Journey <ArrowRight className="w-5 h-5" />
          </Link>
        </MagneticButton>
      </section>
    </div>
  );
}