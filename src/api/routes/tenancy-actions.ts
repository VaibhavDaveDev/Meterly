import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc, ne, sql, like, count } from 'drizzle-orm';
import { getDb } from '../../db';
import { tenancies, bills, billingPeriods, properties, meterReadings, editRequests } from '../../db/schema';
import { authMiddleware } from '../middleware/auth';
import { sweepOrphanedPropertyData } from '../lib/property-cleanup';
import { createNotification } from '../lib/notifications';
import { sendEmail } from '../lib/email';
import { tenantInviteTemplate } from '../lib/email-templates';
import { user as userTable } from '../../db/schema/auth';
import { SuccessResponse, SimpleSuccessResponse, ErrorResponse, IdParam } from '../lib/openapi-schemas';
import type { Bindings, Variables } from '../app';

const tenancyActionsRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

tenancyActionsRouter.use('*', authMiddleware);

const acceptInviteRoute = createRoute({
  method: 'post',
  path: '/accept',
  tags: ['Tenancy Actions'],
  summary: 'Accept an invitation',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            token: z.string().openapi({ example: 'invite_token_123' }),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Invitation accepted',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invalid or expired invitation token',
    },
  },
});

tenancyActionsRouter.openapi(acceptInviteRoute, async (c) => {
  const user = c.get('user');
  const { token } = c.req.valid('json');
  const db = getDb(c.env.DB);

  const [tenancy] = await db
    .select()
    .from(tenancies)
    .where(and(eq(tenancies.inviteToken, token), eq(tenancies.status, 'invited')))
    .limit(1);

  if (!tenancy) {
    return c.json({ 
      success: false as const, 
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired invitation token' } 
    }, 404);
  }

  const [property] = await db.select().from(properties).where(eq(properties.id, tenancy.propertyId)).limit(1);

  await db.update(tenancies)
    .set({
      tenantId: user.id,
      status: 'active',
      joinedAt: new Date(),
      inviteToken: null, // Clear token after use
    })
    .where(eq(tenancies.id, tenancy.id));

  if (property) {
    c.executionCtx.waitUntil(
      createNotification(
        db,
        property.ownerId,
        'system',
        'Tenant Accepted Invite',
        `${user.name || user.email} has accepted the invitation for ${property.name}.`,
        { propertyId: property.id, tenancyId: tenancy.id }
      )
    );
  }

  return c.json({
    success: true as const,
    data: { propertyId: tenancy.propertyId },
  }, 200);
});

const resendInviteRoute = createRoute({
  method: 'post',
  path: '/{id}/resend-invite',
  tags: ['Tenancy Actions'],
  summary: 'Resend an invitation email',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ success: z.literal(true), message: z.string() }) } },
      description: 'Invite resent successfully',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID or Invalid status',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Not authorized or tenancy not found',
    },
    429: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Rate limit exceeded',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Email failed to send',
    },
  },
});

tenancyActionsRouter.openapi(resendInviteRoute, async (c) => {
  const { id: tenancyId } = c.req.valid('param');
  const user = c.get('user');
  const db = getDb(c.env.DB);

  // Auth check: Is this the property owner?
  const [tenancyData] = await db
    .select({
      tenancy: tenancies,
      property: properties,
      owner: userTable,
    })
    .from(tenancies)
    .innerJoin(properties, eq(tenancies.propertyId, properties.id))
    .innerJoin(userTable, eq(properties.ownerId, userTable.id))
    .where(and(eq(tenancies.id, tenancyId), eq(properties.ownerId, user.id)))
    .limit(1);

  if (!tenancyData) {
    return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'Not authorized or tenancy not found' } }, 403);
  }

  const { tenancy, property, owner } = tenancyData;

  if (tenancy.status !== 'invited' || !tenancy.inviteEmail || !tenancy.inviteToken) {
    return c.json({ success: false as const, error: { code: 'INVALID_STATUS', message: 'Tenancy is not in invited status' } }, 400);
  }

  // 24h rate limit using invitedAt
  if (tenancy.invitedAt) {
    const hoursSinceInvite = (Date.now() - tenancy.invitedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceInvite < 24) {
      return c.json({ success: false as const, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'You can only resend the invite once every 24 hours.' } }, 429);
    }
  }

  // Renew token expiry and update invitedAt
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  await db.update(tenancies)
    .set({
      invitedAt: new Date(),
      inviteExpiresAt,
    })
    .where(eq(tenancies.id, tenancy.id));

  // Send email
  const inviteUrl = `${c.env.BETTER_AUTH_URL}/invite/${tenancy.inviteToken}`;
  try {
    const template = tenantInviteTemplate(owner.name || 'Property Owner', property.name, inviteUrl);
    await sendEmail(c.env, {
      to: tenancy.inviteEmail,
      subject: template.subject,
      html: template.html,
    });
  } catch (error) {
    console.error('Failed to send invite email:', error);
    return c.json({ success: false as const, error: { code: 'EMAIL_FAILED', message: 'Failed to send email' } }, 500);
  }

  return c.json({ success: true as const, message: 'Invite resent successfully' }, 200);
});

const exportBillsRoute = createRoute({
  method: 'get',
  path: '/{id}/export/csv',
  tags: ['Tenancy Actions'],
  summary: 'Tenant downloads their billing history',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    query: z.object({
      includeReadings: z.enum(['true', 'false']).optional(),
    }),
  },
  responses: {
    200: {
      content: { 'text/csv': { schema: z.string() } },
      description: 'CSV data',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Only the tenant can export this data',
    },
  },
});

tenancyActionsRouter.openapi(exportBillsRoute, async (c) => {
  const user = c.get('user');
  const { id: tenancyId } = c.req.valid('param');
  const { includeReadings: includeReadingsParam } = c.req.valid('query');
  const includeReadings = includeReadingsParam === 'true';
  const db = getDb(c.env.DB);

  // Auth check: Is this the tenant's tenancy?
  const [tenancy] = await db.select().from(tenancies).where(eq(tenancies.id, tenancyId)).limit(1);
  if (!tenancy || tenancy.tenantId !== user.id) {
    return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'Only the tenant can export this data' } }, 403);
  }

  const result = await db
    .select({
      bill: bills,
      periodMonth: billingPeriods.periodMonth,
      readings: meterReadings,
    })
    .from(bills)
    .innerJoin(billingPeriods, eq(bills.billingPeriodId, billingPeriods.id))
    .leftJoin(meterReadings, eq(billingPeriods.id, meterReadings.billingPeriodId))
    .where(eq(bills.tenancyId, tenancyId))
    .orderBy(desc(billingPeriods.periodMonth));

  let csv = includeReadings 
    ? 'Month,Total Consumption,Split %,Tenant Consumption,Solar Share,Consumption Cost,Export Refund,Custom Charges,Total Due,Status,Import Start,Import End,Export Start,Export End,Solar Gen Start,Solar Gen End\n'
    : 'Month,Total Consumption,Split %,Tenant Consumption,Solar Share,Consumption Cost,Export Refund,Custom Charges,Total Due,Status\n';

  result.forEach(row => {
    let line = `${row.periodMonth},${row.bill.totalConsumption},${row.bill.splitPercentage},${row.bill.tenantConsumption},${row.bill.solarSelfConsumed},${row.bill.consumptionCost},${row.bill.exportRefund},${row.bill.customChargesTotal},${row.bill.totalDue},${row.bill.status}`;
    
    if (includeReadings) {
      if (row.readings) {
        line += `,${row.readings.importStart},${row.readings.importEnd},${row.readings.exportStart},${row.readings.exportEnd},${row.readings.solarGenerationStart},${row.readings.solarGenerationEnd}`;
      } else {
        line += `,,,,,,`; // Empty columns if no readings
      }
    }
    
    csv += line + '\n';
  });

  return c.text(csv, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="tenancy-${tenancyId}-bills.csv"`,
  });
});

const leaveTenancyRoute = createRoute({
  method: 'patch',
  path: '/{id}/leave',
  tags: ['Tenancy Actions'],
  summary: 'Tenant exits a property voluntarily',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Tenancy left',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Tenancy not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Owner tenancy or not active',
    },
  },
});

tenancyActionsRouter.openapi(leaveTenancyRoute, async (c) => {
  const user = c.get('user');
  const { id: tenancyId } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const [tenancy] = await db
    .select()
    .from(tenancies)
    .where(and(eq(tenancies.id, tenancyId), eq(tenancies.tenantId, user.id)))
    .limit(1);

  if (!tenancy) {
    return c.json({ success: false as const, error: { code: 'NOT_FOUND', message: 'Tenancy not found' } }, 404);
  }

  // Block: owner cannot leave their own auto-created tenancy (solo mode)
  if (tenancy.isOwnerTenancy) {
    return c.json({
      success: false as const,
      error: { code: 'OWNER_TENANCY', message: 'Owners cannot leave their own property. Archive or delete the property instead.' }
    }, 409);
  }

  // Block: can only leave an active tenancy
  if (tenancy.status !== 'active') {
    return c.json({
      success: false as const,
      error: { code: 'NOT_ACTIVE', message: 'You are not an active tenant of this property.' }
    }, 409);
  }

  const [property] = await db.select().from(properties).where(eq(properties.id, tenancy.propertyId)).limit(1);

  // Check for pending bills (unpaid) — warn via response metadata but allow leaving
  const pendingBills = await db
    .select({ count: count() })
    .from(bills)
    .where(and(eq(bills.tenancyId, tenancyId), eq(bills.status, 'pending')));
  const hasPendingBills = (pendingBills[0]?.count ?? 0) > 0;

  await db.update(tenancies)
    .set({
      status: 'inactive',
      leftAt: new Date(),
    })
    .where(eq(tenancies.id, tenancyId));

  // Notify owner
  if (property) {
    c.executionCtx.waitUntil(
      createNotification(
        db,
        property.ownerId,
        'system',
        'Tenant Left Property',
        `${user.name || user.email} has left ${property.name}.`,
        { propertyId: property.id, tenancyId }
      )
    );
  }

  return c.json({
    success: true as const,
    data: {
      hasPendingBills,
      warning: hasPendingBills
        ? 'You have unpaid bills. Please settle them with your landlord.'
        : null,
    },
  }, 200);
});

const archiveTenancyRoute = createRoute({
  method: 'patch',
  path: '/{id}/archive',
  tags: ['Tenancy Actions'],
  summary: 'Tenant archives a past tenancy',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SimpleSuccessResponse } },
      description: 'Tenancy archived',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Tenancy not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Cannot archive an active tenancy',
    },
  },
});

tenancyActionsRouter.openapi(archiveTenancyRoute, async (c) => {
  const user = c.get('user');
  const { id: tenancyId } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const [tenancy] = await db
    .select()
    .from(tenancies)
    .where(and(eq(tenancies.id, tenancyId as string), eq(tenancies.tenantId, user.id)))
    .limit(1);

  if (!tenancy) {
    return c.json({ success: false as const, error: { code: 'NOT_FOUND', message: 'Tenancy not found' } }, 404);
  }

  // Can only archive inactive or property_deleted tenancies
  if (tenancy.status === 'active') {
    return c.json({
      success: false as const,
      error: { code: 'ACTIVE_TENANCY', message: 'Cannot archive an active tenancy. Leave the property first.' }
    }, 409);
  }

  await db.update(tenancies)
    .set({ archivedByTenantAt: new Date() })
    .where(eq(tenancies.id, tenancyId as string));

  // If this was the last tenant to archive it, and the owner has deleted the property, sweep the data.
  // This runs in the background so we don't block the response.
  c.executionCtx.waitUntil(sweepOrphanedPropertyData(db, c.env, tenancy.propertyId));

  return c.json({ success: true as const }, 200);
});

const unarchiveTenancyRoute = createRoute({
  method: 'patch',
  path: '/{id}/unarchive',
  tags: ['Tenancy Actions'],
  summary: 'Tenant restores a past tenancy to visible',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SimpleSuccessResponse } },
      description: 'Tenancy unarchived',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Tenancy not found',
    },
  },
});

tenancyActionsRouter.openapi(unarchiveTenancyRoute, async (c) => {
  const user = c.get('user');
  const { id: tenancyId } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const [tenancy] = await db
    .select()
    .from(tenancies)
    .where(and(eq(tenancies.id, tenancyId as string), eq(tenancies.tenantId, user.id)))
    .limit(1);

  if (!tenancy) {
    return c.json({ success: false as const, error: { code: 'NOT_FOUND', message: 'Tenancy not found' } }, 404);
  }

  await db.update(tenancies)
    .set({ archivedByTenantAt: null })
    .where(eq(tenancies.id, tenancyId as string));

  return c.json({ success: true as const }, 200);
});

const getTenancyBillsRoute = createRoute({
  method: 'get',
  path: '/{id}/bills',
  tags: ['Tenancy Actions'],
  summary: 'Tenant reads their own bills',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    query: z.object({
      year: z.string().optional(),
      status: z.enum(['all', 'pending', 'paid']).optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Tenancy bills retrieved',
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
      description: 'Tenancy not found',
    },
  },
});

tenancyActionsRouter.openapi(getTenancyBillsRoute, async (c) => {
  const { id: tenancyId } = c.req.valid('param');
  const query = c.req.valid('query');
  const year = query.year || new Date().getFullYear().toString();
  const status = query.status || 'all';
  const user = c.get('user');
  const db = getDb(c.env.DB);

  // Load the tenancy
  const [tenancy] = await db.select().from(tenancies).where(eq(tenancies.id, tenancyId)).limit(1);
  if (!tenancy) {
    return c.json({ success: false as const, error: { code: 'TENANCY_NOT_FOUND', message: 'Tenancy not found' } }, 404);
  }

  // Only the tenant themselves (or the property owner) can read these bills
  const [property] = await db.select().from(properties).where(eq(properties.id, tenancy.propertyId)).limit(1);
  const isOwner = property?.ownerId === user.id;
  const isTenant = tenancy.tenantId === user.id;

  if (!isOwner && !isTenant) {
    return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'Access denied' } }, 403);
  }

  // Build conditions
  const conditions = [
    eq(bills.tenancyId, tenancyId),
    like(billingPeriods.periodMonth, `${year}-%`)
  ];
  
  if (status === 'pending' || status === 'paid') {
    conditions.push(eq(bills.status, status));
  }

  // Fetch filtered bills
  const billsData = await db
    .select({
      id: bills.id,
      periodMonth: billingPeriods.periodMonth,
      calculationMode: billingPeriods.calculationMode,
      totalDue: bills.totalDue,
      status: bills.status,
      markedPaidAt: bills.markedPaidAt,
      tenantConsumption: bills.tenantConsumption,
      totalConsumption: bills.totalConsumption,
      splitPercentage: bills.splitPercentage,
      billingPeriodId: bills.billingPeriodId,
      // ponytail: simplified pending request count check per billing period
      hasPendingRequest: sql<number>`(
        SELECT count(*) FROM ${editRequests} 
        WHERE ${editRequests.billingPeriodId} = ${bills.billingPeriodId} 
        AND ${editRequests.requestedBy} = ${user.id} 
        AND ${editRequests.status} = 'pending'
      )`
    })
    .from(bills)
    .innerJoin(billingPeriods, eq(billingPeriods.id, bills.billingPeriodId))
    .where(and(...conditions))
    .orderBy(desc(billingPeriods.periodMonth));

  // Compute yearly stats for ALL bills of this year (regardless of status filter)
  const yearlyBillsQuery = await db
    .select({
      totalDue: bills.totalDue,
      status: bills.status
    })
    .from(bills)
    .innerJoin(billingPeriods, eq(billingPeriods.id, bills.billingPeriodId))
    .where(and(eq(bills.tenancyId, tenancyId), like(billingPeriods.periodMonth, `${year}-%`)));

  let totalPaid = 0;
  let totalPending = 0;
  for (const b of yearlyBillsQuery) {
    const due = b.totalDue || 0;
    if (b.status === 'paid') totalPaid += due;
    else totalPending += due;
  }
  
  const avgMonthlyBill = yearlyBillsQuery.length > 0 
    ? (totalPaid + totalPending) / yearlyBillsQuery.length 
    : 0;

  return c.json({
    propertyName: property?.name || 'Property',
    bills: billsData.map(b => ({
      ...b,
      markedPaidAt: b.markedPaidAt?.toISOString() || null
    })),
    yearlyStats: {
      totalPaid,
      totalPending,
      avgMonthlyBill
    }
  } as unknown as z.infer<typeof SuccessResponse>, 200);
});

const getTenancyRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Tenancy Actions'],
  summary: 'Returns complete tenancy overview for the tenant',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Tenancy retrieved',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Tenancy not found',
    },
  },
});

tenancyActionsRouter.openapi(getTenancyRoute, async (c) => {
  const { id: tenancyId } = c.req.valid('param');
  const user = c.get('user');
  const db = getDb(c.env.DB);

  // 1. Fetch tenancy, property, and owner details
  const [tenancyData] = await db
    .select({
      tenancy: tenancies,
      property: properties,
      owner: userTable
    })
    .from(tenancies)
    .innerJoin(properties, eq(properties.id, tenancies.propertyId))
    .innerJoin(userTable, eq(userTable.id, properties.ownerId))
    .where(and(eq(tenancies.id, tenancyId as string), eq(tenancies.tenantId, user.id as string)))
    .limit(1);

  if (!tenancyData) {
    return c.json({ success: false as const, error: { code: 'NOT_FOUND', message: 'Tenancy not found' } }, 404);
  }

  const { tenancy, property, owner } = tenancyData;

  // 2. Fetch the most recent billing period for this property
  const [currentPeriod] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.propertyId, property.id))
    .orderBy(desc(billingPeriods.periodMonth))
    .limit(1);

  // Fetch the last confirmed period for edit requests
  const [lastConfirmedPeriod] = await db
    .select({ id: billingPeriods.id })
    .from(billingPeriods)
    .where(and(
      eq(billingPeriods.propertyId, property.id),
      eq(billingPeriods.status, 'confirmed')
    ))
    .orderBy(desc(billingPeriods.periodMonth))
    .limit(1);

  let currentPeriodData = null;
  if (currentPeriod) {
    // Check if there is a bill for this tenant in this period
    const [bill] = await db
      .select()
      .from(bills)
      .where(and(eq(bills.billingPeriodId, currentPeriod.id), eq(bills.tenancyId, tenancy.id)))
      .limit(1);

    // Check if a reading has been submitted for this period (in general)
    const [reading] = await db
      .select({ id: meterReadings.id })
      .from(meterReadings)
      .where(eq(meterReadings.billingPeriodId, currentPeriod.id))
      .limit(1);

    currentPeriodData = {
      periodId: currentPeriod.id,
      periodMonth: currentPeriod.periodMonth,
      status: currentPeriod.status,
      bill: bill ? {
        billId: bill.id,
        totalDue: bill.totalDue,
        status: bill.status,
        markedPaidAt: bill.markedPaidAt
      } : null,
      hasReading: !!reading,
      canSubmit: !reading // Simplification: can submit if no reading exists
    };
  }

  // 3. Fetch recent bills for this tenancy (excluding the current period if any)
  const billsQuery = db
    .select({
      billId: bills.id,
      totalDue: bills.totalDue,
      status: bills.status,
      periodMonth: billingPeriods.periodMonth
    })
    .from(bills)
    .innerJoin(billingPeriods, eq(billingPeriods.id, bills.billingPeriodId))
    .where(and(
      eq(bills.tenancyId, tenancy.id),
      currentPeriod ? ne(billingPeriods.id, currentPeriod.id) : undefined
    ))
    .orderBy(desc(billingPeriods.periodMonth))
    .limit(3);

  const recentBills = await billsQuery;

  // 4. Fetch pending edit requests for this tenant on this property
  const [pendingRequestsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(editRequests)
    .innerJoin(billingPeriods, eq(billingPeriods.id, editRequests.billingPeriodId))
    .where(
      and(
        eq(billingPeriods.propertyId, property.id),
        eq(editRequests.requestedBy, user.id),
        eq(editRequests.status, 'pending')
      )
    );

  const pendingEditRequests = pendingRequestsResult?.count || 0;

  // Construct response
  const response = {
    tenancy: {
      id: tenancy.id,
      propertyId: property.id,
      propertyName: property.name,
      propertyAddress: property.address,
      hasSolar: property.hasSolar,
      splitPercentage: tenancy.splitPercentage,
      resolvedSplitPercentage: tenancy.splitPercentage, // Should compute active splits if null, but this works for now
      status: tenancy.status,
      joinedAt: tenancy.joinedAt?.toISOString() || null,
      leftAt: tenancy.leftAt?.toISOString() || null,
      ownerName: owner.name,
      ownerAvatarUrl: owner.image || null,
    },
    currentPeriod: currentPeriodData,
    recentBills,
    pendingEditRequests,
    lastConfirmedPeriodId: lastConfirmedPeriod?.id || null
  };

  return c.json(response as unknown as z.infer<typeof SuccessResponse>, 200);
});

const getPendingEditRequestsRoute = createRoute({
  method: 'get',
  path: '/{id}/pending-edit-requests',
  tags: ['Tenancy Actions'],
  summary: 'Get pending edit requests',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Pending requests retrieved',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Not found',
    },
  },
});

tenancyActionsRouter.openapi(getPendingEditRequestsRoute, async (c) => {
  const { id: tenancyId } = c.req.valid('param');
  const user = c.get('user');
  const db = getDb(c.env.DB);

  const [tenancy] = await db.select().from(tenancies).where(and(eq(tenancies.id, tenancyId), eq(tenancies.tenantId, user.id))).limit(1);
  if (!tenancy) return c.json({ success: false as const, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);

  const requestsData = await db
    .select({ request: editRequests })
    .from(editRequests)
    .innerJoin(billingPeriods, eq(editRequests.billingPeriodId, billingPeriods.id))
    .where(and(
      eq(billingPeriods.propertyId, tenancy.propertyId),
      eq(editRequests.requestedBy, user.id),
      eq(editRequests.status, 'pending')
    ));

  return c.json({ success: true as const, data: requestsData.map(r => r.request) }, 200);
});

const getChartDataRoute = createRoute({
  method: 'get',
  path: '/{id}/chart-data',
  tags: ['Tenancy Actions'],
  summary: 'Get chart data',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Chart data retrieved',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Not found',
    },
  },
});

tenancyActionsRouter.openapi(getChartDataRoute, async (c) => {
  const { id: tenancyId } = c.req.valid('param');
  const user = c.get('user');
  const db = getDb(c.env.DB);

  const [tenancy] = await db.select().from(tenancies).where(and(eq(tenancies.id, tenancyId), eq(tenancies.tenantId, user.id))).limit(1);
  if (!tenancy) return c.json({ success: false as const, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);

  const [property] = await db.select().from(properties).where(eq(properties.id, tenancy.propertyId)).limit(1);

  const allBills = await db
    .select({
      bill: bills,
      periodMonth: billingPeriods.periodMonth,
      reading: meterReadings
    })
    .from(bills)
    .innerJoin(billingPeriods, eq(bills.billingPeriodId, billingPeriods.id))
    .innerJoin(meterReadings, eq(billingPeriods.id, meterReadings.billingPeriodId))
    .where(eq(bills.tenancyId, tenancyId))
    .orderBy(billingPeriods.periodMonth);

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const monthlyBills = allBills.map(b => ({
    month: b.periodMonth.slice(0, 7),
    amount: round2(Number(b.bill.totalDue)),
    status: b.bill.status
  }));

  const monthlyConsumption = allBills.map(b => ({
    month: b.periodMonth.slice(0, 7),
    units: round2(Number(b.bill.tenantConsumption || 0))
  }));

  let solarSavings: Array<{ month: string; actual: number; withoutSolar: number }> | null = null;
  let costTrend: Array<{ month: string; bill: number; exportRefund: number; net: number }> | null = null;
  if (property.hasSolar) {
    solarSavings = allBills.map(b => {
      const tenantConsumption = Number(b.bill.tenantConsumption || 0);
      const consumptionRate = Number(b.bill.consumptionRate || 0);
      const consumptionCost = Number(b.bill.consumptionCost || 0);
      const exportRefund = Number(b.bill.exportRefund || 0);
      const billSolarSavings = (tenantConsumption * consumptionRate) - consumptionCost + exportRefund;
      return {
        month: b.periodMonth.slice(0, 7),
        actual: round2(Number(b.bill.totalDue)),
        withoutSolar: round2(Number(b.bill.totalDue) + billSolarSavings)
      };
    });

    costTrend = allBills.map(b => {
      const billAmount = Number(b.bill.totalDue);
      const exportRefund = Number(b.bill.exportRefund || 0);
      return {
        month: b.periodMonth.slice(0, 7),
        bill: round2(billAmount),
        exportRefund: round2(exportRefund),
        net: round2(billAmount - exportRefund)
      };
    });
  }

  let cumulative = 0;
  const cumulativeBills = allBills.map(b => {
    cumulative += Number(b.bill.totalDue);
    return { month: b.periodMonth.slice(0, 7), cumulative: round2(cumulative) };
  });

  return c.json({
    success: true as const,
    data: {
      monthlyBills,
      monthlyConsumption,
      solarSavings,
      costTrend,
      cumulativeBills
    }
  }, 200);
});

const getConfirmedPeriodsRoute = createRoute({
  method: 'get',
  path: '/{id}/confirmed-periods',
  tags: ['Tenancy Actions'],
  summary: 'Get confirmed periods',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Confirmed periods retrieved',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Access denied',
    },
  },
});

tenancyActionsRouter.openapi(getConfirmedPeriodsRoute, async (c) => {
  const { id: tenancyId } = c.req.valid('param');
  const user = c.get('user');
  const db = getDb(c.env.DB);

  if (!user?.id) {
    return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401);
  }

  const [tenancy] = await db.select()
    .from(tenancies)
    .where(and(eq(tenancies.id, tenancyId), eq(tenancies.tenantId, user.id as string)))
    .limit(1);

  if (!tenancy) {
    return c.json({ success: false as const, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  // Get all confirmed periods for this property
  const periods = await db
    .select({
      id: billingPeriods.id,
      periodMonth: billingPeriods.periodMonth,
    })
    .from(billingPeriods)
    .where(and(
      eq(billingPeriods.propertyId, tenancy.propertyId),
      eq(billingPeriods.status, 'confirmed')
    ))
    .orderBy(desc(billingPeriods.periodMonth));

  // Check which periods have pending edit requests
  const periodsWithRequests = await Promise.all(periods.map(async p => {
    const [req] = await db.select()
      .from(editRequests)
      .where(and(
        eq(editRequests.billingPeriodId, p.id),
        eq(editRequests.requestedBy, user.id),
        eq(editRequests.status, 'pending')
      ))
      .limit(1);
    
    return {
      ...p,
      hasPendingRequest: !!req
    };
  }));

  return c.json({ success: true as const, data: periodsWithRequests }, 200);
});

export { tenancyActionsRouter };
