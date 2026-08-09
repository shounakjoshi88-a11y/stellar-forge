import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../lib/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get("/attendee", async (req, res) => {
  const user = (req as any).user;

  const registrations = await prisma.registration.findMany({
    where: { userId: user.userId, status: "CONFIRMED" },
    select: {
      ticketId: true,
      registeredAt: true,
      event: {
        select: { id: true, title: true, date: true, location: true, category: true },
      },
    },
    orderBy: { registeredAt: "desc" },
  });

  const totalRegistrations = registrations.length;
  const upcomingEvents = registrations.filter((r: any) => !r.event.date || new Date(r.event.date) >= new Date()).length;
  const completedEvents = registrations.filter((r: any) => r.event.date && new Date(r.event.date) < new Date()).length;

  const categoryCount: Record<string, number> = {};
  registrations.forEach((r: any) => {
    categoryCount[r.event.category] = (categoryCount[r.event.category] || 0) + 1;
  });
  const favoriteCategory = Object.entries(categoryCount).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "N/A";

  const upcomingReminders = registrations
    .filter((r: any) => !r.event.date || new Date(r.event.date) >= new Date())
    .slice(0, 5)
    .map((r: any) => ({
      id: r.event.id,
      title: r.event.title,
      date: r.event.date,
      location: r.event.location,
    }));

  res.json({
    totalRegistrations,
    upcomingEvents,
    completedEvents,
    favoriteCategory,
    participationStreak: calculateStreak(registrations.map((r: any) => r.event.date).filter(Boolean)),
    upcomingReminders,
    recentActivity: registrations.slice(0, 5).map((r: any) => ({
      eventName: r.event.title,
      date: r.event.date,
      registeredAt: r.registeredAt,
      ticketId: r.ticketId,
    })),
  });
});

dashboardRouter.get("/admin", requireAdmin, async (_req, res) => {
  const now = new Date();

  const [totalEvents, upcomingEvents, completedEvents, totalAttendees, totalRegistrations] = await Promise.all([
    prisma.event.count(),
    prisma.event.count({ where: { OR: [{ date: null }, { date: { gte: now } }] } }),
    prisma.event.count({ where: { date: { lt: now } } }),
    prisma.user.count({ where: { role: "ATTENDEE" } }),
    prisma.registration.count({ where: { status: "CONFIRMED" } }),
  ]);

  const events = await prisma.event.findMany({
    select: {
      id: true,
      title: true,
      date: true,
      capacity: true,
      category: true,
      isPublished: true,
      _count: { select: { registrations: true } },
    },
    orderBy: { date: "asc" },
  });

  const categoryStats = events.reduce(
    (acc: Record<string, number>, e: any) => {
      acc[e.category] = (acc[e.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const monthlyRows = await prisma.$queryRaw<{ month: string; count: number }[]>`
    SELECT TO_CHAR("registeredAt", 'YYYY-MM') AS "month", COUNT(*)::int AS "count"
    FROM "Registration"
    WHERE "status" = 'CONFIRMED'
    GROUP BY TO_CHAR("registeredAt", 'YYYY-MM')
    ORDER BY "month" ASC
  `;

  const monthlyStats = monthlyRows.reduce(
    (acc: Record<string, number>, r) => {
      acc[r.month] = r.count;
      return acc;
    },
    {} as Record<string, number>
  );

  res.json({
    totalEvents,
    upcomingEvents,
    completedEvents,
    totalAttendees,
    totalRegistrations,
    categoryStats,
    monthlyStats,
    eventStats: events.map((e: any) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      capacity: e.capacity,
      registered: e._count.registrations,
      fillRate: Math.round((e._count.registrations / e.capacity) * 100),
    })),
  });
});

function calculateStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const sorted = [...dates].sort((a, b) => b.getTime() - a.getTime());
  const months = new Set(sorted.map((d) => `${d.getFullYear()}-${d.getMonth()}`));

  let streak = 0;
  const now = new Date();
  let current = new Date(now.getFullYear(), now.getMonth());

  while (months.has(`${current.getFullYear()}-${current.getMonth()}`)) {
    streak++;
    current.setMonth(current.getMonth() - 1);
  }

  return streak;
}
