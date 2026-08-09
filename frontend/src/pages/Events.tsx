import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Search, MapPin, Calendar, Users } from "lucide-react";
import { TicketPunch, StampIn, CountUp } from "../components/motion.js";
import { useLiveCount, useRealtimeRefresh } from "../hooks/useLive.js";
import { setMorphSource } from "../lib/morph.js";

import { API_URL } from "../config.js";

interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string | null;
  capacity: number;
  category: string;
  imageUrl: string;
  registeredCount: number;
  spotsLeft: number;
  isOpen: boolean;
}

export function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_URL}/events/categories`)
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Fetch the full list once; filtering is client-side (live search, no spinner)
    axios
      .get(`${API_URL}/events?limit=100`)
      .then((res) => setEvents(res.data?.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Realtime: refetch when the server signals any write (event closed/opened,
  // new listing, etc). Seat counts are live per-card via the count socket.
  useRealtimeRefresh(() => {
    axios
      .get(`${API_URL}/events?limit=100`)
      .then((res) => setEvents(res.data?.events ?? []))
      .catch(() => {});
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (category && e.category !== category) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    });
  }, [events, search, category]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-5">
          <StampIn className="stamp text-green">Open Season</StampIn>
          <span className="label-mono text-ink-soft">{filtered.length} LISTINGS</span>
        </div>
        <h1 className="display text-5xl md:text-7xl mb-6">
          This Season's
          <br />
          <span className="bg-lime px-2 border-2 border-ink inline-block -rotate-1">Line-Up</span>
        </h1>
        <p className="text-lg text-ink-soft max-w-xl">
          Every event worth your evening, sorted by relevance. Flick the filters,
          pick a date, grab a seat.
        </p>
      </header>

      {/* Search & Filters — instant, client-side */}
      <div className="flex flex-col sm:flex-row gap-4 mb-12">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-soft" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, locations, topics… (instant)"
            className="input !pl-12"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input min-w-[200px] cursor-pointer appearance-none"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c} className="bg-card">{c}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-96 paper-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 paper-card">
          <div className="w-20 h-20 bg-blue border-2 border-ink flex items-center justify-center mx-auto mb-6 text-paper">
            <Search className="w-10 h-10" />
          </div>
          <p className="display text-3xl mb-2">Nothing found</p>
          <p className="text-ink-soft">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-6">
          {filtered.map((event, i) => (
            <EventCard key={event.id} event={event} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ event, index }: { event: Event; index: number }) {
  const liveCount = useLiveCount(event.id);
  const registeredCount = liveCount ?? event.registeredCount;
  const spotsLeft = event.capacity - registeredCount;

  return (
    <TicketPunch className="animate-fade-up" corner="top-right">
      <Link
        to={`/events/${event.id}`}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMorphSource(rect);
        }}
        className="block group paper-card overflow-hidden h-full"
      >
        <div className="h-48 bg-ink relative overflow-hidden border-b-2 border-ink">
          {event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-ink flex items-center justify-center">
              <span className="display text-6xl text-paper/20">{event.title[0]}</span>
            </div>
          )}
          <span className="absolute top-3 left-3 bg-lime border-2 border-ink px-2.5 py-1 label-mono text-ink shadow-[2px_2px_0_#1c1813]">
            {event.category}
          </span>
          <span
            className={`absolute top-3 right-3 border-2 border-ink px-2.5 py-1 label-mono text-[10px] shadow-[2px_2px_0_#1c1813] ${
              !event.isOpen ? "bg-red text-paper" : spotsLeft > 0 ? "bg-orange text-paper" : "bg-red text-paper"
            }`}
          >
            {!event.isOpen ? "CLOSED" : spotsLeft > 0 ? `${spotsLeft} LEFT` : "SOLD OUT"}
          </span>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-ink text-orange font-mono text-[11px] px-2 py-0.5">#{String(index + 1).padStart(3, "0")}</span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">
              {event.date
                ? new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Date TBD · Coming Soon"}
            </span>
            {liveCount !== null && (
              <span className="ml-auto inline-block bg-green text-paper border-2 border-ink label-mono text-[9px] px-1.5 py-0.5 animate-blink">
                LIVE
              </span>
            )}
          </div>
          <h3 className="display text-xl mb-3 group-hover:text-orange transition-colors line-clamp-1">
            {event.title}
          </h3>
          <p className="text-sm text-ink-soft leading-relaxed line-clamp-2 mb-5">{event.description}</p>
          <div className="flex items-center justify-between text-sm text-ink-soft border-t-2 border-dashed border-ink pt-4">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-orange" />
              {event.location.split(",")[0]}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue" />
              <CountUp value={registeredCount} />/{event.capacity}
            </span>
          </div>
        </div>
      </Link>
    </TicketPunch>
  );
}