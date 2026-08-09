# Stellar Forge — Event Management Portal

## Ramdeobaba University × GeeksForGeeks Submission

---

## Team Information

| Field | Details |
|-------|---------|
| **Team Name** | Stellar Forge |
| **GitHub ID** | shounakjoshi88-a11y |
| **Leader** | Shounak Joshi |
| **Email** | shounakjoshi88@gmail.com |
| **College** | Ramdeobaba University |

---

## Project Links

| Resource | Link |
|----------|------|
| **GitHub Repository** | https://github.com/shounakjoshi88-a11y/stellar-forge |
| **Live Demo** | https://stellar-forge-frontend.vercel.app/ |
| **API Documentation** | https://github.com/shounakjoshi88-a11y/stellar-forge/blob/main/API.md |

---

## Project Overview

Stellar Forge is a full-stack event management platform that centralizes event creation, registration, ticketing, and real-time monitoring into a single immersive experience.

### Problem Statement
Event creation, registrations, and tracking are currently scattered across multiple platforms, making it difficult to organize, manage, and monitor Event Attendees efficiently.

### Solution
A complete event management workflow with:
- Attendees can discover and join upcoming events
- Administrators can create, manage, and monitor events
- Real-time registration tracking
- QR-based ticketing system

---

## Features

### Attendee Portal
- Browse & search events with filters
- View event details with live seat counter
- Register for events (race-condition safe)
- Cancel registrations
- View event history
- Download/view scannable QR tickets
- Organizer announcements

### Admin Portal
- Create, edit, delete events
- Publish/unpublish events
- Open/close registrations
- Image upload with compression
- View & search attendees
- Export registrations to CSV
- QR ticket scanner (camera + manual)
- Team management with audit log

### Bonus Features
- Attendee Dashboard (streak, stats, reminders)
- Admin Dashboard (trends, charts, analytics)
- Real-time updates (WebSocket + SSE)
- 3D Hero Animation (scroll-driven scissor)
- Command Palette (Cmd+K)
- Sound Design (Web Audio)
- Confetti on registration

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.3+ |
| Frontend | React 19, Tailwind CSS 4, Three.js |
| Animation | GSAP, Framer Motion, React Three Fiber |
| Backend | Express 5, Prisma 7 ORM |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (Google OAuth) |
| Real-time | WebSocket, Server-Sent Events |
| Charts | Recharts |
| QR | qrcode, jsQR, BarcodeDetector |

---

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | https://stellar-forge-frontend.vercel.app/ |
| Backend | AWS EC2 | http://3.110.107.0:3001 |
| Database | Supabase | PostgreSQL |

---

## How to Test

1. Visit https://stellar-forge-frontend.vercel.app/
2. Click "Sign in with Google"
3. First user becomes admin automatically
4. Browse events, register, view tickets
5. Admin: create events, view dashboard, scan QR

---

## Setup Instructions

See [README.md](./README.md) for complete local development setup.

---

## License

MIT
