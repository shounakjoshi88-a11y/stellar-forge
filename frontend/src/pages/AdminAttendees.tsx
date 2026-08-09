import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Search, User, Calendar, MapPin, Ticket, Users } from "lucide-react";
import { useRealtimeRefresh } from "../hooks/useLive.js";
import { useShortcut } from "../hooks/useShortcut.js";
import { API_URL } from "../config.js";

interface Attendee {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  registrations: {
    id: string;
    ticketId: string;
    registeredAt: string;
    usedCount: number;
    event: { id: string; title: string; date: string | null; location: string; category: string };
  }[];
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AdminAttendees() {
  const [people, setPeople] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/attendees`);
      setPeople(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useRealtimeRefresh(load);

  // Keyboard: / → jump to the roster search
  useShortcut("/", () => searchRef.current?.focus());

  const filtered = people.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.registrations.some((r) => r.event.title.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-5">
          <span className="stamp text-lime">Roster</span>
          <span className="label-mono text-ink-soft">{people.length} ATTENDEES</span>
        </div>
        <h1 className="display text-5xl md:text-6xl mb-4">
          The <span className="bg-green text-paper px-2 border-2 border-ink inline-block -rotate-1">Attendees</span>
        </h1>
        <p className="text-ink-soft text-lg">Everyone holding a pass — and every event they've booked, with dates, venues and tickets.</p>
      </header>

      <div className="relative md:w-72 mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-soft" />
        <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, event… (press /)" className="input !pl-12" />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 skeleton-stripes" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 paper-card">
          <p className="display text-2xl mb-2">No attendees found</p>
          <p className="text-ink-soft">Nobody has registered yet — or try another search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => (
            <div key={p.id} className="paper-card p-6">
              <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b-2 border-dashed border-ink">
                <div className="w-10 h-10 border-2 border-ink bg-orange flex items-center justify-center">
                  <User className="w-5 h-5 text-paper" />
                </div>
                <div>
                  <p className="display text-xl">{p.name}</p>
                  <p className="font-mono text-xs text-ink-soft">{p.email} · joined {fmt(p.createdAt)}</p>
                </div>
                <span className="ml-auto bg-paper-2 border-2 border-ink label-mono text-[9px] px-2 py-0.5">
                  {p.registrations.length} PASS{p.registrations.length === 1 ? "" : "ES"}
                </span>
              </div>

              <div className="space-y-3">
                {p.registrations.map((r) => (
                  <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-paper-2 border-2 border-ink p-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{r.event.title}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-ink-soft mt-1">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-orange" />
                          {r.event.date
                            ? new Date(r.event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "Date TBD · Coming Soon"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-blue" />
                          {r.event.location}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-green" />
                          {r.usedCount}/2 scans
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink-soft sm:text-right">
                      <div className="flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5" />
                        <span className="break-all text-ink font-bold">{r.ticketId}</span>
                      </div>
                      <div>booked {fmt(r.registeredAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}