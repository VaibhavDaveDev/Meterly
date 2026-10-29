# API Routes DOX

## Purpose

- API route handlers for the Meterly application, organized by resource domain.

## Ownership

- `properties.ts` owns property CRUD, solo-mode toggle (`PATCH /:id/mode`), archive/unarchive, and owner deletion cascade orchestration (`DELETE /:id`).
- `tenancies.ts` owns owner-facing tenancy queries (active/invited/past) and soft-removal with split reconciliation.
- `tenancy-actions.ts` owns tenant-facing actions (accept invite, leave property, archive/restore visibility, and tenant-side permanent delete).
- `invites.ts` owns tenant invitation token lifecycle (creation, validation, one-time acceptance, decline, cancellation).
- `uploads.ts` owns bill photo uploads to R2 with daily upload rate limiting and authorized photo streaming.
- `edit-requests.ts` owns reading correction request submissions, throttle checks, and owner approval/rejection review flows.
- `cron.ts` owns external cron job endpoints secured by `CRON_SECRET` (`reading-reminders`, `cleanup-stale-rate-limits`, `purge-unverified-accounts`).
- `health.ts` owns liveness (`/healthz`, `/ping`) and readiness (`/readyz`, `/status`, `/health`) probes.
- `bills.ts`, `meter-readings.ts`, `rates.ts`, `notifications.ts`, `users.ts` own domain-specific resource endpoints.

## Local Contracts

- Route handlers must use Hono and register endpoints via `router.openapi()`.
- Input validation via Zod is mandatory.
- Middleware (`authMiddleware`) must be applied to all protected routes.
- Tenancy records must NEVER be hard-deleted directly by route handlers — soft-delete via `status='inactive'`, `status='property_deleted'`, or `deletedByTenantAt`. Permanent deletion is handled only by `sweepOrphanedPropertyData`.
- Invite tokens are one-time-use; nulled on accept/decline/cancel.
- Property delete cascade: On owner delete, immediately hard-delete `meter_reading_edits` -> `edit_requests` -> `custom_charges` -> `property_rates` -> `notifications`, soft-delete tenancies, and delete property row. Retain billing history (`billing_periods`, `meter_readings`, `bills`, `bill_photos`) and delegate full sweep to `sweepOrphanedPropertyData` via `waitUntil`.
- `sweepOrphanedPropertyData` may permanently delete retained billing history only after the property row is gone AND every real tenant (`isOwnerTenancy = false`) has a non-null `deletedByTenantAt`. Solo-mode properties sweep immediately on owner delete.

## Work Guidance

- Keep route handlers focused on orchestration (validate -> authorize -> call lib -> return envelope).
- Ensure relevant mutations trigger notifications via `createNotification`.

## Verification

```bash
pnpm test --run src/api/routes
```

## Child DOX Index

No child DOX files.
