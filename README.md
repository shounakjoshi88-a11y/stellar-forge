# Stellar Forge — Event Management Portal

A full-stack event management platform built for the **Ramdeobaba University × GeeksForGeeks** submission. Centralizes event creation, registration, ticketing, and real-time monitoring into a single immersive experience with exceptional UI/UX, responsive design, creative typography, smooth animations, and interactive 3D elements.

**Author:** [Shounak Joshi](https://github.com/shounakjoshi88-a11y)
**Live Demo:** *(add deployment link)*

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Application Flow](#application-flow)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Dashboards](#dashboards)
- [Real-Time System](#real-time-system)
- [3D Hero Animation](#3d-hero-animation)
- [Sound Design](#sound-design)
- [Security](#security)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Deliverables](#deliverables)

---

## Overview

Event Management Headquarters coordinates events across various sectors. This portal replaces scattered platforms with a unified system where:

- **Attendees** can browse, search, register for events, manage tickets, and track participation
- **Administrators** can create/edit events, monitor registrations in real-time, scan tickets at the door, and export data

The application features a neubrutalist "paper print-shop" design system, a scroll-driven 3D falling scissor animation, Web Audio sound design, and real-time updates via WebSocket + SSE.

---

## Features

### Authentication
- Google OAuth via Supabase Auth
- Just-in-time user provisioning (account created on first sign-in)
- Role-based access control (Attendee / Admin / Owner)
- Self-healing owner (auto-promoted on every request, can never be locked out)
- Live role revocation (demoted admin loses access immediately)
- Popup-based OAuth flow with popup-blocker detection

### Attendee Portal
- Browse all published events with search and filters
- View complete event details with live seat counter
- Register for events (atomic seat claim, race-condition safe)
- Cancel registrations (soft cancel, seat freed)
- View event history (active vs cancelled)
- Download/view scannable QR tickets
- Organizer announcements (posted in real-time)
- Event updates feed

### Admin Portal
- Create, edit, delete events
- Publish/unpublish events (visibility toggle)
- Open/close registrations (instant real-time effect)
- Set event as "Date TBD · Coming Soon"
- Image upload with client-side compression (WebP/JPEG, max 3MB)
- View registered attendees per event
- Search attendees across all events
- Export registrations to CSV
- QR ticket scanner (camera + manual entry, entry/exit tracking)
- Team management: owner grants/revokes admin with audit log
- Post organizer updates visible to attendees instantly

### Bonus Features
- **Attendee Dashboard** — participation streak, statistics, favorite category, upcoming reminders with countdowns, recent activity
- **Admin Dashboard** — total events, registration trends (bar chart), category breakdown (pie chart), event capacity fill bars, live feed
- **Real-time** — live registration counts via WebSocket, admin registration stream via SSE, live activity toaster
- **3D Hero Animation** — scroll-driven falling scissor that cuts the ticket (React Three Fiber + GSAP)
- **Command Palette** — keyboard-driven navigation (Cmd+K)
- **Smooth Scroll** — Lenis integration (desktop only)
- **Sound Design** — Web Audio paper-tear sound effects with CC0 recorded material
- **Confetti** — registration celebration animation

---

## Application Flow

```
                    Register / Login (Google OAuth)
                              ↓
                 ┌────────────┴────────────┐
                 ↓                         ↓
          Attendee Portal            Admin Portal
                 ↓                         ↓
    ┌────────────┼────────────┐   ┌────────┼────────┐
    ↓            ↓            ↓   ↓        ↓        ↓
 Browse      Register    Manage  Create  Monitor  Team
 Events      / Cancel    Tickets Events  Regs     Mgmt
    ↓            ↓            ↓   ↓        ↓
 Event       Ticket      Export  QR      Dashboard
 Details     QR Code     CSV     Scanner (Analytics)
    ↓                         ↓
 Dashboard               Dashboard
 (Streak,                (Trends,
 Reminders)              Charts)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.3+ |
| Frontend | React 19, React Router 7, Tailwind CSS 4 |
| 3D/Graphics | Three.js, React Three Fiber, Drei |
| Animation | GSAP (+ScrollTrigger), Framer Motion |
| Backend | Express 5, Prisma 7 ORM |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (Google OAuth), jose (JWKS) |
| Real-time | WebSocket (ws), Server-Sent Events |
| Charts | Recharts |
| QR | qrcode (generation), jsQR + BarcodeDetector (scanning) |
| Audio | Web Audio API |
| Smooth Scroll | Lenis |
| Command Palette | cmdk |
| Validation | Zod |
| Build | Bun bundler, bun-plugin-tailwind |

---

## Architecture

```
stellar-forge/
├── frontend/              # React 19 SPA (Bun static server)
│   ├── src/
│   │   ├── pages/         # Route components
│   │   ├── components/    # UI + 3D components
│   │   ├── context/       # Auth, Toast providers
│   │   ├── hooks/         # useLive, useShortcut, etc.
│   │   ├── lib/           # client, imageCompress, paperSounds
│   │   └── styles.css     # Global styles
│   └── build.ts           # Bun build with tailwind
├── backend/               # Express 5 API (Bun)
│   ├── src/
│   │   ├── routes/        # auth, events, registrations, admin, dashboard, live
│   │   ├── lib/           # auth, prisma, supabase client
│   │   ├── middleware.ts   # rate limiter, security headers, logger
│   │   └── live.ts        # WebSocket + SSE real-time engine
│   └── prisma/
│       └── schema.prisma  # Database models
└── shared/                # Shared types (vestigial)
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.3+
- PostgreSQL 15+ (or [Supabase](https://supabase.com) project)
- Supabase project with Google OAuth enabled

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

See [Environment Variables](#environment-variables) below.

### 4. Configure Supabase (Google OAuth)

1. In Supabase Dashboard → Authentication → Providers → enable **Google**
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

1. Set `ADMIN_OWNER_EMAIL` in `backend/.env` to your Google email
2. Sign in with Google — your account auto-promotes to ADMIN
3. Go to **Admin → Team** to grant admin access to teammates

---

## Environment Variables

### backend/.env

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/stellarforge"

# Supabase (Auth + API)
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_API_SECRET="<service_role_key>"

# The owner's email — auto-promoted to ADMIN on every request
ADMIN_OWNER_EMAIL="your-email@gmail.com"

# CORS
FRONTEND_URL="http://localhost:5173"

# Optional
PORT=3001
NODE_ENV="development"
```

### frontend/.env

```env
# Supabase (public/anon)
BUN_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
BUN_PUBLIC_SUPABASE_ANON_KEY="<anon_key>"

# Optional
VITE_API_URL="http://localhost:3001/api"
```

---

## Database Schema

### User
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| email | String (unique) | From Google |
| supabaseId | String (unique) | Supabase auth sub |
| name | String | Display name |
| role | Enum | ATTENDEE / ADMIN |
| createdAt | DateTime | |

### Event
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| title | String | |
| description | String | |
| location | String | |
| date | DateTime? | null = "TBD / Coming Soon" |
| endDate | DateTime? | Optional end |
| capacity | Int | Max registrations |
| category | String | Free-text |
| imageUrl | String? | URL or base64 (max 3MB) |
| isPublished | Boolean | Public visibility |
| isOpen | Boolean | Registrations open |

### Registration
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| userId | String (FK) | |
| eventId | String (FK) | |
| status | Enum | CONFIRMED / CANCELLED / WAITLISTED |
| ticketId | String (unique) | Format: TKT-<epoch>-<random> |
| usedCount | Int | 0=unused, 1=entered, 2=exited |
| lastScannedAt | DateTime? | |

### AdminAuditLog
Denormalized record of role changes: actor, target, old/new role, timestamp.

### EventUpdate
Organizer announcements linked to events.

---

## Dashboards

### Attendee Dashboard
- **Total Registrations** — all confirmed registrations
- **Upcoming Events** — events with null date or future date
- **Completed Events** — past events
- **Participation Streak** — consecutive months with registrations
- **Favorite Category** — most-registered category
- **Upcoming Reminders** — next 5 events with countdown
- **Recent Activity** — last 5 registrations

### Admin Dashboard
- **Total / Upcoming / Completed Events**
- **Total Attendees / Registrations**
- **Registration Trends** — monthly bar chart
- **Events by Category** — pie chart
- **Event Capacity** — per-event fill bars (red ≥80%, orange ≥50%)
- **Live Gate Feed** — real-time registration feed

---

## Real-Time System

The realtime layer uses a hybrid of WebSocket and SSE:

### WebSocket (`/ws/live-feed`)
- **Registration Feed** — broadcasts new registrations to all clients
- **Live Counts** — authoritative per-event seat counts (single source of truth)
- **Scan Events** — broadcasts door scans
- **Refresh Signal** — universal "data changed, refetch" signal

### Server-Sent Events
- **`/events/:id/live-count`** — public seat count stream
- **`/admin/registrations-stream`** — admin-only registration stream

### Frontend Hooks
- `useLiveFeed()` — registration feed events
- `useLiveCount(eventId)` — live seat count
- `useAdminRegistrationStream(cb)` — admin SSE with auto-reconnect
- `useRealtimeRefresh(cb)` — refetch on data changes
- `useLiveActivity(cb)` — live activity toaster

---

## 3D Hero Animation

The landing page features a scroll-driven 3D animation built with React Three Fiber:

**Story:** A scissor hangs from a thread above the page. As you scroll, it falls into view, cuts along the ticket's perforation line, the thread runs out mid-cut (jerking to a stop), and the scissor swings on its thread like a pendulum — settling into a faint sway, half a cut behind.

**Phases:**
1. **Fall** — scissor drops from above, gathering speed
2. **Cut** — blades track the tear line, stub peels
3. **Jerk** — thread goes taut, sudden stop with jolt
4. **Pendulum** — damped swing decaying into ambient sway

**Technical Details:**
- Demand-rendered Canvas (`frameloop="demand"`)
- Performance-monitored with DPR capping
- Reduced-motion fallback (static SVG)
- WebGL context loss handling

---

## Sound Design

Web Audio API sound system with two material tiers:

- **Real:** CC0 recorded paper tear-off (Joseph SARDIN / LaSonotheque)
- **Synth fallback:** Procedural filtered white noise (for unsupported browsers)

**Sounds:**
- Paper tap — fingertip on card stock
- Paper cut — scissor snip
- Metal snip — single documented metallic exception (hero prop)
- Paper tear — full rip with crackle
- Paper settle — stub resting after rip
- Paper snap-back — un-tear

All sounds opt-in (muted by default), lazy-loaded on first user gesture.

---

## Security

- **JWKS verification** — local token verification (no per-request API call)
- **Rate limiting** — 100 requests/minute per IP
- **Security headers** — CSP, X-Frame-Options, etc.
- **Role-based access** — DB-authoritative, re-verified per request
- **Input validation** — Zod schemas on all endpoints
- **Image validation** — size limit (3MB), format whitelist
- **Atomic seat claims** — Serializable transactions with row locking
- **Audit logging** — all role changes recorded

---

## API Documentation

See [API.md](./API.md) for complete endpoint documentation.

**Base URL:** `http://localhost:3001/api`

| Category | Endpoints |
|----------|-----------|
| Auth | `GET /auth/me` |
| Events | `GET /events`, `GET /events/:id`, `GET /events/categories`, `GET /events/stats` |
| Registrations | `GET /registrations/my`, `POST /registrations/:eventId`, `DELETE /registrations/:eventId` |
| Admin | `POST /admin/events`, `PUT /admin/events/:id`, `DELETE /admin/events/:id`, `POST /admin/tickets/scan` |
| Dashboard | `GET /dashboard/attendee`, `GET /dashboard/admin` |
| Real-time | `GET /events/:id/live-count` (SSE), `GET /admin/registrations-stream` (SSE), `/ws/live-feed` (WS) |

---

## Deployment

### Frontend (Vercel/Netlify)
```bash
cd frontend
bun run build
# Deploy dist/ folder
```

### Backend (Railway/Render)
```bash
cd backend
# Set environment variables
bun run start
```

### Database
Use Supabase or any PostgreSQL provider. Run `bunx prisma db push` to set up schema.

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
