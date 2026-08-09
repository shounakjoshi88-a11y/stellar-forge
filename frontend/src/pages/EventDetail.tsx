import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { FakeQR } from "../components/FakeQR.js";
import confetti from "canvas-confetti";
import { Calendar, MapPin, Users, Clock, ArrowLeft, AlertCircle, Ticket, X, Megaphone } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";
import { useLiveCount, useRealtimeRefresh } from "../hooks/useLive.js";
import { StampIn, CountUp } from "../components/motion.js";
import { consumeMorphSource } from "../lib/morph.js";

import { API_URL } from "../config.js";

export function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimistic, setOptimistic] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const confettiFired = useRef(false);

  const refetchEvent = () => {
    if (!id) return;
    axios
      .get(`${API_URL}/events/${id}`)
      .then((res) => setEvent(res.data))
      .catch(() => {});
  };

  const refetchUpdates = () => {
    if (!id) return;
    axios
      .get(`${API_URL}/events/${id}/updates`)
      .then((res) => setUpdates(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    if (!id) return;
    axios
      .get(`${API_URL}/events/${id}`)
      .then((res) => setEvent(res.data))
      .catch(() => setToast({ type: "error", text: "Event not found" }))
      .finally(() => setLoading(false));
    refetchUpdates();
  }, [id]);

  // Realtime: refetch on any write (new update, event closed, seat changes).
  useRealtimeRefresh(() => {
    refetchEvent();
    refetchUpdates();
  });

  // Card → detail morph: spring from the clicked card's rect
  const reduce = useReducedMotion();
  const morphFrom = useRef(consumeMorphSource());
  const [morph, setMorph] = useState<{ scale: number; x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = cardRef.current;
    const from = morphFrom.current;
    if (!el || !from || reduce) return;
    const to = el.getBoundingClientRect();
    const scale = from.width / to.width;
    const cx = to.x + to.width / 2;
    const cy = to.y + to.height / 2;
    const fcx = from.x + from.width / 2;
    const fcy = from.y + from.height / 2;
    setMorph({ scale, x: fcx - cx, y: fcy - cy });
  }, [event, reduce]);

  const liveCount = useLiveCount(id ?? "");
  const registeredCount = liveCount ?? event?.registeredCount ?? 0;

  const fireConfetti = () => {
    if (confettiFired.current) return;
    confettiFired.current = true;
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.7 },
      colors: ["#ff4d00", "#2453ff", "#c9e62e", "#1c1813", "#e2231a"],
    });
  };

  const handleRegister = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    // Optimistic: flip the UI immediately, reconcile on response
    setOptimistic(true);
    setToast(null);

    try {
      const res = await axios.post(`${API_URL}/registrations/${id}`);
      const ticketId = res.data?.ticketId ?? "";
      fireConfetti();
      setToast({
        type: "success",
        text: ticketId ? `You're in! Ticket ${ticketId} generated.` : "You're in! Pass generated.",
      });
      const fresh = await axios.get(`${API_URL}/events/${id}`);
      setEvent(fresh.data);
    } catch (err: any) {
      // Roll back. If this was the last-seat race (409), flip to FULL right
      // away — the loser shouldn't see a re-enabled button even for a beat.
      if (err.response?.status === 409) {
        setEvent((e: any) => (e ? { ...e, registeredCount: e.capacity } : e));
      }
      setToast({ type: "error", text: err.response?.data?.error || "Registration failed — nothing was charged, try again." });
    } finally {
      setOptimistic(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="h-[500px] paper-card animate-pulse" />
      </div>
    );
  }

  if (!event) return null;

  const eventDate = event.date ? new Date(event.date) : null;
  const isPast = eventDate !== null && eventDate < new Date();
  const spotsLeft = event.capacity - registeredCount;
  const isFull = spotsLeft <= 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 label-mono text-ink-soft hover:text-ink mb-8 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Events
      </button>

      <motion.div
        ref={cardRef}
        initial={morph ? { scale: morph.scale, x: morph.x, y: morph.y } : false}
        animate={{ scale: 1, x: 0, y: 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 24 }}
        style={{ transformOrigin: "center" }}
        className="paper-card overflow-hidden"
      >
        {event.imageUrl ? (
          <div className="h-72 md:h-96 relative border-b-2 border-ink">
            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
              <div>
                <StampIn className="bg-orange border-2 border-ink px-3 py-1 label-mono text-paper shadow-[2px_2px_0_#1c1813] mb-3">
                  {event.category}
                </StampIn>
                {!event.isOpen && !isPast && (
                  <span className="bg-red border-2 border-paper px-3 py-1 label-mono text-paper mb-3 ml-2">
                    REGISTRATIONS CLOSED
                  </span>
                )}
                <h1 className="display text-4xl md:text-5xl text-paper">{event.title}</h1>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-48 bg-ink border-b-2 border-ink flex items-center justify-center">
            <h1 className="display text-4xl md:text-5xl text-paper">{event.title}</h1>
          </div>
        )}

        <div className="p-8">
          {/* Meta strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { icon: Calendar, label: eventDate ? eventDate.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" }) : "Date TBD · Coming Soon" },
              { icon: Clock, label: eventDate ? eventDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "Announcement pending" },
              { icon: MapPin, label: event.location },
              { icon: Users, label: `${registeredCount}/${event.capacity} seats` },
            ].map((item, i) => (
              <div key={i} className="border-2 border-ink bg-paper-2 p-3 flex flex-col gap-2">
                <item.icon className="w-5 h-5 text-orange" />
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink leading-tight">{item.label}</span>
              </div>
            ))}
          </div>

          <p className="text-ink text-lg leading-relaxed mb-10">{event.description}</p>

          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div
                key={toast.text}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className={`flex items-center gap-3 p-5 border-2 border-ink mb-8 text-sm font-semibold shadow-[4px_4px_0_#1c1813] ${
                  toast.type === "success" ? "bg-lime text-ink" : "bg-red text-paper"
                }`}
              >
                <span className="flex-1">{toast.text}</span>
                {toast.type === "success" && (
                  <Link to="/my-registrations" className="underline underline-offset-4 font-bold">
                    View my tickets →
                  </Link>
                )}
                <button onClick={() => setToast(null)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ticket stub CTA */}
          <div className="ticket p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <p className="label-mono text-ink-soft mb-1">Spots Remaining</p>
                <motion.p
                  className="display text-5xl"
                  key={spotsLeft}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CountUp value={spotsLeft} duration={0.4} />
                  <span className="text-2xl text-ink-soft"> / {event.capacity}</span>
                  {liveCount !== null && (
                    <span className="ml-3 align-middle inline-block bg-green text-paper border-2 border-ink label-mono text-[9px] px-2 py-1 animate-blink">
                      LIVE
                    </span>
                  )}
                </motion.p>
              </div>
              <div className="perforation sm:border-l-2 sm:border-t-0 sm:border-b-0 border-l-2 border-t-0 sm:border-dashed border-dashed sm:pl-6 !mt-0 flex-1 sm:max-w-[260px] hidden sm:block" />
              <div className="flex items-center justify-between sm:flex-col sm:items-start gap-2">
                <p className="label-mono text-orange">STUB · ADMIT ONE</p>
                <button
                  onClick={handleRegister}
                  disabled={isPast || isFull || !event.isOpen || optimistic}
                  className={`btn w-full sm:w-auto ${isPast || !event.isOpen ? "btn-ghost" : isFull ? "btn-ghost" : "btn-orange"} !py-3`}
                >
                  {isPast ? (
                    "Event Ended"
                  ) : !event.isOpen ? (
                    "Registrations Closed"
                  ) : isFull ? (
                    "Fully Booked"
                  ) : optimistic ? (
                    <>
                      <div className="w-5 h-5 border-2 border-paper/30 border-t-paper rounded-full animate-spin" />
                      Reserving your seat…
                    </>
                  ) : (
                    <>
                      <Ticket className="w-5 h-5" />
                      Register Now
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-6 pt-4 border-t-2 border-dashed border-ink">
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">Scan at door · No refunds · Bring ID</span>
              <FakeQR seed={event.id} className="w-20" />
            </div>
          </div>

          {/* Organizer updates — appear the moment an admin posts them */}
          {updates.length > 0 && (
            <div className="mt-10">
              <h2 className="display text-2xl mb-6 flex items-center gap-3">
                <Megaphone className="w-5 h-5 text-orange" />
                Updates from the Organizers
                <span className="ml-auto inline-block bg-green text-paper border-2 border-ink label-mono text-[9px] px-2 py-1 animate-blink">
                  LIVE
                </span>
              </h2>
              <div className="space-y-4">
                {updates.map((u) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-2 border-ink bg-paper-2 p-5 shadow-[4px_4px_0_#1c1813]"
                  >
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <p className="font-display font-extrabold text-lg text-ink">{u.title}</p>
                      <span className="font-mono text-[10px] text-ink-soft uppercase shrink-0">
                        {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
                        {new Date(u.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-ink leading-relaxed whitespace-pre-line">{u.body}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* error banner for non-toast errors */}
          {toast?.type === "error" && !toast.text.includes("not found") && (
            <p className="mt-4 text-sm text-ink-soft flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red" />
              Your registration wasn't completed.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}