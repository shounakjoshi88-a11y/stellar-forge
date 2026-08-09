# Stellar Forge — Event Management Portal

A full-stack event management platform built for **Ramdeobaba University × GeeksForGeeks** submission. Enables attendees to discover and register for events, while administrators manage events, monitor registrations, and track analytics through a dedicated dashboard.

**Live Demo:** *(add deployment link here)*

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Application Flow](#application-flow)
- [Dashboards](#dashboards)
- [API Documentation](#api-documentation)
- [Deliverables](#deliverables)

---

## Overview

Event Management Headquarters coordinates events across various sectors. This portal centralizes event creation, registration, and tracking — replacing scattered platforms with a single immersive experience featuring exceptional UI/UX, responsive design, smooth animations, creative typography, and interactive 3D elements.

---

## Features

### Attendee Portal

- Browse all available events with search and filters
- View complete event details
- Register for events (with real-time seat availability)
- Cancel existing registrations
- View all registered events and event history
- Download/view event tickets (Event Name, Date, Registration Status, QR code)
- Participation streak and attendee statistics
- Upcoming event reminders with countdowns
- Favorite events tracking

### Admin Portal

- Create, edit, and delete events
- View registered attendees per event
- Search registered attendees
- Monitor event registrations in real-time
- Export event registrations to CSV
- QR-based gate scanner (entry/exit tracking)
- Team management: owner grants/revokes admin with audit log

### Bonus Features

- **Attendee Dashboard** — participation streak, statistics, favorite events, upcoming reminders with countdowns
- **Admin Dashboard** — total events, upcoming/completed counts, total attendees, registration trends, category breakdown, participation analytics
- **Real-time** — live registration counts via SSE, WebSocket feed for admin dashboard
- **3D Hero Animation** — scroll-driven falling scissor that cuts the event ticket
- **QR Ticketing** — scannable tickets with entry/exit tracking

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.3+ |
| Frontend | React 19, Tailwind CSS 4, GSAP, Three.js, Framer Motion |
| Backend | Express 5, Prisma ORM, jose (JWT) |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (Google OAuth) |
| Real-time | SSE + WebSocket |
| Charts | Recharts |
| Validation | Zod |

---

## Architecture

```
stellar-forge/
├── frontend/     # React 19 + Tailwind CSS + Three.js + GSAP
├── backend/      # Express 5 + Prisma + PostgreSQL
└── shared/       # Shared types & utilities
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.3+
- PostgreSQL 15+ (or Supabase account)
- Supabase project (for Google OAuth)

### 1. Clone and Install

```bash
git clone https://github.com/shounakjoshi88-a11y/stellar-forge.git
cd stellar-forge
bun install
```

### 2. Set Up the Database

```bash
cd backend
bunx prisma generate
bunx prisma db push
bun run db:seed
```

### 3. Configure Environment Variables

**backend/.env:**
```env
DATABASE_URL="postgresql://user:pass@host:5432/stellarforge"
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_API_SECRET="<service_role_key>"
ADMIN_OWNER_EMAIL="your-email@gmail.com"
FRONTEND_URL="http://localhost:5173"
```

**frontend/.env:**
```env
BUN_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
BUN_PUBLIC_SUPABASE_ANON_KEY="<anon_key>"
```

### 4. Configure Supabase (Google OAuth)

1. Enable **Google** provider in Supabase Auth
2. Set Site URL to `http://localhost:5173`
3. Add redirect URL: `http://localhost:5173/oauth/callback`

### 5. Run Development Servers

```bash
# Terminal 1 - Backend
cd backend && bun run dev

# Terminal 2 - Frontend
cd frontend && bun run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api

### 6. Admin Access

1. Set `ADMIN_OWNER_EMAIL` in `backend/.env` to your email
2. Sign in with Google — your account auto-promotes to ADMIN
3. Go to **Admin → Team** to grant admin access to teammates

---

## Application Flow

```
Register / Login (Google OAuth)
        ↓
   ┌────┴────┐
   ↓         ↓
Attendee   Admin
Portal     Portal
   ↓         ↓
Browse    Manage
Events    Events
   ↓         ↓
Register  View Attendees
   ↓         ↓
Ticket    Export CSV
Generation  ↓
   ↓      Dashboard
Dashboard   Analytics
   ↓
Event History
```

---

## Dashboards

### Attendee Dashboard
- Participation streak
- Total registrations / upcoming / completed
- Favorite category
- Upcoming event reminders with countdowns
- Recent activity feed

### Admin Dashboard
- Total / upcoming / completed events
- Total attendees and registrations
- Category-wise breakdown
- Monthly registration trends
- Per-event participation statistics
- Export to CSV

---

## API Documentation

See [API.md](./API.md) for complete endpoint documentation including:
- Authentication (Google OAuth + JWT)
- Events CRUD
- Registrations & Tickets
- Admin routes (team management, audit log)
- Dashboard analytics
- Real-time SSE & WebSocket

---

## Deliverables

| Deliverable | Status |
|-------------|--------|
| GitHub ID | [shounakjoshi88-a11y](https://github.com/shounakjoshi88-a11y) |
| GitHub Repository | https://github.com/shounakjoshi88-a11y/stellar-forge |
| README with setup | This file |
| API Documentation | [API.md](./API.md) |
| Live Deployment | *(add link)* |

---

## License

MIT
