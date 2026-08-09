import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { CommandPalette } from "./CommandPalette.js";
import { LiveActivityToaster } from "./LiveActivityToaster.js";
import { useShortcut } from "../hooks/useShortcut.js";
import { useLenis } from "../hooks/useLenis.js";
import { Menu, X, ScanLine, ShieldX, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import {
  isSoundEnabled,
  setSoundEnabled,
  unlockAudio,
} from "../lib/paperSounds.js";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  // Sound is opt-in and every session starts muted (sound-design-skill.md). The
  // AudioContext is created lazily inside a user gesture — one-time, anywhere on
  // the site — so a later click can never hit the mobile "no audio without
  // gesture" wall.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    unlockAudio();
    if (next) {
      // A soft paper tap confirms the toggle took — sound is now audible.
      import("../lib/paperSounds.js").then(({ playPaperTap }) => playPaperTap());
    }
  };

  // Global admin shortcuts: n → event desk, s → gate scanner.
  useShortcut("n", () => user?.role === "ADMIN" && navigate("/admin/events"));
  useShortcut("s", () => user?.role === "ADMIN" && navigate("/admin/scan"));

  // Desktop-only smooth scroll (self-gates on touch — see useLenis).
  useLenis();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="grain" />
      <LiveActivityToaster />

      {/* Top strip */}
      <div className="bg-ink text-paper py-1.5 px-4 border-b-2 border-ink">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <p className="label-mono text-orange">★ EVENT HEADQUARTERS — OPEN 24/7</p>
          <p className="label-mono hidden sm:block text-paper/70">EST. 2026 · TICKETS ARE DIGITAL</p>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-paper border-b-2 border-ink">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-orange border-2 border-ink flex items-center justify-center font-bold font-display text-lg shadow-[3px_3px_0_#1c1813] group-hover:rotate-3 transition-transform">
              SF
            </div>
            <span className="display text-xl group-hover:translate-x-0.5 transition-transform">
              Stellar<span className="text-orange">Forge</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            <CommandPalette />
            <button
              onClick={toggleSound}
              aria-label={soundOn ? "Mute sound effects" : "Unmute sound effects"}
              aria-pressed={soundOn}
              title={soundOn ? "Mute sound effects" : "Unmute sound effects"}
              className="w-9 h-9 border-2 border-ink bg-card flex items-center justify-center shadow-[3px_3px_0_#1c1813] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#1c1813] transition-all"
            >
              {soundOn ? <Volume2 className="w-4 h-4 text-green" /> : <VolumeX className="w-4 h-4 text-ink-soft" />}
            </button>
            <Link to="/events" className="nav-link text-ink">Events</Link>
            {user ? (
              <>
                <Link to="/my-registrations" className="nav-link text-ink">My Tickets</Link>
                <Link to="/dashboard" className="nav-link text-ink">Dashboard</Link>
                {user.role === "ADMIN" && <Link to="/admin" className="nav-link text-ink">Admin</Link>}
                {user.isOwner && (
                  <Link to="/admin/team" className="nav-link text-ink flex items-center gap-1">
                    <ShieldX className="w-4 h-4" /> Team
                  </Link>
                )}
                {user.role === "ADMIN" && (
                  <button
                    onClick={() => navigate("/admin/scan")}
                    className="nav-link text-ink flex items-center gap-1.5 hover:text-green"
                  >
                    <ScanLine className="w-4 h-4" /> Gate
                  </button>
                )}
                <div className="flex items-center gap-3 pl-5 border-l-2 border-ink">
                  <span className="font-mono text-xs uppercase tracking-wider bg-lime border-2 border-ink px-2 py-1">
                    {user.name.split(" ")[0]}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="nav-link text-ink hover:text-red"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link text-ink">Login</Link>
                <Link to="/login" className="btn btn-ink !py-2 !px-4">Get Ticket</Link>
              </>
            )}
          </nav>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden w-10 h-10 border-2 border-ink bg-card flex items-center justify-center shadow-[3px_3px_0_#1c1813]">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t-2 border-ink bg-paper-2 p-5 space-y-3">
            <button
              onClick={() => { toggleSound(); setMobileOpen(false); }}
              className="nav-link text-ink flex items-center gap-2 py-1"
            >
              {soundOn ? <Volume2 className="w-4 h-4 text-green" /> : <VolumeX className="w-4 h-4 text-ink-soft" />}
              {soundOn ? "Mute sound effects" : "Unmute sound effects"}
            </button>
            <Link to="/events" onClick={() => setMobileOpen(false)} className="nav-link text-ink block py-1">Events</Link>
            {user ? (
              <>
                <Link to="/my-registrations" onClick={() => setMobileOpen(false)} className="nav-link text-ink block py-1">My Tickets</Link>
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="nav-link text-ink block py-1">Dashboard</Link>
                {user.role === "ADMIN" && <Link to="/admin" onClick={() => setMobileOpen(false)} className="nav-link text-ink block py-1">Admin</Link>}
                {user.isOwner && (
                  <Link to="/admin/team" onClick={() => setMobileOpen(false)} className="nav-link text-ink flex items-center gap-1.5 block py-1">
                    <ShieldX className="w-4 h-4" /> Team
                  </Link>
                )}
                {user.role === "ADMIN" && (
                  <button onClick={() => { setMobileOpen(false); navigate("/admin/scan"); }} className="nav-link text-green flex items-center gap-1.5 block py-1">
                    <ScanLine className="w-4 h-4" /> Gate Scanner
                  </button>
                )}
                <button onClick={handleLogout} className="nav-link text-red block py-1">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="nav-link text-ink block py-1">Login</Link>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="btn btn-ink w-full">Get Ticket</Link>
              </>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-ink text-paper">
        <div className="marquee bg-orange text-ink !border-0 py-2">
          <div className="marquee-track label-mono">
            {[...Array(4)].map((_, i) => (
              <span key={i}>ADMIT ONE · NO REFUNDS · BE EARLY · TICKETS REQUIRED · ADMIT ONE · NO REFUNDS · BE EARLY · TICKETS REQUIRED ·</span>
            ))}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange border-2 border-ink flex items-center justify-center font-bold text-sm">SF</div>
            <span className="display text-lg">StellarForge</span>
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-paper/60">
            © 2026 Stellar Forge · Printed with care
          </p>
        </div>
      </footer>
    </div>
  );
}
