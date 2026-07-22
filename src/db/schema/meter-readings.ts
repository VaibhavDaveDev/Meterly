import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { billingPeriods } from './billing-periods';
import { user } from './auth';

export const meterReadings = sqliteTable('meter_readings', {
  id: text('id').primaryKey(),
  billingPeriodId: text('billing_period_id').references(() => billingPeriods.id).unique().notNull(),
  solarGenerationStart: real('solar_generation_start').default(0),
  solarGenerationEnd: real('solar_generation_end').notNull(),
  exportStart: real('export_start').default(0),
  exportEnd: real('export_end').notNull(),
  importStart: real('import_start').default(0),
  importEnd: real('import_end').notNull(),
  submittedBy: text('submitted_by').references(() => user.id).notNull(),
  version: integer('version').default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});
