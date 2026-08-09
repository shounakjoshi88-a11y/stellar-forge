import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../lib/auth.js";
import { broadcastRefresh, broadcastRegistration, pushAdminRegistration, refreshLiveCount } from "../live.js";

export const registrationsRouter = Router();

registrationsRouter.use(authenticate);

registrationsRouter.get("/my", async (req, res) => {
  const user = (req as any).user;

  const registrations = await prisma.registration.findMany({
    where: { userId: user.userId },
    select: {
      id: true,
      ticketId: true,
      status: true,
      registeredAt: true,
      usedCount: true,
      lastScannedAt: true,
      event: {
        select: { id: true, title: true, date: true, location: true, category: true },
      },
    },
    orderBy: { registeredAt: "desc" },
  });

  res.json(registrations);
});

registrationsRouter.post("/:eventId", async (req, res) => {
  const user = (req as any).user;
  const { eventId } = req.params;

  // Atomic seat claim: the Event row is locked (FOR UPDATE) inside the
  // transaction, so two users racing for the LAST seat serialize at the DB —
  // exactly one wins, the other gets "Event is full". Never oversold.
  const outcome = await prisma.$transaction(
    async (tx) => {
      const eventRow = await tx.$queryRaw<{ capacity: number; isOpen: boolean }[]>`
        SELECT "capacity", "isOpen" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE
      `;
      if (eventRow.length === 0) return { kind: "not_found" as const };

      if (!eventRow[0].isOpen) return { kind: "closed" as const };

      const [{ count }] = await tx.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS "count" FROM "Registration"
        WHERE "eventId" = ${eventId} AND "status" <> 'CANCELLED'
      `;

      const capacity = eventRow[0].capacity;
      if (count >= capacity) return { kind: "full" as const, capacity, count };

      const existing = await tx.registration.findUnique({
        where: { userId_eventId: { userId: user.userId, eventId } },
      });
      if (existing) return { kind: "already" as const };

      const registration = await tx.registration.create({
        data: {
          userId: user.userId,
          eventId,
          ticketId: `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        },
        select: {
          id: true,
          ticketId: true,
          eventId: true,
          status: true,
          registeredAt: true,
          event: { select: { id: true, title: true, date: true, location: true, category: true } },
        },
      });
      return { kind: "created" as const, registration };
    },
    { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 }
  );

  if (outcome.kind === "not_found") {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  if (outcome.kind === "already") {
    res.status(400).json({ error: "Already registered for this event" });
    return;
  }
  if (outcome.kind === "closed") {
    res.status(409).json({ error: "Registrations are closed for this event" });
    return;
  }
  if (outcome.kind === "full") {
    res.status(409).json({ error: "Event is full", spotsLeft: 0 });
    return;
  }

  const registration = outcome.registration;
  await refreshLiveCount(eventId);

  const timestamp = new Date().toISOString();
  pushAdminRegistration(timestamp);
  broadcastRegistration({
    type: "registration",
    attendeeFirstName: user.name?.split(" ")[0] || "Someone",
    eventTitle: registration.event.title,
    eventId,
    timestamp,
  });
  broadcastRefresh();

  res.status(201).json(registration);
});

registrationsRouter.delete("/:eventId", async (req, res) => {
  const user = (req as any).user;
  const { eventId } = req.params;

  const registration = await prisma.registration.findUnique({
    where: { userId_eventId: { userId: user.userId, eventId } },
  });

  if (!registration) {
    res.status(404).json({ error: "Registration not found" });
    return;
  }

  await prisma.registration.update({
    where: { id: registration.id },
    data: { status: "CANCELLED" },
  });

  // A cancelled seat is free again — push the corrected count to everyone.
  await refreshLiveCount(eventId);
  broadcastRefresh();

  res.json({ message: "Registration cancelled" });
});

registrationsRouter.get("/ticket/:ticketId", async (req, res) => {
  const user = (req as any).user;
  const { ticketId } = req.params;

  const registration = await prisma.registration.findUnique({
    where: { ticketId },
    select: {
      id: true,
      userId: true,
      ticketId: true,
      status: true,
      registeredAt: true,
      event: { select: { id: true, title: true, date: true, location: true, category: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!registration) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (registration.userId !== user.userId && user.role !== "ADMIN") {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(registration);
});
