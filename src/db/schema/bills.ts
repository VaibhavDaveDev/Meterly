import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { billingPeriods } from './billing-periods';
import { tenancies } from './tenancies';
import { user } from './auth';

export const bills = sqliteTable('bills', {
  id: text('id').primaryKey(),
  billingPeriodId: text('billing_period_id').references(() => billingPeriods.id).notNull(),
  tenancyId: text('tenancy_id').references(() => tenancies.id).notNull(),

  // Property meter deltas
  solarGenerated: real('solar_generated'),
  gridExported: real('grid_exported'),
  gridImported: real('grid_imported'),
  solarSelfConsumed: real('solar_self_consumed'),
  totalConsumption: real('total_consumption'),

  // Tenant share
  splitPercentage: real('split_percentage'),
  tenantConsumption: real('tenant_consumption'),

  // Rates & Costs
  consumptionRate: real('consumption_rate'),
  consumptionCost: real('consumption_cost'),
  exportRate: real('export_rate'),
  exportRefund: real('export_refund'),
  customChargesJson: text('custom_charges_json'), // JSON string
  customChargesTotal: real('custom_charges_total'),

  totalDue: real('total_due'),

  // Payment
  status: text('status', { enum: ['pending', 'paid'] }).default('pending').notNull(),
  markedPaidAt: integer('marked_paid_at', { mode: 'timestamp' }),
  markedPaidBy: text('marked_paid_by').references(() => user.id),

  // Audit
  snapshotPropertyName: text('snapshot_property_name'),
  snapshotPropertyAddress: text('snapshot_property_address'),
  recalculatedAt: integer('recalculated_at', { mode: 'timestamp' }),
  recalculationCount: integer('recalculation_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index('idx_bills_tenancy_period').on(table.tenancyId, table.billingPeriodId),
]);
