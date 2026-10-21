import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import { getDb } from "../../db";
import {
  properties,
  tenancies,
  billingPeriods,
  notifications,
  otpRateLimit,
  passwordChangeLimit,
  uploadDailyCount,
  readingDailyCount,
} from "../../db/schema";
import { and, eq, lt } from "drizzle-orm";
import type { Bindings } from "../app";
import { logger } from "../lib/logger";

const cronRouter = new OpenAPIHono<{ Bindings: Bindings }>();

// clean helper to validate bearer token or X-Cron-Secret header
function checkCronAuth(
  authHeader: string | undefined,
  xCronSecret: string | undefined,
  cronSecret: string | undefined
): { ok: true } | { ok: false; status: 400 | 401; error: string } {
  if (!authHeader && !xCronSecret) {
    return { ok: false, status: 400, error: "Missing authorization header" };
  }
  if (!cronSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const isMatch =
    authHeader === `Bearer ${cronSecret}` || xCronSecret === cronSecret;
  if (!isMatch) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}

const CronHeadersSchema = z.object({
  authorization: z
    .string()
    .optional()
    .openapi({ example: "Bearer <your-cron-secret>" }),
  "x-cron-secret": z
    .string()
    .optional()
    .openapi({ example: "<your-cron-secret>" }),
});

const readingRemindersResponses = {
  200: {
    content: {
      "application/json": {
        schema: z.object({
          success: z.boolean(),
          processed: z.number(),
          notificationsSent: z.number(),
        }),
      },
    },
    description: "Reading reminders processed",
  },
  400: {
    content: {
      "application/json": { schema: z.object({ error: z.string() }) },
    },
    description: "Missing authorization header",
  },
  401: {
    content: {
      "application/json": { schema: z.object({ error: z.string() }) },
    },
    description: "Unauthorized",
  },
} as const;

const readingRemindersGetRoute = createRoute({
  method: "get",
  path: "/reading-reminders",
  tags: ["Cron"],
  summary: "Send reading reminders",
  security: [{ bearerAuth: [] }],
  request: {
    headers: CronHeadersSchema,
  },
  responses: readingRemindersResponses,
});

const readingRemindersPostRoute = createRoute({
  method: "post",
  path: "/reading-reminders",
  tags: ["Cron"],
  summary: "Send reading reminders (POST)",
  security: [{ bearerAuth: [] }],
  request: {
    headers: CronHeadersSchema,
  },
  responses: readingRemindersResponses,
});

const handleReadingReminders: RouteHandler<
  typeof readingRemindersGetRoute,
  { Bindings: Bindings }
> = async (c) => {
  const authHeader = c.req.header("authorization");
  const xCronSecret = c.req.header("x-cron-secret");
  const cronSecret = c.env.CRON_SECRET;
  const authCheck = checkCronAuth(authHeader, xCronSecret, cronSecret);
  if (!authCheck.ok) {
    return c.json({ error: authCheck.error }, authCheck.status);
  }

  const db = getDb(c.env.DB);
  const today = new Date();
  const currentDay = today.getDate(); // 1-31

  // Get previous month string in YYYY-MM-01 format
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthStr = prevMonthDate.toISOString().split("T")[0];

  // Match: billing period for previous month in draft status AND DAY(today) == property.reading_reminder_day
  const matchingProperties = await db
    .select({
      propertyId: properties.id,
      ownerId: properties.ownerId,
      propertyName: properties.name,
      periodId: billingPeriods.id,
    })
    .from(properties)
    .innerJoin(billingPeriods, eq(properties.id, billingPeriods.propertyId))
    .where(
      and(
        eq(properties.readingReminderDay, currentDay),
        eq(billingPeriods.periodMonth, prevMonthStr),
        eq(billingPeriods.status, "draft")
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
      type: "reading_reminder" as const,
      title: "Meter Readings Due",
      body: `Reminder: Readings for ${match.propertyName} are due today.`,
      metadata: JSON.stringify({
        property_id: match.propertyId,
        billing_period_id: match.periodId,
      }),
    });

    // Tenants notifications
    const activeTenants = await db
      .select()
      .from(tenancies)
      .where(
        and(
          eq(tenancies.propertyId, match.propertyId),
          eq(tenancies.status, "active"),
          eq(tenancies.isOwnerTenancy, false)
        )
      );

    for (const tenant of activeTenants) {
      if (tenant.tenantId) {
        notificationsToInsert.push({
          id: crypto.randomUUID(),
          userId: tenant.tenantId,
          type: "reading_reminder" as const,
          title: "Meter Readings Due",
          body: `Reminder: Readings for ${match.propertyName} are due today.`,
          metadata: JSON.stringify({
            property_id: match.propertyId,
            billing_period_id: match.periodId,
          }),
        });
      }
    }
  }

  if (notificationsToInsert.length > 0) {
    await db.insert(notifications).values(notificationsToInsert);
  }

  logger.info(
    {
      event: "cron.reading_reminders",
      processed: matchingProperties.length,
      notificationsSent: notificationsToInsert.length,
    },
    "reading reminders cron completed"
  );

  return c.json(
    {
      success: true as const,
      processed: matchingProperties.length,
      notificationsSent: notificationsToInsert.length,
    },
    200
  );
};

cronRouter.openapi(readingRemindersGetRoute, handleReadingReminders);
cronRouter.openapi(
  readingRemindersPostRoute,
  handleReadingReminders as RouteHandler<
    typeof readingRemindersPostRoute,
    { Bindings: Bindings }
  >
);

const cleanupRateLimitsResponses = {
  200: {
    content: {
      "application/json": {
        schema: z.object({
          success: z.boolean(),
          deleted: z.object({
            otpRateLimit: z.number(),
            passwordChangeLimit: z.number(),
            uploadDailyCount: z.number(),
            readingDailyCount: z.number(),
          }),
        }),
      },
    },
    description: "Stale rate-limit rows cleaned up",
  },
  400: {
    content: {
      "application/json": { schema: z.object({ error: z.string() }) },
    },
    description: "Missing authorization header",
  },
  401: {
    content: {
      "application/json": { schema: z.object({ error: z.string() }) },
    },
    description: "Unauthorized",
  },
} as const;

const cleanupRateLimitsGetRoute = createRoute({
  method: "get",
  path: "/cleanup-stale-rate-limits",
  tags: ["Cron"],
  summary: "Delete stale rate-limit rows from D1",
  security: [{ bearerAuth: [] }],
  request: {
    headers: CronHeadersSchema,
  },
  responses: cleanupRateLimitsResponses,
});

const cleanupRateLimitsPostRoute = createRoute({
  method: "post",
  path: "/cleanup-stale-rate-limits",
  tags: ["Cron"],
  summary: "Delete stale rate-limit rows from D1 (POST)",
  security: [{ bearerAuth: [] }],
  request: {
    headers: CronHeadersSchema,
  },
  responses: cleanupRateLimitsResponses,
});

const handleCleanupRateLimits: RouteHandler<
  typeof cleanupRateLimitsGetRoute,
  { Bindings: Bindings }
> = async (c) => {
  const authHeader = c.req.header("authorization");
  const xCronSecret = c.req.header("x-cron-secret");
  const cronSecret = c.env.CRON_SECRET;
  const authCheck = checkCronAuth(authHeader, xCronSecret, cronSecret);
  if (!authCheck.ok) {
    return c.json({ error: authCheck.error }, authCheck.status);
  }

  const db = getDb(c.env.DB);
  const now = new Date();

  // OTP rows: delete if last_sent_at older than 30 days
  const otpCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const otpResult = await db
    .delete(otpRateLimit)
    .where(lt(otpRateLimit.lastSentAt, otpCutoff))
    .returning({ id: otpRateLimit.id });

  // Password-change rows: delete if window_start older than 30 days
  const pwCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const pwResult = await db
    .delete(passwordChangeLimit)
    .where(lt(passwordChangeLimit.windowStart, pwCutoff))
    .returning({ id: passwordChangeLimit.id });

  // Upload counters: delete if date_key older than 2 days
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const uploadResult = await db
    .delete(uploadDailyCount)
    .where(lt(uploadDailyCount.dateKey, twoDaysAgo))
    .returning({ id: uploadDailyCount.id });

  // Reading counters: delete if date_key older than 2 days
  const readingResult = await db
    .delete(readingDailyCount)
    .where(lt(readingDailyCount.dateKey, twoDaysAgo))
    .returning({ id: readingDailyCount.id });

  const deleted = {
    otpRateLimit: otpResult.length,
    passwordChangeLimit: pwResult.length,
    uploadDailyCount: uploadResult.length,
    readingDailyCount: readingResult.length,
  };

  logger.info(
    { event: "cron.cleanup_rate_limits", deleted },
    "rate-limit cleanup cron completed"
  );

  return c.json({ success: true as const, deleted }, 200);
};

cronRouter.openapi(cleanupRateLimitsGetRoute, handleCleanupRateLimits);
cronRouter.openapi(
  cleanupRateLimitsPostRoute,
  handleCleanupRateLimits as RouteHandler<
    typeof cleanupRateLimitsPostRoute,
    { Bindings: Bindings }
  >
);

export { cronRouter };
