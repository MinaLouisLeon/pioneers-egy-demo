# Pioneers-EGY — Inspection Management Platform

Inspection job recording and certificate management for Pioneers-EGY, as a
responsive web app (installable as a PWA on Windows) and a native iOS/Android
app that works with no signal.

```
apps/
  web/        Next.js 16 · App Router · Tailwind v4 · shadcn/ui · PWA
  mobile/     Expo SDK 57 · Expo Router · offline-first (SQLite + outbox)
packages/
  core/       Zod schemas, TASK_FORM_SPECS, roles, formatting  ← shared logic
  supabase/   generated DB types + client factories
  api-client/ typed wrappers over the HTTP API
  ui/         shadcn/ui components (web only)
  config/     shared tsconfig / eslint bases
supabase/     migrations + seed
```

---

## The idea that shapes the codebase

React Native cannot use Tailwind, the DOM, or shadcn/ui, so trying to share
_components_ across web and native is the usual way these monorepos fail.
Everything except rendering therefore lives in `@pioneers/core`.

**`packages/core/src/forms/specs.ts`** declares every inspection form once, as
data:

```ts
export const TASK_FORM_SPECS = {
  lifting:  { label: "Lifting",  schema: liftingDataSchema,  fields: [...] },
  ndt:      { label: "NDT",      schema: ndtDataSchema,      fields: [...] },
  testing:  { label: "Testing",  schema: testingDataSchema,  fields: [...] },
  env_option_1: { ... }, env_option_2: { ... }, env_option_3: { ... },
}
```

Two renderers consume it — `apps/web/components/forms/dynamic-field.tsx` (shadcn)
and `apps/mobile/src/components/dynamic-field.tsx` (React Native). Both validate
with the _same_ Zod schema, so a rule is written once and enforced on both
platforms and again on the server.

**Adding the real environmental forms is a change to one file.** No UI code in
either app needs to move. `packages/core/src/__tests__/forms.test.ts` fails the
build if a spec and its schema ever drift apart.

---

## Prerequisites

| Tool                  | Notes                                                                       |
| --------------------- | --------------------------------------------------------------------------- |
| Node 20.19+           | `node --version`                                                            |
| pnpm                  | `corepack enable` (already pinned via `packageManager`)                     |
| Docker Desktop        | **Only** for the local Supabase stack. Skip it if you use a hosted project. |
| Cloudflare R2 bucket  | Private. One bucket is enough.                                              |
| Expo Go / a dev build | To run the mobile app on a device.                                          |

---

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env
```

### 1. Database

**Option A — local (needs Docker):**

```bash
pnpm db:start     # prints the API URL, anon key and service-role key
pnpm db:reset     # applies migrations + seed
pnpm db:types     # regenerate packages/supabase/src/database.types.ts
```

**Option B — hosted Supabase project:**

1. Create a project at supabase.com.
2. Run the three files in `supabase/migrations/` **in filename order** in the
   SQL editor.
3. Optionally run `supabase/seed.sql` for demo data (it writes known passwords —
   never do this on anything real).
4. In Authentication → Providers → Email, **turn off** "Enable sign ups"
   (accounts are invite-only) and add `<your-url>/auth/callback` to the redirect
   allow-list.

Fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` in `.env`.

### 2. Cloudflare R2

Create a private bucket, then an S3 API token (Cloudflare → R2 → Manage API
Tokens). Fill `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET`.

Add a CORS policy so the browser can PUT directly:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 3. Run

```bash
pnpm dev              # everything
pnpm dev:web          # http://localhost:3000
pnpm dev:mobile       # Expo — scan the QR code
```

For the mobile app on a **physical device**, `EXPO_PUBLIC_API_URL` must be your
machine's LAN address (`http://192.168.x.x:3000`) — `localhost` resolves to the
phone itself.

### Seeded accounts

Password for all four: `Pioneers@2026`

| Email                    | Role          |
| ------------------------ | ------------- |
| admin@pioneers-egy.com   | Administrator |
| manager@pioneers-egy.com | Manager       |
| ahmed@pioneers-egy.com   | Inspector     |
| sara@pioneers-egy.com    | Inspector     |

---

## How it fits together

### Roles

|                  | Admin | Manager       | Inspector     |
| ---------------- | ----- | ------------- | ------------- |
| Accounts section | ✅    | —             | —             |
| See all jobs     | ✅    | ✅            | own only      |
| Edit jobs        | all   | own           | own           |
| Certificates     | full  | read + upload | read + upload |

Enforced in three places, deliberately: RLS policies in
`supabase/migrations/*_rls.sql` (the real boundary), `requireRole()` on every
server page, and `can()` from `@pioneers/core/roles` for what the UI offers.

### Storage

The R2 bucket is private and has no public access. Clients never see
credentials — they request a short-lived presigned URL and talk to R2 directly,
which keeps multi-megabyte photos off the Next.js server.

`POST /api/storage/upload-url` will not sign a key just because the caller named
it: it verifies the caller can write the _parent row_ first, through their own
RLS-scoped connection. `POST /api/storage/download-url` only signs keys that
come back from a query the caller was allowed to make.

### Certificate QR sharing

A share link mints a 32-byte token pointing at `/verify/<token>` on this app —
not at storage. That keeps the link revocable, expirable and logged, and means
it does not rot when a signature expires.

`certificate_share_links` has **no anon RLS policy at all**. The public verify
route resolves tokens with the service role, so the table cannot be enumerated
and revocation is always honoured. See `apps/web/lib/verify.ts`.

### Offline (mobile)

The app is local-first. Every read and write hits SQLite; a sync engine
reconciles with Supabase in the background.

- `src/lib/db/schema.ts` — the local mirror and the outbox
- `src/lib/sync/outbox.ts` — queue, exponential backoff, update collapsing
- `src/lib/sync/engine.ts` — the drain loop and photo uploads
- `src/lib/sync/provider.tsx` — triggers: reconnect, foreground, manual

Every row carries a device-generated `client_id` with a UNIQUE constraint, so a
replayed insert after a crash collides instead of duplicating. Conflicts are
last-write-wins on `updated_at` — inspection jobs are single-owner and rarely
edited from two devices, so a CRDT is not warranted.

Photos are handled outside the outbox: they are large binary transfers with
different retry economics, and a failed 3 MB upload should not block a 200-byte
task update behind it in the queue.

---

## Commands

```bash
pnpm dev / dev:web / dev:mobile
pnpm build
pnpm typecheck        # all 7 workspace projects
pnpm test             # @pioneers/core — 53 tests
pnpm format
pnpm db:start / db:reset / db:types
```

---

## Verifying it works

**Web**

1. `/` redirects to `/login`; bad credentials give a generic error.
2. Sign in as `ahmed@` (inspector) → no Accounts nav **and** `/dashboard/accounts`
   redirects. That proves server-side gating, not a hidden link.
3. Create a job with three tasks — one Lifting, one Testing (Pass), one NDT (UT)
   — and upload photos to each. The detail page should show all three with the
   right fields.
4. Upload a certificate → Share → generate a QR → open `/verify/<token>` in a
   private window → download → Revoke → reload: the page now says "revoked".
5. Resize to 375 / 768 / 1440 px. The sidebar becomes a drawer, tables become
   cards, nothing scrolls horizontally.
6. Build and serve in production mode, then check Chrome offers "Install app".

**Mobile (the offline path is the interesting one)**

1. Sign in, then enable airplane mode.
2. Create a job, add a task with two photos. It appears immediately with a
   "Not synced" badge and an offline banner at the top.
3. Force-quit the app and reopen it — the job is still there.
4. Turn the network back on. The banner switches to "Syncing…", then clears.
5. Check Supabase and R2: the job, its task and both images are present, with no
   duplicates.

**Data checks (Supabase SQL editor, as an inspector)**

```sql
select count(*) from jobs;                     -- only their own
select * from certificate_share_links;         -- 0 rows via the anon key
```

---

## Known gaps

- **Not run end-to-end.** The machine this was built on had neither Docker nor a
  device available, so everything is verified by typecheck, build and unit tests
  only. The checklist above is the first thing to work through.
- **Environmental forms** are placeholders (a notes field plus photos) until the
  real field sets are specified. Add them to `TASK_FORM_SPECS`.
- **Certificate upload is web-only.** The mobile app lists, searches, downloads
  and scans certificates but does not upload PDFs yet.
- **Mobile tab icons** are letter glyphs; the template's icon set was removed
  with the rest of the scaffold. Swap in `@expo/vector-icons` or the brand set.
- **Job list on mobile** shows locally-known jobs. There is no pull-down of other
  people's jobs yet, since inspectors only see their own anyway.
- **No EAS build pipeline** configured for the App Store / Play Store.
- Seeded certificates point at placeholder R2 keys, so downloading one before
  you have uploaded a real PDF will 404.
