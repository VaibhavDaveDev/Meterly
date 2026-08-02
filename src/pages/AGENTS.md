# Purpose

Astro frontend pages and UI components for Meterly.

# Ownership

Frontend and Fullstack developers.

# Local Contracts

- Use Astro for SSR.
- UI components use React with shadcn/ui and Tailwind CSS.
- `api/[...path].ts` is the catch-all that delegates all `/api/*` requests to the Hono app.

# Work Guidance

- Follow the UI/UX blueprint in `Plan.md`.
- Use Astro islands for interactive components.
- **Astro v7 / Cloudflare adapter v14 API in `[...path].ts`:**
  - Env bindings: `import { env } from "cloudflare:workers"` — `locals.runtime.env` was removed in v6.
  - Execution context: `context.locals.cfContext` — `locals.runtime.ctx` was removed in v6.
  - Do NOT import `ctx` from `cloudflare:workers`; only `env` is exported by that module.

# Verification

- Verify responsive design on mobile and desktop.
