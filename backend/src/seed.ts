import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.registration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  const attendee = await prisma.user.create({
    data: {
      email: "attendee@stellarforge.com",
      password: "user123",
      name: "Jane Doe",
      role: "ATTENDEE",
    },
  });

  const events = [
    {
      title: "Tech Innovation Summit 2026",
      description: "Join industry leaders for a day of insights into AI, blockchain, and the future of technology.",
      location: "Convention Center, Hall A",
      date: new Date("2026-09-15T09:00:00Z"),
      capacity: 500,
      category: "Technology",
      imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
    },
    {
      title: "Creative Design Workshop",
      description: "Hands-on workshop exploring modern design principles, typography, and brand identity.",
      location: "Design Lab, Floor 3",
      date: new Date("2026-09-20T14:00:00Z"),
      capacity: 50,
      category: "Design",
      imageUrl: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800",
    },
    {
      title: "Startup Pitch Night",
      description: "Watch 10 startups pitch their ideas to a panel of VCs and angel investors.",
      location: "Innovation Hub",
      date: new Date("2026-10-05T18:00:00Z"),
      capacity: 200,
      category: "Business",
      imageUrl: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800",
    },
    {
      title: "Data Science Conference",
      description: "Deep dive into machine learning, data visualization, and statistical modeling.",
      location: "University Auditorium",
      date: new Date("2026-10-12T10:00:00Z"),
      capacity: 300,
      category: "Technology",
      imageUrl: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800",
    },
    {
      title: "Wellness & Mindfulness Retreat",
      description: "A weekend of yoga, meditation, and holistic health practices.",
      location: "Serenity Gardens",
      date: new Date("2026-10-25T08:00:00Z"),
      capacity: 80,
      category: "Wellness",
      imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800",
    },
    {
      title: "Music & Arts Festival",
      description: "Three days of live performances, art installations, and creative workshops.",
      location: "Riverside Park",
      date: new Date("2026-11-10T12:00:00Z"),
      capacity: 1000,
      category: "Arts",
      imageUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800",
    },
    {
      title: "Cybersecurity Workshop",
      description: "Learn ethical hacking, penetration testing, and security best practices.",
      location: "Tech Center, Room 201",
      date: new Date("2026-08-20T13:00:00Z"),
      capacity: 40,
      category: "Technology",
      imageUrl: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800",
    },
    {
      title: "Photography Masterclass",
      description: "Professional photography techniques for portrait, landscape, and street photography.",
      location: "Studio B",
      date: new Date("2026-08-28T10:00:00Z"),
      capacity: 30,
      category: "Arts",
      imageUrl: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800",
    },
  ];

  for (const event of events) {
    await prisma.event.create({ data: event });
  }

  console.log("✅ Seed data created:");
  console.log(`   Attendee: ${attendee.email} / user123`);
  console.log(`   Events: ${events.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
