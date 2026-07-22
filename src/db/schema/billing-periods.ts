import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { properties } from './properties';
import { user } from './auth';

export const billingPeriods = sqliteTable('billing_periods', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  periodMonth: text('period_month').notNull(), // DATE ISO string (1st of month)
  calculationMode: text('calculation_mode', { enum: ['solar', 'grid_only'] }).notNull(),
  status: text('status', { enum: ['draft', 'pending_approval', 'submitted', 'confirmed'] }).notNull(),
  submittedBy: text('submitted_by').references(() => user.id),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }),
  confirmedBy: text('confirmed_by').references(() => user.id),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
  rateOverride: text('rate_override'), // JSON: { consumptionRate: number; exportRate?: number; reason: string; changedBy: string; changedAt: Date }
  oneOffCharges: text('one_off_charges'), // JSON: Array<{ name: string; amount: number; chargedToTenant: boolean }>
}, (table) => [
  index('idx_billing_periods_property_month').on(table.propertyId, table.periodMonth),
]);
