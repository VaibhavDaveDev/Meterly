import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { properties } from './properties';
import { user } from './auth';

export const tenancies = sqliteTable('tenancies', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  tenantId: text('tenant_id').references(() => user.id), // Nullable during invitation
  inviteEmail: text('invite_email'), // Email to invite
  inviteToken: text('invite_token').unique(), // Token for acceptance
  // 'declined' = tenant explicitly refused the invite
  // 'property_deleted' = owner deleted property, kept for tenant history
  status: text('status', { enum: ['invited', 'active', 'inactive', 'declined', 'property_deleted'] }).notNull(),
  splitPercentage: real('split_percentage'), // null = equal split auto-computed

  // Solo mode: marks the auto-created tenancy where the owner is their own "tenant"
  isOwnerTenancy: integer('is_owner_tenancy', { mode: 'boolean' }).default(false),

  // Lifecycle timestamps
  invitedAt: integer('invited_at', { mode: 'timestamp' }),
  inviteExpiresAt: integer('invite_expires_at', { mode: 'timestamp' }), // 7 days from invitedAt
  joinedAt: integer('joined_at', { mode: 'timestamp' }),
  leftAt: integer('left_at', { mode: 'timestamp' }),
  declinedAt: integer('declined_at', { mode: 'timestamp' }), // when tenant declined the invite
  archivedByTenantAt: integer('archived_by_tenant_at', { mode: 'timestamp' }),

  // Reason recorded when a tenant is removed by owner
  removalReason: text('removal_reason', { enum: ['moved_out', 'lease_ended', 'evicted', 'other'] }),
}, (table) => [
  index('idx_tenancies_property_status').on(table.propertyId, table.status),
]);
