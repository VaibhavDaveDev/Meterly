# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:

- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

### Design System Preferences

- No gradients, glows, animations (except minimal hover states), or AI slop aesthetics
- Typography: Work Sans for body, Manrope for headings, JetBrains Mono for numbers
- Direct, honest copy — no marketing jargon like "revolutionary," "paradigm," "disruptive"
- No emojis except occasional use when contextually appropriate
- I don't want to constraint your design imiganation do your best.

### Build & Lint Configuration

- ESLint ignores node_modules, dist, .astro, .wrangler, build, .output, coverage, Reference
- Node memory increased to 4GB via .npmrc for build process (prevents heap out of memory)
- React unescaped entities warning disabled (use &apos; for apostrophes in JSX)
- No explicit `any` types — use proper TypeScript types

### Code Quality — Fallow

- Run `pnpm fallow` to get the review report; save output to `fallow_review.txt`.
- Dead files/exports: delete before refactoring anything else.
- Duplication budget: keep duplicated lines under 5% (currently 10.2% — active work item).
- Complexity budget: no new CRITICAL-rated functions (cyclomatic ≥ 20 or CRAP ≥ 400).
- Extract data-fetching into custom hooks before splitting JSX.

### Parameter Object Pattern (TypeScript)

- Use when the same cluster of 3+ variables is passed across multiple functions.
- Use a `type` or `interface`, not a class — native to the TS stack.
- Never pass the full object to a utility that only needs one field (stamp coupling).
- Current trigger: `dashboard.ts` `:135` when it gets broken up — that handler may benefit from a shared context object.

### Architecture Rules (Ponytail)

- Authorization approach: inline isOwner/isTenant checks (no CASL)
- Queues: Deferred to v2. Use direct fetch and `waitUntil` for now.
- Email: Dual-provider approach (Resend as primary, [Atlas Mailer](https://github.com/VaibhavDaveDev/atlas-mailer.git) as fallback). In development, emails are mocked via console log or redirected to test addresses (e.g. `delivered@resend.dev`) if `RESEND_API_KEY` is present. Tests use `vi.fn()` for Resend and MSW for Atlas adapter HTTP mocking.
- Rate Limiting: Handled by Better Auth built-in (no KV required for this in v1).
- Notification Polling: Click-to-refresh in v1. Smart ETag polling deferred to v1.1.
- Notification Expiry: Query-time filter only, no cron cleanup.
- Session Management: Configurable limit via MAX_SESSIONS_PER_USER (default: 3) with FIFO cleanup on login.
- Storage: R2 bucket `BILL_PHOTOS` is used for bill photo uploads. In local dev, Wrangler creates a simulated local R2 bucket in `.wrangler`.
- Observability: Use @microlabs/otel-cf-workers for edge-native telemetry. Use `src/api/lib/logger.ts` for structured JSON logs (no Pino). Do not use Cloudflare Logpush.
- **Property delete cascade rule:** When a property is deleted by the owner, `billing_periods`, `meter_readings`, `bills`, and `bill_photos` are NOT immediately deleted — they form permanent tenant billing history. Only `meter_reading_edits`, `edit_requests`, `custom_charges`, `property_rates`, and `notifications` are hard-deleted. Tenancies are soft-deleted to `status='property_deleted'`. **Deferred full sweep:** `sweepOrphanedPropertyData` is called via `waitUntil` on both the owner DELETE and the tenant `/archive` routes. It hard-deletes R2 photos + all DB history (bill_photos, meter_reading_edits, meter_readings, bills, billing_periods, tenancies) only once the property row is gone AND every tenancy has a non-null `archivedByTenantAt`. This is the only path that permanently wipes data.
- **Upload/reading rate limits:** `MAX_UPLOADS_PER_DAY` (default 60) and `MAX_READINGS_PER_DAY` (default 20) are read from env. Max 3 photos per billing period per user.
- **Test FK enforcement:** `src/test/setup.ts` sets `PRAGMA foreign_keys = OFF` to match Cloudflare D1 production behavior (D1 disables FK enforcement by default). Do not remove this pragma.
- **Migration baseline:** All migrations were squashed into `src/db/migrations/0000_init.sql` (July 2026). This includes `rate_override` on `billing_periods` and all schema up to that date. Future migrations start from `0001`. The `meta/` folder contains only `0000_snapshot.json` and `_journal.json`. Stale snapshots and the two `0001_*` migration files were removed during the July 2026 squash.

- **Local dev seed:** Run `pnpm seed:fresh` to reset the local D1 database and insert demo fixtures. Credentials: owner@demo.meterly.app / DemoOwner123, tenant@demo.meterly.app / DemoTenant123. Script is at `scripts/seed.ts`. Never commit real data to this script. **Password hashing in seed.ts must use `hashPassword` from `better-auth/crypto`** — not bcryptjs or any other library. Better Auth's verifier expects a `salt:hash` hex format (scrypt); bcrypt hashes (`$2b$...`) will throw `"Invalid password hash"` at login.
- **Edit request throttle after overwrite:** Edit request rate limits are applied per-tenant across all periods. However, when a tenant submits a new request for a period that _already_ has a pending request, the old request is cancelled _before_ the rate limit check. This intentional cancel-then-throttle logic allows same-period overwrites to succeed while still preventing cross-period spam.

### CI / Developer Tooling

- **GitHub Actions:** `.github/workflows/ci.yml` runs lint + typecheck + test on every PR and push that touches `src/`, `scripts/`, or key config files. Pure markdown changes skip CI. Runs on Node.js 24. pnpm version is read from the `packageManager` field in `package.json` — do not add an explicit `version:` in the workflow.
- **Husky:** Pre-commit runs `lint-staged` (ESLint + Prettier on staged files). Pre-push runs `astro check` (full typecheck). Both hooks run automatically after `pnpm install` via the `prepare` script.
- **Dependency security:** CI runs `pnpm audit --prod` on pushes to main. DevDependency vulns (miniflare/undici) are excluded intentionally.

### Recharts Container Rule

Every `<ResponsiveContainer>` must live inside a wrapper div that has explicit `min-h-[Npx]`
and `w-full`. The `100%` height resolution fails when the parent has zero intrinsic height.
The console error `width(-1) and height(-1) of chart should be greater than 0` means a
zero-dimension parent — fix by adding `minHeight` to the wrapper, not by changing
`ResponsiveContainer` props. This is documented in README.md under "Recharts Container Warning".

### Session Security Migration Rule

If migrating away from Cloudflare Workers:

- Do NOT trust `X-Forwarded-For` headers from clients.
- Configure the reverse proxy to set `X-Real-IP` and read only that.
- Implement session IP-binding middleware (see README.md "Session Security").
- Better Auth rolling sessions and FIFO session limits remain in place regardless of host.

## Child DOX Index

<!-- - [Plan.md](./Plan.md): Comprehensive project documentation, requirements, and technical specification. Design sketches are suggestions — full creative freedom. Section 30 contains the product improvement backlog: calculation edge cases, graph review, onboarding critique, new features, chart dropdown implementation plan, polish checklist, and free-tier headroom math. -->

- [src](./src/AGENTS.md): Core application source code.
- [DESIGN.md]: contains the design rules and guidelines.
- [CONTRIBUTING.md]: contributor guide — local setup, code standards, migration workflow, testing, and PR process.
- [DEPLOY.md]: personal deployment guide (not committed — delete after deployment).

### Account Deletion

- Account deletion must require zero owned active properties.
