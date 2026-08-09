# Pioneers-EGY — Setup & Deployment Guide

Everything needed to take this repository from a fresh clone to a live web app
and a mobile app on real phones.

Work through it in order — later steps depend on values produced by earlier
ones. Roughly 2–3 hours end to end, most of which is waiting for builds.

| Part                                                             | What you get                        | Time    |
| ---------------------------------------------------------------- | ----------------------------------- | ------- |
| [1. Supabase](#part-1--supabase)                                 | Database, auth, and your API keys   | ~20 min |
| [2. Cloudflare R2](#part-2--cloudflare-r2)                       | Private storage for photos and PDFs | ~15 min |
| [3. Run it locally](#part-3--run-it-locally)                     | Working app on your machine         | ~10 min |
| [4. Deploy to Vercel](#part-4--deploy-the-web-app-to-vercel)     | Live web app + PWA                  | ~20 min |
| [5. Wire production together](#part-5--wire-production-together) | Auth redirects, CORS                | ~10 min |
| [6. Expo & EAS](#part-6--expo-account--eas-setup)                | Expo account, project linked        | ~15 min |
| [7. Build & test mobile](#part-7--build-and-test-the-mobile-app) | App on a real device                | ~45 min |
| [8. Ship to the stores](#part-8--ship-to-the-app-stores)         | TestFlight / Play Console           | varies  |

**Accounts you will need:** GitHub, Supabase, Cloudflare, Vercel, Expo. All have
free tiers sufficient for this project. Apple Developer ($99/yr) and Google Play
($25 one-off) are only needed for Part 8.

---

## Part 0 — Before you start

```bash
node --version     # need 20.19 or newer
corepack enable    # enables pnpm
pnpm install
```

Push the repository to GitHub — Vercel and EAS both deploy from a Git remote.

```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<you>/pioneers-egy.git
git push -u origin main
```

> **Never commit `.env`.** It is already in `.gitignore`. Confirm with
> `git status` that it is not listed before your first push.

---

## Part 1 — Supabase

Supabase gives you Postgres, authentication, and row-level security.

### 1.1 Create the project

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub.
2. **New project**:
   - **Name:** `pioneers-egy`
   - **Database password:** generate a strong one and save it in a password
     manager — you cannot see it again, and you need it for direct DB access.
   - **Region:** pick the one closest to Egypt. `eu-central-1` (Frankfurt) or
     `eu-west-2` (London) both give good latency; avoid US regions.
   - **Plan:** Free is fine to start. Note the free tier pauses a project after
     7 days of inactivity — upgrade to Pro before real use.
3. Wait ~2 minutes for provisioning.

### 1.2 Run the migrations

Left sidebar → **SQL Editor** → **New query**.

Run these **one at a time, in this order**, pasting the whole contents of each
file and pressing **Run**:

1. `supabase/migrations/20250101000000_init.sql` — tables, enums, indexes
2. `supabase/migrations/20250101000100_rls.sql` — row-level security policies
3. `supabase/migrations/20250101000200_auth_triggers.sql` — profile creation

Each should report **Success. No rows returned.**

> Order matters — file 2 references tables created by file 1, and file 3
> references the enum from file 1.

**Verify:** go to **Table Editor**. You should see `profiles`, `jobs`,
`job_tasks`, `task_photos`, `certificates`, `certificate_share_links`,
`certificate_access_log`. Each should show a green **RLS enabled** badge. If any
shows "RLS disabled", re-run file 2.

### 1.3 Lock down sign-ups

Accounts in this system are created by an administrator only. Public sign-up
must be off, or anyone could register themselves.

**Authentication → Sign In / Providers → Email:**

- **Allow new users to sign up** → **OFF**
- **Confirm email** → OFF (invited users arrive via a link that already proves
  they control the address)

Click **Save**.

### 1.4 Create your first administrator

Public sign-up is now off, so create the first admin by hand. Everyone else can
then be invited from inside the app.

**Authentication → Users → Add user → Create new user:**

- Email: your real work address
- Password: something strong
- **Auto Confirm User:** ✅ ON

Then promote them. **SQL Editor → New query:**

```sql
update public.profiles
set role = 'admin', full_name = 'Your Name'
where email = 'you@yourcompany.com';

-- confirm it worked
select id, email, full_name, role, is_active from public.profiles;
```

You should get one row with `role = admin`.

> **Optional demo data.** `supabase/seed.sql` creates four test accounts and
> some sample jobs and certificates. It writes a known password
> (`Pioneers@2026`), so use it only on a throwaway project — never on the one
> you will put real inspections into.

### 1.5 Collect your keys

**Project Settings → API Keys** (and **Data API** for the URL):

| Copy this                   | Into this variable              | Notes                                 |
| --------------------------- | ------------------------------- | ------------------------------------- |
| Project URL                 | `NEXT_PUBLIC_SUPABASE_URL`      | e.g. `https://abcdefgh.supabase.co`   |
| `anon` / publishable key    | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Safe in a browser — RLS constrains it |
| `service_role` / secret key | `SUPABASE_SERVICE_ROLE_KEY`     | ⚠️ **Bypasses all RLS**               |

> The service-role key must never reach a browser or a phone. In this codebase
> it is used only inside `/api/admin/*` and the public certificate-verify route,
> and it has no `NEXT_PUBLIC_` prefix — so a mistaken import into client code
> fails the build rather than leaking.

Paste all three into your local `.env` now.

---

## Part 2 — Cloudflare R2

R2 stores inspection photos and certificate PDFs. It is S3-compatible with no
egress fees, which matters when clients download certificates.

### 2.1 Create the bucket

1. <https://dash.cloudflare.com> → sign up / sign in.
2. Left sidebar → **R2 Object Storage**. First use asks you to add a payment
   method even for the free tier (10 GB storage, 1M writes/month free).
3. **Create bucket**:
   - **Name:** `pioneers-egy`
   - **Location:** Automatic, or hint to Europe.
   - **Do not** enable public access. Every file in this app is served through a
     short-lived signed URL; a public bucket would make every inspection photo
     and certificate readable by anyone who guessed a filename.

### 2.2 Get your Account ID

On the R2 overview page, copy **Account ID** from the right-hand panel.
→ `R2_ACCOUNT_ID`

### 2.3 Create an API token

**R2 → API → Manage API Tokens → Create API Token** (make sure you are on the
**R2 token** screen, not the general Cloudflare API tokens page):

- **Token name:** `pioneers-egy-app`
- **Permissions:** **Object Read & Write**
- **Specify bucket:** `pioneers-egy` — scope it to this bucket only
- **TTL:** Forever (or set a rotation reminder)

Click **Create**. The next screen shows the credentials **once**:

| Shown as          | Variable               |
| ----------------- | ---------------------- |
| Access Key ID     | `R2_ACCESS_KEY_ID`     |
| Secret Access Key | `R2_SECRET_ACCESS_KEY` |

Copy both now. Ignore the "endpoint" line — the code builds it from your
account ID.

Set `R2_BUCKET=pioneers-egy`.

### 2.4 Add the CORS policy

Browsers upload straight to R2, so the bucket must allow it. Without this,
photo and PDF uploads fail with an opaque CORS error.

**Your bucket → Settings → CORS Policy → Edit → Add:**

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://YOUR-APP.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

Leave the Vercel line as a placeholder for now — you will come back and correct
it in [Part 5](#part-5--wire-production-together).

---

## Part 3 — Run it locally

Your `.env` in the repository root should now look like this:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Cloudflare R2
R2_ACCOUNT_ID=1a2b3c4d5e6f...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=pioneers-egy

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Expo (mirrors of the public values above)
EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
EXPO_PUBLIC_API_URL=http://localhost:3000
```

Then:

```bash
pnpm dev:web
```

Open <http://localhost:3000>.

### Smoke test

1. You land on `/login`. ✅
2. Sign in as the admin you created. You reach `/dashboard`. ✅
3. **Accounts** appears in the sidebar (admins only). ✅
4. **Inspection Jobs → New job.** Fill in the details, then add a task:
   pick **Inspection → Lifting**, fill it in, save, and upload a photo.
   The photo reaching 100% confirms R2 and CORS are working. ✅
5. **Certification → Upload certificate.** Upload any PDF, then **Share** and
   generate a QR code. Open the link in a private window — you should get the
   public verify page with a working **Download**. ✅

If step 4 or 5 fails, see [Troubleshooting](#troubleshooting).

---

## Part 4 — Deploy the web app to Vercel

### 4.1 Import the repository

1. <https://vercel.com> → sign in with GitHub.
2. **Add New… → Project** → import your `pioneers-egy` repository.

### 4.2 Configure the build

This is a monorepo, so one setting matters more than the rest:

- **Root Directory:** click **Edit** and select **`apps/web`**.

Vercel detects Turborepo and fills in the rest. Leave Framework Preset as
**Next.js** and the build/install commands on their defaults.

> Vercel needs files from outside `apps/web` (the `packages/*` workspaces).
> **Settings → General → "Include source files outside of the Root Directory"**
> is enabled by default on modern projects — confirm it is on if the build
> cannot resolve `@pioneers/core`.

### 4.3 Add environment variables

Before the first deploy, expand **Environment Variables** and add all eight.
Tick **Production**, **Preview** and **Development** for each.

| Name                            | Value                            |
| ------------------------------- | -------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | from 1.5                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from 1.5                         |
| `SUPABASE_SERVICE_ROLE_KEY`     | from 1.5                         |
| `R2_ACCOUNT_ID`                 | from 2.2                         |
| `R2_ACCESS_KEY_ID`              | from 2.3                         |
| `R2_SECRET_ACCESS_KEY`          | from 2.3                         |
| `R2_BUCKET`                     | `pioneers-egy`                   |
| `NEXT_PUBLIC_APP_URL`           | leave blank for now — set in 5.1 |

Click **Deploy** and wait ~2 minutes.

### 4.4 Note your URL

You get something like `https://pioneers-egy.vercel.app`. Everything in Part 5
depends on it.

**Custom domain (optional):** Vercel → **Settings → Domains → Add**, then create
the CNAME your registrar is told to add. Use the custom domain everywhere below
if you set one up — certificate QR codes will embed it, and they are handed to
clients, so it is worth doing before you issue any.

---

## Part 5 — Wire production together

Three places still point at `localhost`.

### 5.1 Tell the app its own address

Certificate QR codes are built from this. Get it wrong and every QR code points
somewhere useless.

**Vercel → Settings → Environment Variables →** set:

```
NEXT_PUBLIC_APP_URL = https://your-app.vercel.app
```

Then **Deployments → ⋯ → Redeploy** — environment variables are baked in at
build time, so a redeploy is required.

### 5.2 Allow the auth redirects

Invitation and password-reset emails link back to your app, and Supabase only
follows URLs on its allow-list.

**Supabase → Authentication → URL Configuration:**

- **Site URL:** `https://your-app.vercel.app`
- **Redirect URLs** — add each on its own line:
  ```
  https://your-app.vercel.app/auth/callback
  https://your-app.vercel.app/set-password
  http://localhost:3000/auth/callback
  http://localhost:3000/set-password
  pioneersegy://auth/callback
  ```

Keep the localhost entries so local development keeps working.

### 5.3 Update the R2 CORS policy

Replace the placeholder from 2.4 with your real domain:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-app.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 5.4 Verify production

On the live URL: sign in, upload a photo to a task, upload a certificate,
generate a QR, and scan it with your phone. The verify page should load and the
PDF should download.

**Check the PWA install:** open the site in Chrome or Edge on Windows. An
install icon appears in the address bar. Install it, and it should launch in its
own window with no browser chrome.

---

## Part 6 — Expo account & EAS setup

EAS (Expo Application Services) compiles the native iOS and Android binaries in
the cloud, so you do not need a Mac to build for iOS.

### 6.1 Create the account

1. <https://expo.dev> → **Sign Up**.
2. Verify your email.
3. Free tier includes builds on a shared queue — fine for getting started, but
   expect 10–30 minute waits at busy times.

### 6.2 Sign in and link the project

```bash
npm install -g eas-cli
eas login          # your expo.dev credentials
eas whoami         # confirms who you are

cd apps/mobile
eas init
```

`eas init` creates the project on expo.dev and writes its ID into `app.json`
under `extra.eas.projectId`. **Commit that change** — builds fail without it.

`eas.json` (the build profiles) is already in the repository, so you do not need
`eas build:configure`.

### 6.3 Install the dev-client package

The `development` profile builds a custom dev client, which needs this package:

```bash
cd apps/mobile
pnpm exec expo install expo-dev-client
```

Commit the result.

### 6.4 Set the mobile environment variables

`EXPO_PUBLIC_*` values are compiled into the app binary, so EAS needs its own
copy — your local `.env` is not uploaded.

Run from `apps/mobile`, substituting your real values:

```bash
eas env:set --name EXPO_PUBLIC_SUPABASE_URL \
  --value "https://abcdefgh.supabase.co" \
  --environment development --environment preview --environment production \
  --visibility plaintext --scope project

eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value "eyJhbGciOi..." \
  --environment development --environment preview --environment production \
  --visibility plaintext --scope project

eas env:set --name EXPO_PUBLIC_API_URL \
  --value "https://your-app.vercel.app" \
  --environment development --environment preview --environment production \
  --visibility plaintext --scope project
```

Check them:

```bash
eas env:list production
```

> `plaintext` visibility is correct here. Anything prefixed `EXPO_PUBLIC_` ends
> up inside the app bundle and can be extracted from it, so only genuinely
> public values belong there. The anon key is designed for this — RLS is what
> protects the data. **Never** put `SUPABASE_SERVICE_ROLE_KEY` or any R2
> credential in an `EXPO_PUBLIC_` variable; the mobile app reaches those
> capabilities through your Vercel API routes instead.

---

## Part 7 — Build and test the mobile app

Three ways to run it, in increasing order of realism.

### Option A — Expo Go (fastest, but limited)

Good for checking screens and layout in a few seconds.

```bash
pnpm dev:mobile
```

Install **Expo Go** from the App Store / Play Store and scan the QR code.

⚠️ **The camera, QR scanner and offline SQLite will not work in Expo Go** —
they need native modules that are not in the Expo Go binary. Use Option B for
anything real.

**On a physical device, `localhost` means the phone itself.** Point the app at
your computer instead:

```bash
# find your machine's LAN address
ipconfig | findstr IPv4        # Windows
ifconfig | grep "inet "        # macOS/Linux
```

Set `EXPO_PUBLIC_API_URL=http://192.168.1.42:3000` in `.env` (your address) and
restart. Simplest alternative: point it at your Vercel URL and skip the LAN
entirely.

### Option B — Development build (recommended)

A real app binary with all native modules, that still hot-reloads your code.
Build once, then develop against it for weeks.

```bash
cd apps/mobile

eas build --profile development --platform android
# and/or
eas build --profile development --platform ios
```

**What EAS asks you:**

- **Android** — offers to generate a keystore. Say **yes**; EAS stores it. Back
  it up later via `eas credentials`, because losing it means you can never
  update an app already published to Play.
- **iOS** — needs an Apple Developer account ($99/yr) even for device testing,
  and asks for your Apple ID. Let EAS manage the certificates and provisioning
  profile. For the iOS Simulator instead, add `"simulator": true` under
  `build.development.ios` in `eas.json` — no paid account needed.

Builds take 10–25 minutes. When it finishes:

- **Android:** open the build page on expo.dev on the phone and download the
  APK, or scan the QR in the terminal. Allow "install from unknown sources".
- **iOS:** register the device first with `eas device:create`, then install from
  the build page.

Then start the bundler and connect:

```bash
pnpm dev:mobile
```

The dev build appears and connects to your machine. Code changes now reload
instantly — you only rebuild when you add a native module.

### Option C — Preview build (share with colleagues)

A standalone build with no bundler needed. Use this to hand the app to
inspectors for field trials.

```bash
eas build --profile preview --platform android   # produces an installable APK
eas build --profile preview --platform ios       # needs registered devices
```

Share the resulting link. Anyone can install it without Expo Go.

### 7.1 Test the offline behaviour

This is the part most worth testing properly, and it needs Option B or C.

1. Sign in while online. Wait for the sync banner to clear.
2. **Turn on airplane mode.**
3. Create a job → add a task → take two photos with the camera.
4. Everything saves instantly. An amber banner reads
   **"Offline · 3 items waiting to sync"**.
5. **Force-quit the app entirely**, then reopen it. The job is still there —
   proof it is on disk, not in memory.
6. **Turn airplane mode off.** The banner becomes "Syncing…", then disappears.
7. On the web app, open the job: the tasks and both photos should be there.
8. In Supabase → Table Editor → `jobs`, confirm exactly **one** row for that
   job. Duplicates would mean the idempotency keys are not working.

Also worth testing: kill the app mid-sync in step 6 and reopen it. The queue
resumes and still produces no duplicates.

---

## Part 8 — Ship to the app stores

Only needed for public distribution. Internal use is well served by Option C.

### 8.1 Set the versions

`app.json` already carries `version`, and the bundle identifiers:

- iOS: `com.pioneersegy.inspections`
- Android: `com.pioneersegy.inspections`

Change them before your first submission if you want different ids — they are
permanent once published.

Build numbers are handled for you: `eas.json` sets
`cli.appVersionSource: "remote"` and `autoIncrement` on the production profile.

### 8.2 Production builds

```bash
eas build --profile production --platform all
```

### 8.3 Android — Google Play

1. Register at <https://play.google.com/console> ($25 one-off).
2. Create the app; fill in the store listing, content rating, data-safety form
   and privacy policy URL. **The data-safety form is mandatory** — this app
   collects photos, location-adjacent job data and email addresses.
3. First upload must be manual: download the `.aab` and upload it to a testing
   track.
4. After that, `eas submit --platform android --latest`. Automating it needs a
   Google service-account key — see the EAS docs for
   `submit.production.android.serviceAccountKeyPath`.

### 8.4 iOS — App Store

1. Join the Apple Developer Program ($99/yr).
2. Create the app record in App Store Connect with a matching bundle ID.
3. Submit:
   ```bash
   eas submit --platform ios --latest
   ```
4. The build appears in TestFlight after ~15 minutes of processing. Test there
   before requesting App Store review.

**Expect review questions about:** why the app needs camera access (photographing
inspection findings — the strings are already in `app.json`), and account
deletion. Apple requires an in-app route to request deletion for any app with
accounts; currently deletion is admin-only via the web dashboard. Add a
"request account deletion" action before submitting, or expect a rejection.

---

## Troubleshooting

**Photo or PDF upload hangs, or the console shows a CORS error**
The R2 CORS policy is missing your origin. Re-check 2.4 / 5.3. The origin must
match exactly — `https://app.com` and `https://www.app.com` are different, and
so is a trailing slash.

**Upload returns 403 from R2**
Almost always a `Content-Type` mismatch. The presigned URL signs the content
type, so the PUT must send exactly the same one. If you changed the upload code,
check `apps/web/lib/upload.ts` passes back the `contentType` the API returned.

**"Missing NEXT_PUBLIC_SUPABASE_URL"**
`.env` is not being read, or Vercel is missing the variable. Restart `pnpm dev`
after editing `.env`; on Vercel you must **redeploy** after changing variables.

**Invite emails never arrive**
Supabase's built-in SMTP is rate-limited to a handful of emails per hour and
often lands in spam. For production, set a real provider under
**Authentication → Emails → SMTP Settings** (Resend, SendGrid, Postmark).

**Invite link says "This link has expired"**
Links are single-use and last one hour. Use **Re-send invitation** from the
Accounts page. Also confirm the redirect URL is allow-listed (5.2).

**Signed in but everything is empty**
The `profiles` row is missing or `is_active` is false. Check:

```sql
select * from public.profiles where email = 'you@yourcompany.com';
```

If there is no row, the `on_auth_user_created` trigger did not run — re-apply
migration 3, then insert the profile by hand.

**Vercel build: "Cannot find module '@pioneers/core'"**
Root Directory is not `apps/web`, or "Include source files outside of the Root
Directory" is off. See 4.2.

**Mobile app cannot reach the API**
`EXPO_PUBLIC_API_URL` points at `localhost`, which on a phone means the phone.
Use your LAN IP or the Vercel URL, and remember EAS builds read the value from
`eas env`, not from your local `.env`.

**Camera or QR scanner does nothing**
You are in Expo Go. Build a development build (Option B).

**EAS build fails installing dependencies**
Confirm `.npmrc` with `node-linker=hoisted` is committed — Metro cannot resolve
pnpm's symlinked layout without it — and that `pnpm-lock.yaml` is committed and
current.

---

## Security checklist before real use

- [ ] Public sign-up is **off** in Supabase (1.3)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` exists only in Vercel and your local `.env` —
      never in `EXPO_PUBLIC_*`, never committed
- [ ] R2 bucket has **no** public access; the R2 token is scoped to that bucket
- [ ] `.env` is untracked (`git status` confirms)
- [ ] Every table shows **RLS enabled** in the Table Editor
- [ ] Signed in as an inspector, `select count(*) from jobs;` returns only their
      own, and `select * from certificate_share_links;` returns 0 rows
- [ ] Supabase database password and the Android keystore are backed up
- [ ] Seed data (`Pioneers@2026` accounts) is **not** present on the production
      project
- [ ] Real SMTP configured, so invites actually arrive

---

## Ongoing costs

| Service         | Free tier                               | When you outgrow it                                    |
| --------------- | --------------------------------------- | ------------------------------------------------------ |
| Supabase        | 500 MB DB, 50k monthly users            | Pro $25/mo — needed to stop the 7-day inactivity pause |
| Cloudflare R2   | 10 GB, 1M writes/mo, **no egress fees** | ~$0.015/GB/mo after                                    |
| Vercel          | Hobby, non-commercial only              | Pro $20/user/mo — required for commercial use          |
| Expo EAS        | 30 builds/mo, shared queue              | $19/mo+ for priority builds                            |
| Apple Developer | —                                       | $99/yr                                                 |
| Google Play     | —                                       | $25 one-off                                            |

Realistic starting point for production: **~$65/month** plus the one-off store
fees.

> Vercel's Hobby plan forbids commercial use. Pioneers-EGY using this internally
> counts as commercial, so budget for Pro from day one.
