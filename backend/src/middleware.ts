import type { Request, Response, NextFunction } from "express";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 100;

const rateMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    next();
    return;
  }

  entry.count++;
  if (entry.count > RATE_MAX_REQUESTS) {
    res.status(429).json({ error: "Too many requests. Try again later." });
    return;
  }

  next();
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com"
  );
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
}
