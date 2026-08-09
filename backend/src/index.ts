import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { authRouter } from "./routes/auth.js";
import { eventsRouter } from "./routes/events.js";
import { registrationsRouter } from "./routes/registrations.js";
import { adminRouter } from "./routes/admin.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { liveRouter } from "./routes/live.js";
import { setupLiveServer } from "./live.js";
import { rateLimiter, securityHeaders, requestLogger, errorHandler } from "./middleware.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
const ALLOWED_ORIGINS = [process.env.FRONTEND_URL || "http://localhost:5173", "http://localhost:5173", "https://stellar-forge-frontend.vercel.app"];
app.use(cors({ origin: (origin, cb) => { if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true); else cb(new Error("Not allowed")); }, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "8mb" }));
app.use(securityHeaders);
app.use(rateLimiter);
app.use(requestLogger);

app.get("/", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Stellar Forge API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Syne', system-ui, sans-serif; background: #030014; color: #f0e6ff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 3rem; background: linear-gradient(135deg, #a855f7, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 1rem; }
    .status { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.2); border-radius: 999px; margin-bottom: 2rem; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #06b6d4; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    .endpoints { display: grid; gap: 0.5rem; max-width: 400px; margin: 0 auto; }
    .endpoint { padding: 0.75rem 1rem; background: rgba(26,16,64,0.6); border: 1px solid rgba(168,85,247,0.15); border-radius: 12px; text-align: left; font-size: 0.875rem; }
    .endpoint code { color: #06b6d4; font-family: monospace; }
    .endpoint span { color: #8b8ba7; margin-left: 0.5rem; }
    a { color: #a855f7; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>✨ Stellar Forge</h1>
    <div class="status"><span class="dot"></span> API v1.0.0 — Running</div>
    <div class="endpoints">
      <div class="endpoint"><code>GET /api/auth/me</code><span>Session check (Supabase JWT)</span></div>
      <div class="endpoint"><code>GET /api/events</code><span>Browse events</span></div>
      <div class="endpoint"><code>POST /api/registrations/:id</code><span>Register for event</span></div>
      <div class="endpoint"><code>GET /api/dashboard/attendee</code><span>Attendee stats</span></div>
      <div class="endpoint"><code>GET /api/dashboard/admin</code><span>Admin analytics</span></div>
    </div>
    <p style="margin-top: 2rem;"><a href="/api/health">Health Check →</a></p>
  </div>
</body>
</html>`);
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);
app.use("/api/registrations", registrationsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api", liveRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`🚀 Stellar Forge API running on http://localhost:${PORT}`);
});

setupLiveServer(server);
