import { useEffect, useRef, useState } from "react";
import { API_URL } from "../config.js";
import { getSupabase } from "../lib/client.js";

export interface LiveRegistration {
  type: "registration";
  attendeeFirstName: string;
  eventTitle: string;
  eventId: string;
  timestamp: string;
}

const MAX_FEED_ITEMS = 20;

function wsBaseUrl(): string {
  return API_URL.replace(/\/api\/?$/, "").replace(/^http/, "ws");
}

/**
 * Live registration feed over WebSocket.
 * - Exponential backoff reconnect (1s → 15s cap)
 * - Reconnect paused while document.hidden, resumed on visibilitychange
 * - Fails silently — a WS outage must never break the page
 */
export function useLiveFeed() {
  const [events, setEvents] = useState<LiveRegistration[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let backoff = 1000;
    let closed = false;
    let visible = !document.hidden;

    const pushEvent = (data: LiveRegistration) => {
      setEvents((prev) => {
        const next = [data, ...prev];
        return next.slice(0, MAX_FEED_ITEMS);
      });
    };

    const connect = () => {
      if (closed || !visible) return;

      let ws: WebSocket;
      try {
        ws = new WebSocket(`${wsBaseUrl()}/ws/live-feed`);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        backoff = 1000;
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as string) as LiveRegistration;
          if (data.type === "registration") pushEvent(data);
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* already closed */
        }
      };
    };

    const scheduleReconnect = () => {
      if (closed || !visible) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        backoff = Math.min(backoff * 2, 15_000);
        connect();
      }, backoff);
    };

    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) {
        connect();
      } else if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    connect();

    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { events };
}

/**
 * Live attendee counts over a SINGLE shared WebSocket.
 *
 * Why not one EventSource per viewer? N viewers × N open sockets + N heartbeat
 * timers gets heavy at scale, and each client polling the DB independently can
 * show different numbers. Here the server holds ONE authoritative count per
 * event and broadcasts it — every subscriber receives the identical value, and
 * the cost is a single socket regardless of how many cards are on the page.
 */
type CountListener = (count: number) => void;
const countListeners = new Map<string, Set<CountListener>>();

let countSocket: WebSocket | null = null;
let countSocketRetry = 1000;

function ensureCountSocket() {
  if (countSocket || typeof WebSocket === "undefined") return;
  let ws: WebSocket;
  try {
    ws = new WebSocket(`${wsBaseUrl()}/ws/live-feed`);
  } catch {
    setTimeout(ensureCountSocket, countSocketRetry);
    return;
  }
  countSocket = ws;

  ws.onopen = () => {
    countSocketRetry = 1000;
    // (Re)subscribe to everything currently in use — the server replies with
    // the authoritative count for each, so numbers resync on reconnect.
    for (const eventId of countListeners.keys()) {
      ws.send(JSON.stringify({ type: "subscribe", eventId }));
    }
  };

  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data as string);
      if (data.type !== "count" || typeof data.registeredCount !== "number") return;
      const listeners = countListeners.get(data.eventId);
      if (!listeners) return;
      for (const cb of [...listeners]) cb(data.registeredCount);
    } catch {
      /* ignore malformed frames */
    }
  };

  ws.onclose = () => {
    countSocket = null;
    setTimeout(() => {
      countSocketRetry = Math.min(countSocketRetry * 2, 15_000);
      ensureCountSocket();
    }, countSocketRetry);
  };

  ws.onerror = () => {
    try {
      ws.close();
    } catch {
      /* already closed */
    }
  };
}

function subscribeCount(eventId: string, cb: CountListener) {
  if (!countListeners.has(eventId)) countListeners.set(eventId, new Set());
  countListeners.get(eventId)!.add(cb);
  ensureCountSocket();
  if (countSocket?.readyState === WebSocket.OPEN) {
    countSocket.send(JSON.stringify({ type: "subscribe", eventId }));
  }
}

function unsubscribeCount(eventId: string, cb: CountListener) {
  const set = countListeners.get(eventId);
  if (!set) return;
  set.delete(cb);
  if (set.size === 0) countListeners.delete(eventId);
}

/** Live registered count for a single event. null until the first value arrives. */
export function useLiveCount(eventId: string): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    const cb = (n: number) => {
      if (active) setCount(n);
    };
    subscribeCount(eventId, cb);
    return () => {
      active = false;
      unsubscribeCount(eventId, cb);
    };
  }, [eventId]);

  return count;
}

/**
 * Admin registrations stream (SSE). Calls onEvent with an ISO timestamp per registration.
 *
 * EventSource reconnects natively but reuses the SAME URL — and the access
 * token baked into it expires (1h) / gets rotated, so a stale reconnect loops 401
 * forever. Instead we disable native retries (close on error) and re-open the
 * stream ourselves with a freshly-refreshed session token, backing off on failure.
 */
export function useAdminRegistrationStream(onEvent: (timestamp: string) => void) {
  useEffect(() => {
    let source: EventSource | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let backoff = 1000;

    const setup = async () => {
      if (cancelled) return;
      const { data } = await getSupabase().auth.getSession(); // auto-refreshes an expired session
      if (cancelled || !data.session?.access_token) return;

      source = new EventSource(
        `${API_URL}/admin/registrations-stream?access_token=${encodeURIComponent(data.session.access_token)}`
      );

      source.addEventListener("registration", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data) as { timestamp: string };
          onEvent(data.timestamp);
        } catch {
          /* ignore */
        }
      });

      // Don't let EventSource retry a dead token forever — teardown and rebuild
      // with a refreshed session after a short backoff.
      source.onerror = () => {
        try {
          source?.close();
        } catch {
          /* ignore */
        }
        source = null;
        if (cancelled) return;
        timer = setTimeout(() => {
          backoff = Math.min(backoff * 2, 15_000);
          setup();
        }, backoff);
      };
    };

    setup();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      try {
        source?.close();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ── Realtime refresh signal ──────────────────────────────────────────────
// The server broadcasts { type: "refresh" } over the SAME live-feed socket
// whenever any write happens (registration, cancel, scan, event open/close,
// update posted). Listeners refetch their data — no polling, fire-on-write.

type RefreshListener = () => void;
const refreshListeners = new Set<RefreshListener>();
let refreshSocket: WebSocket | null = null;
let refreshRetry = 1000;

// In-page reactions: any client may subscribe to registration / scan activity
// travelling on the live-feed socket (see useLiveActivity below).
interface ActivityEvent {
  type: "registration" | "scan";
  attendeeFirstName?: string;
  attendee?: string;
  eventTitle?: string;
  direction?: "entry" | "exit";
  eventId?: string;
}
type ActivityListener = (msg: ActivityEvent) => void;
const activityListeners = new Set<ActivityListener>();

function ensureRefreshSocket() {
  if (refreshSocket || typeof WebSocket === "undefined") return;
  let ws: WebSocket;
  try {
    ws = new WebSocket(`${wsBaseUrl()}/ws/live-feed`);
  } catch {
    setTimeout(ensureRefreshSocket, refreshRetry);
    return;
  }
  refreshSocket = ws;

  ws.onopen = () => {
    refreshRetry = 1000;
  };

  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data as string);
      if (data.type === "refresh") {
        for (const cb of [...refreshListeners]) cb();
      } else if (data.type === "registration" || data.type === "scan") {
        for (const cb of [...activityListeners]) cb(data as ActivityEvent);
      }
    } catch {
      /* ignore malformed frames */
    }
  };

  ws.onclose = () => {
    refreshSocket = null;
    setTimeout(() => {
      refreshRetry = Math.min(refreshRetry * 2, 15_000);
      ensureRefreshSocket();
    }, refreshRetry);
  };

  ws.onerror = () => {
    try {
      ws.close();
    } catch {
      /* already closed */
    }
  };
}

/** Fire onRefetch whenever the server signals any write. */
export function useRealtimeRefresh(onRefetch: () => void) {
  const cbRef = useRef(onRefetch);
  cbRef.current = onRefetch;

  useEffect(() => {
    const cb = () => cbRef.current();
    refreshListeners.add(cb);
    ensureRefreshSocket();
    return () => {
      refreshListeners.delete(cb);
    };
  }, []);
}

/** Fire onActivity whenever a registration or a door scan lands on the live feed. */
export function useLiveActivity(onActivity: (msg: ActivityEvent) => void) {
  const cbRef = useRef(onActivity);
  cbRef.current = onActivity;

  useEffect(() => {
    const cb = (msg: ActivityEvent) => cbRef.current(msg);
    activityListeners.add(cb);
    ensureRefreshSocket();
    return () => {
      activityListeners.delete(cb);
    };
  }, []);
}