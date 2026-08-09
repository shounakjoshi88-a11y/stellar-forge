# Stellar Forge — API Documentation

**Base URL:** `http://localhost:3001/api`

---

## Authentication

Authentication uses **Supabase Auth** with Google OAuth. Users sign in via the frontend; the Supabase access token is sent as a Bearer token:

```
Authorization: Bearer <supabase_access_token>
```

The backend verifies tokens locally via JWKS (no per-request Supabase API call) and provisions a local user row on first sign-in.

**Roles are DB-authoritative:**
- `ADMIN_OWNER_EMAIL` in `.env` is the **owner** — auto-promoted on every request
- Other users start as `ATTENDEE`
- Owner grants/revokes admin via Team tab (audit logged)

### GET `/auth/me` *(Auth required)*

Get current user profile.

**Response:**
```json
{ "id": "uuid", "email": "a@b.com", "name": "Ada", "role": "ADMIN", "createdAt": "..." }
```

---

## Events

### GET `/events`

List published events with pagination and filters.

| Param | Type | Description |
|-------|------|-------------|
| search | string | Search title, description, location |
| category | string | Filter by category |
| status | string | `upcoming`, `past`, `all` |
| page | number | Default: 1 |
| limit | number | Default: 12 |

**Response:** `{ "events": [...], "pagination": { "page", "total", "totalPages" } }`

### GET `/events/categories`

Get all unique categories.

**Response:** `["Technology", "Design", ...]`

### GET `/events/:id`

Get single event with attendee count.

**Response:** `{ "id", "title", "description", "location", "date", "capacity", "category", "imageUrl", "registeredCount" }`

### GET `/events/:id/live-count` *(SSE)*

Server-sent events stream of registration count. One message every 5 seconds:

```
data: { "eventId": "abc", "registered": 42, "capacity": 100 }
```

---

## Registrations *(Auth required)*

### GET `/registrations/my`

Get all registrations for the logged-in user.

**Response:** `[{ "id", "ticketId", "status", "event": {...}, "createdAt" }]`

### POST `/registrations/:eventId`

Register for an event. Uses Serializable transaction with row locking — only one user gets the last seat.

**Response (201):** `{ "id", "ticketId", "status": "CONFIRMED", "event": {...} }`
**Response (409):** `{ "error": "Event is full" }`

### DELETE `/registrations/:eventId`

Cancel a registration (frees the seat).

### GET `/registrations/ticket/:ticketId`

Get ticket details for display/download.

**Response:** `{ "ticketId", "eventName", "eventDate", "location", "attendeeName", "status", "qrCode" }`

---

## Admin *(Auth + Admin role required)*

### Event Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/events` | List all events (including unpublished) |
| POST | `/admin/events` | Create new event |
| PUT | `/admin/events/:id` | Update event |
| DELETE | `/admin/events/:id` | Delete event |
| GET | `/admin/events/:id/attendees` | Get registered attendees (`?search=`) |
| GET | `/admin/events/:id/export` | Export attendees as CSV |

**Create Event Body:**
```json
{
  "title": "Tech Summit 2026",
  "description": "Annual technology conference",
  "location": "Convention Center · Hall A",
  "date": "2026-09-15T09:00:00Z",
  "capacity": 200,
  "category": "Technology",
  "imageUrl": "https://..."
}
```

> `date` is optional — omit/null lists as **Date TBD · Coming Soon**

### Attendee Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/registrations` | All registrations (`?search=`, `?status=`) |
| GET | `/admin/attendees` | Every registered person with passes (`?search=`) |

### Ticket Scanning

### POST `/admin/tickets/scan`

Door scan. Each ticket scanned twice: 1st = ENTRY, 2nd = EXIT, 3rd = rejected.

**Body:** `{ "code": "TKT-..." }`

**Response (valid):**
```json
{ "valid": true, "direction": "entry", "usedCount": 1, "scannedAt": "...", "attendee": "Ada", "event": {...} }
```

**Response (invalid):** `404 not_found`, `400 not_open_yet`, `409 max_usage`

### Team Management *(Owner only)*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List users (`?search=`) |
| PUT | `/admin/users/:id/role` | Grant/revoke admin |
| GET | `/admin/audit-log` | Role change history |

**Role Change Body:** `{ "role": "ADMIN" | "ATTENDEE" }`

### Real-time Admin Stream

### GET `/admin/registrations-stream?access_token=<jwt>` *(SSE, Admin only)*

Stream of new registrations for the admin dashboard:

```
data: { "timestamp": "...", "name": "Ada", "event": "Design Night" }
```

---

## Dashboard

### GET `/dashboard/attendee` *(Auth required)*

**Response:**
```json
{
  "totalRegistrations": 5,
  "upcomingEvents": 3,
  "completedEvents": 2,
  "favoriteCategory": "Technology",
  "participationStreak": 2,
  "upcomingReminders": [{ "event": {...}, "daysUntil": 3 }],
  "recentActivity": [...]
}
```

### GET `/dashboard/admin` *(Admin required)*

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

## WebSocket

### `ws://localhost:3001/ws/live-feed`

**Client → Server:**
```json
{ "type": "subscribe", "eventId": "abc" }
```

**Server → Client (count):**
```json
{ "type": "count", "eventId": "abc", "registeredCount": 42 }
```

**Server → Client (registration):**
```json
{ "type": "registration", "name": "Ada", "event": "Tech Summit", "timestamp": "..." }
```

Heartbeat ping every 30s.

---

## Error Format

All errors follow a consistent shape:

```json
{ "error": "Human-readable message", "code": "ERROR_CODE" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation error |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (wrong role) |
| 404 | Resource not found |
| 409 | Conflict (event full, duplicate) |
| 500 | Server error |
