import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Search, User, Calendar, MapPin, Users } from "lucide-react";
import { useRealtimeRefresh } from "../hooks/useLive.js";
import { useShortcut } from "../hooks/useShortcut.js";
import { API_URL } from "../config.js";

interface RegistrationRow {
  id: string;
  ticketId: string;
  status: "CONFIRMED" | "CANCELLED" | "WAITLISTED";
  registeredAt: string;
  usedCount: number;
  lastScannedAt: string | null;
  user: { name: string; email: string };
  event: { title: string; date: string | null; location: string; category: string };
}

type StatusFilter = "ALL" | "CONFIRMED" | "CANCELLED" | "WAITLISTED";

const statusBadge: Record<RegistrationRow["status"], string> = {
  CONFIRMED: "bg-lime text-ink",
  CANCELLED: "bg-red text-paper",
  WAITLISTED: "bg-blue text-paper",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AdminRegistrations() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const searchRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/registrations`);
      setRows(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useRealtimeRefresh(load);

  // Keyboard: / → jump to the ticket-file search
  useShortcut("/", () => searchRef.current?.focus());

  const filtered = rows
    .filter((r) => status === "ALL" || r.status === status)
    .filter((r) => {
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        r.user.name.toLowerCase().includes(q) ||
        r.user.email.toLowerCase().includes(q) ||
        r.event.title.toLowerCase().includes(q) ||
        r.ticketId.toLowerCase().includes(q)
      );
    });

  const statusTabs: StatusFilter[] = ["ALL", "CONFIRMED", "CANCELLED", "WAITLISTED"];
  const countFor = (s: StatusFilter) => (s === "ALL" ? rows.length : rows.filter((r) => r.status === s).length);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-5">
          <span className="stamp text-orange">Ticket File</span>
          <span className="label-mono text-ink-soft">{rows.length} RECORDS</span>
        </div>
        <h1 className="display text-5xl md:text-6xl mb-4">
          All <span className="bg-blue text-paper px-2 border-2 border-ink inline-block rotate-1">Registrations</span>
        </h1>
        <p className="text-ink-soft text-lg">Every pass issued, across all events — who, what, when, and how many doors it opened.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex gap-2 flex-wrap">
          {statusTabs.map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`btn !px-4 !py-2 text-xs ${status === s ? "btn-ink" : "btn-ghost"}`}>
              {s} <span className="opacity-70">({countFor(s)})</span>
            </button>
          ))}
        </div>
        <div className="relative md:ml-auto md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-soft" />
          <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, event, ticket… (press /)" className="input !pl-12" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 skeleton-stripes" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 paper-card">
          <p className="display text-2xl mb-2">No records found</p>
          <p className="text-ink-soft">Try another search or status.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="paper-card paper-card-press p-5 flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span className="flex items-center gap-1.5 font-bold">
                    <User className="w-4 h-4 text-orange" />
                    {r.user.name}
                  </span>
                  <span className="font-mono text-xs text-ink-soft">{r.user.email}</span>
                  <span className={`border-2 border-ink label-mono text-[9px] px-2 py-0.5 ${statusBadge[r.status]}`}>{r.status}</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 font-mono text-xs uppercase tracking-wide text-ink-soft">
                  <span className="flex items-center gap-1.5 font-semibold text-ink">
                    {r.event.title}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-orange" />
                    {r.event.date ? new Date(r.event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Date TBD"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue" />
                    {r.event.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-green" />
                    {r.usedCount}/2 scans
                  </span>
                </div>
              </div>
              <div className="shrink-0 font-mono text-[11px] text-right space-y-1">
                <div className="flex items-center justify-end gap-1.5 text-ink-soft">
                  <span className="uppercase tracking-widest">Ticket</span>
                  <span className="font-bold text-ink break-all">{r.ticketId}</span>
                </div>
                <div className="text-ink-soft">{fmtDate(r.registeredAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}