import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Ticket } from "lucide-react";
import { useLiveFeed, type LiveRegistration } from "../hooks/useLive.js";
import { Link } from "react-router-dom";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.max(1, Math.floor(diff / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function FeedRow({ item, compact }: { item: LiveRegistration; compact?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: reduce ? 0 : -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.3 }}
      className={`flex items-center gap-2 ${compact ? "" : "border-b-2 border-dashed border-ink last:border-0 py-2.5"}`}
    >
      <span className="w-6 h-6 bg-lime border-2 border-ink flex items-center justify-center shrink-0">
        <Ticket className="w-3.5 h-3.5" />
      </span>
      <span className="font-mono text-xs uppercase tracking-wide truncate">
        <span className="font-bold text-orange">{item.attendeeFirstName}</span>{" "}
        {compact ? "just grabbed a pass" : "grabbed a pass for"}
        {!compact && (
          <>
            {" "}
            <Link to={`/events/${item.eventId}`} className="font-bold text-ink underline decoration-2 underline-offset-2 hover:text-orange">
              {item.eventTitle}
            </Link>
          </>
        )}
      </span>
      <span className="ml-auto font-mono text-[10px] text-ink-soft shrink-0">{timeAgo(item.timestamp)}</span>
    </motion.div>
  );
}

/** Live "recently registered" ticker. Fails silently if the WS is down. */
export function LiveFeedTicker({ compact = false }: { compact?: boolean }) {
  const { events } = useLiveFeed();

  if (events.length === 0) {
    if (compact) {
      return (
        <div className="py-1.5 font-mono text-[11px] uppercase tracking-widest text-ink-soft">
          <span className="inline-block w-2 h-2 bg-orange border border-ink rounded-full mr-2 animate-blink" />
          Live gate counter · awaiting first sale
        </div>
      );
    }
    return (
      <div className="py-4 text-center font-mono text-xs uppercase tracking-widest text-ink-soft">
        The gate is open — sales will appear here live.
      </div>
    );
  }

  if (compact) {
    const latest = events[0];
    return <FeedRow item={latest} compact />;
  }

  return (
    <div>
      <AnimatePresence initial={false}>
        {events.slice(0, 10).map((item) => (
          <FeedRow key={item.timestamp + item.eventId + item.attendeeFirstName} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}