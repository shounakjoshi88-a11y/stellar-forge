# ✨ Stellar Forge - Event Management Portal

A full-stack event management platform built with React, Bun, Express, and PostgreSQL.

## 🏗️ Architecture

```
stellar-forge/
├── frontend/     # React 19 + Tailwind CSS + Bun
├── backend/      # Express 5 + Prisma + PostgreSQL
└── shared/       # Shared types & utilities
```

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) v1.3+
- PostgreSQL 15+

### 1. Install dependencies
```bash
bun install
```

### 2. Set up the database
```bash
# Configure backend/.env with your DATABASE_URL
cd backend
bunx prisma generate
bunx prisma db push
bun run db:seed
```

### 3. Configure Supabase (Google OAuth)

Login is Google-only via Supabase Auth.

- **backend/.env** needs:
  ```
  SUPABASE_URL="https://<project-ref>.supabase.co"
  SUPABASE_API_SECRET="<service_role_key>"
  FRONTEND_URL="http://localhost:5173"
  ```
- **frontend/.env** needs:
  ```
  BUN_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
  BUN_PUBLIC_SUPABASE_ANON_KEY="<anon_key>"
  ```
- In the Supabase dashboard: enable the **Google** provider, set Site URL to
  `http://localhost:5173`, and add the redirect URL `http://localhost:5173/oauth/callback`.

### 4. Run development servers
```bash
# Terminal 1 - Backend
cd backend && bun run dev

# Terminal 2 - Frontend
cd frontend && bun run dev
```

Frontend: http://localhost:5173
Backend API: http://localhost:3001/api

### 5. Admin access (owner + team)

Roles are **DB-authoritative** — no admin email checks on login.

1. Set the owner in `backend/.env`:
   ```
   ADMIN_OWNER_EMAIL="you@gmail.com"
   ```
2. The owner's account is auto-promoted to ADMIN (self-healing — can never be locked out).
3. Owner signs in, opens **Admin → Team**, and grants admin to teammates.
4. Promoted admins manage events / scan gates / see the ledger. Only the owner can grant/revoke admin.
5. Every grant/revoke is written to the audit log on the Team tab.

## ✨ Features

### Attendee Portal
- Browse & search events with filters
- View event details
- Register / cancel registrations
- View event tickets
- Event history

### Admin Portal
- Create, edit, delete events
- View registered attendees
- Search attendees
- Export registrations to CSV
- Gate scanner (QR entry/exit)
- Team management: owner grants/revokes admin, with audit log

### Dashboards
- **Attendee**: Participation streak, stats, upcoming reminders with countdowns
- **Admin**: Total events, registration trends, category breakdown, fill rates

## 📚 API Documentation

See [API.md](./API.md) for complete endpoint documentation.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Frontend | React 19, Tailwind CSS 4, GSAP |
| Backend | Express 5, Prisma ORM, jose (JWT) |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (Google OAuth) |
| Charts | Recharts |
| Validation | Zod |

## 📦 Scripts

```bash
# Development
bun run dev              # Start both frontend + backend
bun run dev:backend      # Backend only
bun run dev:frontend     # Frontend only

# Production
bun run build            # Build everything
```
