import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

export const properties = sqliteTable('properties', {
  id: text('id').primaryKey(), // UUID
  ownerId: text('owner_id').references(() => user.id).notNull(),
  name: text('name').notNull(),
  address: text('address'),
  hasSolar: integer('has_solar', { mode: 'boolean' }).default(false),
  solarGenInitial: real('solar_gen_initial').default(0),
  solarExportInitial: real('solar_export_initial').default(0),
  solarActivatedAt: integer('solar_activated_at', { mode: 'timestamp' }),
  paymentTrackingEnabled: integer('payment_tracking_enabled', { mode: 'boolean' }).default(true),
  readingsRequireApproval: integer('readings_require_approval', { mode: 'boolean' }).default(false),
  maxPendingEditRequests: integer('max_pending_edit_requests').default(3),
  readingReminderDay: integer('reading_reminder_day').default(5),
  // Solo mode: owner tracks their own bills without tenants
  soloMode: integer('solo_mode', { mode: 'boolean' }).default(false),
  soloModeChangedAt: integer('solo_mode_changed_at', { mode: 'timestamp' }), // timestamp of last solo_mode toggle, used for timeline mode-change marker
  importInitial: real('import_initial'), // Starting reading for import meter when solar is enabled
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
  meterMaxReading: integer('meter_max_reading').default(10000000), // e.g. 10M rollover
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});
