import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../lib/auth.js";

export const eventsRouter = Router();

const querySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["upcoming", "past", "all"]).optional().default("upcoming"),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(12),
});

eventsRouter.get("/", async (req, res) => {
  try {
    const { search, category, status, page, limit } = querySchema.parse(req.query);

    const now = new Date();
    const filters: any[] = [{ isPublished: true }];

    if (search) {
      filters.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    if (category) {
      filters.push({ category });
    }

    // "Upcoming" includes un-dated (TBD) events — they're still to come.
    if (status === "upcoming") {
      filters.push({ OR: [{ date: null }, { date: { gte: now } }] });
    } else if (status === "past") {
      filters.push({ date: { lt: now } });
    }

    const where: any = { AND: filters };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { date: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          date: true,
          location: true,
          capacity: true,
          category: true,
          imageUrl: true,
          isOpen: true,
          _count: { select: { registrations: { where: { status: { not: "CANCELLED" } } } } },
        },
      }),
      prisma.event.count({ where }),
    ]);

    res.json({
      events: events.map((e: any) => ({
        ...e,
        registeredCount: e._count.registrations,
        spotsLeft: e.capacity - e._count.registrations,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Invalid query", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Server error" });
  }
});

eventsRouter.get("/categories", async (_req, res) => {
  const categories = await prisma.event.findMany({
    distinct: ["category"],
    select: { category: true },
  });
  res.json(categories.map((c: any) => c.category));
});

// Public header stats — real numbers straight from the ledger.
// Cached in memory (60s TTL): this endpoint is hit on every landing visit,
// so without a cache each refresh costs several DB round-trips.
let statsCache: { at: number; data: any } | null = null;
const STATS_TTL_MS = 60_000;

eventsRouter.get("/stats", async (_req, res) => {
  try {
    if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) {
      res.json(statsCache.data);
      return;
    }

    const now = new Date();

    const [totalEvents, upcomingEvents, ticketsIssued, doorsOpened, categories] = await Promise.all([
      prisma.event.count({ where: { isPublished: true } }),
      prisma.event.count({ where: { isPublished: true, OR: [{ date: null }, { date: { gte: now } }] } }),
      prisma.registration.count({ where: { status: "CONFIRMED" } }),
      prisma.registration.count({ where: { status: "CONFIRMED", usedCount: { gte: 1 } } }),
      prisma.event.findMany({ distinct: ["category"], where: { isPublished: true }, select: { category: true } }),
    ]);

    const data = {
      eventsListed: totalEvents,
      eventsUpcoming: upcomingEvents,
      ticketsIssued,
      doorsOpened,
      categories: categories.length,
    };

    statsCache = { at: Date.now(), data };
    res.json(data);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Public updates feed — organizer announcements for an event.
eventsRouter.get("/:id/updates", async (req, res) => {
  const updates = await prisma.eventUpdate.findMany({
    where: { eventId: req.params.id as string },
    select: { id: true, title: true, body: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(updates);
});

eventsRouter.get("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
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

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json({
    ...event,
    registeredCount: event._count.registrations,
    spotsLeft: event.capacity - event._count.registrations,
  });
});
