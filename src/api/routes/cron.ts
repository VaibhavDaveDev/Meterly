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
  user,
  verification,
} from "../../db/schema";
import { and, eq, inArray, lt, ne } from "drizzle-orm";
import type { Bindings } from "../app";
import { logger } from "../lib/logger";
import { ErrorResponse, createSuccessResponse } from "../lib/openapi-schemas";

const cronRouter = new OpenAPIHono<{ Bindings: Bindings }>();

// clean helper to validate bearer token or X-Cron-Secret header
function checkCronAuth(
  authHeader: string | undefined,
  xCronSecret: string | undefined,
  cronSecret: string | undefined
):
  | { ok: true }
  | { ok: false; status: 400 | 401; code: string; error: string } {
  if (!authHeader && !xCronSecret) {
    return {
      ok: false,
      status: 400,
      code: "BAD_REQUEST",
      error: "Missing authorization header",
    };
  }
  if (!cronSecret) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      error: "Unauthorized",
    };
  }
  const isMatch =
    authHeader === `Bearer ${cronSecret}` || xCronSecret === cronSecret;
  if (!isMatch) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      error: "Unauthorized",
    };
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
        schema: createSuccessResponse(
          z.object({
            processed: z.number().openapi({ example: 3 }),
            notificationsSent: z.number().openapi({ example: 6 }),
          })
        ),
      },
    },
    description: "Reading reminders processed",
  },
  400: {
    content: {
      "application/json": { schema: ErrorResponse },
    },
    description: "Missing authorization header",
  },
  401: {
    content: {
      "application/json": { schema: ErrorResponse },
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
    return c.json(
      {
        success: false as const,
        error: { code: authCheck.code, message: authCheck.error },
      },
      authCheck.status
    );
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
      data: {
        processed: matchingProperties.length,
        notificationsSent: notificationsToInsert.length,
      },
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
        schema: createSuccessResponse(
          z.object({
            deleted: z.object({
              otpRateLimit: z.number().openapi({ example: 5 }),
              passwordChangeLimit: z.number().openapi({ example: 2 }),
              uploadDailyCount: z.number().openapi({ example: 10 }),
              readingDailyCount: z.number().openapi({ example: 3 }),
            }),
          })
        ),
      },
    },
    description: "Stale rate-limit rows cleaned up",
  },
  400: {
    content: {
      "application/json": { schema: ErrorResponse },
    },
    description: "Missing authorization header",
  },
  401: {
    content: {
      "application/json": { schema: ErrorResponse },
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
    return c.json(
      {
        success: false as const,
        error: { code: authCheck.code, message: authCheck.error },
      },
      authCheck.status
    );
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

  return c.json({ success: true as const, data: { deleted } }, 200);
};

cronRouter.openapi(cleanupRateLimitsGetRoute, handleCleanupRateLimits);
cronRouter.openapi(
  cleanupRateLimitsPostRoute,
  handleCleanupRateLimits as RouteHandler<
    typeof cleanupRateLimitsPostRoute,
    { Bindings: Bindings }
  >
);

// ─── Purge Unverified Accounts ───────────────────────────────────────────────

const purgeUnverifiedResponses = {
  200: {
    content: {
      "application/json": {
        schema: createSuccessResponse(
          z.object({
            deleted: z.object({
              users: z.number().openapi({ example: 3 }),
              otpVerifications: z.number().openapi({ example: 3 }),
              softDeletedTenancies: z.number().openapi({ example: 1 }),
            }),
          })
        ),
      },
    },
    description: "Stale unverified accounts purged",
  },
  400: {
    content: {
      "application/json": { schema: ErrorResponse },
    },
    description: "Invalid configuration or missing authorization header",
  },
  401: {
    content: {
      "application/json": { schema: ErrorResponse },
    },
    description: "Unauthorized",
  },
} as const;

const purgeUnverifiedGetRoute = createRoute({
  method: "get",
  path: "/purge-unverified-accounts",
  tags: ["Cron"],
  summary:
    "Delete stale unverified user accounts (no email verification after TTL)",
  security: [{ bearerAuth: [] }],
  request: { headers: CronHeadersSchema },
  responses: purgeUnverifiedResponses,
});

const purgeUnverifiedPostRoute = createRoute({
  method: "post",
  path: "/purge-unverified-accounts",
  tags: ["Cron"],
  summary: "Delete stale unverified user accounts (POST)",
  security: [{ bearerAuth: [] }],
  request: { headers: CronHeadersSchema },
  responses: purgeUnverifiedResponses,
});

const handlePurgeUnverified: RouteHandler<
  typeof purgeUnverifiedGetRoute,
  { Bindings: Bindings }
> = async (c) => {
  const authHeader = c.req.header("authorization");
  const xCronSecret = c.req.header("x-cron-secret");
  const cronSecret = c.env.CRON_SECRET;
  const authCheck = checkCronAuth(authHeader, xCronSecret, cronSecret);
  if (!authCheck.ok) {
    return c.json(
      {
        success: false as const,
        error: { code: authCheck.code, message: authCheck.error },
      },
      authCheck.status
    );
  }

  const db = getDb(c.env.DB);

  // TTL: default 48 hours, configurable via env
  // finite positive integer check prevents negative cutoff or partial parse ("2oops")
  const rawTtl = c.env.UNVERIFIED_ACCOUNT_TTL_HOURS;
  let ttlHours = 48; // default
  if (rawTtl !== undefined && rawTtl !== "") {
    const parsed = Number(rawTtl);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
      return c.json(
        {
          success: false as const,
          error: {
            code: "INVALID_CONFIG",
            message: `UNVERIFIED_ACCOUNT_TTL_HOURS must be a positive integer, got: "${rawTtl}"`,
          },
        },
        400
      );
    }
    ttlHours = parsed;
  }
  const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);

  // ponytail: Atomic purge via D1 batch with subqueries.
  // 1. Rechecks eligibility (emailVerified != true AND createdAt < cutoff) across all queries concurrently.
  // 2. Subqueries eliminate client-side array chunking and stay well under D1's 100-parameter limit (7 total params).
  // 3. Execution order (verifications -> tenancies soft-delete -> users delete) resolves the NO ACTION FK
  //    before user deletion, while db.batch guarantees all-or-nothing rollback if any step fails.
  const eligibleUserIds = db
    .select({ id: user.id })
    .from(user)
    .where(and(ne(user.emailVerified, true), lt(user.createdAt, cutoff)));

  const eligibleUserEmails = db
    .select({ email: user.email })
    .from(user)
    .where(and(ne(user.emailVerified, true), lt(user.createdAt, cutoff)));

  const [verResult, tenResult, userResult] = await db.batch([
    db
      .delete(verification)
      .where(inArray(verification.identifier, eligibleUserEmails))
      .returning({ id: verification.id }),
    db
      .update(tenancies)
      .set({ tenantId: null, deletedByTenantAt: new Date() })
      .where(inArray(tenancies.tenantId, eligibleUserIds))
      .returning({ id: tenancies.id }),
    db
      .delete(user)
      .where(and(ne(user.emailVerified, true), lt(user.createdAt, cutoff)))
      .returning({ id: user.id, email: user.email }),
  ]);

  const deleted = {
    users: (userResult as { id: string }[]).length,
    otpVerifications: (verResult as { id: string }[]).length,
    softDeletedTenancies: (tenResult as { id: string }[]).length,
  };

  logger.info(
    {
      event: "cron.purge_unverified_accounts",
      deleted,
      ttlHours,
    },
    "purge unverified accounts cron completed"
  );

  return c.json({ success: true as const, data: { deleted } }, 200);
};

cronRouter.openapi(purgeUnverifiedGetRoute, handlePurgeUnverified);
cronRouter.openapi(
  purgeUnverifiedPostRoute,
  handlePurgeUnverified as RouteHandler<
    typeof purgeUnverifiedPostRoute,
    { Bindings: Bindings }
  >
);

export { cronRouter };
