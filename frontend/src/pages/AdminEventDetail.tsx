import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Search, Download, Users, Ticket, Megaphone, Trash2 } from "lucide-react";
import { useRealtimeRefresh } from "../hooks/useLive.js";
import { useShortcut } from "../hooks/useShortcut.js";
import { useToast } from "../context/ToastContext.js";

import { API_URL } from "../config.js";

interface Attendee {
  id: string;
  ticketId: string;
  registeredAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface EventUpdate {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export function AdminEventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState<EventUpdate[]>([]);
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateBody, setUpdateBody] = useState("");
  const [posting, setPosting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const loadedOnce = useRef(false);

  const finishLoad = () => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    setLoading(false);
  };

  const refetchAttendees = () => {
    if (!id) return;
    axios.get(`${API_URL}/admin/events/${id}/attendees`).then((res) => setAttendees(res.data)).catch(() => {}).finally(finishLoad);
  };

  const refetchUpdates = () => {
    if (!id) return;
    axios.get(`${API_URL}/events/${id}/updates`).then((res) => setUpdates(res.data)).catch(() => {});
  };

  useEffect(() => {
    refetchAttendees();
    refetchUpdates();
  }, [id]);

  // Realtime: new scans don't change headcount, but new registrations and
  // posted updates show up the instant they happen.
  useRealtimeRefresh(() => {
    refetchAttendees();
    refetchUpdates();
  });

  const handleSearch = async () => {
    if (!id) return;
    const params = search ? `?search=${search}` : "";
    const res = await axios.get(`${API_URL}/admin/events/${id}/attendees${params}`);
    setAttendees(res.data);
  };

  const handleExport = () => {
    window.open(`${API_URL}/admin/events/${id}/export`, "_blank");
    toast("Attendance CSV printed to your downloads", "info");
  };

  const handlePostUpdate = async () => {
    if (!id || !updateTitle.trim() || !updateBody.trim()) return;
    setPosting(true);
    try {
      await axios.post(`${API_URL}/admin/events/${id}/updates`, {
        title: updateTitle.trim(),
        body: updateBody.trim(),
      });
      setUpdateTitle("");
      setUpdateBody("");
      refetchUpdates();
      toast("UPDATE LIVE · fans can see it right now", "success");
    } catch {
      toast("Couldn't post the update", "error");
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteUpdate = async (updateId: string) => {
    if (!id) return;
    try {
      await axios.delete(`${API_URL}/admin/events/${id}/updates/${updateId}`);
      refetchUpdates();
      toast("Update pulled", "info");
    } catch {
      toast("Couldn't remove the update", "error");
    }
  };

  // Keyboard: / → jump to the attendee search
  useShortcut("/", () => searchRef.current?.focus());

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 label-mono text-ink-soft hover:text-ink mb-8 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Events
      </button>

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <span className="stamp text-green">Headcount</span>
            <span className="label-mono text-ink-soft flex items-center gap-2">
              <Users className="w-4 h-4" /> {attendees.length} ON THE LIST
            </span>
          </div>
          <h1 className="display text-5xl md:text-6xl mb-3">
            Registered <span className="bg-blue text-paper px-2 border-2 border-ink inline-block rotate-1">Attendees</span>
          </h1>
          <p className="text-ink-soft text-lg">The names behind every ticket.</p>
        </div>
        <button onClick={handleExport} className="btn btn-ink shrink-0">
          <Download className="w-5 h-5" /> Export CSV
        </button>
      </header>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-soft" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search attendees by name… (press /)"
          className="input !pl-12"
        />
      </div>

      {/* Organizer updates */}
      <div className="paper-card p-8 mb-10">
        <h2 className="display text-2xl mb-2 flex items-center gap-3">
          <Megaphone className="w-5 h-5 text-orange" />
          Event Updates
        </h2>
        <p className="text-ink-soft text-sm mb-6">
          Announcements appear on the public event page the moment you post them — no refresh needed.
        </p>

        <div className="space-y-3">
          <input
            type="text"
            value={updateTitle}
            onChange={(e) => setUpdateTitle(e.target.value)}
            placeholder="Update title — e.g. 'Door timings moved'"
            className="input"
          />
          <textarea
            value={updateBody}
            onChange={(e) => setUpdateBody(e.target.value)}
            placeholder="What should attendees know? Venue change, lineup drop, gate timings…"
            rows={3}
            className="input !min-h-[90px] resize-y"
          />
          <button
            onClick={handlePostUpdate}
            disabled={posting || !updateTitle.trim() || !updateBody.trim()}
            className="btn btn-orange"
          >
            {posting ? "Posting…" : "Post Update"}
          </button>
        </div>

        {updates.length > 0 && (
          <div className="mt-8 space-y-3">
            {updates.map((u) => (
              <div key={u.id} className="flex items-start gap-3 border-2 border-ink bg-paper-2 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="font-display font-extrabold text-ink truncate">{u.title}</p>
                    <span className="font-mono text-[10px] text-ink-soft uppercase shrink-0">
                      {new Date(u.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-ink text-sm whitespace-pre-line">{u.body}</p>
                </div>
                <button
                  onClick={() => handleDeleteUpdate(u.id)}
                  className="text-red hover:bg-red hover:text-paper border-2 border-red p-1.5 shrink-0 transition-colors"
                  aria-label="Delete update"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 skeleton-stripes" />
          ))}
        </div>
      ) : attendees.length === 0 ? (
        <div className="text-center py-20 paper-card">
          <div className="w-16 h-16 bg-orange border-2 border-ink flex items-center justify-center mx-auto mb-6 text-paper shadow-[4px_4px_0_#1c1813]">
            <Users className="w-8 h-8" />
          </div>
          <p className="display text-3xl mb-2">No attendees yet</p>
          <p className="text-ink-soft">Attendees will appear here once they register.</p>
        </div>
      ) : (
        <div className="paper-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-ink text-paper">
                  <th className="px-5 py-4 label-mono text-[10px] text-left">#</th>
                  <th className="px-5 py-4 label-mono text-[10px] text-left">Attendee</th>
                  <th className="px-5 py-4 label-mono text-[10px] text-left">Email</th>
                  <th className="px-5 py-4 label-mono text-[10px] text-left">Ticket</th>
                  <th className="px-5 py-4 label-mono text-[10px] text-left">Registered</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((a, i) => (
                  <tr key={a.id} className={`border-b-2 border-dashed border-ink last:border-0 hover:bg-lime transition-colors ${i % 2 === 1 ? "bg-paper-2/50" : ""}`}>
                    <td className="px-5 py-4 font-mono text-sm text-ink-soft">{String(i + 1).padStart(2, "0")}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange border-2 border-ink flex items-center justify-center font-display font-extrabold text-ink shrink-0">
                          {a.user.name[0].toUpperCase()}
                        </div>
                        <span className="font-bold text-ink">{a.user.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-ink-soft">{a.user.email}</td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs text-ink bg-paper-2 border-2 border-ink px-2 py-1 inline-flex items-center gap-1.5">
                        <Ticket className="w-3 h-3 text-orange" />
                        {a.ticketId.slice(-8)}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-ink-soft">
                      {new Date(a.registeredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}