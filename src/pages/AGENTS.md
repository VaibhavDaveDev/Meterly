# Pages DOX

## Purpose

- Astro frontend pages, SSR entry points, and the API gateway route for Meterly.

## Ownership

- `api/[...path].ts` owns the SSR catch-all route delegating `/api/*` HTTP requests to the Hono application with Cloudflare execution context.
- `index.astro` owns the public marketing landing page.
- `login.astro`, `signup.astro`, `verify-email.astro`, `forgot-password.astro` own public authentication page shells.
- `dashboard.astro`, `notifications.astro`, `settings.astro` own top-level authenticated dashboard pages.
- `properties/` owns property management pages (`index.astro`, `new.astro`, `[id].astro`).
- `bills/` owns bill detail pages (`[id].astro`).

## Local Contracts

- All interactive components on Astro pages must be mounted as Astro islands (`client:load` or `client:only`).
- Cloudflare bindings in `[...path].ts`: import `env` from `"cloudflare:workers"`; access execution context via `context.locals.cfContext`.
- Top-level React island components must export wrapped with `withErrorBoundary`.

## Work Guidance

- Maintain responsive design on mobile and desktop viewports.

## Verification

```bash
pnpm typecheck
```

## Child DOX Index

No child DOX files.
