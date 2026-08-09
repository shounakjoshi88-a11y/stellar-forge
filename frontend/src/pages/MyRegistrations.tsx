import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Calendar, MapPin, Ticket, X } from "lucide-react";
import { TicketQR } from "../components/TicketQR.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";

import { API_URL } from "../config.js";

interface Registration {
  id: string;
  ticketId: string;
  status: string;
  registeredAt: string;
  usedCount?: number;
  lastScannedAt?: string | null;
  event: {
    id: string;
    title: string;
    date: string | null;
    location: string;
    category: string;
  };
}

export function MyRegistrations() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get(`${API_URL}/registrations/my`)
      .then((res) => setRegistrations(res.data))
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = async (eventId: string) => {
    await axios.delete(`${API_URL}/registrations/${eventId}`);
    setRegistrations((prev) =>
      prev.map((r) => (r.event.id === eventId ? { ...r, status: "CANCELLED" } : r))
    );
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 ticket animate-pulse" />
        ))}
      </div>
    );
  }

  const active = registrations.filter((r) => r.status === "CONFIRMED");
  const cancelled = registrations.filter((r) => r.status === "CANCELLED");

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-5">
          <span className="stamp text-orange">Your Wallet</span>
          <span className="label-mono text-ink-soft">{active.length} VALID PASSES</span>
        </div>
        <h1 className="display text-5xl md:text-6xl mb-4">
          My <span className="bg-blue text-paper px-2 border-2 border-ink inline-block rotate-1">Tickets</span>
        </h1>
        <p className="text-ink-soft">Every pass you own, stamped and barcoded.</p>
      </header>

      {registrations.length === 0 ? (
        <div className="text-center py-24 paper-card">
          <div className="w-20 h-20 bg-orange border-2 border-ink flex items-center justify-center mx-auto mb-6 text-paper shadow-[4px_4px_0_#1c1813]">
            <Ticket className="w-10 h-10" />
          </div>
          <p className="display text-3xl mb-2">No tickets yet</p>
          <p className="text-ink-soft mb-8">The season is waiting for you.</p>
          <Link to="/events" className="btn btn-ink">Browse Events</Link>
        </div>
      ) : (
        <div className="space-y-10">
          {active.length > 0 && (
            <div>
              <h2 className="display text-2xl mb-6 flex items-center gap-3">
                <span className="w-4 h-4 bg-green border-2 border-ink animate-blink" />
                Active Tickets ({active.length})
              </h2>
              <div className="space-y-8">
                {active.map((reg, i) => (
                  <RegistrationCard key={reg.id} registration={reg} onCancel={handleCancel} index={i} />
                ))}
              </div>
            </div>
          )}

          {cancelled.length > 0 && (
            <div>
              <h2 className="display text-2xl mb-6 flex items-center gap-3">
                <span className="w-4 h-4 bg-red border-2 border-ink" />
                Cancelled ({cancelled.length})
              </h2>
              <div className="space-y-8 opacity-60">
                {cancelled.map((reg, i) => (
                  <RegistrationCard key={reg.id} registration={reg} onCancel={handleCancel} index={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RegistrationCard({
  registration,
  onCancel,
  index,
}: {
  registration: Registration;
  onCancel: (eventId: string) => void;
  index: number;
}) {
  const eventDate = registration.event.date ? new Date(registration.event.date) : null;
  const isPast = eventDate !== null && eventDate < new Date();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="ticket animate-fade-up" style={{ animationDelay: `${(index % 3) * 0.1}s` }}>
      <div className="flex">
        {/* Stub side */}
        <div className="w-24 sm:w-28 bg-orange border-r-2 border-dashed border-ink p-4 flex flex-col items-center justify-center gap-3 text-paper">
          <p className="font-mono text-[9px] uppercase tracking-widest text-ink/70 text-center leading-tight">ADMIT ONE</p>
          <Ticket className="w-6 h-6 text-ink" />
          <p className="font-mono text-[10px] text-ink font-semibold break-all text-center">{registration.ticketId.slice(-6)}</p>
        </div>

        {/* Main side */}
        <div className="flex-1 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-lime border-2 border-ink px-2 py-0.5 label-mono text-[9px] text-ink">
              {registration.event.category}
            </span>
            <span
              className={`px-2 py-0.5 label-mono text-[9px] border-2 border-ink ${
                registration.status === "CONFIRMED" ? "bg-green text-paper" : "bg-red text-paper"
              }`}
            >
              {registration.status === "CONFIRMED" ? "CONFIRMED" : "VOID"}
            </span>
          </div>

          <Link to={`/events/${registration.event.id}`}>
            <h3 className="display text-xl sm:text-2xl mb-3 hover:text-orange transition-colors">
              {registration.event.title}
            </h3>
          </Link>

          <div className="flex flex-wrap items-center gap-4 font-mono text-xs uppercase tracking-wide text-ink-soft">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-orange" />
              {eventDate
                ? eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Date TBD · Coming Soon"}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue" />
              {registration.event.location}
            </span>
          </div>

          <div className="flex items-center justify-between mt-5 pt-4 border-t-2 border-dashed border-ink">
            <div className="flex items-center gap-4">
              <TicketQR value={registration.ticketId} size={116} />
              <div className="space-y-2">
                <span className="font-mono text-[11px] text-ink bg-paper-2 border-2 border-ink px-2 py-1 block">
                  {registration.ticketId}
                </span>
                <TicketUsage usedCount={registration.usedCount ?? 0} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              {registration.status === "CONFIRMED" && !isPast && (
                <button
                  onClick={() => setConfirmOpen(true)}
                  className="label-mono text-red hover:bg-red hover:text-paper transition-colors px-2 py-1 border-2 border-red flex items-center gap-1 self-start"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Dump Ticket?"
        message={`This voids your pass to "${registration.event.title}". Your seat is released back to the floor and the ticket cannot be brought back.`}
        confirmWord="delete"
        confirmLabel="Delete Ticket"
        onConfirm={() => onCancel(registration.event.id)}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function TicketUsage({ usedCount }: { usedCount: number }) {
  const stamps: { n: number; label: string; used: boolean }[] = [
    { n: 1, label: "ENTRY", used: usedCount >= 1 },
    { n: 2, label: "EXIT", used: usedCount >= 2 },
  ];
  return (
    <div className="flex items-center gap-2">
      {stamps.map((s) => (
        <span
          key={s.n}
          className={`label-mono text-[9px] px-2 py-1 border-2 border-ink ${
            s.used ? "bg-green text-paper" : "bg-paper-2 text-ink-soft"
          }`}
        >
          {s.used ? "✓ " : ""}
          {s.label}
        </span>
      ))}
    </div>
  );
}