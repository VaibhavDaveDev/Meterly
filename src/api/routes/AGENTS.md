# Purpose

API route handlers for the Meterly application, organized by resource.

# Ownership

API and Backend developers.

# Local Contracts

- Route handlers must use Hono.
- Input validation via Zod is mandatory.
- Middleware (like `authMiddleware`) must be used for protected routes.
- Tenancy records must NEVER be hard-deleted by route handlers — always soft-delete via `status='inactive'`, `status='property_deleted'`, or `deletedByTenantAt`. The only exception is `sweepOrphanedPropertyData`, which purges tenancy rows after the owner deleted the property AND every real tenant deleted their record.
- Invite tokens are one-time-use; nulled on accept/decline/cancel.
- **Property delete cascade (DELETE /:id):** On owner delete, immediately hard-delete: `edit_requests` → `meter_reading_edits` → `custom_charges` → `property_rates` → `notifications`, then soft-delete tenancies to `status='property_deleted'`, then delete the property row. Do NOT immediately delete `bills`, `billing_periods`, or `bill_photos` — these form permanent tenant billing history. After the immediate cascade, call `sweepOrphanedPropertyData` via `waitUntil` (non-blocking); it purges R2 objects and hard-deletes all retained history only once every real tenant has a non-null `deletedByTenantAt`. Never call `db.delete(properties)` alone — SQLite FKs are disabled at the Drizzle level.

# Work Guidance

- Keep route handlers focused on orchestration; move heavy logic to `src/api/lib`.
- Follow the standard API response envelope defined in `Plan.md`.
- Ensure relevant routes (like reading submissions or edit approvals) trigger notifications via `createNotification`.
- `invites.ts`: full invite lifecycle (pending/accept/decline/cancel). Token lookup resolves tenancy; status guards prevent double-use.
- `uploads.ts`: POST /api/uploads/bill-photo — multipart WebP upload to R2 with D1 database rate-limiting (10/user/day). GET /api/uploads/bill-photo/\* — streams the object from R2; enforces userId prefix ownership. Never serve a key that does not start with the requesting user's ID.
- `tenancies.ts`: owner-facing grouped view (active/invited/past) and soft-remove. Calls `reconcileSplitsAfterRemoval` after every removal.
- `tenancy-actions.ts`: tenant-facing actions (accept invite, leave property, archive/unarchive visibility, and explicit permanent deletion `DELETE /{id}`).
- `properties.ts`: solo mode toggle at `PATCH /:id/mode`; create with `soloMode: true` auto-creates owner tenancy. Archive/unarchive at `PATCH /:id/archive` and `PATCH /:id/unarchive`. Full cascade delete at `DELETE /:id`.
- `edit-requests.ts`: implements tenant-facing reading correction request creation and owner-facing approval/rejection review flows, with a dedicated unit test suite at `edit-requests.test.ts`.
- **Health Checks**: Liveness checks (`/api/healthz`, `/api/ping`) perform a shallow check immediately returning `200 OK` (verifies the server runtime hasn't crashed). Readiness checks (`/api/readyz`, `/api/status`, and backward compatible `/api/health`) perform a deep check verifying connectivity to the D1 database.
