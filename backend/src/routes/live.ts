import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { subscribeEventCount, subscribeAdminStream, refreshLiveCount, ensureLiveCount } from "../live.js";

export const liveRouter = Router();

function sseHeaders(res: any) {
  res.status(200);
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
}

liveRouter.get("/events/:id/live-count", async (req, res) => {
  const { id } = req.params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  // Bring the authoritative registry up to date, then emit from it — everyone
  // connected (SSE or WS) serves the same number.
  sseHeaders(res);
  await refreshLiveCount(id);
  const current = await ensureLiveCount(id);
  res.write(`event: count\ndata: ${JSON.stringify({ registeredCount: current })}\n\n`);

  subscribeEventCount(id, res);
});

// EventSource can't send Authorization headers, so the access token travels in
// ?access_token= (authenticate accepts both) and the user must be an admin.
liveRouter.get("/admin/registrations-stream", authenticate, requireAdmin, (req, res) => {
  sseHeaders(res);
  subscribeAdminStream(res);
});