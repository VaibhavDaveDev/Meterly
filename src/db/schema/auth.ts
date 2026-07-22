import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  theme: text('theme', { enum: ['light', 'dark', 'system'] }).default('system'),
  primaryRole: text('primary_role', { enum: ['owner', 'tenant', 'both'] }),
  onboardingCompletedAt: integer('onboarding_completed_at', { mode: 'timestamp' }),
  onboardingChecklist: text('onboarding_checklist', { mode: 'json' }), // stores JSON like { property: true, solar: true, tenant: true, rates: false }
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  index('idx_session_user_created').on(table.userId, table.createdAt),
]);

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const otpRateLimit = sqliteTable('otp_rate_limit', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  attempts: integer('attempts').notNull().default(0),
  lastSentAt: integer('last_sent_at', { mode: 'timestamp' }).notNull(),
});

export const passwordChangeLimit = sqliteTable('password_change_limit', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  count: integer('count').notNull().default(0),
  windowStart: integer('window_start', { mode: 'timestamp' }).notNull(),
});

