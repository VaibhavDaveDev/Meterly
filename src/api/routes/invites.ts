/**
 * Invite Routes — /api/invites
 *
 * Handles the full invite lifecycle:
 *  - Tenant: view pending invites, accept, decline
 *  - Owner: cancel a pending invite
 *
 * Route hierarchy:
 *   GET    /api/invites/pending          — tenant: see all invites addressed to their email
 *   GET    /api/invites/:token           — public: resolve invite token (used on /invite/[token] page)
 *   POST   /api/invites/:token/accept    — tenant: accept an invite (must be logged in)
 *   POST   /api/invites/:token/decline   — tenant: decline an invite
 *   DELETE /api/invites/:token/cancel    — owner: cancel a pending invite they sent
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db';
import { tenancies, properties } from '../../db/schema';
import { authMiddleware } from '../middleware/auth';
import { sendEmail } from '../lib/email';
import { createNotification } from '../lib/notifications';
import { reconcileSplitsAfterRemoval } from '../lib/solo-mode';
import { SuccessResponse, SimpleSuccessResponse, ErrorResponse } from '../lib/openapi-schemas';
import type { Bindings, Variables } from '../app';

const invitesRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

invitesRouter.use('/pending', authMiddleware);
invitesRouter.use('/:token/accept', authMiddleware);
invitesRouter.use('/:token/decline', authMiddleware);
invitesRouter.use('/:token/cancel', authMiddleware);

const TokenParam = z.object({
  token: z.string().openapi({ example: 'invite_token_123' }),
});

const getPendingInvitesRoute = createRoute({
  method: 'get',
  path: '/pending',
  tags: ['Invites'],
  summary: 'Get pending invites for user',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Pending invites retrieved',
    },
  },
});

invitesRouter.openapi(getPendingInvitesRoute, async (c) => {
    const user = c.get('user');
    const db = getDb(c.env.DB);
    const now = new Date();

    const pendingInvites = await db
      .select({
        tenancyId: tenancies.id,
        propertyId: tenancies.propertyId,
        inviteToken: tenancies.inviteToken,
        splitPercentage: tenancies.splitPercentage,
        invitedAt: tenancies.invitedAt,
        inviteExpiresAt: tenancies.inviteExpiresAt,
        propertyName: properties.name,
        propertyAddress: properties.address,
        propertyOwnerId: properties.ownerId,
      })
      .from(tenancies)
      .innerJoin(properties, eq(tenancies.propertyId, properties.id))
      .where(
        and(
          eq(tenancies.inviteEmail, user.email),
          eq(tenancies.status, 'invited')
        )
      );

    const enriched = pendingInvites.map(inv => ({
      ...inv,
      isExpired: inv.inviteExpiresAt ? inv.inviteExpiresAt < now : false,
    }));

    return c.json({ success: true as const, data: enriched }, 200);
});

const getInviteRoute = createRoute({
  method: 'get',
  path: '/{token}',
  tags: ['Invites'],
  summary: 'Get invite by token',
  request: {
    params: TokenParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Invite retrieved',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing token',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invite not found',
    },
    410: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invite declined or already used',
    },
  },
});

invitesRouter.openapi(getInviteRoute, async (c) => {
  const { token } = c.req.valid('param');
  const db = getDb(c.env.DB);
  const { user } = await import('../../db/schema');

  const [row] = await db
    .select({
      tenancyId: tenancies.id,
      status: tenancies.status,
      inviteEmail: tenancies.inviteEmail,
      inviteExpiresAt: tenancies.inviteExpiresAt,
      splitPercentage: tenancies.splitPercentage,
      propertyId: tenancies.propertyId,
      propertyName: properties.name,
      propertyAddress: properties.address,
      ownerName: user.name,
    })
    .from(tenancies)
    .innerJoin(properties, eq(tenancies.propertyId, properties.id))
    .innerJoin(user, eq(properties.ownerId, user.id))
    .where(eq(tenancies.inviteToken, token))
    .limit(1);

  if (!row) {
    return c.json({ success: false as const, error: { code: 'INVITE_NOT_FOUND', message: 'Invite not found or has been cancelled.' } }, 404);
  }

  if (row.status === 'declined') {
    return c.json({ success: false as const, error: { code: 'INVITE_DECLINED', message: 'This invite was already declined.' } }, 410);
  }

  if (row.status === 'active' || row.status === 'inactive') {
    return c.json({ success: false as const, error: { code: 'INVITE_ALREADY_USED', message: 'This invite has already been accepted.' } }, 410);
  }

  const isExpired = row.inviteExpiresAt ? row.inviteExpiresAt < new Date() : false;

  return c.json({
    success: true as const,
    data: {
      ...row,
      isExpired,
    },
  }, 200);
});

const acceptInviteRoute = createRoute({
  method: 'post',
  path: '/{token}/accept',
  tags: ['Invites'],
  summary: 'Accept an invite',
  security: [{ cookieAuth: [] }],
  request: {
    params: TokenParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Invite accepted',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing token',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Email mismatch',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invite not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invite not pending',
    },
    410: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invite expired',
    },
  },
});

invitesRouter.openapi(acceptInviteRoute, async (c) => {
    const { token } = c.req.valid('param');
    const user = c.get('user');
    const db = getDb(c.env.DB);

    const [tenancy] = await db
      .select()
      .from(tenancies)
      .where(eq(tenancies.inviteToken, token))
      .limit(1);

    if (!tenancy) {
      return c.json({ success: false as const, error: { code: 'INVITE_NOT_FOUND', message: 'Invite not found or has been cancelled.' } }, 404);
    }

    if (tenancy.status !== 'invited') {
      return c.json({ success: false as const, error: { code: 'INVITE_NOT_PENDING', message: 'This invite is no longer valid.' } }, 409);
    }

    // Check expiry
    if (tenancy.inviteExpiresAt && tenancy.inviteExpiresAt < new Date()) {
      return c.json({ success: false as const, error: { code: 'INVITE_EXPIRED', message: 'This invite has expired. Ask the owner to send a new one.' } }, 410);
    }

    if (user.email.toLowerCase() !== (tenancy.inviteEmail ?? '').toLowerCase()) {
      return c.json({
        success: false as const,
        error: {
          code: 'INVITE_EMAIL_MISMATCH',
          message: `This invite was sent to ${tenancy.inviteEmail}. Please log in with that email address to accept it.`,
        },
      }, 403);
    }

    await db
      .update(tenancies)
      .set({
        tenantId: user.id,
        status: 'active',
        joinedAt: new Date(),
        inviteToken: null,
      })
      .where(eq(tenancies.id, tenancy.id));

    const [property] = await db.select().from(properties).where(eq(properties.id, tenancy.propertyId)).limit(1);
    if (property) {
      c.executionCtx.waitUntil(
        createNotification(db, property.ownerId, 'tenant_accepted', 'Invite Accepted', `${user.email} has joined ${property.name} as a tenant.`, { tenancyId: tenancy.id, propertyId: property.id })
      );
    }

    return c.json({
      success: true as const,
      data: {
        tenancyId: tenancy.id,
        propertyId: tenancy.propertyId,
      },
    }, 200);
});

const declineInviteRoute = createRoute({
  method: 'post',
  path: '/{token}/decline',
  tags: ['Invites'],
  summary: 'Decline an invite',
  security: [{ cookieAuth: [] }],
  request: {
    params: TokenParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SimpleSuccessResponse } },
      description: 'Invite declined',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing token',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Email mismatch',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invite not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invite not pending',
    },
  },
});

invitesRouter.openapi(declineInviteRoute, async (c) => {
    const { token } = c.req.valid('param');
    const user = c.get('user');
    const db = getDb(c.env.DB);

    const [tenancy] = await db
      .select()
      .from(tenancies)
      .where(eq(tenancies.inviteToken, token))
      .limit(1);

    if (!tenancy) {
      return c.json({ success: false as const, error: { code: 'INVITE_NOT_FOUND', message: 'Invite not found.' } }, 404);
    }

    if (tenancy.status !== 'invited') {
      return c.json({ success: false as const, error: { code: 'INVITE_NOT_PENDING', message: 'This invite is no longer pending.' } }, 409);
    }

    if (user.email.toLowerCase() !== (tenancy.inviteEmail ?? '').toLowerCase()) {
      return c.json({
        success: false as const,
        error: {
          code: 'INVITE_EMAIL_MISMATCH',
          message: `This invite was sent to ${tenancy.inviteEmail}.`,
        },
      }, 403);
    }

    await db
      .update(tenancies)
      .set({
        status: 'declined',
        declinedAt: new Date(),
        inviteToken: null,
      })
      .where(eq(tenancies.id, tenancy.id));

    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, tenancy.propertyId))
      .limit(1);

    if (property) {
      sendEmail(c.env, {
        to: user.email,
        subject: `Meterly: ${user.email} declined your invitation`,
        html: `
          <p>${user.email} declined your invitation to join <strong>${property.name}</strong> on Meterly.</p>
          <p>You can invite someone else from your property's Tenants settings.</p>
        `,
      }).catch(err => console.error('[invites/decline] Failed to send decline notification:', err));
    }

    return c.json({ success: true as const }, 200);
});

const cancelInviteRoute = createRoute({
  method: 'delete',
  path: '/{token}/cancel',
  tags: ['Invites'],
  summary: 'Cancel an invite',
  security: [{ cookieAuth: [] }],
  request: {
    params: TokenParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Invite cancelled',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing token',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invite not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invite not pending',
    },
  },
});

invitesRouter.openapi(cancelInviteRoute, async (c) => {
    const { token } = c.req.valid('param');
    const user = c.get('user');
    const db = getDb(c.env.DB);

    const [tenancy] = await db
      .select()
      .from(tenancies)
      .where(eq(tenancies.inviteToken, token))
      .limit(1);

    if (!tenancy) {
      return c.json({ success: false as const, error: { code: 'INVITE_NOT_FOUND', message: 'Invite not found.' } }, 404);
    }

    if (tenancy.status !== 'invited') {
      return c.json({ success: false as const, error: { code: 'INVITE_NOT_PENDING', message: 'Only pending invites can be cancelled.' } }, 409);
    }

    const [property] = await db
      .select()
      .from(properties)
      .where(and(eq(properties.id, tenancy.propertyId), eq(properties.ownerId, user.id)))
      .limit(1);

    if (!property) {
      return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: 'Only the property owner can cancel invites.' } }, 403);
    }

    await db
      .update(tenancies)
      .set({
        status: 'inactive',
        leftAt: new Date(),
        inviteToken: null,
        removalReason: 'other',
      })
      .where(eq(tenancies.id, tenancy.id));

    await reconcileSplitsAfterRemoval(db, tenancy.propertyId);

    return c.json({ success: true as const, data: { cancelled: true } }, 200);
});

export { invitesRouter };
