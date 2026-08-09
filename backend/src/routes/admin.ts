import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireAdmin, requireOwner } from "../lib/auth.js";
import { broadcastRefresh, broadcastScan } from "../live.js";

export const adminRouter = Router();

// ── Team management (owner-only; deliberately NOT behind requireAdmin, so a
//    stale DB role can never lock the owner out of the role manager) ──

const roleSchema = z.object({ role: z.enum(["ADMIN", "ATTENDEE"]) });

adminRouter.get("/users", authenticate, requireOwner, async (req, res) => {
  const { search } = req.query;
  const q = typeof search === "string" ? search : undefined;
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as any } },
            { email: { contains: q, mode: "insensitive" as any } },
          ],
        }
      : undefined,
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(users);
});

adminRouter.put("/users/:id/role", authenticate, requireOwner, async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id as string } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const ownerEmails = (process.env.ADMIN_OWNER_EMAIL || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  if (ownerEmails.includes(target.email.toLowerCase())) {
    res.status(400).json({ error: "The owner's role cannot be changed via this endpoint" });
    return;
  }

  let newRole: "ADMIN" | "ATTENDEE";
  try {
    newRole = roleSchema.parse(req.body).role;
  } catch {
    res.status(400).json({ error: "role must be ADMIN or ATTENDEE" });
    return;
  }

  const actor = (req as any).user as { userId: string; email: string };

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: target.id },
      data: { role: newRole },
      select: { id: true, email: true, name: true, role: true },
    });
    await tx.adminAuditLog.create({
      data: {
        actorId: actor.userId,
        actorEmail: actor.email,
        targetId: target.id,
        targetEmail: target.email,
        oldRole: target.role,
        newRole,
      },
    });
    return u;
  });

  res.json(updated);
});

adminRouter.get("/audit-log", authenticate, requireOwner, async (_req, res) => {
  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(logs);
});

adminRouter.use(authenticate, requireAdmin);

const eventSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(3),
  location: z.string().min(2),
  date: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  capacity: z.number().min(1),
  category: z.string().min(1),
  imageUrl: z
    .string()
    .optional()
    .nullable()
    .refine(
      (v) => {
        if (!v) return true;
        // Uploaded banners come in as compressed data URLs (png/jpeg/webp),
        // capped at ~3 MB decoded; regular http(s) URLs still accepted.
        if (v.startsWith("data:image/")) {
          return (
            /^data:image\/(png|jpeg|jpg|webp);base64,/.test(v) &&
            Buffer.byteLength(v.split(",")[1] ?? "", "base64") <= 3 * 1024 * 1024
          );
        }
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Cover must be a valid URL or compressed image (png/jpeg/webp, max 3 MB)" }
    ),
  isPublished: z.boolean().optional().default(true),
  isOpen: z.boolean().optional().default(true),
});

const updateSchema = z.object({ title: z.string().min(1).max(120), body: z.string().min(1).max(2000) });

adminRouter.get("/events", async (_req, res) => {
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      date: true,
      endDate: true,
      location: true,
      capacity: true,
      category: true,
      imageUrl: true,
      isPublished: true,
      isOpen: true,
      _count: { select: { registrations: { where: { status: { not: "CANCELLED" } } } } },
    },
  });

  res.json(
    events.map((e: any) => ({
      ...e,
      registeredCount: e._count.registrations,
      spotsLeft: e.capacity - e._count.registrations,
    }))
  );
});

const scanSchema = z.object({ code: z.string().trim().min(1).max(64) });

// Door scan: ENTRY (0→1) then EXIT (1→2); anything past that is rejected.
adminRouter.post("/tickets/scan", async (req, res) => {
  try {
    const { code } = scanSchema.parse(req.body);

    const registration = await prisma.registration.findUnique({
      where: { ticketId: code },
      select: {
        id: true,
        status: true,
        usedCount: true,
        event: { select: { id: true, title: true, date: true } },
        user: { select: { name: true } },
      },
    });

    if (!registration || registration.status === "CANCELLED") {
      res.status(404).json({ valid: false, reason: "not_found", message: "No active ticket matches this code." });
      return;
    }

    if (!registration.event.date || registration.event.date.getTime() > Date.now() + 60 * 60 * 1000) {
      res.status(400).json({ valid: false, reason: "not_open_yet", message: "The gates aren't open for this event yet." });
      return;
    }

    if (registration.usedCount >= 2) {
      res.status(409).json({ valid: false, reason: "max_usage", message: "This ticket has already been used for entry and exit." });
      return;
    }

    const direction = registration.usedCount === 0 ? "entry" : "exit";
    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: { usedCount: registration.usedCount + 1, lastScannedAt: new Date() },
      select: { usedCount: true, lastScannedAt: true },
    });

    res.json({
      valid: true,
      direction,
      usedCount: updated.usedCount,
      scannedAt: updated.lastScannedAt,
      attendee: registration.user.name,
      event: { id: registration.event.id, title: registration.event.title },
    });
    broadcastScan({
      type: "scan",
      attendee: registration.user.name,
      eventTitle: registration.event.title,
      direction,
      timestamp: new Date().toISOString(),
    });
    broadcastRefresh();
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ valid: false, reason: "bad_code", message: "That doesn't look like a ticket code." });
      return;
    }
    res.status(500).json({ valid: false, reason: "server", message: "Scanner jammed — try again." });
  }
});

adminRouter.post("/events", async (req, res) => {
  try {
    const data = eventSchema.parse(req.body);

    const event = await prisma.event.create({
      data: {
        ...data,
        date: data.date ? new Date(data.date) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });

    broadcastRefresh();
    res.status(201).json(event);
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Server error" });
  }
});

adminRouter.put("/events/:id", async (req, res) => {
  try {
    const data = eventSchema.partial().parse(req.body);

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...data,
        date: "date" in data ? (data.date ? new Date(data.date) : null) : undefined,
        endDate: "endDate" in data ? (data.endDate ? new Date(data.endDate) : null) : undefined,
      },
    });

    broadcastRefresh();
    res.json(event);
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Server error" });
  }
});

adminRouter.delete("/events/:id", async (req, res) => {
  await prisma.event.delete({ where: { id: req.params.id as string } });
  broadcastRefresh();
  res.json({ message: "Event deleted" });
});

// Organizer updates: post + delete announcements for an event.
adminRouter.post("/events/:id/updates", async (req, res) => {
  try {
    const { title, body } = updateSchema.parse(req.body);
    const update = await prisma.eventUpdate.create({
      data: { eventId: req.params.id as string, title, body },
      select: { id: true, title: true, body: true, createdAt: true },
    });
    broadcastRefresh();
    res.status(201).json(update);
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Server error" });
  }
});

adminRouter.delete("/events/:id/updates/:updateId", async (req, res) => {
  await prisma.eventUpdate.delete({ where: { id: req.params.updateId as string } });
  broadcastRefresh();
  res.json({ message: "Update removed" });
});

adminRouter.get("/registrations", async (req, res) => {
  const { search, status } = req.query;

  const registrations = await prisma.registration.findMany({
    where: {
      ...(status && ["CONFIRMED", "CANCELLED", "WAITLISTED"].includes(status as string)
        ? { status: status as "CONFIRMED" | "CANCELLED" | "WAITLISTED" }
        : {}),
      ...(search
        ? {
            OR: [
              { user: { name: { contains: search as string, mode: "insensitive" as any } } },
              { user: { email: { contains: search as string, mode: "insensitive" as any } } },
              { event: { title: { contains: search as string, mode: "insensitive" as any } } },
              { ticketId: { contains: search as string } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      ticketId: true,
      status: true,
      registeredAt: true,
      usedCount: true,
      lastScannedAt: true,
      user: { select: { id: true, name: true, email: true } },
      event: { select: { id: true, title: true, date: true, endDate: true, location: true, category: true } },
    },
    orderBy: { registeredAt: "desc" },
    take: 500,
  });

  res.json(registrations);
});

// Every registered person, each with the full list of passes they hold.
adminRouter.get("/attendees", async (req, res) => {
  const { search } = req.query;

  const attendees = await prisma.user.findMany({
    where: {
      registrations: { some: { status: "CONFIRMED" } },
      ...(search
        ? {
            OR: [
              { name: { contains: search as string, mode: "insensitive" as any } },
              { email: { contains: search as string, mode: "insensitive" as any } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      registrations: {
        where: { status: "CONFIRMED" },
        select: {
          id: true,
          ticketId: true,
          registeredAt: true,
          usedCount: true,
          event: { select: { id: true, title: true, date: true, location: true, category: true } },
        },
        orderBy: { registeredAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  res.json(attendees);
});

adminRouter.get("/events/:id/attendees", async (req, res) => {
  const { search } = req.query;

  const registrations = await prisma.registration.findMany({
    where: {
      eventId: req.params.id,
      status: "CONFIRMED",
      ...(search
        ? {
            user: {
              name: { contains: search as string, mode: "insensitive" as any },
            },
          }
        : {}),
    },
    select: {
      id: true,
      ticketId: true,
      registeredAt: true,
      usedCount: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { registeredAt: "asc" },
  });

  res.json(registrations);
});

adminRouter.get("/events/:id/export", async (req, res) => {
  const registrations = await prisma.registration.findMany({
    where: { eventId: req.params.id, status: "CONFIRMED" },
    select: {
      ticketId: true,
      registeredAt: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { registeredAt: "asc" },
  });

  const header = "Name,Email,Ticket ID,Registered At\n";
  const rows = registrations
    .map(
      (r: any) =>
        `"${r.user.name}","${r.user.email}","${r.ticketId}","${r.registeredAt.toISOString()}"`
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="attendees-${req.params.id}.csv"`);
  res.send(header + rows);
});
