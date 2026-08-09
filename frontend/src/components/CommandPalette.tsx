import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import axios from "axios";
import { Search, CalendarDays, Ticket, LayoutDashboard, Shield, ScanLine, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";
import { API_URL } from "../config.js";

interface EventItem {
  id: string;
  title: string;
  category: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open && events.length === 0) {
      axios
        .get(`${API_URL}/events?limit=50`)
        .then((res) => {
          const list = (res.data?.events ?? []).map((e: any) => ({
            id: e.id,
            title: e.title,
            category: e.category,
          }));
          setEvents(list);
        })
        .catch(() => {});
    }
  }, [open, events.length]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 label-mono text-ink-soft hover:text-ink transition-colors"
        aria-label="Open command palette"
      >
        <Search className="w-4 h-4" />
        Jump to…
        <kbd className="border-2 border-ink bg-card px-1.5 py-0.5 text-[10px] text-ink">⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] bg-ink/70 flex items-start justify-center pt-[14vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div className="paper-card w-full max-w-lg overflow-hidden animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 bg-ink text-paper">
              <span className="label-mono text-orange">QUICK JUMPS</span>
              <button onClick={() => setOpen(false)} className="hover:text-orange transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <Command
              className="bg-card"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            >
              <Command.Input
                autoFocus
                placeholder="Type an event, a page, anything…"
                className="w-full px-5 py-4 font-body text-lg border-b-2 border-ink bg-transparent outline-none placeholder:text-ink-soft"
              />
              <Command.List className="max-h-80 overflow-y-auto py-2">
                <Command.Empty className="px-5 py-6 text-center font-mono text-xs uppercase tracking-widest text-ink-soft">
                  No matches in the drawer
                </Command.Empty>

                <Command.Group heading={<GroupLabel>Pages</GroupLabel>}>
                  <Item icon={<CalendarDays className="w-4 h-4" />} onSelect={() => go("/events")}>
                    Browse Events
                  </Item>
                  {user && (
                    <>
                      <Item icon={<Ticket className="w-4 h-4" />} onSelect={() => go("/my-registrations")}>
                        My Tickets
                      </Item>
                      <Item icon={<LayoutDashboard className="w-4 h-4" />} onSelect={() => go("/dashboard")}>
                        My Dashboard
                      </Item>
                    </>
                  )}
                  {user?.role === "ADMIN" && (
                    <>
                      <Item icon={<Shield className="w-4 h-4" />} onSelect={() => go("/admin")}>
                        Admin Ledger
                      </Item>
                      <Item icon={<ScanLine className="w-4 h-4" />} onSelect={() => go("/admin/scan")}>
                        Gate Scanner
                      </Item>
                      <Item icon={<CalendarDays className="w-4 h-4" />} onSelect={() => go("/admin/events")}>
                        Manage Events
                      </Item>
                      {user.isOwner && (
                        <Item icon={<Shield className="w-4 h-4" />} onSelect={() => go("/admin/team")}>
                          Manage Team
                        </Item>
                      )}
                    </>
                  )}
                </Command.Group>

                {events.length > 0 && (
                  <Command.Group heading={<GroupLabel>Events</GroupLabel>}>
                    {events.map((e) => (
                      <Item key={e.id} onSelect={() => go(`/events/${e.id}`)}>
                        <span className="font-bold truncate">{e.title}</span>
                        <span className="ml-auto shrink-0 bg-lime border-2 border-ink label-mono text-[9px] px-1.5 py-0.5">
                          {e.category}
                        </span>
                      </Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </div>
        </div>
      )}
    </>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 pt-3 pb-1 font-mono text-[10px] uppercase tracking-widest text-ink-soft">{children}</div>
  );
}

function Item({
  children,
  onSelect,
  icon,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-3 px-5 py-2.5 cursor-pointer font-body text-sm data-[selected=true]:bg-ink data-[selected=true]:text-paper"
    >
      {icon}
      {children}
    </Command.Item>
  );
}