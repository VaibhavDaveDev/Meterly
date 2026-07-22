import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc, lte } from 'drizzle-orm';
import { getDb } from '../../db';
import { properties, propertyRates, tenancies } from '../../db/schema';
import { authMiddleware } from '../middleware/auth';
import { requireOwner } from '../lib/property-auth';
import { createNotification } from '../lib/notifications';
import { SuccessResponse, ErrorResponse, IdParam } from '../lib/openapi-schemas';
import type { Bindings, Variables } from '../app';

const ratesRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

ratesRouter.use('*', authMiddleware);

const PropertyRateSchema = z.object({
  consumptionRate: z.number().min(0).openapi({ example: 0.15 }),
  exportRate: z.number().min(0).default(0).openapi({ example: 0.05 }),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").openapi({ example: '2026-07-01' }),
});

const listRatesRoute = createRoute({
  method: 'get',
  path: '/{id}/rates',
  tags: ['Rates'],
  summary: 'List rate history for property',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Rate history listed',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Not authorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Property not found',
    },
  },
});

ratesRouter.openapi(listRatesRoute, async (c) => {
  const { id: propertyId } = c.req.valid('param');
  const user = c.get('user');
  const db = getDb(c.env.DB);

  // Authorization: Must be owner or tenant
  const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
  if (!property) {
    return c.json({ success: false as const, error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found' } }, 404);
  }

  // Check if owner or active tenant
  if (property.ownerId !== user.id) {
    const [tenancy] = await db.select().from(tenancies).where(and(eq(tenancies.propertyId, propertyId), eq(tenancies.tenantId, user.id), eq(tenancies.status, 'active'))).limit(1);
    if (!tenancy) {
      return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'Not authorized to view rates for this property' } }, 403);
    }
  }

  const rates = await db
    .select()
    .from(propertyRates)
    .where(eq(propertyRates.propertyId, propertyId))
    .orderBy(desc(propertyRates.effectiveFrom));

  return c.json({
    success: true as const,
    data: rates,
  }, 200);
});

const currentRateRoute = createRoute({
  method: 'get',
  path: '/{id}/rates/current',
  tags: ['Rates'],
  summary: 'Get current effective rates',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Current rate retrieved',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Not authorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Property or rate not found',
    },
  },
});

ratesRouter.openapi(currentRateRoute, async (c) => {
  const { id: propertyId } = c.req.valid('param');
  const user = c.get('user');
  const db = getDb(c.env.DB);
  const now = new Date().toISOString().split('T')[0];

  const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
  if (!property) {
    return c.json({ success: false as const, error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found' } }, 404);
  }

  // Check if owner or active tenant
  if (property.ownerId !== user.id) {
    const [tenancy] = await db.select().from(tenancies).where(and(eq(tenancies.propertyId, propertyId), eq(tenancies.tenantId, user.id), eq(tenancies.status, 'active'))).limit(1);
    if (!tenancy) {
      return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'Not authorized to view rates for this property' } }, 403);
    }
  }

  const [currentRate] = await db
    .select()
    .from(propertyRates)
    .where(and(
      eq(propertyRates.propertyId, propertyId),
      lte(propertyRates.effectiveFrom, now)
    ))
    .orderBy(desc(propertyRates.effectiveFrom))
    .limit(1);

  if (!currentRate) {
    return c.json({ success: false as const, error: { code: 'RATES_NOT_FOUND', message: 'No effective rates found for this property' } }, 404);
  }

  return c.json({
    success: true as const,
    data: currentRate,
  }, 200);
});

const createRateRoute = createRoute({
  method: 'post',
  path: '/{id}/rates',
  tags: ['Rates'],
  summary: 'Add new rates',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    body: {
      content: { 'application/json': { schema: PropertyRateSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Rate created',
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

ratesRouter.openapi(createRateRoute, async (c) => {
  const { id: propertyId } = c.req.valid('param');
  const user = c.get('user');
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  // Authorization: Must be owner
  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'Only the property owner can update rates' } }, 403);
  }

  const rateId = crypto.randomUUID();
  await db.insert(propertyRates).values({
    id: rateId,
    propertyId: propertyId,
    consumptionRate: data.consumptionRate,
    exportRate: data.exportRate,
    effectiveFrom: data.effectiveFrom,
    createdBy: user.id,
  });

  const [newRate] = await db.select().from(propertyRates).where(eq(propertyRates.id, rateId)).limit(1);

  const activeTenancies = await db.select().from(tenancies).where(and(eq(tenancies.propertyId, propertyId), eq(tenancies.status, 'active')));
  for (const t of activeTenancies) {
    if (t.tenantId) {
      c.executionCtx.waitUntil(
        createNotification(db, t.tenantId, 'rate_changed', 'Rates Updated', `Rates for ${property.name} have been updated.`, { propertyId })
      );
    }
  }

  return c.json({
    success: true as const,
    data: newRate,
  }, 200);
});

const deleteRateRoute = createRoute({
  method: 'delete',
  path: '/{propertyId}/rates/{rateId}',
  tags: ['Rates'],
  summary: 'Delete a rate',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      propertyId: z.string().openapi({ example: 'uuid-1234' }),
      rateId: z.string().openapi({ example: 'uuid-5678' }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Rate deleted',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Cannot delete the only rate',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
  },
});

ratesRouter.openapi(deleteRateRoute, async (c) => {
  const { propertyId, rateId } = c.req.valid('param');
  const user = c.get('user');
  const db = getDb(c.env.DB);

  // Authorization: Must be owner
  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'Only the property owner can delete rates' } }, 403);
  }

  // Ensure it's not the only rate
  const allRates = await db.select().from(propertyRates).where(eq(propertyRates.propertyId, propertyId));
  if (allRates.length <= 1) {
    return c.json({ success: false as const, error: { code: 'CANNOT_DELETE_LAST_RATE', message: 'Cannot delete the only rate for a property' } }, 400);
  }

  await db.delete(propertyRates).where(and(eq(propertyRates.id, rateId), eq(propertyRates.propertyId, propertyId)));

  return c.json({ success: true as const, data: { deletedId: rateId } }, 200);
});

export { ratesRouter };
