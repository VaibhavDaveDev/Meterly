# Purpose

Core application source code: API, database schema, frontend pages, server-side utilities, and shared client libraries. All code that ships to Cloudflare Workers or the browser lives here.

# Ownership

- `api/` owns all Hono route handlers, middleware, and server-side business logic.
- `db/` owns the Drizzle ORM schema, migrations, and `getDb` factory.
- `pages/` owns Astro page files and server-side rendering entry points.
- `components/` owns all React island components, organized by domain.
- `hooks/` owns React hooks; all server-data fetching must use TanStack Query v5 — no raw `useEffect`+`useState`.
- `lib/` owns client-side utilities, query keys, and format helpers.
- `layouts/` owns Astro layout wrappers.
- `types/` owns global TypeScript declarations.
- `test/` owns shared test setup, fixtures, and the in-memory SQLite database.
- `utils/` owns stateless pure utility functions.

# Local Contracts

- TypeScript is mandatory for all files in this directory.
- No `any` types — use proper TypeScript types.
- Every React island component mounted with `client:*` must wrap its export with `withErrorBoundary` (name internal implementation `<ComponentName>Inner` and `export const <ComponentName> = withErrorBoundary(<ComponentName>Inner)` at the module bottom).
- All client-side data fetching must use TanStack Query v5 (`useQuery` / `useMutation` / `useInfiniteQuery`). Do not use raw `useEffect` + `useState` for server data.
- Cloudflare bindings are accessed via `import { env } from "cloudflare:workers"` in Astro routes. Use `context.locals.cfContext` for `waitUntil`.

# Work Guidance

- Put route handler orchestration in `api/routes/`. Move pure business logic to `api/lib/`.
- Add a new Drizzle schema table in `db/schema/` and re-export from `db/schema/index.ts`. Generate a migration with `pnpm db:generate`.
- New React islands go in `components/<domain>/`. Register with `withErrorBoundary` at the Astro page level.

# Verification

```bash
pnpm typecheck   # 0 errors expected across all files
pnpm lint        # 0 warnings expected (ESLint + Prettier)
pnpm test --run  # all tests green
```

# Child DOX Index

| Child                                          | Scope                                                        |
| ---------------------------------------------- | ------------------------------------------------------------ |
| [api/AGENTS.md](./api/AGENTS.md)               | Hono API implementation: routes, middleware, business logic. |
| [components/AGENTS.md](./components/AGENTS.md) | React island components organized by domain.                 |
| [db/AGENTS.md](./db/AGENTS.md)                 | Drizzle schema, migrations, and the `getDb` factory.         |
| [hooks/AGENTS.md](./hooks/AGENTS.md)           | React hooks; TanStack Query v5 conventions.                  |
| [layouts/AGENTS.md](./layouts/AGENTS.md)       | Astro layout wrappers.                                       |
| [lib/AGENTS.md](./lib/AGENTS.md)               | Client-side libraries, query keys, format helpers.           |
| [pages/AGENTS.md](./pages/AGENTS.md)           | Astro frontend pages and SSR entry points.                   |
| [test/AGENTS.md](./test/AGENTS.md)             | Shared test setup, in-memory SQLite, fixtures.               |
| [types/AGENTS.md](./types/AGENTS.md)           | Global TypeScript declarations.                              |
| [utils/AGENTS.md](./utils/AGENTS.md)           | Pure stateless utility functions.                            |
