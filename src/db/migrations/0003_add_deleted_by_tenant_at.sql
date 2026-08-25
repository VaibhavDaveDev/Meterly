-- 0003_add_deleted_by_tenant_at.sql
-- Add deleted_by_tenant_at to tenancies table for explicit tenant deletion
ALTER TABLE `tenancies` ADD `deleted_by_tenant_at` integer;

--> statement-breakpoint
-- Add r2_cleanup_backlog: persists R2 object keys that failed deletion during
-- sweepOrphanedPropertyData so they can be retried on the next sweep call.
-- No FK to properties/users — by the time a key lands here, the property row is gone.
CREATE TABLE `r2_cleanup_backlog` (
  `id` text PRIMARY KEY NOT NULL,
  `object_key` text NOT NULL,
  `property_id` text NOT NULL,
  `failed_at` integer NOT NULL DEFAULT (strftime('%s', 'now')),
  `attempt_count` integer NOT NULL DEFAULT 1
);

--> statement-breakpoint
CREATE INDEX `idx_r2_backlog_failed_at` ON `r2_cleanup_backlog` (`failed_at`);
