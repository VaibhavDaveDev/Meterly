import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { getDb } from '../../db';
import { properties, tenancies, billingPeriods, notifications } from '../../db/schema';
import { and, eq } from 'drizzle-orm';
import type { Bindings } from '../app';
import { logger } from '../lib/logger';

const cronRouter = new OpenAPIHono<{ Bindings: Bindings }>();

const readingRemindersRoute = createRoute({
  method: 'get',
  path: '/reading-reminders',
  tags: ['Cron'],
  summary: 'Send reading reminders',
  security: [{ bearerAuth: [] }],
  request: {
    headers: z.object({
      authorization: z.string().openapi({ example: 'Bearer <your-cron-secret>' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            processed: z.number(),
            notificationsSent: z.number(),
          }),
        },
      },
      description: 'Reading reminders processed',
    },
    401: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Unauthorized',
    },
  },
});

cronRouter.openapi(readingRemindersRoute, async (c) => {
  const authHeader = c.req.header('Authorization');
  if (c.env.ENVIRONMENT === 'production' && authHeader !== `Bearer ${c.env.CRON_SECRET || 'dev-secret'}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = getDb(c.env.DB);
  const today = new Date();
  const currentDay = today.getDate(); // 1-31

  // Get previous month string in YYYY-MM-01 format
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthStr = prevMonthDate.toISOString().split('T')[0];

  // Match: billing period for previous month in draft status AND DAY(today) == property.reading_reminder_day
  const matchingProperties = await db.select({
    propertyId: properties.id,
    ownerId: properties.ownerId,
    propertyName: properties.name,
    periodId: billingPeriods.id,
  }).from(properties)
    .innerJoin(billingPeriods, eq(properties.id, billingPeriods.propertyId))
    .where(
      and(
        eq(properties.readingReminderDay, currentDay),
        eq(billingPeriods.periodMonth, prevMonthStr),
        eq(billingPeriods.status, 'draft')
      )
    );

  const notificationsToInsert = [];

  for (const match of matchingProperties) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days (or handled by global cleanup)

    // Owner notification
    notificationsToInsert.push({
      id: crypto.randomUUID(),
      userId: match.ownerId,
      type: 'reading_reminder' as const,
      title: 'Meter Readings Due',
      body: `Reminder: Readings for ${match.propertyName} are due today.`,
      metadata: JSON.stringify({ property_id: match.propertyId, billing_period_id: match.periodId }),
    });

    // Tenants notifications
    const activeTenants = await db.select().from(tenancies).where(
      and(
        eq(tenancies.propertyId, match.propertyId),
        eq(tenancies.status, 'active'),
        eq(tenancies.isOwnerTenancy, false)
      )
    );

    for (const tenant of activeTenants) {
      if (tenant.tenantId) {
        notificationsToInsert.push({
          id: crypto.randomUUID(),
          userId: tenant.tenantId,
          type: 'reading_reminder' as const,
          title: 'Meter Readings Due',
          body: `Reminder: Readings for ${match.propertyName} are due today.`,
          metadata: JSON.stringify({ property_id: match.propertyId, billing_period_id: match.periodId }),
        });
      }
    }
  }

  if (notificationsToInsert.length > 0) {
    await db.insert(notifications).values(notificationsToInsert);
  }

  logger.info({
    event: 'cron.reading_reminders',
    processed: matchingProperties.length,
    notificationsSent: notificationsToInsert.length,
  }, 'reading reminders cron completed');

  return c.json({
    success: true as const,
    processed: matchingProperties.length,
    notificationsSent: notificationsToInsert.length,
  }, 200);
});

export { cronRouter };
