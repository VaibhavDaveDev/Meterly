import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { meterReadings } from './meter-readings';
import { user } from './auth';

export const meterReadingEdits = sqliteTable('meter_reading_edits', {
  id: text('id').primaryKey(),
  meterReadingId: text('meter_reading_id').references(() => meterReadings.id).notNull(),
  editedBy: text('edited_by').references(() => user.id).notNull(),
  reason: text('reason').notNull(),
  oldValues: text('old_values').notNull(), // JSON string
  newValues: text('new_values').notNull(), // JSON string
  versionBefore: integer('version_before').notNull(),
  versionAfter: integer('version_after').notNull(),
  affectedPeriods: text('affected_periods'), // JSON string array of IDs
  editedAt: integer('edited_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});
