import type { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { prisma } from "./prisma.js";
import { createSupabaseClient } from "./client.js";

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  name: string;
  isOwner: boolean;
}

interface SupabaseClaims extends JWTPayload {
  sub?: string;
  email?: string;
  user_metadata?: { name?: string; full_name?: string };
}

// Verifies the JWT signature locally via the project's JWKS endpoint (no
// per-request Supabase API round trip). Falls back to Supabase's getUser for
// tokens our cache cannot handle yet (e.g. keys rotated between refreshes).
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) {
    const url = process.env.SUPABASE_URL;
    if (!url) throw new Error("SUPABASE_URL must be set in backend/.env");
    jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

async function verifySupabaseToken(token: string): Promise<SupabaseClaims> {
  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      clockTolerance: 30,
    });
    return payload as SupabaseClaims;
  } catch {
    // Fallback: ask Supabase to validate (covers JWKS refresh races).
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new Error("Invalid or revoked token");
    return {
      sub: data.user.id,
      email: data.user.email,
      user_metadata: data.user.user_metadata as SupabaseClaims["user_metadata"],
    };
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const queryToken = typeof req.query.access_token === "string" ? req.query.access_token : undefined;
  if (!header?.startsWith("Bearer ") && !queryToken) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  try {
    const token = header?.startsWith("Bearer ") ? header.split(" ")[1] : queryToken!;
    const claims = await verifySupabaseToken(token);

    const supabaseId = claims.sub!;
    const email = claims.email && claims.email.length > 0 ? claims.email : `${supabaseId}@no-email.local`;
    const name = claims.user_metadata?.name || claims.user_metadata?.full_name || "Attendee";

    const ownerEmail = process.env.ADMIN_OWNER_EMAIL;
    const isOwner = !!ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase();

    // The owner's role is self-healing: it is forced back to ADMIN on every
    // request. Nobody else's role is ever touched here — that is DB-authoritative.
    const dbUser = await prisma.user.upsert({
      where: { supabaseId },
      update: { email, name, ...(isOwner ? { role: "ADMIN" } : {}) },
      create: { email, name, role: isOwner ? "ADMIN" : "ATTENDEE", supabaseId },
    });

    (req as any).user = { userId: dbUser.id, email: dbUser.email, role: dbUser.role, name: dbUser.name, isOwner };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or revoked token" });
  }
}

// Guards are deliberately independent. Team routes use requireOwner alone, so
// a DB inconsistency could never lock the true owner out of the role manager.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user || user.role !== "ADMIN") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function requireOwner(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user || !user.isOwner) {
    res.status(403).json({ error: "Owner access required" });
    return;
  }
  next();
}