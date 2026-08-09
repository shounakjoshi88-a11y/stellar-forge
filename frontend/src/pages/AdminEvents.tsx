import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Plus, Edit, Trash2, Users, Download, Search, Calendar, MapPin, X, Eye, EyeOff, Radio, Lock, Unlock, Clock, ImagePlus, CalendarPlus } from "lucide-react";
import { useRealtimeRefresh } from "../hooks/useLive.js";
import { useShortcut } from "../hooks/useShortcut.js";
import { useToast } from "../context/ToastContext.js";
import { compressImage, dataUrlSizeKb } from "../lib/imageCompress.js";

import { API_URL } from "../config.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";

interface Event {
  id: string;
  title: string;
  description: string;
  date: string | null;
  endDate: string | null;
  location: string;
  capacity: number;
  category: string;
  imageUrl: string | null;
  isPublished: boolean;
  isOpen: boolean;
  registeredCount: number;
}

type StatusFilter = "all" | "upcoming" | "live" | "completed";

const emptyForm = {
  title: "",
  description: "",
  location: "",
  date: "",
  endDate: "",
  capacity: 100,
  category: "",
  imageUrl: "",
  isPublished: true,
  isOpen: true,
};

type EventForm = typeof emptyForm;

function eventStatus(e: Event): "upcoming" | "live" | "completed" {
  if (!e.date) return "upcoming"; // TBD — still to come
  const now = Date.now();
  const start = new Date(e.date).getTime();
  const end = e.endDate ? new Date(e.endDate).getTime() : start + 24 * 60 * 60 * 1000;
  if (now < start) return "upcoming";
  if (now >= end) return "completed";
  return "live";
}

const statusMeta = {
  upcoming: { label: "UPCOMING", cls: "bg-blue text-paper" },
  live: { label: "LIVE NOW", cls: "bg-lime text-ink animate-blink" },
  completed: { label: "COMPLETED", cls: "bg-paper-2 text-ink-soft" },
} as const;

const filterTabs: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "live", label: "Live now" },
  { key: "completed", label: "Completed" },
];

export function AdminEvents() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const handleDelete = async (id: string) => {
    const target = events.find((e) => e.id === id);
    try {
      await axios.delete(`${API_URL}/admin/events/${id}`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast(`WIPED "${target?.title ?? "event"}" from the ledger`, "error");
    } catch {
      toast("Couldn't delete the event", "error");
    }
  };

  const [form, setForm] = useState<EventForm>({ ...emptyForm });

  // Deep-linkable status from the dashboard cards: /admin/events?status=completed
  useEffect(() => {
    const s = searchParams.get("status");
    if (s === "upcoming" || s === "live" || s === "completed" || s === "all") {
      setFilter(s);
    }
  }, [searchParams]);

  const setStatusFilter = (key: StatusFilter) => {
    setFilter(key);
    const next = new URLSearchParams(searchParams);
    if (key === "all") next.delete("status");
    else next.set("status", key);
    setSearchParams(next);
  };

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/events`);
      setEvents(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Realtime: refresh instantly when an attendee registers/cancels or an
  // update is posted anywhere.
  useRealtimeRefresh(fetchEvents);

  const toForm = (e: Event): EventForm => ({
    title: e.title,
    description: e.description,
    location: e.location,
    date: e.date ? new Date(e.date).toISOString().slice(0, 16) : "",
    endDate: e.endDate ? new Date(e.endDate).toISOString().slice(0, 16) : "",
    capacity: e.capacity,
    category: e.category,
    imageUrl: e.imageUrl ?? "",
    isPublished: e.isPublished,
    isOpen: e.isOpen,
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const handleEdit = (event: Event) => {
    setEditing(event);
    setForm(toForm(event));
    setShowForm(true);
  };

  const togglePublish = async (event: Event) => {
    try {
      await axios.put(`${API_URL}/admin/events/${event.id}`, { isPublished: !event.isPublished });
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, isPublished: !e.isPublished } : e)));
      toast(event.isPublished ? `UNLISTED "${event.title}" from the public site` : `LISTED "${event.title}"`, "info");
    } catch {
      toast("Couldn't change listing", "error");
    }
  };

  const toggleOpen = async (event: Event) => {
    try {
      await axios.put(`${API_URL}/admin/events/${event.id}`, { isOpen: !event.isOpen });
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, isOpen: !e.isOpen } : e)));
      toast(event.isOpen ? `REGISTRATIONS CLOSED · ${event.title}` : `REGISTRATIONS REOPENED · ${event.title}`, "info");
    } catch {
      toast("Couldn't change registrations", "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      date: form.date ? form.date : null,
      endDate: form.endDate ? form.endDate : null,
      imageUrl: form.imageUrl ? form.imageUrl : null,
    };
    try {
      if (editing) {
        await axios.put(`${API_URL}/admin/events/${editing.id}`, payload);
        toast(`UPDATED "${form.title}"`, "success");
      } else {
        await axios.post(`${API_URL}/admin/events`, payload);
        toast(form.date ? `LISTING PRINTED · ${form.title}` : `LISTING PRINTED (DATE TBD) · ${form.title}`, "success");
      }
    } catch {
      toast("Couldn't save — check the form and try again", "error");
    }
    setShowForm(false);
    setEditing(null);
    setForm({ ...emptyForm });
    fetchEvents();
  };

  const handleExport = (eventId: string) => {
    window.open(`${API_URL}/admin/events/${eventId}/export`, "_blank");
  };

  const handleBanner = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setCompressing(true);
    try {
      const dataUrl = await compressImage(file);
      setForm((f) => ({ ...f, imageUrl: dataUrl }));
    } catch {
      /* invalid file — keep the current banner */
    } finally {
      setCompressing(false);
    }
  };

  // Keyboard: n → print a new event, / → jump to search.
  useShortcut("n", openCreate, !showForm);
  useShortcut("/", () => searchRef.current?.focus());

  const filtered = events
    .filter(
      (e) =>
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.category.toLowerCase().includes(search.toLowerCase()) ||
        e.location.toLowerCase().includes(search.toLowerCase())
    )
    .filter((e) => filter === "all" || eventStatus(e) === filter)
    .sort((a, b) => (a.date ? new Date(a.date).getTime() : Infinity) - (b.date ? new Date(b.date).getTime() : Infinity));

  const countFor = (key: StatusFilter) =>
    key === "all" ? events.length : events.filter((e) => eventStatus(e) === key).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-4 mb-5">
            <span className="stamp text-blue">Editor's Desk</span>
            <span className="label-mono text-ink-soft">{events.length} LISTINGS</span>
          </div>
          <h1 className="display text-5xl md:text-6xl mb-4">
            Manage <span className="bg-orange text-paper px-2 border-2 border-ink inline-block -rotate-1">Events</span>
          </h1>
          <p className="text-ink-soft text-lg">The lineup lives here — every event is added by hand, never hardcoded.</p>
        </div>
        <button onClick={openCreate} className="btn btn-ink shrink-0">
          <Plus className="w-5 h-5" /> Create Event
        </button>
      </header>

      {/* Status filter + search */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex gap-2 flex-wrap">
          {filterTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={`btn !px-4 !py-2 text-xs ${filter === t.key ? "btn-ink" : "btn-ghost"}`}
            >
              {t.label} <span className="opacity-70">({countFor(t.key)})</span>
            </button>
          ))}
        </div>
        <div className="relative md:ml-auto md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-soft" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, category, venue… (press /)"
            className="input !pl-12"
          />
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4">
          <div className="paper-card p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="display text-3xl">{editing ? "Edit Event" : "New Listing"}</h2>
              <button onClick={() => setShowForm(false)} className="w-10 h-10 border-2 border-ink bg-paper-2 flex items-center justify-center hover:bg-red hover:text-paper transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="label-mono text-ink">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="input" />
              </div>
              <div className="space-y-2">
                <label className="label-mono text-ink">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} required className="input resize-none" />
              </div>
              <div className="space-y-2">
                <label className="label-mono text-ink">Location</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required className="input" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="label-mono text-ink">Starts (optional — leave blank for TBD)</label>
                  <input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" />
                  {!form.date && (
                    <p className="font-mono text-[10px] uppercase tracking-widest text-orange">Blank = "COMING SOON" · date can be set later when confirmed</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="label-mono text-ink">Ends (optional)</label>
                  <input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="label-mono text-ink">Capacity</label>
                  <input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 1 })} required className="input" />
                </div>
                <div className="space-y-2">
                  <label className="label-mono text-ink">Category</label>
                  <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required className="input" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="label-mono text-ink">Banner</label>
                {form.imageUrl ? (
                  <div className="relative border-2 border-ink overflow-hidden">
                    <img src={form.imageUrl} alt="Event banner preview" className="w-full h-40 object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 py-2 bg-ink/70">
                      <span className="label-mono text-[9px] text-lime">
                        {form.imageUrl.startsWith("http") ? "EXTERNAL URL" : `COMPRESSED · ~${dataUrlSizeKb(form.imageUrl)} KB`}
                      </span>
                      <span className="ml-auto flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="label-mono text-[9px] bg-lime text-ink hover:bg-orange hover:text-paper transition-colors px-2 py-1 border-2 border-ink"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                          className="label-mono text-[9px] bg-paper text-red hover:bg-red hover:text-paper transition-colors px-2 py-1 border-2 border-ink"
                        >
                          Remove
                        </button>
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) void handleBanner(f);
                    }}
                    className={`w-full h-40 border-2 border-dashed border-ink flex flex-col items-center justify-center gap-2 text-ink-soft hover:border-orange hover:text-orange transition-colors cursor-pointer ${
                      dragOver ? "border-orange text-orange bg-orange/5" : ""
                    }`}
                  >
                    {compressing ? (
                      <>
                        <div className="w-6 h-6 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                        <span className="font-mono text-xs uppercase tracking-widest">Compressing…</span>
                      </>
                    ) : (
                      <>
                        <ImagePlus className="w-8 h-8" />
                        <span className="font-mono text-xs uppercase tracking-widest">
                          {dragOver ? "Drop it!" : "Upload banner — PNG / JPG / WebP"}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-ink-soft">
                          Auto-compressed in your browser · full quality kept
                        </span>
                      </>
                    )}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleBanner(f);
                    e.target.value = "";
                  }}
                />
                <input type="text" value={form.imageUrl.startsWith("data:image/") ? "" : form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="…or paste an external image URL" className="input !text-xs" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none border-2 border-ink bg-paper-2 p-3">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  className="w-5 h-5 accent-lime"
                />
                <span className="font-mono text-xs uppercase tracking-widest">Listed on the public site</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none border-2 border-ink bg-paper-2 p-3">
                <input
                  type="checkbox"
                  checked={form.isOpen}
                  onChange={(e) => setForm({ ...form, isOpen: e.target.checked })}
                  className="w-5 h-5 accent-lime"
                />
                <span className="font-mono text-xs uppercase tracking-widest">Open for registrations</span>
              </label>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                Unticking "Open for registrations" instantly blocks the register button for attendees — in realtime.
              </p>
              <div className="flex gap-4 pt-3">
                <button type="submit" className="btn btn-orange flex-1">
                  {editing ? "Update Event" : "Print Listing"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Events List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 paper-card skeleton-stripes" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 paper-card border-2 border-dashed border-ink">
          <CalendarPlus className="w-12 h-12 text-orange mx-auto mb-4" />
          <p className="display text-2xl mb-2">{events.length === 0 ? "The ledger is empty" : "No listings here"}</p>
          <p className="text-ink-soft mb-6">
            {events.length === 0 ? "Print the first event and open the doors." : "Try another filter — or print a new event."}
          </p>
          <button onClick={openCreate} className="btn btn-ink mx-auto">
            <Plus className="w-5 h-5" /> Create Event <span className="opacity-60">(N)</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((event) => {
            const st = eventStatus(event);
            const meta = statusMeta[st];
            return (
              <div
                key={event.id}
                className="paper-card paper-card-press p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="display text-xl">{event.title}</h3>
                    <span className={`border-2 border-ink label-mono text-[9px] px-2 py-0.5 ${meta.cls}`}>{meta.label}</span>
                    {st === "live" && <Radio className="w-4 h-4 text-green" />}
                    {!event.isOpen && (
                      <span className="border-2 border-ink bg-red text-paper label-mono text-[9px] px-2 py-0.5">REGISTRATIONS CLOSED</span>
                    )}
                    {!event.isPublished && (
                      <span className="border-2 border-ink bg-red text-paper label-mono text-[9px] px-2 py-0.5">HIDDEN</span>
                    )}
                    <span className="bg-lime border-2 border-ink label-mono text-[9px] px-2 py-0.5">{event.category}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 font-mono text-xs uppercase tracking-wide text-ink-soft">
                    {event.date ? (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-orange" />
                        {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {new Date(event.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        {event.endDate &&
                          ` → ${new Date(event.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-orange font-bold">
                        <Clock className="w-4 h-4" /> Date TBD · Coming Soon
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-blue" />
                      {event.location}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-green" />
                      {event.registeredCount}/{event.capacity} registered
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <IconBtn onClick={() => navigate(`/admin/events/${event.id}`)} title="Attendees list" className="hover:bg-blue hover:text-paper">
                    <Users className="w-4 h-4" />
                  </IconBtn>
                  <IconBtn onClick={() => handleExport(event.id)} title="Export CSV" className="hover:bg-orange hover:text-paper">
                    <Download className="w-4 h-4" />
                  </IconBtn>
                  <IconBtn onClick={() => togglePublish(event)} title={event.isPublished ? "Unlist from public site" : "List on public site"} className="hover:bg-lime">
                    {event.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </IconBtn>
                  <IconBtn onClick={() => toggleOpen(event)} title={event.isOpen ? "Close registrations now" : "Reopen registrations"} className="hover:bg-orange hover:text-paper">
                    {event.isOpen ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </IconBtn>
                  <IconBtn onClick={() => handleEdit(event)} title="Edit" className="hover:bg-lime">
                    <Edit className="w-4 h-4" />
                  </IconBtn>
                  <IconBtn onClick={() => setDeletingId(event.id)} title="Delete" className="hover:bg-red hover:text-paper">
                    <Trash2 className="w-4 h-4" />
                  </IconBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        title="Delete Event?"
        message={
          deletingId
            ? `"${events.find((e) => e.id === deletingId)?.title ?? "This event"}" and its registrations will be wiped from the ledger. There is no undo.`
            : ""
        }
        confirmWord="delete"
        confirmLabel="Delete Event"
        onConfirm={() => deletingId && handleDelete(deletingId)}
        onClose={() => setDeletingId(null)}
      />
    </div>
  );
}

function IconBtn({ children, onClick, title, className = "" }: { children: React.ReactNode; onClick: () => void; title: string; className?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-10 h-10 border-2 border-ink bg-card flex items-center justify-center shadow-[2px_2px_0_#1c1813] hover:shadow-[3px_3px_0_#1c1813] transition-all text-ink ${className}`}
    >
      {children}
    </button>
  );
}
