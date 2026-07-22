import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq, and, or, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { tenancies, bills } from '../../db/schema';
import { user as userTable } from '../../db/schema/auth';
import { authMiddleware } from '../middleware/auth';
import { sendEmail, checkEmailRateLimit } from '../lib/email';
import { tenantInviteTemplate } from '../lib/email-templates';
import { reconcileSplitsAfterRemoval } from '../lib/solo-mode';
import { requireOwner } from '../lib/property-auth';
import { SuccessResponse, ErrorResponse } from '../lib/openapi-schemas';
import type { Bindings, Variables } from '../app';

const tenanciesRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

tenanciesRouter.use('*', authMiddleware);

const InviteTenantSchema = z.object({
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email').openapi({ example: 'tenant@meterly.app' }),
  splitPercentage: z.number().min(0).max(100).optional(),
});

const RemoveTenantSchema = z.object({
  removalReason: z.enum(['moved_out', 'lease_ended', 'evicted', 'other']).optional(),
  // Whether to exclude tenant from any in-progress billing period
  excludeCurrentPeriod: z.boolean().default(false),
});

const getTenanciesRoute = createRoute({
  method: 'get',
  path: '/{propertyId}/tenancies',
  tags: ['Tenancies'],
  summary: 'Get tenancies for a property',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      propertyId: z.string().openapi({ example: 'uuid-1234' }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Tenancies retrieved',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing property ID',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
  },
});

tenanciesRouter.openapi(getTenanciesRoute, async (c) => {
  const { propertyId } = c.req.valid('param');
  const user = c.get('user');
  const db = getDb(c.env.DB);

  // Only the owner can list tenancies
  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'You do not own this property' } }, 403);
  }

  const allQuery = await db
    .select({
      tenancy: tenancies,
      tenantName: userTable.name,
      unpaidBillsCount: sql<number>`(SELECT count(*) FROM ${bills} WHERE ${bills.tenancyId} = ${tenancies.id} AND ${bills.status} = 'pending')`
    })
    .from(tenancies)
    .leftJoin(userTable, eq(tenancies.tenantId, userTable.id))
    .where(
      and(
        eq(tenancies.propertyId, propertyId),
        eq(tenancies.isOwnerTenancy, false) // never expose the internal owner tenancy
      )
    );

  const all = allQuery.map(row => ({
    ...row.tenancy,
    tenantName: row.tenantName,
    unpaidBills: Number(row.unpaidBillsCount || 0)
  }));

  // Group into four lists for clean frontend rendering
  const active   = all.filter(t => t.status === 'active');
  const invited  = all.filter(t => t.status === 'invited');
  // 'past' includes both removed tenants AND declined/expired invites so owners have full visibility
  const past     = all.filter(t => t.status === 'inactive' || t.status === 'declined');

  return c.json({ success: true as const, data: { active, invited, past } }, 200);
});

const inviteTenantRoute = createRoute({
  method: 'post',
  path: '/{propertyId}/tenancies/invite',
  tags: ['Tenancies'],
  summary: 'Invite a new tenant',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      propertyId: z.string().openapi({ example: 'uuid-1234' }),
    }),
    body: {
      content: { 'application/json': { schema: InviteTenantSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Tenant invited',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Validation error',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Property not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Tenancy already exists',
    },
    429: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Rate limit exceeded',
    },
  },
});

tenanciesRouter.openapi(inviteTenantRoute, async (c) => {
  const { propertyId } = c.req.valid('param');
  const user = c.get('user');
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  if (!checkEmailRateLimit(user.id)) {
    return c.json({ success: false as const, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Please wait a minute before sending another invite' } }, 429);
  }

  // Check ownership
  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json({ success: false as const, error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found or you are not the owner' } }, 404);
  }

  // Block if this email already has an active or pending invite for this property
  const [existingActive] = await db
    .select()
    .from(tenancies)
    .where(
      and(
        eq(tenancies.propertyId, propertyId),
        eq(tenancies.inviteEmail, data.email),
        or(
          eq(tenancies.status, 'active'),
          eq(tenancies.status, 'invited')
        )
      )
    )
    .limit(1);

  if (existingActive) {
    // An expired 'invited' tenancy should not block a re-invite
    const isExpired = existingActive.status === 'invited' &&
      existingActive.inviteExpiresAt !== null &&
      existingActive.inviteExpiresAt < new Date();

    if (!isExpired) {
      const msg = existingActive.status === 'active'
        ? 'This tenant already has an active tenancy for this property.'
        : 'An invite is already pending for this email. It expires in 7 days. You can cancel the existing invite first, or wait for it to expire.';
      return c.json({ success: false as const, error: { code: 'TENANCY_EXISTS', message: msg } }, 409);
    }
    // Expired invite — fall through and create a new one
  }

  // Always create a fresh tenancy record — even if they had a past inactive one
  const inviteToken = crypto.randomUUID();
  const tenancyId = crypto.randomUUID();

  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  await db.insert(tenancies).values({
    id: tenancyId,
    propertyId,
    inviteEmail: data.email,
    inviteToken,
    status: 'invited',
    splitPercentage: data.splitPercentage ?? null,
    invitedAt: new Date(),
    inviteExpiresAt,
  });

  const inviteUrl = `${c.env.BETTER_AUTH_URL}/invite/${inviteToken}`;
  try {
    const template = tenantInviteTemplate(user.name, property.name, inviteUrl);
    await sendEmail(c.env, {
      to: data.email,
      subject: template.subject,
      html: template.html,
    });
  } catch (error) {
    console.error('Failed to send invite email:', error);
    return c.json({
      success: true as const,
      data: { tenancyId, inviteToken },
      warning: 'Tenancy created but the invitation email failed to send.',
    } as unknown as z.infer<typeof SuccessResponse>, 201); // fallback
  }

  return c.json({ success: true as const, data: { tenancyId, inviteToken } }, 201);
});

const removeTenantRoute = createRoute({
  method: 'patch',
  path: '/{tenancyId}/remove',
  tags: ['Tenancies'],
  summary: 'Remove a tenant',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      tenancyId: z.string().openapi({ example: 'uuid-1234' }),
    }),
    body: {
      content: { 'application/json': { schema: RemoveTenantSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Tenant removed',
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
      description: 'Tenancy not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Already removed',
    },
  },
});

tenanciesRouter.openapi(removeTenantRoute, async (c) => {
  const { tenancyId } = c.req.valid('param');
  const user = c.get('user');
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  // Load tenancy + verify ownership
  const [tenancy] = await db.select().from(tenancies).where(eq(tenancies.id, tenancyId)).limit(1);
  if (!tenancy) {
    return c.json({ success: false as const, error: { code: 'TENANCY_NOT_FOUND', message: 'Tenancy not found' } }, 404);
  }

  const property = await requireOwner(db, tenancy.propertyId, user.id);
  if (!property) {
    return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'You do not own this property' } }, 403);
  }

  if (tenancy.isOwnerTenancy) {
    return c.json({ success: false as const, error: { code: 'CANNOT_REMOVE_OWNER_TENANCY', message: 'Cannot remove the owner tenancy. Toggle solo mode off instead.' } }, 400);
  }

  if (tenancy.status === 'inactive') {
    return c.json({ success: false as const, error: { code: 'ALREADY_INACTIVE', message: 'This tenant has already been removed.' } }, 409);
  }

  // Soft-delete the tenancy
  await db
    .update(tenancies)
    .set({
      status: 'inactive',
      leftAt: new Date(),
      removalReason: data.removalReason ?? null,
    })
    .where(eq(tenancies.id, tenancyId));

  // Reconcile remaining tenants' splits — reset to equal if they no longer sum to 100%
  const splitsReset = await reconcileSplitsAfterRemoval(db, tenancy.propertyId);

  return c.json({
    success: true as const,
    data: {
      tenancyId,
      splitsReset, // frontend uses this to show the "splits were reset" warning toast
    },
  }, 200);
});

const UpdateSplitsSchema = z.record(z.string(), z.number().min(0).max(100));

const updateSplitsRoute = createRoute({
  method: 'patch',
  path: '/{propertyId}/tenancies/splits',
  tags: ['Tenancies'],
  summary: 'Update split percentages',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      propertyId: z.string().openapi({ example: 'uuid-1234' }),
    }),
    body: {
      content: { 'application/json': { schema: UpdateSplitsSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ success: z.literal(true), message: z.string() }) } },
      description: 'Splits updated',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Validation error',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Property not found',
    },
  },
});

tenanciesRouter.openapi(updateSplitsRoute, async (c) => {
  const { propertyId } = c.req.valid('param');
  const user = c.get('user');
  const splits = c.req.valid('json');
  const db = getDb(c.env.DB);

  // Check ownership
  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json({ success: false as const, error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found or you are not the owner' } }, 404);
  }

  const sum = Object.values(splits).reduce((a, b) => a + b, 0);
  
  // Floating point sum check
  if (Math.abs(sum - 100) > 0.01) {
    return c.json({ success: false as const, error: { code: 'INVALID_SUM', message: 'Splits must sum to exactly 100%' } }, 400);
  }

  // Update each tenancy
  for (const [id, percentage] of Object.entries(splits)) {
    await db.update(tenancies).set({ splitPercentage: percentage }).where(and(eq(tenancies.id, id), eq(tenancies.propertyId, propertyId)));
  }

  return c.json({ success: true as const, message: 'Splits updated successfully' }, 200);
});

export { tenanciesRouter };
