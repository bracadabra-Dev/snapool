# SnapPool (spaisnap)

Crowd-sourced event photography platform — Phase 1 MVP.

## Stack

- **Backend:** Node.js + Express (TypeScript)
- **Frontend:** React + Vite + Tailwind (TypeScript)
- **Database:** Neon Postgres (Prisma)
- **Storage:** Cloudflare R2
- **Deploy:** Single Render web service (API + static SPA)

## Local setup

1. Copy env file and fill in values:

```bash
cp .env.example .env
```

2. Install and generate Prisma client:

```bash
npm install
npm run db:generate
```

3. Apply schema to Neon (pick one):

```bash
# preferred once DATABASE_URL + DIRECT_URL are set
npm run db:migrate

# or push without migration history during early local setup
npm run db:push
```

4. Run API + frontend together:

```bash
npm run dev
```

- Frontend: http://localhost:5173  
- API: http://localhost:3000/api/health  

Vite proxies `/api` to the backend.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string (app runtime) |
| `DIRECT_URL` | Neon **direct** connection string (Prisma migrations) |
| `JWT_SECRET` | Signing secret for owner + contributor tokens |
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API token |
| `R2_BUCKET_NAME` | Bucket name |
| `R2_PUBLIC_URL_BASE` | Public base URL for objects (custom domain or r2.dev) |
| `APP_PUBLIC_URL` | Public app origin used in QR/share links (no trailing slash) |
| `PORT` | Backend port (default `3000`) |

## Deploy on Render

1. Create a Neon project and copy pooled + direct connection strings.
2. Create an R2 bucket and API token; enable a public URL (r2.dev or custom domain).
3. Connect this repo on Render (or use `render.yaml`).
4. Set all env vars above. Set `APP_PUBLIC_URL` to your Render URL (e.g. `https://spaisnap.onrender.com`).
5. Build: `npm install --include=dev && npm run build`  
   (Render sets `NODE_ENV=production`, which would otherwise skip Vite/TypeScript.)  
   Start: `npm start` (`prisma migrate deploy` then Node).

The Express server serves `frontend/dist` and SPA-falls back for non-`/api` routes, so `/e/:slug` works on the same origin.

## Phase 1 flows

- Owner registers/logs in → creates event → gets share link + QR
- Guest opens `/e/:slug` → Open Camera → client-side compress → upload → live gallery
- Owner uploads Pro Shots (amber badge) separate from guest pool (cyan badge)
