# SnapPool (working name) — Crowd-Sourced Event Photography Platform
## Full Product & Business Playbook

---

## 1. The Core Idea

A cloud/web platform that turns every phone at an event into a photographer, while
letting a professional photographer keep their own separate, "official" gallery for
the same event — all under one shareable link/QR code.

**The one-line pitch:** Everyone at the event scans a code or taps a link, hits
"Open Camera," and every photo they take lands instantly in one shared pool for
that event — sorted, organized, and viewable by everyone, with zero app install
and zero login for guests.

**Why it matters:** Traditional event photography captures one perspective (the
photographer's). This captures the whole room — every angle, every candid moment,
from everyone who was there — as a *free add-on* layer around the paid professional
work, not a replacement for it.

---

## 2. Problem It Solves

- Guests take great candid photos on their phones that never get shared beyond
  their own camera roll.
- Photographers only capture what they had a lens pointed at — they miss 90% of
  the room at any given moment.
- WhatsApp group photo-sharing is chaotic: duplicate uploads, no organization, no
  single place to see "everything from the event."
- Organizers want one artifact at the end: "here's everything, from everyone."

---

## 3. Who Uses It (Personas)

### A. The Photographer (primary business partner / growth engine)
- Freelance or small-studio photographer covering weddings, birthdays, corporate
  events, church events.
- Creates a **permanent account** they own across many events/clients.
- For each client event: creates an event, gets a unique QR/link, uploads their
  own professional shots as "Pro Shots," and shares the link for guests to
  contribute candid shots to the same event's gallery.
- Sells this to clients as an **added service**: "You get my professional shots
  AND everything your guests captured, all in one place."
- This is the wedge for turning photographers into paying, repeat business
  partners — not just a one-off organizer.

### B. The Individual Organizer
- Anyone hosting a birthday, graduation, reunion, church program, send-off, etc.
- No photographer involved (or a casual one). Just wants a shared pool of memories
  from everyone who attended.
- Creates an account, creates one event, shares the link/QR in a WhatsApp group or
  printed at the venue.
- Typically a single, one-off use — pays per event rather than subscribing.

### C. The Contributor (guest)
- Never creates an account. Scans/taps the link, sees the event name, taps
  "Open Camera," shoots, done.
- Zero friction is the entire point — any friction here kills the network effect.

---

## 4. Core User Flow

1. Owner (photographer or organizer) creates an account.
2. Owner creates an Event → gets a unique slug, public URL, and QR code.
3. Owner configures event parameters (see Section 6).
4. Owner shares the QR code (printed/displayed at venue) or link (WhatsApp group,
   SMS, etc.).
5. Guest taps/scans → lands on a no-login web page showing the event name and a
   big "Open Camera" button.
6. Guest taps → native camera opens → guest shoots → photo is compressed
   client-side and uploaded automatically to the shared pool.
7. Gallery view shows all contributor photos (and, separately, the owner's Pro
   Shots) organized by time, in one shared, live-updating gallery.
8. After the event: owner reviews, optionally moderates, and can export a full
   zip of the gallery for the client or for themselves.

---

## 5. Entity / Account Model

```
User (account)
 ├─ role: photographer | organizer | hybrid
 ├─ profile: business name, contact, portfolio link (photographers)
 ├─ subscription/plan state
 └─ Events[] (owned)
       ├─ event_id, slug, qr_code_url, public_url
       ├─ config (see Section 6)
       ├─ ProShots[]        ← uploaded only by the owner, tagged "official"
       ├─ ContributorPool[] ← uploaded by anyone with the link, no login required
       └─ Contributors[]    ← optional lightweight identity (name/phone), no account
```

Key design decision: **contributors never need an account.** Only event owners
(photographers, organizers) have persistent accounts. This keeps the guest-facing
side completely frictionless, which is the entire value proposition.

---

## 6. Event Configuration Parameters (Owner-Controlled)

### Visibility & Access
- Public / unlisted (link-only) / password-protected
- Contribution window: opens now, auto-closes at a set time
- Gallery visibility: live (contributors see the pool immediately) vs. hidden
  until the owner publishes it

### Contribution Rules
- Max photos per contributor (spam/storage control)
- Optional: require contributor name/phone before first upload (for attribution:
  "shot by Grace") — off by default for pure anonymous fun
- Photos only, or allow short video clips
- Moderation mode: auto-publish vs. owner-approves-before-public

### Organization
- Pro Shots tab (owner-only, tagged "official") kept visually separate from the
  Contributor Pool tab, but presented together as "the full story of the event"
- Default sort: upload-received time (not client EXIF, which is unreliable on
  poor connections)
- Optional sub-albums/tags within one event (ceremony / reception / photobooth)

### Branding (the sellable part for photographers)
- Custom event cover photo, event name, photographer's business name/logo
- Custom "thank you" screen after each contributor upload: "Photos by
  [Photographer] — book them at [link]" — turns free guest traffic into the
  photographer's own marketing funnel

### Post-Event
- Download-all as zip (paid feature)
- Retention/expiry window, auto-archive after N days unless extended
- Highlight reel: owner curates a "best of" subset for sharing

---

## 7. Technical Architecture

### Stack (aligned to Gerald's existing tooling)
- **Backend:** Node.js (Express or NestJS), hosted on Render
- **Database:** Neon Postgres, accessed through Prisma
- **Frontend:** React (contributor page is a lightweight PWA, no install required)
- **Object storage:** Cloudflare R2 (S3-compatible API — near-zero migration
  friction from existing DigitalOcean Spaces knowledge)
- **Auth:** JWT/session for owner accounts; short-lived anonymous tokens scoped
  to a single `event_id` for contributors
- **Payments:** Campay (Mobile Money / XAF), reusing patterns from SpaiHub billing
- **Notifications:** OpenWA gateway (already in progress across SpaiHub/ST-Erics/
  Katush) — auto-share event links into WhatsApp groups, optional "12 new photos
  added" nudges during live events

### Why R2 over Cloudinary
This app's traffic pattern is upload-once, view-many (contributors upload once,
then guests + owner + client repeatedly browse/download) — an egress-dominant
workload. R2 charges $0 for egress and ~$0.015/GB for storage, with no punitive
overage/suspension behavior. Cloudinary's credit system charges for bandwidth and
can suspend or block uploads on free/fixed tiers once credits run out — an
unacceptable failure mode for a live paid client event. Cloudinary's real strength
(on-the-fly AI transforms, moderation tagging) can be bolted on later as a small
add-on layer if needed; it shouldn't be the primary storage/serving backbone.

### Image Handling Pipeline (client-side, before upload)
Goal: maximum practical quality at minimum file size, without visible degradation.
This is NOT the pro photographer's tier — this is "as good as the phone can give,
as light as possible, without looking compressed."

1. Resize longest edge to **2048px** (never upscale smaller originals).
   This alone cuts file size ~70-80% with zero perceptible quality loss at any
   normal viewing size (screen or print).
2. Re-encode as JPEG at **quality 85** (or WebP equivalent if supported) — the
   sweet spot where further quality increases add file size fast for
   near-zero visible gain, and going below ~80 starts introducing visible
   blocking artifacts.
3. Strip EXIF metadata except orientation; bake orientation into the pixels
   directly to avoid sideways-photo bugs across viewers, and to protect
   contributor privacy (no leaked GPS/device data).
4. Generate two versions per photo:
   - **Thumbnail** (~400px wide, quality 70) — used in the gallery grid, since
     grid browsing is the majority of bandwidth cost
   - **Full view** (2048px, quality 85) — loaded only when a photo is tapped/
     opened full-screen
5. All compression happens in-browser via Canvas API before upload starts —
   critical for weak-connectivity venues, since it turns a ~5MB native photo
   into a ~300-800KB upload, directly reducing failed/abandoned uploads.

### Real-Time Gallery Updates
- Polling every 3-5 seconds is sufficient for v1 (weddings/halls) — avoids the
  complexity of WebSockets for a marginal UX gain at launch.
- Sort by server-received upload timestamp by default.

### Moderation & Abuse Controls
- Rate limiting per contributor session (max photos/time window)
- Optional pre-publish moderation queue (owner approves before public)
- Owner can delete/report any contributor photo at any time

---

## 8. Monetization Model

### A. Photographer / Business Accounts — Subscription (primary revenue engine)

| Tier | Price (suggested) | Includes |
|---|---|---|
| Starter (Free) | 0 | 1 active event, 100 contributor photos/event, 7-day retention, platform branding on gallery |
| Pro | ~5,000–10,000 XAF/month | Unlimited events & contributor photos, 90-day retention, custom branding, client zip download |
| Studio | ~20,000–30,000 XAF/month | Everything in Pro + multi-user team logins, analytics dashboard, priority support, white-labeled gallery subdomain |

Billed via Campay, monthly or annual (annual discount improves cash flow and
suits Mobile Money habits better than recurring auto-debit).

### B. Individual Organizer Accounts — Pay-Per-Event (transactional)

| Tier | Price | Includes |
|---|---|---|
| Free | 0 | Basic gallery, 50 contributor photos, 3-day retention, then locked/archived |
| Event Pass | ~1,000–3,000 XAF one-time | Full contributor limit, 30-day retention, zip download, no platform branding |

Free-but-limited, unlock-with-one-payment pattern: organizers see their gallery
fill with photos in real time (the emotional hook) before being asked to pay —
the ask lands after value is already felt.

### C. Contributor-Side Monetization (minimal, careful)
Contributors should almost never pay — that breaks the frictionless magic that
drives the network effect. Acceptable exception: optional "download my own
photos in original quality" or "download full event zip," priced very low
(200–500 XAF), as pure upside rather than a gate on the core experience.

### D. Add-On / Upsell Revenue (post-v1)
- Extended retention beyond the default window
- AI-curated "highlight reel" (auto-select best shots via a vision-scoring API)
- Print-on-demand photobook integration (larger lift, not v1)
- Sponsor/branding slot on gallery page for corporate events (B2B, orthogonal
  to the organizer/photographer payment)

### Suggested Rollout Order
1. Free tier for both photographer and organizer paths — prioritize usage and
   word-of-mouth first; this product lives on network effects (more
   contributors per event → more people who later create their own event).
2. Photographer Pro subscription — build the upgrade nudge around the 2nd/3rd
   event a photographer creates (proof of repeat use, not just testing).
3. Organizer one-time Event Pass — simpler to ship (no recurring billing state
   machine), good early cash flow while subscriptions ramp.
4. Add-ons — only once real usage data shows which one people actually want.

---

## 9. Go-To-Market: The Photographer Wedge

Photographers are the highest-leverage acquisition channel:
- One photographer running 20 events/year brings 20 client galleries and
  20 × ~100-200 contributors who see your branding and the photographer's
  branding — far cheaper customer acquisition than reaching organizers one by one.
- Pitch to photographers: "Offer your clients the professional shots you took
  PLUS everything their guests captured — as a value-added service you can
  charge for, at no extra work for you."
- The "thank you" screen after every contributor upload doubles as free
  marketing for the photographer's own business, creating a strong incentive
  for them to promote the tool actively at every event they shoot.

---

## 10. Build Roadmap (Phased)

### Phase 1 — MVP
- Owner account creation + login
- Create event → auto-generate slug, QR code, public link
- Contributor flow: open link → see event name → open camera → upload
- Client-side compression (2048px / quality 85, thumbnail + full)
- Shared gallery view, sorted by upload time, polling-based refresh
- Pro Shots vs. Contributor Pool separation
- Basic free-tier limits (photo count, retention window)

### Phase 2 — Monetization
- Campay integration: photographer subscription (Pro tier) + organizer Event Pass
- Paywall triggers: soft lock (banner/nudge) vs hard lock (blocked upload) at
  free-tier limits
- Zip download (paid feature)
- Custom branding fields (logo, business name, thank-you message)

### Phase 3 — Retention & Growth
- OpenWA integration: auto-share links to WhatsApp groups, live nudges during
  events ("12 new photos added")
- Moderation queue (pre-publish approval mode)
- Analytics dashboard for Studio-tier photographers
- Contributor attribution (optional name/phone before upload)

### Phase 4 — Advanced
- AI highlight reel curation
- Multi-user team accounts (Studio tier)
- White-labeled gallery subdomains
- Print-on-demand integration
- Sponsor/branding slots for corporate events

---

## 11. Key Product Principles (do not compromise on these)

1. **Zero friction for contributors.** No login, no install, no more than 2 taps
   from link to camera. This is the entire product.
2. **Pro Shots and Contributor Pool stay visually distinct but presented as one
   story.** Photographers must never feel their professional work is diluted by
   the crowd pool — it's an added layer, not a replacement.
3. **Compress aggressively but invisibly.** The goal is "as good as the phone
   can give, as light as possible" — never sacrifice visible quality for
   marginal file-size gains.
4. **Photographers are business partners, not just users.** Every feature
   decision should ask: does this make it easier for a photographer to sell
   this as an add-on service to their clients?
5. **Free tier must feel genuinely good before any paywall hits.** The upgrade
   ask should land after the value (a filling, live gallery) is already felt.
