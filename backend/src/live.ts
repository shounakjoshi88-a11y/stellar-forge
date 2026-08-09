import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { Response } from "express";
import { prisma } from "./lib/prisma.js";

export interface LiveRegistrationEvent {
  type: "registration";
  attendeeFirstName: string;
  eventTitle: string;
  eventId: string;
  timestamp: string;
}

const wsClients = new Set<WebSocket>();

// Live attendee-count subscribers, keyed per event (SSE legacy channel)
const countSubscribers = new Map<string, Set<Response>>();

// Admin registrations-stream subscribers
let adminSubscribers = new Set<Response>();

// Authoritative per-event registered counts. ONE source of truth in server
// memory: every viewer (WS or SSE) receives the same number from here, and the
// value only changes when someone actually registers/cancels — never per-client
// polling, so 1,000 viewers cost the same as 1.
const liveCounts = new Map<string, number>();

export function setupLiveServer(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/live-feed" });

  wss.on("connection", (ws) => {
    wsClients.add(ws);
    (ws as any).isAlive = true;

    ws.on("pong", () => {
      (ws as any).isAlive = true;
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "subscribe" && typeof msg.eventId === "string") {
          (ws as any).subscribedEvent = msg.eventId;
          // Reply with the authoritative count (loads from DB once if unknown).
          void ensureLiveCount(msg.eventId).then((n) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "count", eventId: msg.eventId, registeredCount: n }));
            }
          });
        }
      } catch {
        /* ignore malformed frames */
      }
    });

    ws.on("close", () => wsClients.delete(ws));
    ws.on("error", () => {});
  });

  const heartbeat = setInterval(() => {
    for (const ws of wsClients) {
      if ((ws as any).isAlive === false) {
        ws.terminate();
        continue;
      }
      (ws as any).isAlive = false;
      ws.ping();
    }
  }, 30_000);

  (wss as any).on("close", () => {
    clearInterval(heartbeat);
    wsClients.clear();
  });
}

/** Get the authoritative count for an event, loading from DB exactly once. */
export async function ensureLiveCount(eventId: string): Promise<number> {
  if (!liveCounts.has(eventId)) {
    const n = await prisma.registration.count({
      where: { eventId, status: { not: "CANCELLED" } },
    });
    liveCounts.set(eventId, n);
  }
  return liveCounts.get(eventId)!;
}

/**
 * Recompute a single event's count from the DB and fan it out to every
 * subscriber (WS + legacy SSE) in one shot. Called ONLY on write events
 * (registration create/cancel) — cost is bounded by write rate, not viewers.
 */
export async function refreshLiveCount(eventId: string) {
  const n = await prisma.registration.count({
    where: { eventId, status: { not: "CANCELLED" } },
  });
  liveCounts.set(eventId, n);

  const subs = countSubscribers.get(eventId);
  if (subs && subs.size > 0) {
    const payload = `event: count\ndata: ${JSON.stringify({ registeredCount: n })}\n\n`;
    for (const res of subs) {
      try {
        res.write(payload);
      } catch {
        subs.delete(res);
      }
    }
  }

  const wsPayload = JSON.stringify({ type: "count", eventId, registeredCount: n });
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN && (ws as any).subscribedEvent === eventId) {
      try {
        ws.send(wsPayload);
      } catch {
        /* client gone; heartbeat will reap it */
      }
    }
  }
}

export interface LiveScanEvent {
  type: "scan";
  attendee: string;
  eventTitle: string;
  direction: "entry" | "exit";
  timestamp: string;
}

/** Tell every connected client a door scan happened, so in-page reactions fire. */
export function broadcastScan(data: LiveScanEvent) {
  const payload = JSON.stringify(data);
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch {
        /* ignore */
      }
    }
  }
}

export function broadcastRegistration(data: LiveRegistrationEvent) {
  const payload = JSON.stringify(data);
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Tell every connected client that a write happened (registration, event
 * update, scan, event open/close). Clients that show derived totals / times /
 * content refetch their data instead of polling — the signal is fire-on-write.
 */
export function broadcastRefresh() {
  const payload = JSON.stringify({ type: "refresh", at: Date.now() });
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch {
        /* ignore */
      }
    }
  }
}

export function subscribeEventCount(eventId: string, res: Response) {
  if (!countSubscribers.has(eventId)) countSubscribers.set(eventId, new Set());
  countSubscribers.get(eventId)!.add(res);

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 15_000);

  res.on("close", () => {
    clearInterval(heartbeat);
    countSubscribers.get(eventId)?.delete(res);
  });
}

export function subscribeAdminStream(res: Response): void {
  adminSubscribers.add(res);
  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 15_000);
  res.on("close", () => {
    clearInterval(heartbeat);
    adminSubscribers.delete(res);
  });
}

export function pushAdminRegistration(timestamp: string) {
  const payload = `event: registration\ndata: ${JSON.stringify({ timestamp })}\n\n`;
  for (const res of [...adminSubscribers]) {
    try {
      res.write(payload);
    } catch {
      adminSubscribers.delete(res);
    }
  }
}
