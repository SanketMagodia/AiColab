# TeamHub

A password-protected internal team tool built with Next.js 14 (App Router), TypeScript, and MongoDB Atlas. Includes a Scrum board, password vault, sticky notes, and a collaborative drawing board. All data is shared across all users — no per-user accounts.

## Features

- **🗂 Scrum Board** — manage team members and tasks across Todo / In Progress / Finished columns
- **🔑 Password Vault** — store credentials per environment (DEV / QA / UAT / STAGING / PROD)
- **📝 Sticky Notes** — draggable notes on a shared canvas
- **🎨 Drawing Board** — collaborative infinite canvas with pen, shapes, text, and undo

Near-real-time sync via SWR polling (5s for most sections, 3s for drawing).

---

## Prerequisites

- Node.js 18.17+
- A free MongoDB Atlas account

---

## 1. Set up MongoDB Atlas (free tier)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and create a free account.
2. Create a new **M0 (Free)** cluster — pick any cloud/region.
3. In **Database Access**, create a database user with a username and password (write down the password).
4. In **Network Access**, click **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`). This is required so Vercel serverless functions can reach the cluster.
5. Once the cluster is ready, click **Connect → Drivers**, pick Node.js, and copy the connection string. It looks like:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<user>` and `<password>` with your DB user credentials.

Collections (`users`, `tasks`, `passwords`, `notes`, `drawing`) are created automatically on first use — no migrations needed.

---

## 2. Local development

```bash
npm install
cp .env.local.example .env.local
```

Edit `.env.local`:

```
APP_PASSWORD=pickanypassword
MONGODB_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter the password you set, and you're in.

---

## 3. Deploy to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com), import the repo.
3. In **Settings → Environment Variables**, add:
   - `APP_PASSWORD` — the team password
   - `MONGODB_URI` — the Atlas connection string
4. Click **Deploy**. Vercel will build and host it on a free `*.vercel.app` URL.

> Make sure `0.0.0.0/0` is whitelisted in Atlas Network Access — Vercel functions use dynamic IPs.

---

## Architecture notes

- `lib/mongodb.ts` caches the MongoClient on `global._mongoClientPromise` to avoid connection-pool exhaustion in serverless.
- All API routes are server-only and live under `app/api/`.
- The password gate is purely a frontend convenience — `localStorage.teamhub_auth=true` after `/api/auth/verify` succeeds. There is intentionally **no auth on the API routes** (the spec calls for fully transparent shared data).
- SWR polls every 5 seconds for users / tasks / passwords / notes; the drawing board polls every 3 seconds and merges by replacing local shapes with server state.
- Drawing undo (Ctrl+Z) is local-only (50-step history) — undo does not propagate to other users.
- The drawing collection always holds exactly one document; routes use `findOne()` and `updateOne({}, ..., { upsert: true })`.

---

## Project structure

```
app/
  api/                  ← REST routes
  (protected)/          ← layout enforces localStorage auth
    scrum/page.tsx
    passwords/page.tsx
    notes/page.tsx
    drawing/page.tsx
  page.tsx              ← password gate
  layout.tsx
  globals.css
components/
  layout/   scrum/   passwords/   notes/   drawing/   ui/
lib/
  mongodb.ts  auth.ts  fetcher.ts  types.ts
hooks/
  useAuth.ts  useToast.ts
```

---

## Scripts

```bash
npm run dev      # local dev
npm run build    # production build
npm run start    # run production build
```
