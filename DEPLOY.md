# Meterly — Production Deployment Guide

This guide covers a full first-time production deployment of Meterly on
Cloudflare Pages + Workers. It also covers ongoing operations: future deploys,
schema migrations, and rolling back a bad deploy.

Prerequisites, secrets, and environment variables are listed upfront in the
checklist below. Complete each step in order — skipping steps leads to the
common errors documented in the Troubleshooting section.

---

## Before You Start — Checklist

- [ ] Cloudflare account created
- [ ] Wrangler CLI authenticated (`pnpm exec wrangler login`)
- [ ] Domain name decided (Cloudflare Pages gives you a `.pages.dev` free subdomain — you can use that)
- [ ] Google OAuth credentials ready (optional but recommended)
- [ ] GitHub OAuth credentials ready (optional but recommended)
- [ ] If using GitHub OAuth: note your `Client ID` (goes in `wrangler.jsonc`) and generate a `Client Secret` (goes in `wrangler secret put`)
- [ ] Email provider chosen: **Resend** (recommended — requires a verified domain) OR
      **Atlas Mailer** (no domain needed, uses Gmail SMTP). See `.env.example` for details.
- [ ] If using Resend: Resend account created at https://resend.com and domain verified
- [ ] If using Atlas Mailer: Atlas Mailer Worker deployed and URL ready
- [ ] A strong random secret generated locally for `BETTER_AUTH_SECRET` (`openssl rand -hex 32`)

---

## Step 1 — Authenticate with Cloudflare

```bash
pnpm exec wrangler login
```

This opens a browser. Log in to your Cloudflare account. After authorising, Wrangler saves credentials locally. You only need to do this once per machine.

Verify it worked:

```bash
pnpm exec wrangler whoami
```

---

## Step 2 — Create the D1 Database

```bash
pnpm exec wrangler d1 create meterly-db
```

You will see output like this:

```text
Successfully created DB 'meterly-db'

[[d1_databases]]
binding = "DB"
database_name = "meterly-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the `database_id` UUID.** You will need it in Step 4.

## Step 3 — Create the R2 Bucket

```bash
# Production bucket:
pnpm exec wrangler r2 bucket create meterly-bills

# Preview bucket (required for `wrangler dev --remote`):
pnpm exec wrangler r2 bucket create meterly-bills-preview
```

No ID to copy — the bucket names are already configured in `wrangler.jsonc`.

---

## Step 4 — Update wrangler.jsonc

Open `wrangler.jsonc` and fill in the D1 database ID you copied above. Replace the placeholder values:

```jsonc
{
  "compatibility_date": "2024-09-23",
  "compatibility_flags": ["nodejs_compat_v2"],
  "vars": {
    "MAX_SESSIONS_PER_USER": "3",
    "MAX_UPLOADS_PER_DAY": "60",
    "OBSERVABILITY_ENABLED": "false",
    "ENVIRONMENT": "production",
    "BETTER_AUTH_URL": "https://YOUR-PROJECT-NAME.pages.dev",
    "PUBLIC_BETTER_AUTH_URL": "https://YOUR-PROJECT-NAME.pages.dev",
    "EMAIL_PROVIDER": "resend",
    "RESEND_FROM": "Meterly <noreply@yourdomain.com>",
    // OR: if using Atlas Mailer instead:
    // "EMAIL_PROVIDER": "atlas",
    // "ATLAS_MAILER_URL": "https://your-atlas-mailer-worker.workers.dev",
    "GOOGLE_CLIENT_ID": "your-google-client-id",
    "GITHUB_CLIENT_ID": "your-github-client-id",
    "PUBLIC_TURNSTILE_SITE_KEY": "your-turnstile-site-key",
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "meterly-db",
      "database_id": "PASTE-YOUR-D1-ID-HERE",
      "preview_database_id": "local",
      "migrations_dir": "src/db/migrations",
    },
  ],
  "r2_buckets": [
    {
      "binding": "BILL_PHOTOS",
      "bucket_name": "meterly-bills",
      // preview_bucket_name is used by `wrangler dev --remote`. A separate bucket
      // keeps local/preview development from touching production bill photos.
      "preview_bucket_name": "meterly-bills-preview",
    },
  ],
}
```

**Replace:**

- `PASTE-YOUR-D1-ID-HERE` with the UUID from Step 2
- `YOUR-PROJECT-NAME` with what you want your Cloudflare Pages app to be called (becomes `https://your-project-name.pages.dev`)
- Other vars with their actual values (see Step 6 for how to get each one)

> **💡 Important URL Note:** `YOUR-PROJECT-NAME` is just a placeholder in these instructions for the unique name you will choose. Cloudflare Pages URLs must be globally unique. If the name you want is already taken, Cloudflare will automatically append random characters during your first deploy in Step 7 (e.g., `meterly-a3f.pages.dev`).
>
> **If this happens, your authentication will break.** You will need to take the _actual_ assigned URL from the Step 7 success message, come back, update these variables and your OAuth callbacks, and deploy one more time.

> If you are using a custom domain instead of `.pages.dev`, update `BETTER_AUTH_URL` and `PUBLIC_BETTER_AUTH_URL` to your custom domain.

---

## Step 5 — Apply the Database Migration

Run the init SQL against your **remote** (production) D1 database:

```bash
pnpm exec wrangler d1 execute meterly-db --remote --file=./src/db/migrations/0000_init.sql
```

You will see output confirming each SQL statement was applied.

> **Important:** You only run `0000_init.sql`. This is the complete squashed schema for the entire database — all tables, indexes, and constraints in one file.
> Do not run any `0001_*` files. Those were consolidated into `0000_init.sql` before release.
> Future schema changes will create new numbered migrations starting from `0001`.

---

## Step 6 — Set Production Secrets

Secrets are encrypted and stored in Cloudflare. They must never be committed to version control. `.dev.vars` is gitignored and safe for **local development only** — do not use it for production secrets. In production, always use `wrangler secret put`.

Run each command below — it will prompt you to paste the value interactively:

### 6a. BETTER_AUTH_SECRET

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET
```

Generate the value with: `openssl rand -hex 32`

This is the master secret that signs all session cookies and auth tokens. Never share it.

### 6b. TURNSTILE_SECRET_KEY

```bash
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
```

**How to get it:**

1. Go to https://dash.cloudflare.com
2. Left sidebar → Turnstile → Add site
3. Give it a name, enter your domain (e.g. `meterly.pages.dev` or your custom domain)
4. Copy the **Secret Key** and paste it here
5. Copy the **Site Key** and add it to `wrangler.jsonc` vars as `PUBLIC_TURNSTILE_SITE_KEY`

### 6c. Email Provider Secret

**Choose one based on your chosen provider:**

#### Option A — Resend (recommended)

```bash
pnpm exec wrangler secret put RESEND_API_KEY
```

Get your API key from https://resend.com/api-keys
Verify your sending domain first at https://resend.com/domains

`RESEND_FROM` is a plain var (not a secret) — set it in `wrangler.jsonc` vars:
`"RESEND_FROM": "Meterly <noreply@yourdomain.com>"`

#### Option B — Atlas Mailer (no domain required)

```bash
pnpm exec wrangler secret put ATLAS_MAILER_SECRET
```

This is the bearer token your Atlas Mailer Worker expects.
Also set `ATLAS_MAILER_URL` in `wrangler.jsonc` vars.

### 6d. GOOGLE_CLIENT_SECRET (optional — skip if not using Google login)

```bash
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
```

**How to get it:**

1. Go to https://console.cloud.google.com
2. Create or select a project
3. APIs and Services → Credentials → Create Credentials → OAuth 2.0 Client ID
4. Application type: Web application
5. Authorised redirect URIs: `https://YOUR-PROJECT-NAME.pages.dev/api/auth/callback/google`
   > _Note: Be sure to use your **actual** assigned Cloudflare URL here. If Cloudflare appends random characters to your project name during deploy, you must update this callback URL to match._
6. Copy the **Client Secret** and paste it here as the secret
7. Copy the **Client ID** and add it to `wrangler.jsonc` vars as `GOOGLE_CLIENT_ID`

### 6e. GITHUB_CLIENT_SECRET (optional — skip if not using GitHub login)

```bash
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
```

**How to get it:**

1. Go to https://github.com/settings/developers
2. Select **OAuth Apps** -> **New OAuth App**
3. Application name: Meterly (or your project name)
4. Homepage URL: `https://YOUR-PROJECT-NAME.pages.dev`
5. Authorization callback URL: `https://YOUR-PROJECT-NAME.pages.dev/api/auth/callback/github`
   > _Note: Be sure to use your **actual** assigned Cloudflare URL here. If Cloudflare appends random characters to your project name during deploy, you must update this callback URL to match._
6. Click **Register application**
7. Copy the **Client ID** and add it to `wrangler.jsonc` vars as `GITHUB_CLIENT_ID`
8. Click **Generate a new client secret**, copy it, and paste it here as the secret

### 6f. CRON_SECRET

```bash
pnpm exec wrangler secret put CRON_SECRET
```

Generate the value with: `openssl rand -hex 32`

**Write this value down.** You will need it in Step 8 when setting up the cron scheduler. Without it, the reading reminder endpoint will return 401 Unauthorized to any caller.

---

## Step 7 — First Deploy

Build and deploy to Cloudflare Pages:

```bash
pnpm run build
pnpm exec wrangler pages deploy dist --project-name=YOUR-PROJECT-NAME
```

The first time you run this, Wrangler will ask if you want to create a new Pages project. Type `y`.

After a minute or two you will see:

```text
Deployment complete! Take a peek over at https://YOUR-PROJECT-NAME.pages.dev
```

Future deploys are just: `pnpm run deploy`

---

## Step 8 — Set Up the Daily Cron Job

The cron endpoint `GET /api/cron/reading-reminders` needs to be called once per day by an external scheduler. It:

1. Checks all properties where `reading_reminder_day` matches today's date
2. Finds the previous month's billing period if it is still in `draft` status
3. Creates in-app notifications for the property owner and active tenants

It is protected by `Authorization: Bearer CRON_SECRET`. Without the correct header, it returns 401.

### Option A — cron-job.org (Free, Recommended)

1. Go to https://cron-job.org and create a free account
2. Dashboard → Create Cronjob
3. Fill in:
   - **Title:** Meterly Reading Reminders
   - **URL:** `https://YOUR-PROJECT-NAME.pages.dev/api/cron/reading-reminders`
   - **Schedule:** Every day at 08:00 (or whatever time suits your users)
   - **Request method:** GET
4. Expand the **Headers** section and add one header:
   - Name: `Authorization`
   - Value: `Bearer YOUR-CRON-SECRET-VALUE` (the exact value you set in Step 6f)
5. Save/Create

The job will now run daily. You can check the execution log in cron-job.org to confirm it is hitting 200.

### Option B — GitHub Actions (if repo is on GitHub)

Create `.github/workflows/reading-reminders.yml` in your repository:

```yaml
name: Daily Reading Reminders
on:
  schedule:
    # Runs at 03:00 UTC every day (08:30 IST)
    - cron: "0 3 * * *"
  workflow_dispatch: # allows manual trigger

jobs:
  trigger-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger reading reminders cron
        run: |
          curl --fail --silent --show-error \
            -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://YOUR-PROJECT-NAME.pages.dev/api/cron/reading-reminders
```

Then add `CRON_SECRET` to your GitHub repository:

1. GitHub → your repo → Settings → Secrets and variables → Actions
2. New repository secret → Name: `CRON_SECRET`, Value: (the same value you set in Step 6f)

### Option C — Verify the Endpoint is Working

Test it manually right now:

```bash
# In Bash / Zsh (prompts silently to keep secrets out of shell history):
read -s -p "Enter CRON_SECRET: " CRON_SECRET; echo
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR-PROJECT-NAME.pages.dev/api/cron/reading-reminders
unset CRON_SECRET

# Or in PowerShell:
$secret = Read-Host -AsSecureString "Enter CRON_SECRET"
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
$plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
curl.exe -X GET -H "Authorization: Bearer $plain" https://YOUR-PROJECT-NAME.pages.dev/api/cron/reading-reminders
```

Expected response:

```json
{ "success": true, "processed": 0, "notificationsSent": 0 }
```

Zero is correct if no billing periods happen to match today's reminder day. The endpoint is working correctly.

---

## Step 9 — Verify the Full App

1. Visit `https://YOUR-PROJECT-NAME.pages.dev`
2. Sign up with an email and password
3. Check your email inbox for the OTP (if Resend or Atlas Mailer is configured correctly)
4. Complete verification, create a property
5. Invite yourself as a tenant using a second email
6. Submit a meter reading, confirm a billing period, check bills

---

## Step 10 — Custom Domain (Optional)

1. Cloudflare Dashboard → Pages → your project → Custom domains → Set up a custom domain
2. Enter your domain (e.g. `app.meterly.com`)
3. Follow the DNS configuration instructions (if your domain is on Cloudflare, it is automatic)
4. After DNS propagates, update in `wrangler.jsonc`:
   ```jsonc
   "vars": {
     "BETTER_AUTH_URL": "https://app.meterly.com",
     "PUBLIC_BETTER_AUTH_URL": "https://app.meterly.com"
   }
   ```
5. Redeploy: `pnpm run deploy`
6. Update the Google OAuth redirect URI to `https://app.meterly.com/api/auth/callback/google`
7. Update the GitHub OAuth callback URL to `https://app.meterly.com/api/auth/callback/github`
8. Update the Turnstile allowed domain to `app.meterly.com`

---

## Rollback — Reverting a Bad Deploy

Cloudflare Pages keeps a full deployment history. If a deploy breaks production:

### Code rollback (instant)

1. Cloudflare Dashboard → Pages → your project → Deployments
2. Find the last known-good deployment
3. Click the three-dot menu → **Rollback to this deployment**

This takes about 30 seconds and requires no code changes.

> **⚠️ Migration Compatibility Notice:** A Pages code rollback only reverts frontend and API worker code — it does **not** revert D1 database schema migrations or data. If the failing deployment included a database migration:
>
> - If the migration was **backward-compatible** (additive: added nullable columns, new tables), the rolled-back code will continue working without database changes.
> - If the migration was **breaking** (renamed/removed columns or tables), you must perform a database rollback (see below) or apply a forward corrective migration before or immediately after rolling back code.

### Database rollback (manual)

Cloudflare D1 supports **Time Travel** — point-in-time restore for up to **7 days**
on the Workers Free plan and up to **30 days** on the paid plan.

#### Option A — D1 Time Travel (recommended)

> **⚠️ Destructive Action:** Time Travel restore overwrites the database in place. Any writes made after the restore point will be lost. Always take a pre-restore export snapshot first.

1. Find the current bookmark:
   ```bash
   pnpm exec wrangler d1 time-travel info meterly-db
   ```
2. **Safety Step — Export current state to an external backup directory:**

   ```bash
   mkdir -p ~/backups
   pnpm exec wrangler d1 export meterly-db --remote --output=~/backups/meterly-pre-restore-$(date +%Y%m%d_%H%M%S).sql
   chmod 600 ~/backups/meterly-pre-restore-*.sql
   ```

   > _Never save database dumps inside the project repository to prevent accidental commits of production data._

3. Restore to a specific timestamp or bookmark:
   ```bash
   pnpm exec wrangler d1 time-travel restore meterly-db --timestamp="YOUR_RFC3339_TIMESTAMP"
   # or by bookmark ID:
   pnpm exec wrangler d1 time-travel restore meterly-db --bookmark="BOOKMARK_ID"
   ```
4. **Validate database integrity:**
   ```bash
   pnpm exec wrangler d1 execute meterly-db --remote --command="SELECT count(*) FROM user;"
   ```

#### Option B — SQL dump restore (longer retention / manual backup)

If the incident is older than the Time Travel retention window (7-30 days) and you need to restore from a previously exported `.sql` dump:

1. **Create a fresh D1 database:**
   ```bash
   pnpm exec wrangler d1 create meterly-db-restored
   ```
2. **Import the SQL dump into the new database:**
   ```bash
   pnpm exec wrangler d1 execute meterly-db-restored --remote --file=~/backups/your-backup.sql
   ```
3. **Verify restored data integrity:**
   ```bash
   pnpm exec wrangler d1 execute meterly-db-restored --remote --command="SELECT count(*) FROM user;"
   ```
4. **Cut over to the restored database:**
   Update `database_id` in `wrangler.jsonc` with the new database UUID from Step 1, then redeploy:
   ```bash
   pnpm run deploy
   ```
5. _If no backup exists:_ Create a forward corrective migration that reverses the bad schema change. Do not edit applied migration files.

**Prevention:** Before applying any migration to production, always apply it to
local first (`--local`) and verify the app works. For destructive migrations,
export a snapshot first (supplements Time Travel for retention beyond 7 days):

```bash
mkdir -p ~/backups
pnpm exec wrangler d1 export meterly-db --remote --output=~/backups/meterly-backup-$(date +%Y%m%d_%H%M%S).sql
chmod 600 ~/backups/meterly-backup-*.sql
```

---

## Ongoing — Future Deploys

### Normal code change:

```bash
pnpm run deploy
```

### New database migration:

> ### Database Migration Best Practices:
>
> Always write **backward-compatible (expand-and-contract)** migrations:
>
> 1. **Expand**: Add new nullable columns or tables first. Deploy code that writes to both old and new columns.
> 2. **Contract**: In a subsequent release after all data is migrated, drop old columns/tables.
>    This ensures that any sudden code rollback never encounters missing columns or schema incompatibilities.

```bash
# 1. Generate migration from schema change
pnpm exec drizzle-kit generate

# 2. Apply to local first and test
pnpm exec wrangler d1 execute meterly-db --local --file=./src/db/migrations/0001_your_migration.sql
pnpm run dev

# 3. Apply to production
pnpm exec wrangler d1 execute meterly-db --remote --file=./src/db/migrations/0001_your_migration.sql

# 4. Deploy new code
pnpm run deploy
```

Always run migrations before deploying new code that depends on them.

---

## Environment Variables Reference

| Variable                      | How to Set            | Description                                                        |
| ----------------------------- | --------------------- | ------------------------------------------------------------------ |
| `BETTER_AUTH_SECRET`          | `wrangler secret put` | Master signing secret — generate with `openssl rand -hex 32`       |
| `TURNSTILE_SECRET_KEY`        | `wrangler secret put` | From Cloudflare Turnstile dashboard → your site → Secret Key       |
| `RESEND_API_KEY`              | `wrangler secret put` | From https://resend.com/api-keys — only if `EMAIL_PROVIDER=resend` |
| `ATLAS_MAILER_SECRET`         | `wrangler secret put` | Bearer token for your Atlas Mailer Worker                          |
| `GOOGLE_CLIENT_SECRET`        | `wrangler secret put` | From Google Cloud Console OAuth credentials                        |
| `GITHUB_CLIENT_SECRET`        | `wrangler secret put` | From GitHub Developer Settings OAuth Apps                          |
| `CRON_SECRET`                 | `wrangler secret put` | Random secret — you use this in your cron scheduler header         |
| `RESEND_FROM`                 | `wrangler.jsonc` vars | Sender address, e.g. `Meterly <noreply@yourdomain.com>`            |
| `ENVIRONMENT`                 | `wrangler.jsonc` vars | Set to `production`                                                |
| `BETTER_AUTH_URL`             | `wrangler.jsonc` vars | Your app's public URL (no trailing slash)                          |
| `PUBLIC_BETTER_AUTH_URL`      | `wrangler.jsonc` vars | Same as `BETTER_AUTH_URL`                                          |
| `ATLAS_MAILER_URL`            | `wrangler.jsonc` vars | Your Atlas Mailer Worker URL                                       |
| `GOOGLE_CLIENT_ID`            | `wrangler.jsonc` vars | From Google Cloud Console OAuth credentials                        |
| `GITHUB_CLIENT_ID`            | `wrangler.jsonc` vars | From GitHub Developer Settings OAuth Apps                          |
| `PUBLIC_TURNSTILE_SITE_KEY`   | `wrangler.jsonc` vars | From Cloudflare Turnstile dashboard → your site → Site Key         |
| `MAX_SESSIONS_PER_USER`       | `wrangler.jsonc` vars | Max concurrent sessions (default: `3`)                             |
| `MAX_READINGS_PER_DAY`        | `wrangler.jsonc` vars | Max meter reading submissions per user per day (default: `20`)     |
| `MAX_UPLOADS_PER_DAY`         | `wrangler.jsonc` vars | Max bill photo uploads per user per day (default: `60`)            |
| `OBSERVABILITY_ENABLED`       | `wrangler.jsonc` vars | Set to `true` to enable OpenTelemetry telemetry (default: `false`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `wrangler.jsonc` vars | OTLP HTTP collector endpoint (e.g. Grafana Cloud / local OTel)     |
| `GRAFANA_CLOUD_INSTANCE_ID`   | `wrangler.jsonc` vars | Instance ID for Grafana Cloud OTLP ingestion                       |
| `LOG_LEVEL`                   | `wrangler.jsonc` vars | Structured log verbosity: `debug`, `info`, `warn`, `error`         |
| `GRAFANA_CLOUD_API_KEY`       | `wrangler secret put` | Ingestion token for Grafana Cloud — store as encrypted secret      |

---

## Free Tier Headroom

All Cloudflare services Meterly uses are free for reasonable usage:

| Service                   | Free Limit                                                                | Notes                                                             |
| ------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Cloudflare Pages          | Unlimited static asset requests                                           | Static assets only                                                |
| Pages Functions & Workers | **Shared** 100,000 requests/day (Workers Free tier)                       | API, SSR, and Worker requests all count against this single quota |
| D1                        | 5M row reads/day, 100K writes/day, 500MB per database (5GB account total) | More than enough for hundreds of users                            |
| R2                        | 10GB storage, 1M Class A ops/month                                        | Bill photos are compressed to under 250KB each                    |
| Turnstile                 | Unlimited                                                                 | Always free                                                       |

---

## Troubleshooting

**Deployment fails: "missing binding DB"**
Your `database_id` in `wrangler.jsonc` is still the placeholder. Run `pnpm exec wrangler d1 list` to find your real ID.

**Email OTP never arrives in production**
`ENVIRONMENT` must be set to `production` in `wrangler.jsonc` vars. In development mode, OTPs print to the terminal and the mailer is not called. In production, the terminal print is suppressed and the mailer must work.

**Turnstile: "invalid sitekey"**
The `PUBLIC_TURNSTILE_SITE_KEY` in `wrangler.jsonc` must match the site key from Cloudflare Turnstile. Make sure the Turnstile site allows your Pages domain.

**Google login: redirect_uri_mismatch**
The redirect URI in Google Cloud Console must exactly match `https://YOUR-DOMAIN/api/auth/callback/google`. No trailing slash. Must be https.

**Cron endpoint returns 401**
The `Authorization: Bearer` header value in your cron scheduler must exactly match what you set via `wrangler secret put CRON_SECRET`. Check for extra spaces or quote characters.

**"table does not exist" error after deploy**
You need to apply the migration to the remote database. Run:

```bash
pnpm exec wrangler d1 execute meterly-db --remote --file=./src/db/migrations/0000_init.sql
```
