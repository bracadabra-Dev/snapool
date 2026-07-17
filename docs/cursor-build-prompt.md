# CURSOR BUILD PROMPT
## Crowd-Sourced Event Photography Platform — Full Technical Build Spec

Paste this entire document into Cursor as your project context / initial prompt.
It is written to be built incrementally — follow the phases in order, and do not
skip ahead to Phase 2 features while Phase 1 is unstable.

---

## PROJECT SUMMARY

Build a multi-tenant web platform where:
- Event owners (photographers or individual organizers) create accounts, create
  "Events," and get a unique shareable link + QR code per event.
- Anyone with the link/QR can open a no-login web page, tap "Open Camera," and
  have their photo automatically compressed and uploaded into a shared gallery
  pool for that event.
- Owners can separately upload their own "Pro Shots," kept visually distinct
  from the contributor pool but shown together on one gallery page.
- Owners manage per-event settings, moderate content, and (in later phases)
  monetize via subscriptions (photographers) or one-time event passes
  (organizers).

---

## TECH STACK (fixed — do not substitute without asking)

- **Backend:** Node.js + Express (TypeScript)
- **Database:** Neon PostgreSQL (use Prisma as ORM)
- **Frontend:** React + Vite (TypeScript), Tailwind CSS
- **Object storage:** Cloudflare R2 (S3-compatible API — use `@aws-sdk/client-s3`
  pointed at the R2 endpoint)
- **Auth (owners):** JWT-based session auth, email + password to start
- **Auth (contributors):** short-lived signed tokens scoped to a single
  `event_id`, no account, no password
- **Payments:** Campay API (Mobile Money / XAF) — stub this in Phase 1, wire
  fully in Phase 2
- **Image compression:** client-side, via browser Canvas API, before upload
- **Deployment target:** Render, so structure the app to run cleanly as a
  production web service from the start

---

## DATA MODEL (Prisma schema — build this first)

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  role          String   // "photographer" | "organizer" | "hybrid"
  businessName  String?
  portfolioUrl  String?
  plan          String   @default("free") // "free" | "pro" | "studio" | "event_pass"
  planExpiresAt DateTime?
  createdAt     DateTime @default(now())
  events        Event[]
}

model Event {
  id                String   @id @default(uuid())
  ownerId           String
  owner             User     @relation(fields: [ownerId], references: [id])
  name              String
  slug              String   @unique
  coverImageUrl     String?
  visibility        String   @default("unlisted") // "public" | "unlisted" | "password"
  passwordHash      String?
  contributionOpensAt   DateTime?
  contributionClosesAt  DateTime?
  galleryLive       Boolean  @default(true)
  moderationMode    String   @default("auto") // "auto" | "manual"
  maxPhotosPerContributor Int @default(20)
  requireContributorName  Boolean @default(false)
  brandingLogoUrl   String?
  thankYouMessage   String?
  retentionDays     Int      @default(7)
  createdAt         DateTime @default(now())
  photos            Photo[]
  contributors      Contributor[]
}

model Contributor {
  id           String   @id @default(uuid())
  eventId      String
  event        Event    @relation(fields: [eventId], references: [id])
  name         String?
  phone        String?
  sessionToken String   @unique
  createdAt    DateTime @default(now())
  photos       Photo[]
}

model Photo {
  id             String   @id @default(uuid())
  eventId        String
  event          Event    @relation(fields: [eventId], references: [id])
  contributorId  String?
  contributor    Contributor? @relation(fields: [contributorId], references: [id])
  type           String   // "pro" | "contributor"
  fullUrl        String
  thumbUrl       String
  status         String   @default("published") // "pending" | "published" | "rejected"
  uploadedAt     DateTime @default(now())
}
```

---

## PHASE 1 — MVP (build this fully before anything else)

### 1.1 Backend setup
- Initialize Express + TypeScript project, Prisma connected to Neon Postgres.
- Env vars: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
  `R2_PUBLIC_URL_BASE`, `APP_PUBLIC_URL`.
- Use Neon's pooled connection string for `DATABASE_URL` in the running Render
  web service, and Neon's direct connection string for `DIRECT_URL` when Prisma
  needs direct migration access.
- Set up R2 client using the S3-compatible SDK pointed at
  `https://<account_id>.r2.cloudflarestorage.com`.

### 1.2 Owner auth
- `POST /api/auth/register` — email, password, role (photographer/organizer)
- `POST /api/auth/login` — returns JWT
- Middleware: `requireAuth` for all owner-only routes

### 1.3 Event CRUD
- `POST /api/events` — create event (owner only), auto-generate a unique slug
  (e.g. slugify(name) + short random suffix), generate a QR code (use `qrcode`
  npm package) pointing to `https://yourdomain.com/e/{slug}`, return QR as a
  data URL or store as an image in R2.
- `GET /api/events/:id` — owner view (full config + all photos)
- `PATCH /api/events/:id` — update event config fields
- `GET /api/e/:slug` — **public** route, contributor-facing: returns event name,
  cover image, branding, and whether contribution is currently open. No auth.

### 1.4 Contributor flow
- `POST /api/e/:slug/session` — creates a Contributor record scoped to this
  event, returns a signed short-lived token (JWT with `eventId` + `contributorId`
  claims, no password). Optionally collects name/phone if
  `requireContributorName` is true for that event.
- `POST /api/e/:slug/upload` — authenticated via contributor session token only
  (not owner JWT). Accepts a pre-compressed image (see client-side compression
  spec below), uploads both thumb and full versions to R2 under
  `events/{eventId}/contributor/{photoId}-thumb.jpg` and
  `.../{photoId}-full.jpg`, creates a Photo record with `type: "contributor"`.
  Enforce `maxPhotosPerContributor` server-side (never trust the client).

### 1.5 Owner Pro Shots upload
- `POST /api/events/:id/pro-upload` — owner-authenticated, same compression
  pipeline, stores under `events/{eventId}/pro/`, creates Photo with
  `type: "pro"`.

### 1.6 Gallery retrieval
- `GET /api/e/:slug/gallery` — public route (respects `galleryLive` flag),
  returns paginated list of published photos (both pro and contributor,
  separated by `type`), sorted by `uploadedAt` descending.
- Frontend polls this endpoint every 3-5 seconds while the contributor/gallery
  page is open.

### 1.7 Frontend — Contributor page (`/e/:slug`)
- Minimal, mobile-first, fast-loading single page.
- Shows event name + cover image.
- Big "Open Camera" button:
  - Uses `<input type="file" accept="image/*" capture="environment">` for v1
    (native camera UI — do not build a custom `getUserMedia` viewfinder yet,
    it adds iOS Safari complexity for marginal gain at this stage).
- On file selected → run client-side compression (see below) → upload via
  `POST /api/e/:slug/upload` → show upload progress → show thank-you message
  from event config on success.
- Below the camera button: live gallery grid (thumbnails only, tap to view
  full-size in a lightbox), auto-refreshing via polling.

### 1.8 Frontend — Owner dashboard
- List of owned events, "Create Event" button.
- Per-event page: config form (all Section 6 parameters from the playbook),
  Pro Shots upload area, full gallery view (pro + contributor, clearly
  labeled/separated tabs), basic photo moderation (delete any photo).

### 1.9 Client-side image compression (build as a shared utility, use on both
contributor and owner upload flows)

```ts
async function compressImage(
  file: File,
  maxDimension = 2048,
  quality = 0.85
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', quality)
  );
}
```

- Generate BOTH a thumbnail (400px, quality 0.70) and a full version (2048px,
  quality 0.85) client-side before upload; upload both in the same request
  (multipart) so the server never has to re-process images.
- Never upscale: if the original is already smaller than `maxDimension`, skip
  resizing for that pass.
- Do not preserve EXIF beyond orientation — since the image is being redrawn
  onto a canvas at a corrected orientation, EXIF orientation should already be
  baked into the pixels; verify this works correctly on iOS Safari specifically
  (known source of sideways-photo bugs) before considering Phase 1 done.

### 1.10 Rate limiting / abuse basics
- Enforce `maxPhotosPerContributor` server-side per contributor session.
- Basic IP-based rate limit on the upload endpoint (e.g. max 10 uploads/minute
  per IP) to blunt basic spam/abuse even before moderation tooling exists.

### Phase 1 Definition of Done
- A user can register, create an event, get a QR code + link.
- Anyone with the link can open camera, shoot, and see their photo appear in
  the shared gallery within a few seconds, with no login.
- Owner can upload Pro Shots separately and see them labeled distinctly in the
  gallery.
- All uploaded images are properly compressed (verify actual file sizes land
  in the 300-800KB range for full-size, well under 100KB for thumbnails) and
  visually look sharp on both a phone screen and full-screen laptop view.

---

## PHASE 2 — MONETIZATION (only after Phase 1 is fully stable)

### 2.1 Plan/entitlement model
- Add `plan` and `planExpiresAt` on User (already in schema above).
- Middleware: `checkEntitlement(feature)` that reads the owner's plan and
  either allows, soft-warns, or hard-blocks an action.

### 2.2 Campay integration
- `POST /api/billing/subscribe` — initiates a Campay Mobile Money charge for
  photographer Pro/Studio subscription.
- `POST /api/billing/event-pass` — one-time charge for organizer Event Pass on
  a specific event.
- Webhook endpoint to receive Campay payment confirmation, update `plan` /
  `planExpiresAt` accordingly (reuse patterns from existing SpaiHub Campay
  integration — centralize billing logic, event nodes only make outbound calls).

### 2.3 Paywall trigger logic
- Free tier: block new event creation beyond 1 active event; block uploads
  beyond photo-count limit (return a clear "upgrade to continue" response, not
  a silent failure); auto-lock gallery visibility after `retentionDays` unless
  plan allows extended retention.
- Soft lock: banner/nudge shown in UI when nearing a limit.
- Hard lock: upload blocked, but never delete existing photos — always allow
  viewing already-uploaded content even on a lapsed/free plan, only gate new
  contributions/features.

### 2.4 Branding & zip download (paid features)
- Custom branding fields (logo, thank-you message) only editable/visible on
  paid plans; on free plan, show default platform branding on the contributor
  page and thank-you screen.
- `GET /api/events/:id/export` — server-side zip generation of all photos
  (full-size versions) for an event, gated behind plan check.

---

## PHASE 3 — RETENTION & GROWTH (after Phase 2 billing is working end-to-end)

- OpenWA integration: share event link to a WhatsApp group directly from the
  owner dashboard; optional periodic "N new photos added" nudge messages sent
  to the group during the contribution window.
- Manual moderation queue: when `moderationMode = "manual"`, contributor photos
  land as `status: "pending"` and require owner approval before appearing in
  the public gallery.
- Analytics dashboard (Studio tier): contributor count, photos over time,
  peak upload periods.
- Contributor attribution: show "shot by [name]" on photos when
  `requireContributorName` is enabled.

---

## PHASE 4 — ADVANCED (post-launch, based on real usage data)

- AI highlight reel: score photos via a vision API (sharpness, face detection,
  composition) and auto-select a curated subset.
- Multi-user team accounts for Studio tier (multiple logins under one
  business account).
- White-labeled gallery subdomains.
- Print-on-demand photobook integration.
- Sponsor/branding slot for corporate events.

---

## NON-NEGOTIABLE CONSTRAINTS (apply across all phases)

1. Contributors must NEVER be required to create an account or log in — max
   2 taps from link/QR scan to camera opening.
2. Never sacrifice visible image quality for marginal file-size savings —
   stick to the 2048px / quality 0.85 baseline unless testing proves a better
   number for this specific use case.
3. Pro Shots and Contributor Pool must always be visually distinguishable in
   the UI, even while shown on the same gallery page.
4. All billing logic should be centralized on the backend, matching the
   existing SpaiHub pattern — never let a client directly control plan/
   entitlement state.
5. Compression must happen client-side, before upload, on both the
   contributor and owner upload paths — never rely on server-side
   post-processing as the only compression step, since it doesn't save
   contributor upload bandwidth/time on weak connections.

---

## BUILD ORDER SUMMARY (paste-and-go for Cursor)

1. Prisma schema + Postgres connection
2. Owner auth (register/login/JWT)
3. Event CRUD + slug/QR generation
4. Contributor session + public event view route
5. Client-side compression utility (shared between contributor and owner flows)
6. Contributor upload endpoint + R2 storage wiring
7. Owner Pro Shots upload endpoint
8. Gallery retrieval endpoint + polling frontend
9. Contributor-facing frontend page
10. Owner dashboard frontend
11. Rate limiting / basic abuse controls
12. --- STOP, TEST PHASE 1 THOROUGHLY BEFORE CONTINUING ---
13. Plan/entitlement model + Campay billing integration
14. Paywall trigger logic (soft/hard locks)
15. Branding + zip export paid features
16. --- STOP, TEST PHASE 2 BEFORE CONTINUING ---
17. OpenWA integration, moderation queue, analytics
18. Advanced features (Phase 4), only based on real usage feedback
