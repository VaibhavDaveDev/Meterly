# API Business Logic DOX

## Purpose

- Core business logic, rate limiters, auth configuration, and background maintenance functions for the Meterly API.

## Ownership

- `billing-engine.ts` owns the source of truth for all meter-to-currency calculations, prior reading resolution (via `innerJoin` on `billingPeriods`), and rate-tier splitting.
- `auth.ts` owns the Better Auth instance, authentication plugins (email OTP, OAuth), session policy (rolling sessions: 7-day expiry, 1-day roll), and lifecycle hooks (`onPasswordUpdate`, `after[/sign-up/email]`).
- `session-limit.ts` owns FIFO session cleanup executed on user login.
- `email.ts` owns the provider-agnostic email dispatch abstraction (Resend primary, Atlas Mailer fallback) and in-memory rate limiting.
- `avatar.ts` owns Gravatar URL generation (SHA-256 Web Crypto) and DiceBear fallback.
- `solo-mode.ts` owns owner-tenancy lifecycle helpers (`ensureOwnerTenancy`, `deactivateOwnerTenancy`, `reconcileSplitsAfterRemoval`).
- `otp-limiter.ts` owns exponential backoff rate limiting for OTP sending (5m, 15m, 30m, 60m cooldowns; 2h inactivity reset or on-verify reset).
- `password-change-limiter.ts` owns per-user rate limit enforcement for password changes (3 per 24h rolling window via D1).
- `property-cleanup.ts` owns `sweepOrphanedPropertyData` for deferred permanent sweeping of deleted properties, tenancy records, historical readings, and R2 photo backlog draining.

## Local Contracts

- All files in this directory must be pure functions or stateless helpers where possible.
- Complex calculations (such as billing engine) require 100% unit test coverage.
- All email dispatch is gated by `EMAIL_PROVIDER` env var — no hardcoded providers.
- R2 cleanup retries up to 3 times before enqueuing to `r2_cleanup_backlog`; items reaching 10 attempts are logged as permanent orphans and purged from backlog.

## Work Guidance

- Keep modules decoupled; pass required database handles and env bindings as explicit arguments.
- Refer to `MAILER.md` for email provider configuration and integration details.

## Verification

```bash
pnpm test --run src/api/lib
```

## Child DOX Index

- [MAILER.md](./MAILER.md): Email provider integration contract (Resend + Atlas Mailer).
