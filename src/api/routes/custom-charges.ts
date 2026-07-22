import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db';
import { customCharges, tenancies } from '../../db/schema';
import { authMiddleware } from '../middleware/auth';
import { requireOwner } from '../lib/property-auth';
import { createNotification } from '../lib/notifications';
import { SuccessResponse, ErrorResponse, IdParam } from '../lib/openapi-schemas';
import type { Bindings, Variables } from '../app';

const chargesRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

chargesRouter.use('*', authMiddleware);

const CustomChargeSchema = z.object({
  name: z.string().min(1, 'Charge name is required').max(100, 'Charge name too long (max 100 characters)').openapi({ example: 'Internet' }),
  amount: z.number().openapi({ example: 45.5 }),
  chargedToTenant: z.boolean().default(true).openapi({ example: true }),
  isActive: z.boolean().default(true).openapi({ example: true }),
});

const listChargesRoute = createRoute({
  method: 'get',
  path: '/{id}/charges',
  tags: ['Custom Charges'],
  summary: 'List custom charges for property',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Custom charges listed',
    },
  },
});

chargesRouter.openapi(listChargesRoute, async (c) => {
  const { id: propertyId } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const charges = await db
    .select()
    .from(customCharges)
    .where(eq(customCharges.propertyId, propertyId));

  return c.json({
    success: true as const,
    data: charges,
  }, 200);
});

const createChargeRoute = createRoute({
  method: 'post',
  path: '/{id}/charges',
  tags: ['Custom Charges'],
  summary: 'Create custom charge',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    body: {
      content: { 'application/json': { schema: CustomChargeSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Charge created',
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

chargesRouter.openapi(createChargeRoute, async (c) => {
  const { id: propertyId } = c.req.valid('param');
  const user = c.get('user');
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  // Authorization: Must be owner
  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'Only the property owner can manage custom charges' } }, 403);
  }

  const chargeId = crypto.randomUUID();
  await db.insert(customCharges).values({
    id: chargeId,
    propertyId: propertyId,
    name: data.name,
    amount: data.amount,
    chargedToTenant: data.chargedToTenant,
    isActive: data.isActive,
  });

  const [newCharge] = await db.select().from(customCharges).where(eq(customCharges.id, chargeId)).limit(1);

  const activeTenancies = await db.select().from(tenancies).where(and(eq(tenancies.propertyId, propertyId), eq(tenancies.status, 'active')));
  for (const t of activeTenancies) {
    if (t.tenantId) {
      c.executionCtx.waitUntil(
        createNotification(db, t.tenantId, 'charge_added', 'New Recurring Charge', `A new recurring charge "${newCharge.name}" has been added for ${property.name}.`, { propertyId })
      );
    }
  }

  return c.json({
    success: true as const,
    data: newCharge,
  }, 200);
});

const updateChargeRoute = createRoute({
  method: 'patch',
  path: '/charges/{id}',
  tags: ['Custom Charges'],
  summary: 'Update custom charge',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    body: {
      content: { 'application/json': { schema: CustomChargeSchema.partial() } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Charge updated',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Validation error',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Charge not found',
    },
  },
});

chargesRouter.openapi(updateChargeRoute, async (c) => {
  const { id: chargeId } = c.req.valid('param');
  const user = c.get('user');
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  const [charge] = await db.select().from(customCharges).where(eq(customCharges.id, chargeId)).limit(1);
  if (!charge) {
    return c.json({ success: false as const, error: { code: 'CHARGE_NOT_FOUND', message: 'Custom charge not found' } }, 404);
  }

  // Check if user owns the property this charge belongs to
  const property = await requireOwner(db, charge.propertyId, user.id);
  if (!property) {
    return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'You do not have permission to edit this charge' } }, 403);
  }

  await db.update(customCharges)
    .set({
      ...data,
    })
    .where(eq(customCharges.id, chargeId));

  const [updatedCharge] = await db.select().from(customCharges).where(eq(customCharges.id, chargeId)).limit(1);

  const activeTenancies = await db.select().from(tenancies).where(and(eq(tenancies.propertyId, property.id), eq(tenancies.status, 'active')));
  for (const t of activeTenancies) {
    if (t.tenantId) {
      c.executionCtx.waitUntil(
        createNotification(db, t.tenantId, 'charge_updated', 'Recurring Charge Updated', `The recurring charge "${updatedCharge.name}" has been updated for ${property.name}.`, { propertyId: property.id })
      );
    }
  }

  return c.json({
    success: true as const,
    data: updatedCharge,
  }, 200);
});

const deleteChargeRoute = createRoute({
  method: 'delete',
  path: '/charges/{id}',
  tags: ['Custom Charges'],
  summary: 'Delete custom charge',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Charge deleted',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Charge not found',
    },
  },
});

chargesRouter.openapi(deleteChargeRoute, async (c) => {
  const { id: chargeId } = c.req.valid('param');
  const user = c.get('user');
  const db = getDb(c.env.DB);

  const [charge] = await db.select().from(customCharges).where(eq(customCharges.id, chargeId)).limit(1);
  if (!charge) {
    return c.json({ success: false as const, error: { code: 'CHARGE_NOT_FOUND', message: 'Custom charge not found' } }, 404);
  }

  // Check if user owns the property this charge belongs to
  const property = await requireOwner(db, charge.propertyId, user.id);
  if (!property) {
    return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'You do not have permission to delete this charge' } }, 403);
  }

  await db.delete(customCharges).where(eq(customCharges.id, chargeId));

  return c.json({
    success: true as const,
    data: { id: chargeId },
  }, 200);
});

export { chargesRouter };
