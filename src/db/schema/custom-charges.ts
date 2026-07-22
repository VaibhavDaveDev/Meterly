import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { properties } from './properties';

export const customCharges = sqliteTable('custom_charges', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  chargedToTenant: integer('charged_to_tenant', { mode: 'boolean' }).default(true),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});
