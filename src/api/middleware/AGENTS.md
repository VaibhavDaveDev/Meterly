# API Middleware DOX

## Purpose

- Hono middleware functions that intercept requests before reaching route handlers.

## Ownership

- `auth.ts` owns session extraction from headers via Better Auth and injection of user and session objects into Hono context (`c.set('user', ...)`).
- `turnstile.ts` owns Cloudflare Turnstile token verification (Layer 1 bot defense) before auth logic runs, supporting secret key validation and hostname allowlists.

## Local Contracts

- Middleware must only mutate the Hono Context (`c.set()`) or return early HTTP responses (e.g., 401 Unauthorized, 403 Forbidden).
- Do not place heavy business logic in middleware.

## Work Guidance

- `turnstile.ts` uses form-encoded requests to Cloudflare's siteverify endpoint with timeout and size guards. Requires `TURNSTILE_SECRET_KEY` in production.

## Verification

```bash
pnpm test --run src/api/middleware
```

## Child DOX Index

No child DOX files.
