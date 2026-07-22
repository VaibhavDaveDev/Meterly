import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id).notNull(),
  type: text('type', {
    enum: [
      'readings_submitted',
      'reading_pending_approval',
      'reading_approved',
      'reading_rejected',
      'bill_ready',
      'tenant_accepted',
      'edit_request_raised',
      'edit_approved',
      'edit_rejected',
      'rate_changed',
      'charge_added',
      'charge_updated',
      'payment_received',
      'payment_reminder',
      'reading_reminder',
      'bill_generated',
      'system',
    ],
  }).notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  metadata: text('metadata'), // JSON string
  readAt: integer('read_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index('idx_notifications_user_created').on(table.userId, table.createdAt),
]);
