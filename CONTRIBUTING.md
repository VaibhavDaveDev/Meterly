# Contributing to Meterly

Thank you for your interest in contributing. This document explains how the codebase is organised, what standards we hold code to, and the exact workflow for making a change.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How the Codebase Works](#how-the-codebase-works)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Database Migrations](#database-migrations)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

Be direct and respectful. We review code, not people. If you disagree with a decision, explain your reasoning technically. Personal attacks or dismissive language in issues or PRs will result in removal.

---

## How the Codebase Works

Meterly uses the **DOX framework** — every directory that owns a domain has an `AGENTS.md` file that defines its purpose, rules, and contracts. Read the `AGENTS.md` in any folder you plan to touch before editing files inside it.

The chain to always read before any change:
1. `/AGENTS.md` — project-wide rules
2. `/src/AGENTS.md` — source-level rules
3. The `AGENTS.md` closest to the file you are editing

**Stack:**
- **Frontend:** Astro (SSR) + React islands + Tailwind CSS + shadcn/ui
- **Backend:** Hono (on Cloudflare Workers) + Drizzle ORM
- **Database:** Cloudflare D1 (SQLite dialect)
- **Auth:** Better Auth — email/password, Google OAuth, email OTP
- **Storage:** Cloudflare R2 (bill photos)

---

## Getting Started

### Prerequisites

- Node.js v18+
- pnpm v10+
- A Cloudflare account (free tier is fine)
- Wrangler CLI (installed via pnpm)

### Local Setup

```bash
# Clone the repository
git clone https://github.com/YOUR-ORG/meterly.git
cd meterly

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .dev.vars

# Apply the database schema to local D1
pnpm exec wrangler d1 execute meterly-db --local --file=./src/db/migrations/0000_init.sql

# Start the dev server
pnpm run dev
```

The app runs at `http://localhost:4321`.

For local development, the default values in `.dev.vars` work out of the box:
- Email OTP codes print to the terminal — no mailer needed (like Resend or [Atlas Mailer](https://github.com/VaibhavDaveDev/atlas-mailer.git))
- Turnstile is pre-configured with Cloudflare's always-pass test keys
- Google OAuth is optional

### Pre-commit hooks

This project uses Husky for pre-commit enforcement. After `pnpm install`, git hooks are automatically installed.

- **Pre-commit:** Runs ESLint and Prettier on staged files via `lint-staged`. Fix any lint errors before committing.
- **Pre-push:** Runs `astro check` (full TypeScript typecheck). Fix any type errors before pushing.

To skip hooks in an emergency (not recommended):
```bash
git commit --no-verify -m "your message"
git push --no-verify
```

### Seed Demo Data

To skip manual setup and get a fully populated dashboard:

```bash
pnpm seed:fresh
```

This resets the local database and inserts demo fixtures with two accounts:

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@demo.meterly.app` | `DemoOwner123` |
| Tenant | `tenant@demo.meterly.app` | `DemoTenant123` |

---

## Development Workflow

### Branch Strategy

- `main` — production-ready code. Never push directly.
- Feature branches: `feat/short-description`
- Bug fix branches: `fix/short-description`
- Refactor branches: `refactor/short-description`

### Making a Change

1. Create a branch from the latest `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feat/your-feature-name
   ```

2. Read the relevant `AGENTS.md` files for the directories you plan to touch.

3. Make your changes. Run checks frequently:
   ```bash
   pnpm run lint
   pnpm run typecheck
   pnpm test
   ```

4. If you changed the database schema, see [Database Migrations](#database-migrations).

5. Commit with a clear message (see [Commit Messages](#commit-messages)).

6. Open a pull request against `main`.

### Commit Messages

Use this format:

```
type: short imperative description

Optional longer explanation if needed. Wrap at 72 chars.
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`

Examples:
- `feat: add rate override to billing periods`
- `fix: cancel pending edit requests before rate limit check`
- `docs: update migration instructions in README`

---

## Code Standards

### TypeScript

- No `any` types. Use `unknown` and narrow it, or define a proper interface.
- Prefer `type` over `interface` for plain data shapes.
- Use the Parameter Object pattern when passing 3+ related values across function boundaries.
- All functions called from API routes must be typed end-to-end.

### React Components

- One component per file.
- Props typed with a `type Props = {...}` at the top of the file.
- No `useState` for data that is fetched — use the established fetch-on-mount pattern.
- Event handlers defined inside the component, not as inline arrows in JSX.

### API Routes (Hono)

- Every route must validate its input with Zod.
- Authorization checks (`isOwner`, `isTenant`) must happen at the start of the handler, before any DB call.
- Return consistent error shapes: `{ error: string }` with the appropriate HTTP status.
- Never expose internal error messages to clients in production.

### API Documentation

All API routes must be registered using `createRoute()` from `@hono/zod-openapi`. This is what populates the Swagger UI at `/api/docs`.

**Pattern for every new route:**
1. Define the Zod schemas for params, query, body, and responses.
2. Call `createRoute({ method, path, tags, summary, request, responses })`.
3. Register with `router.openapi(route, handler)` — not `router.get/post/etc`.
4. The route will automatically appear in `/api/docs`.

**Never use `router.get/post/patch/delete()` for new routes.** Use `.openapi()` exclusively.
If you add a route without `createRoute()`, it will not appear in the API docs and the PR will not be approved.

### Styling

- Use Tailwind utility classes. No inline styles.
- Design tokens and theme values live in `tailwind.config.mjs` — don't hardcode colours.
- Typography: Work Sans for body, Manrope for headings, JetBrains Mono for numbers/code.
- No gradients, heavy shadows, or animation-heavy UI. Minimal hover states only.

---

## Database Migrations

Meterly uses Drizzle ORM with versioned SQL migration files. **Never use `drizzle-kit push` on production.**

### When to create a migration

Any time you change a file in `src/db/schema/` — add a column, add a table, add an index — you must generate a migration:

```bash
# 1. Edit the schema file(s)
# 2. Generate the migration SQL
pnpm exec drizzle-kit generate

# 3. A new file appears in src/db/migrations/
#    e.g. 0001_add_rate_override.sql

# 4. Apply it to your local database
pnpm exec wrangler d1 execute meterly-db --local --file=./src/db/migrations/0001_your_migration.sql

# 5. Verify the app still works
pnpm run dev
```

Include the migration file in your PR. Reviewers will check that it is correct and safe to apply.

### Migration rules

- Migrations are **append-only** — never edit a migration that has already been applied.
- D1 (SQLite) does not support `ALTER COLUMN`. If you need to change a column type, you may need to recreate the table. Check Drizzle docs.
- Do not delete the `meta/` directory or snapshots — Drizzle Kit uses them to generate correct diffs.
- The baseline is `0000_init.sql`. All subsequent migrations are numbered from `0001`.

---

## Testing

Meterly uses Vitest with in-memory SQLite (`better-sqlite3`) for fast, isolated unit and integration tests.

```bash
# Run all tests
pnpm test

# Run in watch mode
pnpm test --watch

# Run with UI
pnpm test --ui
```

### Writing tests

- Tests live in `src/test/`.
- Use the helpers in `src/test/setup.ts` for database setup — they apply the schema and run in isolation.
- Test the billing engine logic (`src/api/lib/billing.ts`) with pure input/output cases. No HTTP needed.
- For route-level tests, use Hono's `app.request()` helper.
- Foreign key enforcement is off in tests (matching D1 production behaviour). Do not remove `PRAGMA foreign_keys = OFF` from `src/test/setup.ts`.

New features should include tests. Bug fixes should include a test that reproduces the bug before the fix.

---

## Pull Request Process

1. All checks must pass: `pnpm run lint`, `pnpm run typecheck`, `pnpm test`.
2. PR title follows the commit message format.
3. PR description explains:
   - What changed and why
   - Any migration needed and how to apply it
   - How to manually verify the feature/fix
4. One approval required before merge.
5. API docs updated: any new or changed routes use `createRoute()` and appear in `/api/docs`
6. Squash merge into `main`.

### What gets reviewed

- Correctness — does it do what the PR says?
- Security — authorization checks, input validation, no secrets in code
- Schema changes — backwards compatible, migration is clean
- DOX compliance — did you update the relevant `AGENTS.md` files?
- Test coverage — is new behaviour tested?

---

## Reporting Bugs

Open a GitHub Issue with:

1. **What you expected to happen**
2. **What actually happened** (paste the exact error message or describe the wrong output)
3. **Steps to reproduce** (be specific — which property, which billing period, what action)
4. **Environment** — browser, local dev or production, any relevant config

For security vulnerabilities, do not open a public issue. Email the maintainer directly.

---

## Requesting Features

Open a GitHub Issue and describe:

1. **The problem you are trying to solve** — not the solution, the problem
2. **Who this affects** — owners, tenants, both?
3. **What you have tried** — workarounds you currently use

Feature requests are prioritised based on how many users they affect and how well they fit the product's direction. 