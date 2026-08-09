# Troubleshooting & Lessons Learned

This document captures the hurdles faced during deployment and how they were solved.

---

## 1. PM2 Not Picking Up Environment Variable Changes

**Problem:** After updating `.env`, `pm2 restart` kept using old env vars. The `FRONTEND_URL` was stuck on `localhost:5173`.

**Root Cause:** PM2 caches environment variables at process spawn time. `pm2 restart` does NOT re-read the `.env` file.

**Solution:**
```bash
pm2 delete <app>          # Delete old process
pm2 start <app>           # Start fresh (reads updated .env)
```

Or kill the entire PM2 daemon:
```bash
pm2 kill                  # Stops daemon + clears cache
pm2 start <app>
```

**Better approach:** Use an ecosystem file (`ecosystem.config.cjs`) with explicit env vars, or use a start script that exports env vars before running.

---

## 2. CORS Middleware Reading Env Var Before `.env` Loaded

**Problem:** Bun reads `.env` files automatically, but the `cors()` middleware was instantiated at module load time — before Bun had loaded the `.env` file. So `process.env.FRONTEND_URL` was `undefined`, falling back to `localhost:5173`.

**Error:**
```
Access-Control-Allow-Origin: http://localhost:5173
```

**Solution:** Use a function-based CORS config with explicit allowed origins:

```ts
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "https://stellar-forge-frontend.vercel.app"
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error("Not allowed"));
  },
  credentials: true
}));
```

---

## 3. Frontend Env Var Not Injected at Build Time

**Problem:** `VITE_API_URL` was set on Vercel but the frontend kept hitting `localhost:3001`.

**Root Cause:** The build script (`build.ts`) only injects env vars starting with `BUN_PUBLIC_`:
```ts
if (key.startsWith("BUN_PUBLIC_")) {
  envDefine[`process.env.${key}`] = JSON.stringify(value ?? "");
}
```

**Solution:** Rename `VITE_API_URL` to `BUN_PUBLIC_API_URL` in both:
- `config.ts`: `process.env.BUN_PUBLIC_API_URL`
- Vercel Environment Variables

Also ensure `config.ts` reads from `process.env` (not `globalThis.process?.env`) so the build-time replacement works:
```ts
export const API_URL = process.env.BUN_PUBLIC_API_URL || "http://localhost:3001/api";
```

---

## 4. Mixed Content (HTTPS Frontend → HTTP Backend)

**Problem:** Frontend on Vercel (HTTPS) couldn't call backend on AWS EC2 (HTTP). Browser blocked the requests.

**Error:**
```
Mixed Content: The page was loaded over HTTPS, but requested an insecure endpoint.
```

**Root Cause:** Browsers block HTTPS pages from making HTTP requests for security.

**Solution:** Use **Cloudflare Tunnel** to get a free HTTPS URL for the backend:

```bash
# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Start tunnel
cloudflared tunnel --url http://localhost:3001
# Returns: https://abc123.trycloudflare.com
```

Then update Vercel env var:
```
BUN_PUBLIC_API_URL = https://abc123.trycloudflare.com/api
```

**Benefits:**
- Free, no signup required
- HTTPS works for anyone (no cert installation)
- WebSocket works over WSS automatically

---

## 5. Prisma Client Not Found with PM2

**Problem:** `Cannot find module '.prisma/client/default'` when running with PM2.

**Root Cause:** PM2 was using Node.js instead of Bun as the interpreter, causing module resolution issues with Bun's cached packages.

**Solution:** Run directly with Bun instead of PM2:
```bash
nohup bun src/index.ts > /tmp/stellar-forge.log 2>&1 &
```

Or use systemd for production:
```ini
# /etc/systemd/system/stellar-forge.service
[Service]
ExecStart=/home/ubuntu/.bun/bin/bun src/index.ts
```

---

## 6. Database Connection from EC2 to Supabase

**Problem:** `P1001: Can't reach database server` — EC2 couldn't connect to Supabase.

**Root Cause:** Supabase's direct connection uses IPv6, but AWS EC2 VPC didn't support IPv6.

**Solution:** Use Supabase's **connection pooler** (port 6543) which handles IPv4:
```
postgresql://postgres:pass@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

---

## Key Takeaways

1. **PM2 caches env vars** — always `delete` + `start`, never just `restart`
2. **Bun loads `.env` at runtime** — but middleware setup runs at module load time
3. **Build-time env injection** — must use the correct prefix (`BUN_PUBLIC_`)
4. **HTTPS everywhere** — browsers block mixed content, use Cloudflare Tunnel
5. **Bun ≠ Node** — some tools (PM2) don't work well with Bun, use native solutions

---

## Useful Commands

```bash
# Check what Bun reads from .env
bun -e "console.log(process.env.FRONTEND_URL)"

# Check PM2 env vars
pm2 env <pid>

# Test database connection
bun -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.user.count().then(c => console.log('Users:', c));"

# Start Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3001
```
