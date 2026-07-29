# PixDump — Production UX/UI Redesign Spec
**Status:** Engineering build reference  
**Product:** PixDump (web, [pixdump.net](https://pixdump.net)) — live event crowd photography  
**Visual direction:** Bold, energetic, event-brand activation (camera-first social energy × venue night)  
**Platform constraint:** Mobile web / PWA — browser camera APIs only (no native deep-link into Snapchat)  
**Assumption:** Dark-mode-first for low-light venues  

---

## 0. Reality check (web camera limits)

| Desired behavior | Web reality | Spec response |
|---|---|---|
| “Open Snapchat and shoot” | No reliable deep-link return of media to a web page | **Upload** = pick from camera roll (where Snapchat/IG saves land) |
| In-app filtered camera | `getUserMedia` + Canvas filters | **Snap** = PixDump lens (permission-gated) |
| Native system camera | `<input capture>` | Optional tertiary; current product = Snap + Upload only |
| Keep shooting offline | Browser may kill stream; uploads need network | Queue uploads when online; never fake Snapchat handoff |
| iOS Safari | Permission prompts, orientation, `playsInline`, PWA quirks | Explicit permission copy + orientation bake-in + portal overlays |

**Principle:** Never promise app-switching the browser cannot deliver. Frame Upload as “shot elsewhere? drop it in.”

---

## 1. Information architecture

### 1.1 Personas & surfaces

| Persona | Auth | Primary surface | Goal |
|---|---|---|---|
| Guest (contributor) | None | `/e/:slug` | 1–2 taps → Snap or Upload → see self in live pool |
| Event convenor (owner) | Account | `/dashboard`, `/events/:id` | Create event, share QR/link, Pro Shots, moderate |
| Scout / marketer | None | `/` | Understand product; convert to owner |

### 1.2 Screen inventory

**Guest (camera-first)**  
1. **Event Arena** `/e/:slug` — brand hero, live masonry, capture dock  
2. **Snap Lens** (portal overlay) — full-bleed filtered camera  
3. **Review flash** (optional, 800–1200ms) — last capture before thank-you  
4. **Lightbox** (portal) — full-res browse, swipe  
5. **Name gate** (inline sheet) — only if `requireContributorName`  

**Owner**  
6. **Marketing Home** `/`  
7. **Auth** `/login`, `/register`  
8. **Events Hub** `/dashboard`  
9. **Event Console** `/events/:id` — share/QR, settings, Pro upload, gallery tabs  

### 1.3 Navigation model

```
Guest:   QR/link → Event Arena (sticky dock always available)
         Dock → Snap Lens | Upload picker
         Grid tap → Lightbox
         Tabs (Photos | Pro | Guests) = filter only, never leave Arena

Owner:   Home → Register/Login → Hub → Console
         Console = settings + Pro + admin grid (tiles variant)
```

- **No bottom tab bar for guests** — dock *is* navigation.  
- **Event identity always on-screen** — name + logo in Arena header; never rely on browser chrome.  
- **“Who else is capturing”** = live shot count + pulsing live dot + masonry filling (social proof without avatars). Skip online-user lists in v1 (noise + privacy).

### 1.4 Hierarchy (Event Arena)

1. Event brand (name / logo)  
2. Capture dock (Snap | Upload)  
3. Live feed (masonry)  
4. Feed filters (Photos / Pro / Guests)  
5. Meta (count, closed state)

---

## 2. Core capture flow UX

### 2.1 Primary CTAs (locked product choice)

| Control | Label | Action |
|---|---|---|
| Primary | **Snap** | Open Snap Lens (`getUserMedia` + filters) |
| Secondary | **Upload** | `<input type="file" accept="image/*">` **without** `capture` |

Equal visual weight in a 2-up dock; Snap uses brand fill, Upload uses ghost/outline.

### 2.2 App / source picker — web-honest pattern

**Do not** show a fake list of “Snapchat / Instagram / Camera.”  
**Do** use a **bottom sheet** only when we need to explain Upload:

**Upload explainer sheet** (first time per device, dismissible)

- Title: `Add a photo you already took`  
- Body: `Shot in Snapchat or another app? Save it to your camera roll, then choose it here.`  
- CTA: `Choose photo` → native file picker  
- Link: `Use PixDump camera instead` → closes sheet, opens Snap Lens  

Persistent path after first visit: Upload goes straight to file picker.

### 2.3 Snap Lens flow

```
Tap Snap
  → if no getUserMedia support → toast + focus Upload
  → request permission
  → denied → Permission sheet (see §6)
  → granted → full-screen portal lens
       filter chips → shutter → flash → compress → upload
       on success → close lens → Arena thank-you pulse → grid inserts
```

**Fallback order:** Snap Lens → (permission fail) Upload → (picker cancel) stay on Arena.

### 2.4 Review → share (guest)

Guests don’t leave Arena. Post-capture:

1. **Shutter flash** (90–120ms white)  
2. **Thank chip** on Arena (`thankYouMessage` or “You’re in the pool.”) — 3–4s  
3. New thumb **rises into masonry** (see §4)  

Optional v1.1: 1s hold of last frame with `Add another` / `Done` — skip if it adds friction past 2 taps.

### 2.5 Owner Pro capture

- Pro Shots **only** on Event Console (owner JWT).  
- Label: `Pro Shot · Owner only`.  
- Separate amber/gold treatment in feed.

---

## 3. Visual design system

### 3.1 Brand personality

**Flash Night** — venue blackout + stage light. Acid lime = flash pop. Gold = official Pro. Energetic type (Syne), readable UI (Manrope).

### 3.2 Color roles (dark-first)

| Token | Hex | Role |
|---|---|---|
| `color.ink` | `#070708` | Page void |
| `color.ink-elevated` | `#121217` | Sheets / dock |
| `color.surface` | `#1A1A22` | Cards / inputs |
| `color.line` | `#2E2E38` | Dividers |
| `color.text` | `#F4F4F5` | Primary text |
| `color.text-muted` | `#9B9BA8` | Secondary |
| `color.accent` | `#D6FF3C` | Snap CTA, live, focus |
| `color.accent-ink` | `#0A0A0A` | Text on accent |
| `color.pro` | `#F0C43A` | Pro badge / Pro CTA |
| `color.danger` | `#FF5C6C` | Errors |
| `color.overlay` | `#000000E8` | Lens / lightbox scrim |

**Rationale:** Lime reads as “flash / go” under venue light; high chroma on dark passes WCAG for large CTAs; avoid purple/glow-slop.

**Light mode:** defer. If needed later: invert ink/text; keep accent.

### 3.3 Typography

| Token | Font | Size / line / weight | Use |
|---|---|---|---|
| `type.display-xl` | Syne | 40–56 / 0.92 / 800 | Event name, Home hero |
| `type.display-md` | Syne | 28–32 / 1.0 / 700 | Screen titles |
| `type.title` | Manrope | 18 / 1.25 / 700 | Section titles |
| `type.body` | Manrope | 15–16 / 1.45 / 500 | Body |
| `type.caption` | Manrope | 12–13 / 1.35 / 600 | Meta, tabs |
| `type.micro` | Manrope | 10–11 / 1.3 / 700 | Badges, LENS label |
| `type.label` | Manrope | 11 / 1.2 / 700 / +0.14em | Section labels (uppercase sparingly) |

### 3.4 Spacing & radius

| Token | Value |
|---|---|
| `space.1` … `space.8` | 4, 8, 12, 16, 20, 24, 32, 40 |
| `space.dock` | 12 + safe-area |
| `radius.sm` | 8 |
| `radius.md` | 12 |
| `radius.lg` | 16 |
| `radius.xl` | 20–28 (masonry tiles, dock sheet) |
| `radius.pill` | 999 (live dot, shutter ring only) |

**Grid gutters:** masonry `6–8px`; owner tiles `6px`.

### 3.5 Elevation

| Level | Treatment |
|---|---|
| 0 | Flat ink |
| 1 | `surface` + 1px `line` |
| 2 | Dock sheet: blur + soft top shadow (no multi-layer neon glow) |
| 3 | Portal overlays (lens, lightbox) full scrim |

### 3.6 Iconography

- Stroke 1.75–2px, rounded caps, 24px touch icons in 44px hit areas.  
- Set: close, shutter, flip, grid, bolt (torch), upload, share/copy.  
- No emoji as UI.

### 3.7 Motion language

- Ease: `cubic-bezier(0.22, 1, 0.36, 1)` for entrances.  
- Snap: hard flash + soft settle.  
- Prefer transform/opacity only.

---

## 4. Micro-interactions & motion

| Moment | Spec |
|---|---|
| Arena enter | Header `rise` 400–550ms staggered |
| Tab change | Underline slide 200ms; grid crossfade 150ms |
| Snap open | Lens portal fade 180ms; stream starts on mount |
| Filter change | CSS filter 280ms; name toast 900ms |
| Shutter | White flash 90–120ms; shutter scale 0.9 |
| Upload progress | Determinate bar under dock; labels Compressing → Uploading |
| **Signature delight** | New photo **pops into masonry** — scale 0.84→1 + lime rim flash 400ms (“flash joined the pool”) |
| Thank chip | Accent border pulse once, auto-dismiss 3.5s |
| Lightbox | Portal; swipe with rubber-band at ends |

Respect `prefers-reduced-motion`: cut flash intensity; keep opacity fades only.

---

## 5. Accessibility & performance

### 5.1 A11y

- Text/accent contrast: body text ≥ 4.5:1 on ink; accent buttons ≥ 3:1 as large text/UI.  
- Tap targets ≥ **44×44px** (Snap/Upload ≥ 48px height).  
- Focus visible: 2px accent ring.  
- Lens & lightbox: `role="dialog"`, `aria-modal`, Escape closes, body scroll lock.  
- Shutter: `aria-label="Take photo"`.  
- Don’t rely on color alone for Pro vs Guest (badge text).  
- One-handed: dock within thumb zone; primary actions bottom-weighted.

### 5.2 Performance (event Wi‑Fi)

- Compress client-side before upload (already: 2048/0.85 + 400/0.7).  
- Launch lens only on Snap tap (no early `getUserMedia`).  
- Portal overlays — never nest under `backdrop-filter` parents.  
- Gallery: thumb URLs only; full only in lightbox.  
- Poll 4s; backoff if tab hidden (`document.visibilityState`).  
- Downscale before heavy pixel filters on low-end devices if capture janks.  
- Perceived speed: optimistic thank chip after request starts; reconcile on error.

### 5.3 PWA (optional phase)

- Manifest + theme-color `#070708`.  
- Soft install banner after first successful upload (not on first paint).

---

## 6. Empty / error / edge states

| State | UI |
|---|---|
| Empty gallery | Dashed rounded panel: “No shots yet / Be first” |
| Gallery not live | Soft panel: host hasn’t published; capture still allowed if open |
| Contributions closed | Dock replaced by muted “Contributions closed” |
| Camera unsupported | Toast → emphasize Upload |
| Permission denied | Sheet: “Camera blocked” + steps (Site settings) + **Upload instead** |
| Upload fail / offline | Error under dock; retry; optional queue badge “1 waiting” |
| Expired guest session | Silent re-session; re-prompt name if required |
| Slow network | Indeterminate → determinate; never block browsing grid |
| No event / 404 | Centered error, no fake gallery |
| Pro upload non-owner | API 403; UI never exposes Pro on guest Arena |

**Offline queue (v1.1):** IndexedDB blob + metadata; flush on `online`; show count on dock.

---

## 7. Design tokens & handoff checklist

### 7.1 CSS variables (implement / extend)

```css
:root {
  --ink: #070708;
  --ink-elevated: #121217;
  --surface: #1a1a22;
  --line: #2e2e38;
  --text: #f4f4f5;
  --muted: #9b9ba8;
  --accent: #d6ff3c;
  --accent-ink: #0a0a0a;
  --pro: #f0c43a;
  --danger: #ff5c6c;
  --font-display: "Syne", sans-serif;
  --font-body: "Manrope", sans-serif;
  --radius-lg: 1rem;
  --radius-xl: 1.75rem;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
}
```

### 7.2 Component checklist (React / Tailwind)

| Component | Must have | Notes |
|---|---|---|
| `CaptureDock` | Snap + Upload; closed state; progress; error | Fixed bottom sheet; safe-area |
| `UploadExplainerSheet` | First-run only; Choose photo CTA | Honest Snapchat copy |
| `FilteredCamera` / Snap Lens | Portal to `body`; filters; shutter; flip; torch; grid; permission fail | z-index ≥ 110 |
| `GalleryGrid` | `masonry` (guest) / `tiles` (owner) | Pro badge gold |
| `FeedTabs` | Photos / Pro / Guests underline | Sticky under header |
| `EventHero` | Name, logo, optional cover, tagline | Brand-first |
| `Lightbox` | Portal; swipe; prev/next; counter | z-index ≥ 100 |
| `ThankChip` | Event thank-you or default | Auto-dismiss |
| `LiveCount` | Dot + number | Social proof |
| `ProShotUpload` | Owner console only | Amber CTA |
| `SharePanel` | Link + QR + copy | Owner console |
| `PermissionSheet` | Deny recovery | Upload fallback |
| `EmptyGallery` | Dashed empty | — |
| `AuthScreens` | Login / Register | Same tokens |
| `HomeHero` | Brand display + CTA | Marketing |

### 7.3 Build sequence for eng

1. Tokens + type already partially live — align names to this spec.  
2. CaptureDock = Snap + Upload only (done directionally).  
3. UploadExplainerSheet first-run.  
4. Snap Lens portal + permission sheet (portal done; harden copy).  
5. Masonry insert animation (signature delight).  
6. Session 401 refresh + offline queue.  
7. Owner console polish (tiles, Pro labeling).  
8. A11y pass + reduced-motion.

### 7.4 Explicit non-goals (this release)

- Deep-link into Snapchat / IG camera  
- Guest accounts  
- Video (separate phase)  
- Light mode  
- Fake “online guests” avatars  

---

## 8. Mapping to current codebase

| Spec piece | Current home |
|---|---|
| Event Arena | `frontend/src/pages/ContributorPage.tsx` |
| CaptureDock | `frontend/src/components/CaptureActions.tsx` |
| Snap Lens | `frontend/src/components/FilteredCamera.tsx` + `lib/filters.ts` |
| Gallery | `frontend/src/components/GalleryGrid.tsx` |
| Lightbox | `frontend/src/components/Lightbox.tsx` |
| Tokens | `frontend/src/index.css` |
| Owner Pro | `ProShotUpload.tsx` + `POST /api/events/:id/pro-upload` (owner-only) |

---

## 9. Success criteria

- Guest understands event in <2s (brand + live count).  
- Snap or Upload reachable in ≤2 taps from Arena.  
- No dead-end when camera denied (Upload always offered).  
- New photo visibly joins pool (delight) within seconds on good Wi‑Fi.  
- Pro vs Guest always distinguishable.  
- Works one-handed on mobile Safari/Chrome at venue lighting.
