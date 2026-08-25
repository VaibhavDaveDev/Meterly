# Purpose

Core business logic and utility functions for the Meterly API.

# Ownership

API and Backend developers.

# Local Contracts

- All files in this directory must be pure functions or stateless helpers where possible.
- Complex logic (like billing) must be accompanied by comprehensive unit tests.

# Work Guidance

- `billing-engine.ts`: The source of truth for all meter-to-currency calculations. 100% unit test coverage required. Start-value resolution resolves prior period readings using an `innerJoin` on `billingPeriods` (skipping periods with no submitted meter readings).
- `auth.ts`: Better Auth instance — email+password primary, Google and GitHub OAuth secondary, emailOTP for password reset. Rolling sessions enabled (7-day expiry, 1-day roll window). Hooks: `onPasswordUpdate` sends security email; `after[/sign-up/email]` resolves avatar via `resolveAvatarAtSignup`.
- `session-limit.ts`: FIFO session cleanup logic executed on login.
- `email.ts`: Provider-agnostic email abstraction. Supports Resend (primary, `EMAIL_PROVIDER=resend`) and [Atlas Mailer](https://github.com/VaibhavDaveDev/atlas-mailer.git) (fallback, `EMAIL_PROVIDER=atlas`). `RESEND_FROM` configures the sender address. All logic gated by `EMAIL_PROVIDER` env var — no hardcoded provider. See `MAILER.md`.
- `avatar.ts`: Gravatar URL generation (SHA-256, Web Crypto) and DiceBear fallback.
- `solo-mode.ts`: Helpers for the owner-tenancy pattern — `ensureOwnerTenancy`, `deactivateOwnerTenancy`, `reconcileSplitsAfterRemoval`. All are idempotent.
- `otp-limiter.ts`: Exponential backoff rate limiting for OTP sending (5m, 15m, 30m, 60m cooldowns). Resets after 2 hours of inactivity or upon successful verification.
- `password-change-limiter.ts`: Per-user rate limit for change-password (3 per 24h rolling window). Uses D1 table `password_change_limit`. Enforced in app.ts before delegating to Better Auth handler.
- `property-cleanup.ts`: `sweepOrphanedPropertyData(db, env, propertyId)` — permanently deletes all historical data (R2 photos, bill_photos, meter_reading_edits, meter_readings, bills, billing_periods, tenancies) once a property is owner-deleted AND every real tenant (`isOwnerTenancy = false`) has explicitly deleted their record (`deletedByTenantAt IS NOT NULL`). Called speculatively via `waitUntil` in owner `DELETE /properties/:id` and tenant `DELETE /tenancies/:id`. Solo-mode properties (no real tenants) sweep immediately on owner delete. Safe to call before either condition is met — returns false without side effects.
  - **R2 retry strategy:** Each R2 key gets up to 3 attempts with 200 ms exponential backoff inside `waitUntil`. Keys exhausting all retries are written to `r2_cleanup_backlog` (attempt_count starts at 3) and DB cleanup proceeds unconditionally. At the top of every future sweep call, up to 50 backlog entries are drained (1 attempt each); successes remove the row, failures increment `attempt_count`. Entries reaching 10 total attempts are logged as permanent orphans and purged from the backlog.
  - Rate limits: `MAX_READINGS_PER_DAY` (default 20) and `MAX_UPLOADS_PER_DAY` (default 60) are read from env vars; max 3 photos per reading period per user.

# Child DOX Index

- [MAILER.md](./MAILER.md): Email provider integration contract (Resend + [Atlas Mailer](https://github.com/VaibhavDaveDev/atlas-mailer.git)).
