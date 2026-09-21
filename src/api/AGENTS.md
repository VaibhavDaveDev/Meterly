# Purpose

Hono-based API implementation. Owns all server-side route handlers, middleware, and orchestration logic that runs on Cloudflare Workers.

# Ownership

- `app.ts` owns the Hono app instance, global middleware registration, and all auth-intercept routes (sign-in, sign-up, OTP, change-password).
- `routes/` owns resource-scoped route handlers (one file per resource domain).
- `middleware/` owns reusable Hono middleware (auth, Turnstile).
- `lib/` owns business logic called by route handlers.

# Local Contracts

- All routes must be registered via `router.openapi()` with Zod request/response schemas. Do NOT use `router.get/post/delete`.
- All responses must use the `SuccessResponse` and `ErrorResponse` wrappers from `lib/openapi-schemas.ts`. Every `ErrorResponse` must include a string `code` and `message`.
- `authMiddleware` must be applied to every router that requires an authenticated user (`router.use('*', authMiddleware)`).
- Authorization is always inline `isOwner`/`isTenant` checks — never external ABAC libraries.
- Cron routes are secured by `CRON_SECRET` bearer token, not session cookies.
- `Bindings` and `Variables` types live in `app.ts` and must be imported from there — never redefined locally.
- All env vars accessed by routes must be declared in the `Bindings` type in `app.ts`.
- The Cloudflare execution context is `c.executionCtx` (Hono) — do not use `context.locals.cfContext` in Hono handlers.

# Work Guidance

- New resource routes go in `routes/<resource>.ts`. Mount them in `app.ts` with `app.route('/api/<resource>', router)`.
- Auth-intercepted routes (sign-in, OTP, change-password) must stay in `app.ts` above the catch-all `app.on(['POST','GET'], '/api/auth/*', ...)`.
- Move heavy logic to `lib/`. Keep route handlers to: validate → authorize → call lib → return response.

# Verification

```bash
pnpm test --run src/api   # run all route and lib tests
pnpm typecheck            # confirm 0 type errors
```

# Child DOX Index

| Child                                          | Scope                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| [lib/AGENTS.md](./lib/AGENTS.md)               | Business logic, billing engine, auth config, email, rate limiters. |
| [routes/AGENTS.md](./routes/AGENTS.md)         | API route handlers, one file per resource.                         |
| [middleware/AGENTS.md](./middleware/AGENTS.md) | Hono middleware: auth session, Turnstile bot protection.           |
