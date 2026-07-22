import type { properties, tenancies, bills, billingPeriods } from '../db/schema';

export type Property = typeof properties.$inferSelect;
export type Tenancy = typeof tenancies.$inferSelect & { tenantName?: string | null };
export type Bill = typeof bills.$inferSelect;
export type BillingPeriod = typeof billingPeriods.$inferSelect;
