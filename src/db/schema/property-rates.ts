import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { properties } from './properties';
import { user } from './auth';

export const propertyRates = sqliteTable('property_rates', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  consumptionRate: real('consumption_rate').notNull(), // ₹/unit
  exportRate: real('export_rate').notNull(), // ₹/unit

  effectiveFrom: text('effective_from').notNull(), // DATE ISO string
  createdBy: text('created_by').references(() => user.id).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});
