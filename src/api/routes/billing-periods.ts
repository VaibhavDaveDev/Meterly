import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc, lte } from 'drizzle-orm';
import { getDb } from '../../db';
import { billingPeriods, meterReadings, propertyRates, tenancies, customCharges } from '../../db/schema';
import { authMiddleware } from '../middleware/auth';
import { requireOwner } from '../lib/property-auth';
import { generateAndSaveBills } from '../lib/bill-generation';
import { createNotification } from '../lib/notifications';
import { SuccessResponse, ErrorResponse, IdParam } from '../lib/openapi-schemas';
import type { Bindings, Variables } from '../app';

const periodsRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

periodsRouter.use('*', authMiddleware);

const CreatePeriodSchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}-01$/, "Must be YYYY-MM-01").openapi({ example: '2026-07-01' }),
  readings: z.object({
    importStart: z.number(),
    importEnd: z.number(),
    solarGenerationStart: z.number().optional(),
    solarGenerationEnd: z.number().optional(),
    exportStart: z.number().optional(),
    exportEnd: z.number().optional(),
  }).optional(),
  oneOffCharges: z.array(z.object({
    name: z.string(),
    amount: z.number(),
    chargedToTenant: z.boolean()
  })).optional(),
});

const listPeriodsRoute = createRoute({
  method: 'get',
  path: '/{id}/periods',
  tags: ['Billing Periods'],
  summary: 'List billing periods for property',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Billing periods listed',
    },
  },
});

periodsRouter.openapi(listPeriodsRoute, async (c) => {
  const { id: propertyId } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const periods = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.propertyId, propertyId))
    .orderBy(desc(billingPeriods.periodMonth));

  return c.json({
    success: true as const,
    data: periods,
  }, 200);
});

const createPeriodRoute = createRoute({
  method: 'post',
  path: '/{id}/periods',
  tags: ['Billing Periods'],
  summary: 'Create billing period',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    body: {
      content: { 'application/json': { schema: CreatePeriodSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Billing period created',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Validation error',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
  },
});

periodsRouter.openapi(createPeriodRoute, async (c) => {
  const { id: propertyId } = c.req.valid('param');
  const user = c.get('user');
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'Only the property owner can create billing periods' } }, 403);
  }

  // Check if period already exists
  const [existing] = await db.select().from(billingPeriods).where(and(eq(billingPeriods.propertyId, propertyId), eq(billingPeriods.periodMonth, data.periodMonth))).limit(1);
  if (existing) {
    return c.json({ success: false as const, error: { code: 'PERIOD_ALREADY_EXISTS', message: 'A billing period for this month already exists' } }, 400);
  }

  const periodId = crypto.randomUUID();
  await db.insert(billingPeriods).values({
    id: periodId,
    propertyId: propertyId,
    periodMonth: data.periodMonth,
    calculationMode: property.hasSolar ? 'solar' : 'grid_only',
    status: 'draft',
    oneOffCharges: data.oneOffCharges ? JSON.stringify(data.oneOffCharges) : null,
  });

  if (data.readings) {
    // 1. Resolve Rates
    const [rate] = await db
      .select()
      .from(propertyRates)
      .where(and(
        eq(propertyRates.propertyId, propertyId),
        lte(propertyRates.effectiveFrom, data.periodMonth)
      ))
      .orderBy(desc(propertyRates.effectiveFrom))
      .limit(1);

    if (!rate) {
      return c.json({ success: false as const, error: { code: 'RATES_NOT_CONFIGURED', message: 'No effective rates found for this period' } }, 400);
    }

    // 2. Resolve Tenants and Splits
    const activeTenancies = (await db.select().from(tenancies).where(and(eq(tenancies.propertyId, propertyId), eq(tenancies.status, 'active')))).map(t => ({
      ...t,
      isOwnerTenancy: t.isOwnerTenancy ?? false
    }));

    // 3. Resolve Custom Charges
    const activeCharges = (await db.select().from(customCharges).where(and(eq(customCharges.propertyId, propertyId), eq(customCharges.isActive, true)))).map(ch => ({
      ...ch,
      chargedToTenant: ch.chargedToTenant ?? true
    }));

    // 4. Save Readings
    await db.insert(meterReadings).values({
      id: crypto.randomUUID(),
      billingPeriodId: periodId,
      importStart: data.readings.importStart,
      importEnd: data.readings.importEnd,
      solarGenerationStart: data.readings.solarGenerationStart ?? 0,
      solarGenerationEnd: data.readings.solarGenerationEnd ?? 0,
      exportStart: data.readings.exportStart ?? 0,
      exportEnd: data.readings.exportEnd ?? 0,
      submittedBy: user.id,
      version: 1,
    });

    // 5. Generate bills
    const generatedBills = await generateAndSaveBills(
      db,
      periodId,
      property.hasSolar ? 'solar' : 'grid_only',
      {
        importStart: data.readings.importStart,
        importEnd: data.readings.importEnd,
        solarGenerationStart: data.readings.solarGenerationStart ?? 0,
        solarGenerationEnd: data.readings.solarGenerationEnd ?? 0,
        exportStart: data.readings.exportStart ?? 0,
        exportEnd: data.readings.exportEnd ?? 0,
        meterMaxReading: property.meterMaxReading ?? undefined,
      },
      { consumptionRate: rate.consumptionRate, exportRate: rate.exportRate },
      activeTenancies,
      activeCharges,
      false // not a recalculation
    );

    // 6. Send notifications
    for (const { tenancy, totalDue } of generatedBills) {
      if (tenancy.tenantId) {
        c.executionCtx.waitUntil(
          createNotification(
            db,
            tenancy.tenantId,
            'bill_generated',
            'New Bill Generated',
            `A new bill of ₹${totalDue} has been generated for ${property.name} (${data.periodMonth.slice(0, 7)}).`,
            { periodId, propertyId: property.id }
          )
        );
      }
    }

    // 7. Update period status to submitted
    await db.update(billingPeriods)
      .set({ 
        status: 'submitted',
        submittedBy: user.id,
        submittedAt: new Date()
      })
      .where(eq(billingPeriods.id, periodId));
  }

  const [newPeriod] = await db.select().from(billingPeriods).where(eq(billingPeriods.id, periodId)).limit(1);

  return c.json({
    success: true as const,
    data: newPeriod,
  }, 200);
});

export { periodsRouter };
