# Deployment Guide

## Overview

Stellar Forge is deployed as:
- **Frontend** → Vercel (static SPA)
- **Backend** → Railway (Node.js/Bun server)
- **Database** → Supabase (PostgreSQL)

---

## Prerequisites

1. [Supabase](https://supabase.com) account + project
2. [Vercel](https://vercel.com) account
3. [Railway](https://railway.app) account
4. Google OAuth credentials configured in Supabase

---

## Step 1: Set Up Supabase Database

1. Create a new Supabase project
2. Go to **Settings → Database → Connection string**
3. Copy the **URI** connection string
4. Run the migration:
   ```bash
   cd backend
   DATABASE_URL="your-connection-string" bunx prisma db push
   DATABASE_URL="your-connection-string" bun run db:seed
   ```
5. Go to **Authentication → Providers → Enable Google**
6. Set Site URL to your Vercel domain (e.g., `https://stellar-forge.vercel.app`)
7. Add redirect URL: `https://stellar-forge.vercel.app/oauth/callback`

---

## Step 2: Deploy Backend to Railway

1. Go to [Railway](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select the `stellar-forge` repository
3. Set the root directory to `backend`
4. Add environment variables:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Your Supabase connection string |
   | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `SUPABASE_API_SECRET` | Your Supabase service_role key |
   | `ADMIN_OWNER_EMAIL` | Your Google email |
   | `FRONTEND_URL` | `https://stellar-forge.vercel.app` |
   | `PORT` | `3001` |

5. Railway will auto-detect the start command from `railway.json`
6. Wait for deployment to complete
7. Note the generated domain (e.g., `https://stellar-forge-api.up.railway.app`)

---

## Step 3: Deploy Frontend to Vercel

1. Go to [Vercel](https://vercel.com) → **Add New Project**
2. Import the `stellar-forge` repository
3. Configure the project:

   | Setting | Value |
   |---------|-------|
   | Framework Preset | **Other** |
   | Root Directory | `frontend` |
   | Build Command | `bun run build` |
   | Output Directory | `dist` |

4. Add environment variables:

   | Variable | Value |
   |----------|-------|
   | `BUN_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `BUN_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
   | `VITE_API_URL` | `https://stellar-forge-api.up.railway.app/api` |

5. Click **Deploy**

---

## Step 4: Update Supabase Redirect URL

After both deployments are live:

1. Go to Supabase → **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel domain
3. Add redirect URL: `https://stellar-forge.vercel.app/oauth/callback`

---

## Step 5: Verify Deployment

1. Visit your Vercel URL
2. Sign in with Google
3. Create an event (Admin → Events)
4. Register for the event
5. Check the dashboard
6. Test the QR scanner

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Check `FRONTEND_URL` in Railway matches Vercel domain |
| Auth not working | Verify Supabase redirect URLs |
| Database connection failed | Check `DATABASE_URL` format |
| Build fails | Ensure `bun` is installed (Vercel/Railway auto-detect) |

---

## Alternative: Docker Deployment

```bash
# Build
docker build -t stellar-forge-api ./backend

# Run
docker run -p 3001:3001 \
  -e DATABASE_URL="..." \
  -e SUPABASE_URL="..." \
  -e SUPABASE_API_SECRET="..." \
  -e ADMIN_OWNER_EMAIL="..." \
  -e FRONTEND_URL="..." \
  stellar-forge-api
```
