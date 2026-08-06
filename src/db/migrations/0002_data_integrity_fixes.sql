-- 0002_data_integrity_fixes.sql
-- Fixes for data integrity.

-- 1. Pre-index duplicate cleanup.
--    No-ops on clean data; guards against rare bug-created duplicates
--    before unique indexes are applied.

-- Keep the newest billing period per (property_id, period_month).
DELETE FROM billing_periods
WHERE rowid NOT IN (
  SELECT MAX(rowid)
  FROM   billing_periods
  GROUP  BY property_id, period_month
);
--> statement-breakpoint

-- Keep the newest bill per (tenancy_id, billing_period_id).
DELETE FROM bills
WHERE rowid NOT IN (
  SELECT MAX(rowid)
  FROM   bills
  GROUP  BY tenancy_id, billing_period_id
);
--> statement-breakpoint

-- Keep the newest active tenancy per (tenant_id, property_id) where
-- the partial unique index applies.
DELETE FROM tenancies
WHERE status = 'active'
  AND tenant_id IS NOT NULL
  AND rowid NOT IN (
    SELECT MAX(rowid)
    FROM   tenancies
    WHERE  status = 'active'
      AND  tenant_id IS NOT NULL
    GROUP  BY tenant_id, property_id
  );
--> statement-breakpoint

-- 2. Named unique indexes for daily-counter tables.
--    Drizzle schema declares uniqueIndex("upload_daily_count_user_date_unique")
--    and uniqueIndex("reading_daily_count_user_date_unique").
CREATE UNIQUE INDEX IF NOT EXISTS upload_daily_count_user_date_unique
  ON upload_daily_count (user_id, date_key);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS reading_daily_count_user_date_unique
  ON reading_daily_count (user_id, date_key);
