import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq, and, desc, lt, lte, asc, gt, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  properties,
  billingPeriods,
  meterReadings,
  propertyRates,
  customCharges,
  tenancies,
  meterReadingEdits,
  editRequests,
  bills,
} from "../../db/schema";
import { user as userTable } from "../../db/schema/auth";
import { authMiddleware } from "../middleware/auth";
import { generateAndSaveBills } from "../lib/bill-generation";
import { recalculateChain } from "../lib/recalculation";
import { createNotification } from "../lib/notifications";
import { formatCurrency } from "../../lib/format";
import type { Bindings, Variables } from "../app";

import type { Database } from "../../db";
import type { Property, BillingPeriod } from "../../types/db";
import { SuccessResponse, MessageResponse, ErrorResponse, IdParam } from "../lib/openapi-schemas";

const readingsRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

readingsRouter.use('*', authMiddleware);

async function resolveAndValidateStartValues(
  db: Database,
  property: Property,
  period: BillingPeriod,
  data: {
    allowRollover?: boolean;
    importEnd: number;
    solarGenerationEnd?: number;
    exportEnd?: number;
  }
) {
  const [previousPeriod] = await db
    .select()
    .from(billingPeriods)
    .where(
      and(
        eq(billingPeriods.propertyId, period.propertyId),
        lt(billingPeriods.periodMonth, period.periodMonth)
      )
    )
    .orderBy(desc(billingPeriods.periodMonth))
    .limit(1);

  let startValues = {
    solarGenerationStart: property.solarGenInitial || 0,
    exportStart: property.solarExportInitial || 0,
    importStart: 0,
  };

  if (previousPeriod) {
    const [prevReading] = await db
      .select()
      .from(meterReadings)
      .where(eq(meterReadings.billingPeriodId, previousPeriod.id))
      .limit(1);
    if (prevReading) {
      startValues = {
        solarGenerationStart: prevReading.solarGenerationEnd,
        exportStart: prevReading.exportEnd,
        importStart: prevReading.importEnd,
      };
    }
  }

  if (!data.allowRollover) {
    if (data.importEnd < startValues.importStart) {
      return {
        error: {
          code: "READING_BELOW_PREVIOUS",
          message: "Import reading cannot be lower than the previous reading",
        },
      };
    }
    if (property.hasSolar) {
      if (
        data.solarGenerationEnd !== undefined &&
        data.solarGenerationEnd < startValues.solarGenerationStart
      ) {
        return {
          error: {
            code: "READING_BELOW_PREVIOUS",
            message:
              "Solar Generation reading cannot be lower than the previous reading",
          },
        };
      }
      if (
        data.exportEnd !== undefined &&
        data.exportEnd < startValues.exportStart
      ) {
        return {
          error: {
            code: "READING_BELOW_PREVIOUS",
            message: "Export reading cannot be lower than the previous reading",
          },
        };
      }
    }
  }

  return { startValues };
}

const SubmitReadingSchema = z.object({
  solarGenerationEnd: z.number().min(0).default(0),
  exportEnd: z.number().min(0).default(0),
  importEnd: z.number().min(0),
  allowRollover: z.boolean().optional(),
  oneOffCharges: z
    .array(
      z.object({
        name: z.string(),
        amount: z.number(),
        chargedToTenant: z.boolean(),
      })
    )
    .optional(),
});

const getPeriodContextRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Meter Readings'],
  summary: 'Get full context for the Meter Reading page',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Context retrieved',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Period not found',
    },
  },
});

readingsRouter.openapi(getPeriodContextRoute, async (c) => {
  const { id: periodId } = c.req.valid('param');
  const user = c.get("user");
  const db = getDb(c.env.DB);

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, periodId))
    .limit(1);
  if (!period) {
    return c.json(
      {
        success: false as const,
        error: { code: "NOT_FOUND", message: "Period not found" },
      },
      404
    );
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, period.propertyId))
    .limit(1);

  const isOwner = property.ownerId === user.id;
  const [tenancy] = await db
    .select()
    .from(tenancies)
    .where(
      and(
        eq(tenancies.propertyId, property.id),
        eq(tenancies.tenantId, user.id)
      )
    )
    .limit(1);
  const isTenant = !!tenancy;

  if (!isOwner && !isTenant) {
    return c.json(
      {
        success: false as const,
        error: { code: "UNAUTHORIZED", message: "Access denied" },
      },
      403
    );
  }

  // Determine start values
  let startValues = {
    solarGenerationStart: property.solarGenInitial || 0,
    exportStart: property.solarExportInitial || 0,
    importStart: 0,
  };

  const [previousPeriod] = await db
    .select()
    .from(billingPeriods)
    .where(
      and(
        eq(billingPeriods.propertyId, period.propertyId),
        lt(billingPeriods.periodMonth, period.periodMonth)
      )
    )
    .orderBy(desc(billingPeriods.periodMonth))
    .limit(1);

  if (previousPeriod) {
    const [prevReading] = await db
      .select()
      .from(meterReadings)
      .where(eq(meterReadings.billingPeriodId, previousPeriod.id))
      .limit(1);
    if (prevReading) {
      startValues = {
        solarGenerationStart: prevReading.solarGenerationEnd,
        exportStart: prevReading.exportEnd,
        importStart: prevReading.importEnd,
      };
    }
  }

  // Determine current rates
  const [rate] = await db
    .select()
    .from(propertyRates)
    .where(
      and(
        eq(propertyRates.propertyId, period.propertyId),
        lte(propertyRates.effectiveFrom, period.periodMonth)
      )
    )
    .orderBy(desc(propertyRates.effectiveFrom))
    .limit(1);

  const resolvedRate = (() => {
    if (period.rateOverride) {
      try {
        const override = JSON.parse(period.rateOverride);
        return {
          id: "override",
          propertyId: period.propertyId,
          effectiveFrom: period.periodMonth,
          consumptionRate: override.consumptionRate,
          exportRate: override.exportRate ?? rate?.exportRate ?? 0,
          createdAt: override.changedAt
            ? new Date(override.changedAt)
            : new Date(),
          updatedAt: override.changedAt
            ? new Date(override.changedAt)
            : new Date(),
        };
      } catch (e) {
        console.error(
          "Failed to parse rateOverride in GET /api/periods/:id",
          e
        );
        return rate || null;
      }
    } else {
      return rate || null;
    }
  })();

  // Active tenancy split (simplified for MVP: just get the user's split if tenant, or 100 if owner)
  let activeTenancySplit = 100;
  if (isTenant && tenancy.splitPercentage) {
    activeTenancySplit = tenancy.splitPercentage;
  } else if (isTenant) {
    // calculate auto split if null
    const activeTenancies = await db
      .select()
      .from(tenancies)
      .where(
        and(
          eq(tenancies.propertyId, property.id),
          eq(tenancies.status, "active")
        )
      );
    const explicit = activeTenancies.filter((t) => t.splitPercentage !== null);
    const nullCount = activeTenancies.length - explicit.length;
    const remaining =
      100 - explicit.reduce((sum, t) => sum + (t.splitPercentage || 0), 0);
    activeTenancySplit = nullCount === 0 ? 0 : remaining / nullCount;
  }

  // Existing reading
  const [existingReading] = await db
    .select()
    .from(meterReadings)
    .where(eq(meterReadings.billingPeriodId, periodId))
    .limit(1);

  let submittedByName = "Unknown";
  if (existingReading?.submittedBy) {
    const [submitter] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, existingReading.submittedBy))
      .limit(1);
    submittedByName = submitter?.name || "Unknown";
  }

  // Edit history
  const editHistoryRows = existingReading
    ? await db
        .select()
        .from(meterReadingEdits)
        .where(eq(meterReadingEdits.meterReadingId, existingReading.id))
        .orderBy(desc(meterReadingEdits.editedAt))
    : [];

  // Pending edit requests count
  // We'll stub this out for now, Section 6 handles edit requests properly.
  const pendingEditRequests = 0;

  const canSubmit =
    period.status === "draft" &&
    (isOwner || !property.readingsRequireApproval || isTenant);
  const canEdit =
    isOwner && (period.status === "submitted" || period.status === "draft");
  const canRequestEdit = isTenant && period.status === "confirmed";

  return c.json({
    success: true as const,
    data: {
      period,
      property: {
        id: property.id,
        name: property.name,
        address: property.address,
        hasSolar: property.hasSolar,
        readingsRequireApproval: property.readingsRequireApproval,
      },
      startValues,
      currentRates: resolvedRate || null,
      activeTenancySplit,
      existingReading: existingReading
        ? {
            solarGenerationEnd: existingReading.solarGenerationEnd,
            exportEnd: existingReading.exportEnd,
            importEnd: existingReading.importEnd,
            submittedByName,
            submittedAt: period.submittedAt,
            version: existingReading.version || 1,
          }
        : null,
      editHistory: editHistoryRows,
      isOwner,
      isTenant,
      canSubmit,
      canEdit,
      canRequestEdit,
      pendingEditRequests,
      tenancyId: tenancy?.id || null,
      allPeriods: await db
        .select({
          id: billingPeriods.id,
          periodMonth: billingPeriods.periodMonth,
          status: billingPeriods.status,
        })
        .from(billingPeriods)
        .where(eq(billingPeriods.propertyId, period.propertyId))
        .orderBy(desc(billingPeriods.periodMonth)),
    },
  }, 200);
});

const getPeriodReadingsRoute = createRoute({
  method: 'get',
  path: '/{id}/readings',
  tags: ['Meter Readings'],
  summary: 'Get readings for a period',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Readings retrieved',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
  },
});

readingsRouter.openapi(getPeriodReadingsRoute, async (c) => {
  const { id: periodId } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const [reading] = await db
    .select()
    .from(meterReadings)
    .where(eq(meterReadings.billingPeriodId, periodId))
    .limit(1);

  return c.json({
    success: true as const,
    data: reading || null,
  }, 200);
});

const submitReadingsRoute = createRoute({
  method: 'post',
  path: '/{id}/readings',
  tags: ['Meter Readings'],
  summary: 'Submit readings and calculate bills',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    body: {
      content: { 'application/json': { schema: SubmitReadingSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MessageResponse } },
      description: 'Readings submitted',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Validation error or invalid request',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Period not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Reading already exists',
    },
    429: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Rate limited',
    },
  },
});

readingsRouter.openapi(submitReadingsRoute, async (c) => {
  const { id: periodId } = c.req.valid('param');
  const user = c.get("user");
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  // --- Daily reading submission rate limit ---
  const MAX_READINGS_PER_DAY = c.env.MAX_READINGS_PER_DAY
    ? parseInt(c.env.MAX_READINGS_PER_DAY, 10)
    : 20;

  const [readingsToday] = await db
    .select({ count: sql<number>`count(*)` })
    .from(meterReadings)
    .where(
      and(
        eq(meterReadings.submittedBy, user.id),
        sql`${meterReadings.createdAt} >= strftime('%s', 'now', 'start of day')`
      )
    );
  const submissionCount = readingsToday?.count ?? 0;

  if (submissionCount >= MAX_READINGS_PER_DAY) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "RATE_LIMITED",
          message: `Reading submission limit reached (${MAX_READINGS_PER_DAY}/day). Try again tomorrow.`,
        },
      },
      429,
      { "Retry-After": "86400" }
    );
  }

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, periodId))
    .limit(1);
  if (!period) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "PERIOD_NOT_FOUND",
          message: "Billing period not found",
        },
      },
      404
    );
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, period.propertyId))
    .limit(1);

  const [tenancy] = await db
    .select()
    .from(tenancies)
    .where(
      and(
        eq(tenancies.propertyId, property.id),
        eq(tenancies.tenantId, user.id)
      )
    )
    .limit(1);
  if (property.ownerId !== user.id && !tenancy) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "UNAUTHORIZED",
          message: "You do not have access to this property",
        },
      },
      403
    );
  }

  const [existingReadingCheck] = await db
    .select()
    .from(meterReadings)
    .where(eq(meterReadings.billingPeriodId, periodId))
    .limit(1);
  if (existingReadingCheck) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "READING_ALREADY_EXISTS",
          message:
            "A reading has already been submitted for this period. Use the edit option to change it.",
        },
      },
      409
    );
  }
  if (!["draft", "pending_approval"].includes(period.status)) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "PERIOD_NOT_OPEN",
          message: `Cannot submit readings for a period with status: ${period.status}`,
        },
      },
      400
    );
  }
  // 1. Resolve and Validate Start Values
  const startValidation = await resolveAndValidateStartValues(
    db,
    property,
    period,
    data
  );
  if (startValidation.error) {
    return c.json({ success: false as const, error: startValidation.error as { code: string; message: string } }, 400);
  }
  const { startValues } = startValidation;

  if (property.hasSolar) {
    const solarGenerated =
      data.solarGenerationEnd - startValues.solarGenerationStart;
    const gridExported = data.exportEnd - startValues.exportStart;
    if (gridExported > solarGenerated) {
      return c.json(
        {
          success: false as const,
          error: {
            code: "INVALID_READING_EXPORT_EXCEEDS_GENERATION",
            message: `Export to Grid (${gridExported} units) cannot exceed Solar Generated (${solarGenerated} units). Please check your solar meter reading.`,
          },
        },
        400
      );
    }
  }

  // 2. Save Readings
  const readingId = crypto.randomUUID();
  await db.insert(meterReadings).values({
    id: readingId,
    billingPeriodId: periodId,
    solarGenerationStart: startValues.solarGenerationStart,
    solarGenerationEnd: data.solarGenerationEnd,
    exportStart: startValues.exportStart,
    exportEnd: data.exportEnd,
    importStart: startValues.importStart,
    importEnd: data.importEnd,
    submittedBy: user.id,
  });

  // 3. Resolve Rates
  const [rate] = await db
    .select()
    .from(propertyRates)
    .where(
      and(
        eq(propertyRates.propertyId, period.propertyId),
        lte(propertyRates.effectiveFrom, period.periodMonth)
      )
    )
    .orderBy(desc(propertyRates.effectiveFrom))
    .limit(1);

  if (!rate) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "RATES_NOT_CONFIGURED",
          message: "No effective rates found for this period",
        },
      },
      400
    );
  }

  // 4. Resolve Tenants and Splits
  const activeTenancies = (
    await db
      .select()
      .from(tenancies)
      .where(
        and(
          eq(tenancies.propertyId, period.propertyId),
          eq(tenancies.status, "active")
        )
      )
  ).map((t) => ({
    ...t,
    isOwnerTenancy: t.isOwnerTenancy ?? false,
  }));

  const newOneOffChargesStr = data.oneOffCharges
    ? JSON.stringify(data.oneOffCharges)
    : period.oneOffCharges;

  if (property.readingsRequireApproval && user.id !== property.ownerId) {
    await db
      .update(billingPeriods)
      .set({
        status: "pending_approval",
        submittedAt: new Date(),
        submittedBy: user.id,
        oneOffCharges: newOneOffChargesStr,
      })
      .where(eq(billingPeriods.id, periodId));
    c.executionCtx.waitUntil(
      createNotification(
        db,
        property.ownerId,
        "reading_pending_approval",
        "Reading Needs Approval",
        `A reading for ${property.name} (${period.periodMonth}) needs your approval.`,
        { periodId, propertyId: property.id }
      )
    );
    return c.json({
      success: true as const,
      message: "Readings submitted for approval",
    }, 200);
  }

  // 5. Calculate and Save Bills
  const activeCharges = (
    await db
      .select()
      .from(customCharges)
      .where(
        and(
          eq(customCharges.propertyId, period.propertyId),
          eq(customCharges.isActive, true)
        )
      )
  ).map((c) => ({
    ...c,
    chargedToTenant: c.chargedToTenant ?? true,
  }));

  let oneOffChargesList: Array<{
    chargedToTenant: boolean;
    amount: number;
    name: string;
  }> = [];
  if (newOneOffChargesStr) {
    try {
      oneOffChargesList = JSON.parse(newOneOffChargesStr);
    } catch (e) {
      console.error("Failed to parse oneOffCharges", e);
    }
  }
  const combinedCharges = [...activeCharges, ...oneOffChargesList];

  const readings = {
    solarGenerationStart: startValues.solarGenerationStart,
    solarGenerationEnd: data.solarGenerationEnd,
    exportStart: startValues.exportStart,
    exportEnd: data.exportEnd,
    importStart: startValues.importStart,
    importEnd: data.importEnd,
    meterMaxReading: property.meterMaxReading ?? undefined,
  };

  const generatedBills = await generateAndSaveBills(
    db,
    periodId,
    period.calculationMode,
    readings,
    { consumptionRate: rate.consumptionRate, exportRate: rate.exportRate },
    activeTenancies,
    combinedCharges,
    false // not a recalculation
  );

  for (const { tenancy, totalDue } of generatedBills) {
    if (tenancy.tenantId) {
      c.executionCtx.waitUntil(
        createNotification(
          db,
          tenancy.tenantId,
          "bill_ready",
          `New Bill: ${property.name}`,
          `Your electricity bill for ${period.periodMonth} is ready. Total due: ${formatCurrency(totalDue)}.`,
          { periodId }
        )
      );
    }
  }

  if (user.id !== property.ownerId) {
    c.executionCtx.waitUntil(
      createNotification(
        db,
        property.ownerId,
        "readings_submitted",
        "Readings Submitted",
        `A tenant submitted readings for ${property.name} (${period.periodMonth}).`,
        { periodId, propertyId: property.id }
      )
    );
  }

  // 6. Update Period Status
  await db
    .update(billingPeriods)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      submittedBy: user.id,
      oneOffCharges: newOneOffChargesStr,
    })
    .where(eq(billingPeriods.id, periodId));

  // 7. Cascade recalculation to any SUBSEQUENT periods
  const [nextPeriod] = await db
    .select()
    .from(billingPeriods)
    .where(
      and(
        eq(billingPeriods.propertyId, period.propertyId),
        gt(billingPeriods.periodMonth, period.periodMonth)
      )
    )
    .orderBy(asc(billingPeriods.periodMonth))
    .limit(1);

  if (nextPeriod) {
    c.executionCtx.waitUntil(
      recalculateChain(db, nextPeriod.id).catch((err) => {
        console.error("[Recalc cascade failed]", periodId, err);
      })
    );
  }

  return c.json({
    success: true as const,
    message: "Readings submitted and bills calculated",
  }, 200);
});

const EditReadingSchema = z.object({
  solarGenerationEnd: z.number().min(0).optional(),
  exportEnd: z.number().min(0).optional(),
  importEnd: z.number().min(0).optional(),
  reason: z.string().min(10),
  allowRollover: z.boolean().optional(),
  oneOffCharges: z
    .array(
      z.object({
        name: z.string().min(1),
        amount: z.number().min(0),
        chargedToTenant: z.boolean().default(true),
      })
    )
    .optional(),
});

const editReadingsRoute = createRoute({
  method: 'patch',
  path: '/{id}/readings',
  tags: ['Meter Readings'],
  summary: 'Owner direct edit',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    body: {
      content: { 'application/json': { schema: EditReadingSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MessageResponse } },
      description: 'Reading updated',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Validation error or invalid request',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Period or reading not found',
    },
  },
});

readingsRouter.openapi(editReadingsRoute, async (c) => {
  const { id: periodId } = c.req.valid('param');
  const user = c.get("user");
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, periodId))
    .limit(1);
  if (!period) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "PERIOD_NOT_FOUND",
          message: "Billing period not found",
        },
      },
      404
    );
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(
      and(eq(properties.id, period.propertyId), eq(properties.ownerId, user.id))
    )
    .limit(1);
  if (!property) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "UNAUTHORIZED",
          message: "Only the property owner can edit readings directly",
        },
      },
      403
    );
  }

  if (period.status === "confirmed") {
    return c.json(
      {
        success: false as const,
        error: {
          code: "PERIOD_CONFIRMED",
          message:
            "Cannot edit a confirmed period directly. Re-open the period first, or approve a tenant edit request.",
        },
      },
      400
    );
  }

  if (period.status === "pending_approval") {
    return c.json(
      {
        success: false as const,
        error: {
          code: "PERIOD_PENDING_APPROVAL",
          message:
            "A tenant reading is awaiting your approval. Approve or reject it before making direct edits.",
        },
      },
      400
    );
  }

  const [oldReading] = await db
    .select()
    .from(meterReadings)
    .where(eq(meterReadings.billingPeriodId, periodId))
    .limit(1);
  if (!oldReading) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "READING_NOT_FOUND",
          message: "No readings found for this period to edit",
        },
      },
      404
    );
  }

  // 1. Record the edit in audit log
  const editId = crypto.randomUUID();
  const newValues = {
    solarGenerationEnd:
      data.solarGenerationEnd ?? oldReading.solarGenerationEnd,
    exportEnd: data.exportEnd ?? oldReading.exportEnd,
    importEnd: data.importEnd ?? oldReading.importEnd,
  };

  // 0.5 Validate Start Values
  const startValidation = await resolveAndValidateStartValues(
    db,
    property,
    period,
    {
      allowRollover: data.allowRollover,
      importEnd: newValues.importEnd,
      solarGenerationEnd: newValues.solarGenerationEnd,
      exportEnd: newValues.exportEnd,
    }
  );
  if (startValidation.error) {
    return c.json({ success: false as const, error: startValidation.error as { code: string; message: string } }, 400);
  }
  const { startValues } = startValidation;

  if (property.hasSolar) {
    const solarGenerated =
      newValues.solarGenerationEnd! - startValues.solarGenerationStart;
    const gridExported = newValues.exportEnd! - startValues.exportStart;
    if (gridExported > solarGenerated) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_READING_EXPORT_EXCEEDS_GENERATION",
            message: `Export to Grid (${gridExported} units) cannot exceed Solar Generated (${solarGenerated} units). Please check your solar meter reading.`,
          },
        },
        400
      );
    }
  }

  await db.insert(meterReadingEdits).values({
    id: editId,
    meterReadingId: oldReading.id,
    editedBy: user.id,
    reason: data.reason,
    oldValues: JSON.stringify(oldReading),
    newValues: JSON.stringify(newValues),
    versionBefore: oldReading.version || 1,
    versionAfter: (oldReading.version || 1) + 1,
    affectedPeriods: JSON.stringify([periodId]), // Simplified, cascade will add more
  });

  // 2. Update the reading
  await db
    .update(meterReadings)
    .set({
      ...newValues,
      version: (oldReading.version || 1) + 1,
      updatedAt: new Date(),
    })
    .where(eq(meterReadings.id, oldReading.id));

  // 2.2 Update one-off charges if provided
  if (data.oneOffCharges !== undefined) {
    await db
      .update(billingPeriods)
      .set({ oneOffCharges: JSON.stringify(data.oneOffCharges) })
      .where(eq(billingPeriods.id, periodId));
  }

  // 2.5 Auto-cancel any pending edit requests for this period
  const cancelledRequests = await db
    .update(editRequests)
    .set({
      status: "cancelled",
      reviewNote: "Owner edited readings directly. Request superseded.",
      reviewedAt: new Date(),
      reviewedBy: user.id,
    })
    .where(
      and(
        eq(editRequests.billingPeriodId, periodId),
        eq(editRequests.status, "pending")
      )
    )
    .returning({ requestedBy: editRequests.requestedBy });

  for (const req of cancelledRequests) {
    c.executionCtx.waitUntil(
      createNotification(
        db,
        req.requestedBy,
        "edit_rejected",
        "Edit Request Cancelled",
        `Your edit request for ${period.periodMonth} was cancelled because the owner edited the reading directly.`,
        { periodId }
      )
    );
  }

  // 3. Trigger recalculation
  c.executionCtx.waitUntil(
    recalculateChain(db, periodId)
      .then(async () => {
        const affectedTenancies = await db
          .select()
          .from(tenancies)
          .where(
            and(
              eq(tenancies.propertyId, property.id),
              eq(tenancies.status, "active")
            )
          );
        for (const t of affectedTenancies) {
          if (t.tenantId && !t.isOwnerTenancy) {
            await createNotification(
              db,
              t.tenantId,
              "readings_submitted",
              "Readings Updated",
              `The owner has updated the readings for ${property.name} (${period.periodMonth}). Your bill preview has changed.`,
              { periodId, propertyId: property.id }
            ).catch((err) => console.error("Failed to notify tenant", err));
          }
        }
      })
      .catch((err) => {
        console.error("[Recalc failed]", periodId, err);
        // ponytail: log-only error handling, add queue retry when failure rate >1%
      })
  );

  return c.json({
    success: true as const,
    message: "Reading updated and recalculation queued",
  }, 200);
});

const reopenPeriodRoute = createRoute({
  method: 'patch',
  path: '/{id}/reopen',
  tags: ['Meter Readings'],
  summary: 'Owner reopens a confirmed/submitted period',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MessageResponse } },
      description: 'Period reopened',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID or invalid status',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Period not found',
    },
  },
});

readingsRouter.openapi(reopenPeriodRoute, async (c) => {
  const { id: periodId } = c.req.valid('param');
  const user = c.get("user");
  const db = getDb(c.env.DB);

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, periodId))
    .limit(1);
  if (!period)
    return c.json(
      {
        success: false as const,
        error: { code: "PERIOD_NOT_FOUND", message: "Period not found" },
      },
      404
    );

  const [property] = await db
    .select()
    .from(properties)
    .where(
      and(eq(properties.id, period.propertyId), eq(properties.ownerId, user.id))
    )
    .limit(1);
  if (!property)
    return c.json(
      {
        success: false as const,
        error: { code: "UNAUTHORIZED", message: "Only owner can reopen" },
      },
      403
    );

  if (period.status !== "confirmed" && period.status !== "submitted") {
    return c.json(
      {
        success: false as const,
        error: {
          code: "INVALID_STATUS",
          message: "Only confirmed or submitted periods can be reopened",
        },
      },
      400
    );
  }

  await db
    .update(billingPeriods)
    .set({ status: "submitted" })
    .where(eq(billingPeriods.id, periodId));

  const affectedTenancies = await db
    .select()
    .from(tenancies)
    .where(
      and(eq(tenancies.propertyId, property.id), eq(tenancies.status, "active"))
    );
  for (const t of affectedTenancies) {
    if (t.tenantId && !t.isOwnerTenancy) {
      c.executionCtx.waitUntil(
        createNotification(
          db,
          t.tenantId,
          "readings_submitted",
          "Billing Period Reopened",
          `Your owner has reopened the ${period.periodMonth} billing period for ${property.name}. Your bill may be revised.`,
          { periodId, propertyId: property.id }
        )
      );
    }
  }

  return c.json({ success: true as const, message: "Period reopened for editing" }, 200);
});

const confirmPeriodRoute = createRoute({
  method: 'patch',
  path: '/{id}/confirm',
  tags: ['Meter Readings'],
  summary: 'Owner manually confirms a submitted period',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MessageResponse } },
      description: 'Period confirmed',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID or invalid status/split mismatch',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Period not found',
    },
  },
});

readingsRouter.openapi(confirmPeriodRoute, async (c) => {
  const { id: periodId } = c.req.valid('param');
  const user = c.get("user");
  const db = getDb(c.env.DB);

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, periodId))
    .limit(1);
  if (!period)
    return c.json(
      {
        success: false as const,
        error: { code: "PERIOD_NOT_FOUND", message: "Period not found" },
      },
      404
    );

  const [property] = await db
    .select()
    .from(properties)
    .where(
      and(eq(properties.id, period.propertyId), eq(properties.ownerId, user.id))
    )
    .limit(1);
  if (!property)
    return c.json(
      {
        success: false as const,
        error: { code: "UNAUTHORIZED", message: "Only owner can confirm" },
      },
      403
    );

  if (period.status !== "submitted") {
    return c.json(
      {
        success: false as const,
        error: {
          code: "INVALID_STATUS",
          message: "Only submitted periods can be confirmed",
        },
      },
      400
    );
  }

  const activeTenancies = await db
    .select()
    .from(tenancies)
    .where(
      and(eq(tenancies.propertyId, property.id), eq(tenancies.status, "active"))
    );

  const explicit = activeTenancies.filter((t) => t.splitPercentage !== null);
  const nullCount = activeTenancies.length - explicit.length;
  const explicitTotal = explicit.reduce(
    (sum, t) => sum + (t.splitPercentage || 0),
    0
  );

  if (nullCount === 0 && Math.abs(explicitTotal - 100) > 0.01) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "SPLIT_MISMATCH",
          message: `Splits add up to ${explicitTotal}%, not 100%. Fix before confirming.`,
        },
      },
      400
    );
  }

  await db
    .update(billingPeriods)
    .set({ status: "confirmed" })
    .where(eq(billingPeriods.id, periodId));

  return c.json({ success: true as const, message: "Period confirmed successfully" }, 200);
});

const approveReadingRoute = createRoute({
  method: 'patch',
  path: '/{id}/approve',
  tags: ['Meter Readings'],
  summary: 'Owner approves a reading',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MessageResponse } },
      description: 'Reading approved',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID or invalid status',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Period not found',
    },
  },
});

readingsRouter.openapi(approveReadingRoute, async (c) => {
  const { id: periodId } = c.req.valid('param');
  const user = c.get("user");
  const db = getDb(c.env.DB);

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, periodId))
    .limit(1);
  if (!period)
    return c.json(
      {
        success: false as const,
        error: { code: "PERIOD_NOT_FOUND", message: "Period not found" },
      },
      404
    );

  const [property] = await db
    .select()
    .from(properties)
    .where(
      and(eq(properties.id, period.propertyId), eq(properties.ownerId, user.id))
    )
    .limit(1);
  if (!property)
    return c.json(
      {
        success: false as const,
        error: { code: "UNAUTHORIZED", message: "Only owner can approve" },
      },
      403
    );

  if (period.status !== "pending_approval") {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_STATUS",
          message: "Period is not pending approval",
        },
      },
      400
    );
  }

  const [reading] = await db
    .select()
    .from(meterReadings)
    .where(eq(meterReadings.billingPeriodId, periodId))
    .limit(1);
  const [rate] = await db
    .select()
    .from(propertyRates)
    .where(
      and(
        eq(propertyRates.propertyId, period.propertyId),
        lte(propertyRates.effectiveFrom, period.periodMonth)
      )
    )
    .orderBy(desc(propertyRates.effectiveFrom))
    .limit(1);
  const activeTenancies = (
    await db
      .select()
      .from(tenancies)
      .where(
        and(
          eq(tenancies.propertyId, period.propertyId),
          eq(tenancies.status, "active")
        )
      )
  ).map((t) => ({
    ...t,
    isOwnerTenancy: t.isOwnerTenancy ?? false,
  }));
  const activeCharges = (
    await db
      .select()
      .from(customCharges)
      .where(
        and(
          eq(customCharges.propertyId, period.propertyId),
          eq(customCharges.isActive, true)
        )
      )
  ).map((c) => ({
    ...c,
    chargedToTenant: c.chargedToTenant ?? true,
  }));

  const readings = {
    solarGenerationStart: reading.solarGenerationStart || 0,
    solarGenerationEnd: reading.solarGenerationEnd || 0,
    exportStart: reading.exportStart || 0,
    exportEnd: reading.exportEnd || 0,
    importStart: reading.importStart || 0,
    importEnd: reading.importEnd || 0,
  };

  const rates = {
    consumptionRate: rate?.consumptionRate || 0,
    exportRate: rate?.exportRate || 0,
  };

  const generatedBills = await generateAndSaveBills(
    db,
    periodId,
    period.calculationMode,
    readings,
    rates,
    activeTenancies,
    activeCharges,
    false
  );

  for (const { tenancy, totalDue } of generatedBills) {
    if (tenancy.tenantId) {
      c.executionCtx.waitUntil(
        createNotification(
          db,
          tenancy.tenantId,
          "bill_ready",
          `New Bill: ${property.name}`,
          `Your electricity bill for ${period.periodMonth} is ready. Total due: ${formatCurrency(totalDue)}.`,
          { periodId }
        )
      );
    }
  }

  if (period.submittedBy) {
    c.executionCtx.waitUntil(
      createNotification(
        db,
        period.submittedBy,
        "reading_approved",
        "Reading Approved",
        `Your reading for ${period.periodMonth} was approved.`,
        { periodId }
      )
    );
  }

  await db
    .update(billingPeriods)
    .set({ status: "confirmed" })
    .where(eq(billingPeriods.id, periodId));

  return c.json({
    success: true as const,
    message: "Reading approved and bills generated",
  }, 200);
});

const rejectReadingRoute = createRoute({
  method: 'patch',
  path: '/{id}/reject',
  tags: ['Meter Readings'],
  summary: 'Owner rejects a reading',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    body: {
      content: {
        'application/json': {
          schema: z.object({ reason: z.string().optional() }),
        },
      },
      required: false,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MessageResponse } },
      description: 'Reading rejected',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID or invalid status',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Period not found',
    },
  },
});

readingsRouter.openapi(rejectReadingRoute, async (c) => {
  const { id: periodId } = c.req.valid('param');
  const user = c.get("user");
  const data = c.req.valid('json') || {};
  const reason = data.reason || "No reason provided";
  const db = getDb(c.env.DB);

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, periodId))
    .limit(1);
  if (!period)
    return c.json(
      {
        success: false as const,
        error: { code: "PERIOD_NOT_FOUND", message: "Period not found" },
      },
      404
    );

  const [property] = await db
    .select()
    .from(properties)
    .where(
      and(eq(properties.id, period.propertyId), eq(properties.ownerId, user.id))
    )
    .limit(1);
  if (!property)
    return c.json(
      {
        success: false as const,
        error: { code: "UNAUTHORIZED", message: "Only owner can reject" },
      },
      403
    );

  if (period.status !== "pending_approval") {
    return c.json(
      {
        success: false as const,
        error: {
          code: "INVALID_STATUS",
          message: "Period is not pending approval",
        },
      },
      400
    );
  }

  await db
    .update(billingPeriods)
    .set({ status: "draft" })
    .where(eq(billingPeriods.id, periodId));

  if (period.submittedBy) {
    c.executionCtx.waitUntil(
      createNotification(
        db,
        period.submittedBy,
        "reading_rejected",
        "Reading Rejected",
        `Your reading for ${period.periodMonth} was rejected. Reason: ${reason}`,
        { periodId }
      )
    );
  }

  return c.json({ success: true as const, message: "Reading rejected" }, 200);
});

const RateChangeSchema = z.object({
  consumptionRate: z.number().min(0, "Consumption rate cannot be negative"),
  exportRate: z.number().min(0, "Export rate cannot be negative").optional(),
  reason: z
    .string()
    .min(10, "Reason must be at least 10 characters")
    .max(500, "Reason too long (max 500 characters)"),
});

const changeRatesRoute = createRoute({
  method: 'patch',
  path: '/{id}/rates',
  tags: ['Meter Readings'],
  summary: 'Owner overrides rates for a period and recalculates',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    body: {
      content: { 'application/json': { schema: RateChangeSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Rates updated and bills recalculated',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Validation error or invalid status',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Period or property not found',
    },
  },
});

readingsRouter.openapi(changeRatesRoute, async (c) => {
  const { id: periodId } = c.req.valid('param');
  const user = c.get("user");
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  // 1. Fetch period and property
  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, periodId))
    .limit(1);
  if (!period) {
    return c.json(
      {
        success: false as const,
        error: { code: "PERIOD_NOT_FOUND", message: "Period not found" },
      },
      404
    );
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, period.propertyId))
    .limit(1);
  if (!property) {
    return c.json(
      {
        success: false as const,
        error: { code: "PROPERTY_NOT_FOUND", message: "Property not found" },
      },
      404
    );
  }

  // 2. Authorization: Must be property owner
  if (property.ownerId !== user.id) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "UNAUTHORIZED",
          message: "Only the property owner can edit rates",
        },
      },
      403
    );
  }

  // 3. Period must be submitted or confirmed
  if (period.status !== "submitted" && period.status !== "confirmed") {
    return c.json(
      {
        success: false as const,
        error: {
          code: "INVALID_STATUS",
          message:
            "Rates can only be edited for submitted or confirmed periods",
        },
      },
      400
    );
  }

  // 4. Resolve old rates for audit
  const oldRates = { consumptionRate: 0, exportRate: 0 };
  if (period.rateOverride) {
    try {
      const parsed = JSON.parse(period.rateOverride);
      oldRates.consumptionRate = parsed.consumptionRate;
      oldRates.exportRate = parsed.exportRate || 0;
    } catch {
      /* ignore */
    }
  } else {
    const [rate] = await db
      .select()
      .from(propertyRates)
      .where(
        and(
          eq(propertyRates.propertyId, period.propertyId),
          lte(propertyRates.effectiveFrom, period.periodMonth)
        )
      )
      .orderBy(desc(propertyRates.effectiveFrom))
      .limit(1);

    oldRates.consumptionRate = rate?.consumptionRate || 0;
    oldRates.exportRate = rate?.exportRate || 0;
  }

  const newRates = {
    consumptionRate: data.consumptionRate,
    exportRate: data.exportRate ?? oldRates.exportRate,
  };

  // 5. Update period with rate override
  const overrideObj = {
    consumptionRate: newRates.consumptionRate,
    exportRate: newRates.exportRate,
    reason: data.reason,
    changedBy: user.id,
    changedAt: new Date().toISOString(),
  };

  await db
    .update(billingPeriods)
    .set({ rateOverride: JSON.stringify(overrideObj) })
    .where(eq(billingPeriods.id, periodId));

  // 6. Fetch bills before recalculation
  const oldBills = await db
    .select()
    .from(bills)
    .where(eq(bills.billingPeriodId, periodId));

  // 7. Run recalculation chain
  await recalculateChain(db, periodId);

  // 8. Fetch bills after recalculation
  const newBills = await db
    .select()
    .from(bills)
    .where(eq(bills.billingPeriodId, periodId));

  // 9. Audit trail in meter_reading_edits
  const [reading] = await db
    .select()
    .from(meterReadings)
    .where(eq(meterReadings.billingPeriodId, periodId))
    .limit(1);
  if (reading) {
    await db.insert(meterReadingEdits).values({
      id: crypto.randomUUID(),
      meterReadingId: reading.id,
      editedBy: user.id,
      reason: `Rate changed: ${data.reason}`,
      oldValues: JSON.stringify(oldRates),
      newValues: JSON.stringify(newRates),
      versionBefore: reading.version || 1,
      versionAfter: (reading.version || 1) + 1,
      affectedPeriods: JSON.stringify([periodId]),
    });

    await db
      .update(meterReadings)
      .set({
        version: sql`${meterReadings.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(meterReadings.id, reading.id));
  }

  // 10. Notify active tenants
  let tenantsNotified = 0;
  const changedOnStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date())
    .replace(",", " at");

  for (const newBill of newBills) {
    const [tenancy] = await db
      .select()
      .from(tenancies)
      .where(eq(tenancies.id, newBill.tenancyId))
      .limit(1);
    if (tenancy && tenancy.tenantId && tenancy.status === "active") {
      const oldBill = oldBills.find((b) => b.tenancyId === tenancy.id);
      const oldTotal = oldBill?.totalDue ?? 0;
      const newTotal = newBill.totalDue ?? 0;
      const deltaTotal = newTotal - oldTotal;

      const deltaText =
        deltaTotal > 0
          ? `+₹${deltaTotal.toFixed(2)} (increase of ₹${deltaTotal.toFixed(2)})`
          : `-₹${Math.abs(deltaTotal).toFixed(2)} (you save ₹${Math.abs(deltaTotal).toFixed(2)})`;

      const notificationBody = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Your Bill Was Recalculated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Property: ${property.name}
Period: ${new Date(period.periodMonth).toLocaleString("en-US", { month: "long", year: "numeric" })}
Changed by: ${user.name || "Owner"} (Owner)
Changed on: ${changedOnStr}

What changed:
• Consumption Rate: ₹${oldRates.consumptionRate.toFixed(2)}/unit → ₹${newRates.consumptionRate.toFixed(2)}/unit
• Export Rate: ₹${oldRates.exportRate.toFixed(2)}/unit → ₹${newRates.exportRate.toFixed(2)}/unit${oldRates.exportRate === newRates.exportRate ? " (no change)" : ""}

Reason from owner:
"${data.reason}"

Your bill impact:
• Old bill: ₹${oldTotal.toFixed(2)}
• New bill: ₹${newTotal.toFixed(2)}
• Difference: ${deltaText}

[View Updated Bill →]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await createNotification(
        db,
        tenancy.tenantId,
        "rate_changed",
        "Bill Recalculated due to Rate Change",
        notificationBody,
        { periodId, propertyId: property.id, billId: newBill.id }
      );
      tenantsNotified++;
    }
  }

  return c.json({
    success: true as const,
    data: {
      periodId,
      oldRates,
      newRates,
      billsRecalculated: newBills.length,
      tenantsNotified,
    },
  }, 200);
});

export { readingsRouter };
