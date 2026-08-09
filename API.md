# Stellar Forge API Documentation

Base URL: `http://localhost:3001/api`

---

## Authentication

Authentication is handled by **Supabase Auth** (Google OAuth provider). Users sign in through the frontend
(`supabase.auth.signInWithOAuth({ provider: "google" })`); the resulting Supabase access token is sent
as a Bearer token on every request:

```
Authorization: Bearer <supabase_access_token>
```

The backend verifies the token **locally via the project's JWKS** (no per-request Supabase API round
trip; falls back to `supabase.auth.getUser` on JWKS refresh races) and lazily provisions/links a local
user row by `supabaseId` (email + name synced from Google).

**Roles are DB-authoritative.** The account in `ADMIN_OWNER_EMAIL` (backend `.env`) is the **owner**:
their row is force-synced to `ADMIN` on every request (self-healing — the owner can never be locked
out by a stale DB row or a bad demotion). All other users start as `ATTENDEE` and only become `ADMIN`
when the owner grants it through the Team tab. Revocation is enforced live: every request re-reads the
role from the database, and the frontend refetches `/auth/me` the moment any admin route returns
401/403.

### GET `/auth/me` *(Auth required)*
Get the current user profile (also re-syncs name/email from the Google identity).

**Response:** `{ id, email, name, role, createdAt }`

> There is no `/auth/register` or `/auth/login` — accounts are created on first Google sign-in.

---

## Events

### GET `/events`
List published events with pagination and filters.

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| search | string | Search in title, description, location |
| category | string | Filter by category |
| status | string | `upcoming`, `past`, or `all` |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 12) |

**Response:** `{ events[], pagination }`

### GET `/events/categories`
Get all unique categories.

**Response:** `string[]`

### GET `/events/:id`
Get single event details with attendee count.

---

## Registrations *(Auth required)*

### GET `/registrations/my`
Get all registrations for the logged-in user.

### POST `/registrations/:eventId`
Register for an event.

**Response:** `{ id, ticketId, status, event }`

### DELETE `/registrations/:eventId`
Cancel a registration.

### GET `/registrations/ticket/:ticketId`
Get ticket details.

---

## Admin *(Auth + Admin role required)*

### Team Management *(Auth + Owner required)*

Team routes are guarded by `requireOwner` alone (deliberately independent of `requireAdmin`), so a
stale DB role can never lock the owner out of the role manager.

### GET `/admin/users` *(Owner)*
List users. **Query Params:** `?search=John` (name or email).

### PUT `/admin/users/:id/role` *(Owner)*
Grant or revoke administrator access.

**Body:** `{ "role": "ADMIN" | "ATTENDEE" }`

**Guards:** the owner's own role cannot be changed (400); every change is recorded in the audit log
inside the same transaction.

### GET `/admin/audit-log` *(Owner)*
Recent role changes (actor, target, old/new role, timestamp), newest first.

### GET `/admin/events`
List all events (including unpublished).

### POST `/admin/events`
Create a new event.

**Body:** (`date` is optional — omit/`null` to list the event as **Date TBD · Coming Soon**)
```json
{
  "title": "Event Name",
  "description": "Description",
  "location": "Location",
  "date": "2026-09-15T09:00:00Z",
  "capacity": 100,
  "category": "Technology",
  "imageUrl": "https://..."
}
```

### PUT `/admin/events/:id`
Update an event.

### DELETE `/admin/events/:id`
Delete an event.

### GET `/admin/events/:id/export`
Export attendees as CSV file.

### GET `/admin/events/:id/attendees`
Get registered attendees for an event.

**Query Params:** `?search=John` (search by name)

### GET `/admin/events/:id/export`
Export attendees as CSV file.

### GET `/admin/registrations`
All registrations across every event (newest first, max 500).

**Query Params:** `?search=` (attendee name/email, event title, or ticket id) · `?status=CONFIRMED|CANCELLED|WAITLISTED`

### GET `/admin/attendees`
Every registered person, each with all their CONFIRMED passes (event title, date, venue, ticket id, scan count).

**Query Params:** `?search=` (search by name or email)

### POST `/admin/tickets/scan`
Door scan. Each ticket may be scanned **twice**: 1st scan = ENTRY, 2nd = EXIT, 3rd = rejected.

**Body:** `{ "code": "TKT-…" }` (the value encoded in the ticket QR)

**Response (valid):**
```json
{ "valid": true, "direction": "entry" | "exit", "usedCount": 1, "scannedAt": "…", "attendee": "Ada", "event": { "id": "…", "title": "…" } }
```

**Response (invalid):** `404 not_found`, `400 not_open_yet` (gates open 1h before the event), `409 max_usage` — always shaped as `{ "valid": false, "reason": "…", "message": "…" }`.

---

## Dashboard

### GET `/dashboard/attendee` *(Auth required)*
Get attendee dashboard stats.

**Response:**
```json
{
  "totalRegistrations": 5,
  "upcomingEvents": 3,
  "completedEvents": 2,
  "favoriteCategory": "Technology",
  "participationStreak": 2,
  "upcomingReminders": [...],
  "recentActivity": [...]
}
```

### GET `/dashboard/admin` *(Admin required)*
Get admin dashboard stats.

**Response:**
```json
{
  "totalEvents": 10,
  "upcomingEvents": 6,
  "completedEvents": 4,
  "totalAttendees": 50,
  "totalRegistrations": 120,
  "categoryStats": { "Technology": 5, "Design": 3 },
  "monthlyStats": { "2026-08": 30, "2026-09": 45 },
  "eventStats": [...]
}
```

---

## Real-Time (Live)

Realtime is a hybrid of **SSE** (one-way aggregations) and **WebSocket** (the registration feed).

### SSE `GET /events/:id/live-count`
Event-stream of the current registered count. One message every 5 seconds:
```
data: { "eventId": "abc", "registered": 42, "capacity": 100 }
```
Consumed by `useLiveCount` in the frontend. Auto-fires an extra message whenever a registration
is created/cancelled so the badge reacts instantly.

### SSE `GET /admin/registrations-stream?access_token=<supabase_jwt>` *(Admin only)*
Stream of new registrations, for the admin dashboard's live gate:
```
data: { "timestamp": "2026-08-06T12:34:56Z", "name": "Ada Lovelace", "event": "Design Night" }
```
The token is a Supabase access token passed as a query param (SSE cannot set headers); it is
verified server-side before the stream is opened.

### WebSocket `ws://localhost:3001/ws/live-feed`
Two message types:

1. **Registration feed** — server broadcasts exactly the same payload shape as the admin SSE on every registration create.
2. **Authoritative live counts** — clients send `{"type":"subscribe","eventId"}` (the server replies with the current count), then receive `{"type":"count","eventId","registeredCount"}` on every change. One count per event is held in server memory and fanned out to all subscribers — every viewer sees the identical number, no per-client polling.

Heartbeat ping every 30s. Consumed by `useLiveFeed` (reconnect + backoff) and `useLiveCount` (single shared socket, auto-resubscribe on reconnect).

### Seat-claim atomicity
`POST /api/registrations/:eventId` runs inside a `Serializable` transaction that locks the Event row
(`SELECT … FOR UPDATE`) before checking capacity — two users racing for the last seat serialize at the
database: exactly one gets `201`, the loser gets `409 { "error": "Event is full" }`. Cancelled
registrations free their seat (counts exclude `CANCELLED`), and every create/cancel triggers a
single authoritative-count refresh broadcast to all subscribers.

### Frontend hooks
- `useLiveCount(eventId)` → `{ registered, capacity, isFull }` (SSE, fails silently)
- `useLiveFeed()` → array of `{ id, name, event, timestamp }` (WS, reconnect + backoff)
- `useAdminRegistrationStream(cb)` → SSE with `?access_token=` auth, auto-reconnect
