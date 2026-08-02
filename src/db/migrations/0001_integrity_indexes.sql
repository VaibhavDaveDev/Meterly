-- 1a. UNIQUE constraint: one billing period per property per month.
--     Replaces the plain index so the DB engine rejects a second row
--     for the same (propertyId, periodMonth) pair, not just the code.
DROP INDEX IF EXISTS idx_billing_periods_property_month;
--> statement-breakpoint
CREATE UNIQUE INDEX idx_billing_periods_property_month
  ON billing_periods (property_id, period_month);
--> statement-breakpoint

-- 1b. UNIQUE constraint: one bill per tenancy per billing period.
--     Recalculation always deletes before re-inserting, so this is
--     safe. The index makes the invariant enforcement database-level.
DROP INDEX IF EXISTS idx_bills_tenancy_period;
--> statement-breakpoint
CREATE UNIQUE INDEX idx_bills_tenancy_period
  ON bills (tenancy_id, billing_period_id);
--> statement-breakpoint

-- 1c. UNIQUE constraint: prevent duplicate active tenancies.
--     Only one row with status='active' may exist for a given
--     (tenant_id, property_id) pair. NULL tenant_id rows (invited
--     but not yet joined) are excluded via WHERE to allow multiple
--     pending invites for the same email across properties.
--     SQLite partial indexes use a WHERE clause for this.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenancies_active_unique
  ON tenancies (tenant_id, property_id)
  WHERE status = 'active' AND tenant_id IS NOT NULL;
--> statement-breakpoint

-- 1d. Performance indexes for high-frequency FK lookups.
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties (owner_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_property_rates_property ON property_rates (property_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_custom_charges_property ON custom_charges (property_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_edit_requests_period ON edit_requests (billing_period_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_edit_requests_status ON edit_requests (status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_meter_reading_edits_reading ON meter_reading_edits (meter_reading_id);
--> statement-breakpoint

-- 1e. Atomic counter tables for daily rate limiting.
--     upload_daily_count: one row per (user_id, date_key).
--       date_key is 'YYYY-MM-DD' in UTC. The UNIQUE constraint
--       on (user_id, date_key) lets INSERT OR IGNORE + UPDATE be
--       used as an atomic increment (no read-then-write).
CREATE TABLE IF NOT EXISTS upload_daily_count (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  date_key  TEXT NOT NULL,          -- 'YYYY-MM-DD'
  count     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, date_key)
);
--> statement-breakpoint

--     reading_daily_count: same shape for meter-reading submissions.
CREATE TABLE IF NOT EXISTS reading_daily_count (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  date_key  TEXT NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, date_key)
);
