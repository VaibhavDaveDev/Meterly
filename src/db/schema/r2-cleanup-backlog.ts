import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Backlog of R2 object keys that failed deletion during sweepOrphanedPropertyData.
 *
 * No FK to `properties` or `users`  by the time a key lands here the property
 * row is already gone. `propertyId` is stored for observability only.
 *
 * Drain contract: at the top of every sweepOrphanedPropertyData call,
 * up to 50 entries are drained (1 attempt each). Success removes the row.
 * Failure increments `attemptCount`. At 10 total attempts the key is logged
 * as a permanent orphan and the row is purged.
 */
export const r2CleanupBacklog = sqliteTable(
  "r2_cleanup_backlog",
  {
    id: text("id").primaryKey(),
    objectKey: text("object_key").notNull(),
    propertyId: text("property_id").notNull(), // logging only, no FK
    failedAt: integer("failed_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    attemptCount: integer("attempt_count").notNull().default(1),
  },
  (table) => [index("idx_r2_backlog_failed_at").on(table.failedAt)]
);
