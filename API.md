# Stellar Forge — API Documentation

**Base URL:** `http://localhost:3001/api`
**Auth:** Bearer token (Supabase JWT) via `Authorization` header or `?access_token=` query param

---

## Authentication

All authenticated endpoints require a valid Supabase access token. The backend verifies tokens locally via JWKS (no per-request Supabase API call).

```
Authorization: Bearer <supabase_access_token>
```

**Roles:**
- `ATTENDEE` — default for new users
- `ADMIN` — granted by owner
- `OWNER` — set via `ADMIN_OWNER_EMAIL` env var (self-healing)

---

## Auth Endpoints

### GET `/auth/me`

Get current user profile. Re-syncs name/email from Google identity.

**Auth:** Required

**Response 200:**
```json
{
  "id": "clq...",
  "email": "user@gmail.com",
  "name": "Ada Lovelace",
  "role": "ADMIN",
  "createdAt": "2026-08-01T00:00:00Z",
  "isOwner": true
}
```

**Responses:** `401` (invalid token), `404` (user not found)

---

## Events Endpoints (Public)

### GET `/events`

List published events with filters and pagination.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| search | string | — | Search title, description, location |
| category | string | — | Filter by category |
| status | string | `"upcoming"` | `upcoming`, `past`, `all` |
| page | number | 1 | Page number |
| limit | number | 12 | Items per page |

**Response 200:**
```json
{
  "events": [{
    "id": "clq...",
    "title": "Tech Summit",
    "description": "Annual tech conference",
    "date": "2026-09-15T09:00:00Z",
    "location": "Convention Center",
    "capacity": 200,
    "category": "Technology",
    "imageUrl": "https://...",
    "isOpen": true,
    "registeredCount": 45,
    "spotsLeft": 155
  }],
  "pagination": { "page": 1, "limit": 12, "total": 25, "pages": 3 }
}
```

> Note: `status="upcoming"` includes TBD (date=null) events.

---

### GET `/events/categories`

Get all unique categories.

**Response:** `["Technology", "Design", "Workshop", ...]`

---

### GET `/events/stats`

Platform-wide statistics (cached 60s).

**Response:**
```json
{
  "eventsListed": 25,
  "eventsUpcoming": 18,
  "ticketsIssued": 342,
  "doorsOpened": 289,
  "categories": 6
}
```

---

### GET `/events/:id`

Get single event details.

**Response 200:**
```json
{
  "id": "clq...",
  "title": "Tech Summit",
  "description": "...",
  "date": "2026-09-15T09:00:00Z",
  "endDate": "2026-09-15T18:00:00Z",
  "location": "Convention Center · Hall A",
  "capacity": 200,
  "category": "Technology",
  "imageUrl": "https://...",
  "isPublished": true,
  "isOpen": true,
  "registeredCount": 45,
  "spotsLeft": 155
}
```

**Responses:** `404` (not found)

---

### GET `/events/:id/updates`

Get organizer announcements for an event.

**Response:** `[{ "id": "...", "title": "...", "body": "...", "createdAt": "..." }]`

---

### GET `/events/:id/live-count` (SSE)

Server-sent events stream of registration count.

```
event: count
data: { "registeredCount": 45 }
```

---

## Registrations (Auth Required)

All registration routes require authentication.

### GET `/registrations/my`

Get all registrations for the current user.

**Response:**
```json
[
  {
    "id": "...",
    "ticketId": "TKT-1722988800000-ABC123",
    "status": "CONFIRMED",
    "registeredAt": "2026-08-06T12:00:00Z",
    "usedCount": 1,
    "lastScannedAt": "2026-09-15T08:55:00Z",
    "event": { "id": "...", "title": "Tech Summit", "date": "...", "location": "...", "category": "..." }
  }
]
```

---

### POST `/registrations/:eventId`

Register for an event. **Atomic, race-proof seat claim** using Serializable transaction with row locking.

**Response 201:**
```json
{
  "id": "...",
  "ticketId": "TKT-1722988800000-ABC123",
  "eventId": "...",
  "status": "CONFIRMED",
  "registeredAt": "2026-08-06T12:00:00Z",
  "event": { "id": "...", "title": "Tech Summit", "date": "...", "location": "...", "category": "..." }
}
```

**Error Responses:**

| Status | Body | Meaning |
|--------|------|---------|
| 400 | `{ "error": "Already registered for this event" }` | Duplicate registration |
| 404 | `{ "error": "Event not found" }` | Invalid event |
| 409 | `{ "error": "Registrations are closed for this event" }` | Event not open |
| 409 | `{ "error": "Event is full", "spotsLeft": 0 }` | Capacity reached |

**Side effects:** Broadcasts live count update, admin SSE event, WebSocket registration + refresh.

---

### DELETE `/registrations/:eventId`

Cancel a registration (soft cancel — status set to CANCELLED).

**Response 200:** `{ "message": "Registration cancelled" }`

**Responses:** `404` (not found)

---

### GET `/registrations/ticket/:ticketId`

Get ticket details. Owner or admin only.

**Response 200:**
```json
{
  "id": "...",
  "userId": "...",
  "ticketId": "TKT-...",
  "status": "CONFIRMED",
  "registeredAt": "...",
  "event": { "title": "Tech Summit", "date": "...", "location": "..." },
  "user": { "name": "Ada", "email": "ada@gmail.com" }
}
```

**Responses:** `403` (not owner), `404` (not found)

---

## Admin Endpoints

All admin routes require `ADMIN` role. Team management routes require owner.

### Event Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/events` | List all events (incl. unpublished) |
| POST | `/admin/events` | Create event |
| PUT | `/admin/events/:id` | Update event (partial) |
| DELETE | `/admin/events/:id` | Delete event (cascades) |
| GET | `/admin/events/:id/attendees` | Get attendees (`?search=`) |
| GET | `/admin/events/:id/export` | Export attendees CSV |

**Create Event Body:**
```json
{
  "title": "Tech Summit 2026",
  "description": "Annual technology conference",
  "location": "Convention Center · Hall A",
  "date": "2026-09-15T09:00:00Z",
  "endDate": "2026-09-15T18:00:00Z",
  "capacity": 200,
  "category": "Technology",
  "imageUrl": "https://...",
  "isPublished": true,
  "isOpen": true
}
```

> `date` is optional — omit/null for **Date TBD · Coming Soon**
> `imageUrl` accepts URLs or base64 data URLs (png/jpeg/webp, max 3MB)

**Update uses `eventSchema.partial()`** — any subset of fields. Use `{ isPublished: false }` to unpublish, `{ isOpen: false }` to close registrations.

---

### Event Updates (Announcements)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/events/:id/updates` | Post announcement |
| DELETE | `/admin/events/:id/updates/:updateId` | Delete announcement |

**Body:** `{ "title": "...", "body": "..." }`

---

### Ticket Scanning

### POST `/admin/tickets/scan`

Door scan. Each ticket scanned twice: 1st = ENTRY, 2nd = EXIT.

**Body:** `{ "code": "TKT-..." }`

**Response (valid):**
```json
{
  "valid": true,
  "direction": "entry",
  "usedCount": 1,
  "scannedAt": "2026-09-15T08:55:00Z",
  "attendee": "Ada Lovelace",
  "event": { "id": "...", "title": "Tech Summit" }
}
```

**Response (invalid):**

| Status | Body |
|--------|------|
| 404 | `{ "valid": false, "reason": "not_found", "message": "No active ticket matches this code." }` |
| 400 | `{ "valid": false, "reason": "not_open_yet", "message": "The gates aren't open for this event yet." }` |
| 409 | `{ "valid": false, "reason": "max_usage", "message": "This ticket has already been used for entry and exit." }` |
| 400 | `{ "valid": false, "reason": "bad_code", "message": "That doesn't look like a ticket code." }` |

> Tickets become scannable 1 hour before event date. TBD events cannot be scanned.

---

### Attendee & Registration Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/registrations` | All registrations (`?search=`, `?status=`) |
| GET | `/admin/attendees` | All attendees with passes (`?search=`) |

**Registration filters:** `status` can be `CONFIRMED`, `CANCELLED`, or `WAITLISTED`.

---

### Team Management (Owner Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List users (`?search=`) |
| PUT | `/admin/users/:id/role` | Grant/revoke admin |
| GET | `/admin/audit-log` | Role change history |

**Role Change Body:** `{ "role": "ADMIN" | "ATTENDEE" }`

**Response 200:** `{ "id": "...", "email": "...", "name": "...", "role": "ADMIN" }`

**Responses:** `400` (owner's role cannot change), `404` (user not found)

---

### Admin Real-Time Stream

### GET `/admin/registrations-stream` (SSE)

Stream of new registrations. Token via `?access_token=` (SSE can't set headers).

```
event: registration
data: { "timestamp": "2026-08-06T12:34:56Z" }
```

---

## Dashboard Endpoints

### GET `/dashboard/attendee` (Auth Required)

**Response:**
```json
{
  "totalRegistrations": 5,
  "upcomingEvents": 3,
  "completedEvents": 2,
  "favoriteCategory": "Technology",
  "participationStreak": 2,
  "upcomingReminders": [
    { "id": "...", "title": "Tech Summit", "date": "...", "location": "..." }
  ],
  "recentActivity": [
    { "eventName": "Tech Summit", "date": "...", "registeredAt": "...", "ticketId": "TKT-..." }
  ]
}
```

---

### GET `/dashboard/admin` (Admin Required)

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
  "eventStats": [
    { "id": "...", "title": "Tech Summit", "date": "...", "capacity": 200, "registered": 150, "fillRate": 75 }
  ]
}
```

---

## WebSocket

### `ws://localhost:3001/ws/live-feed`

**Client → Server (subscribe):**
```json
{ "type": "subscribe", "eventId": "clq..." }
```

**Server → Client (count):**
```json
{ "type": "count", "eventId": "clq...", "registeredCount": 45 }
```

**Server → Client (registration):**
```json
{
  "type": "registration",
  "attendeeFirstName": "Ada",
  "eventTitle": "Tech Summit",
  "eventId": "...",
  "timestamp": "2026-08-06T12:34:56Z"
}
```

**Server → Client (scan):**
```json
{
  "type": "scan",
  "attendee": "Ada Lovelace",
  "eventTitle": "Tech Summit",
  "direction": "entry",
  "timestamp": "..."
}
```

**Server → Client (refresh):**
```json
{ "type": "refresh", "at": 1722988800000 }
```

---

## Error Format

All errors follow a consistent shape:

```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation error |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (wrong role) |
| 404 | Resource not found |
| 409 | Conflict (full, closed, duplicate) |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

## Health Check

### GET `/api/health`

**Response:** `{ "status": "ok", "timestamp": "2026-08-06T12:00:00Z" }`
