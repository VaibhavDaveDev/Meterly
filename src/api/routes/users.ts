import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { user as userTable } from '../../db/schema/auth';
import { authMiddleware } from '../middleware/auth';
import { SuccessResponse, ErrorResponse } from '../lib/openapi-schemas';
import type { Bindings, Variables } from '../app';

const usersRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// Guard: require auth for all routes in this router
usersRouter.use('*', authMiddleware);

const getProfileRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Users'],
  summary: 'Get full user profile',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Profile retrieved',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'User not found',
    },
  },
});

usersRouter.openapi(getProfileRoute, async (c) => {
  const user = c.get('user');
  const db = getDb(c.env.DB);
  
  const [fullUser] = await db.select().from(userTable).where(eq(userTable.id, user.id));
  
  if (!fullUser) {
    return c.json({ success: false as const, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }
  
  return c.json({ success: true as const, data: fullUser }, 200);
});

const OnboardingSchema = z.object({
  primaryRole: z.enum(['owner', 'tenant', 'both']).optional().openapi({ example: 'owner' }),
  onboardingChecklist: z.any().optional(),
  markCompleted: z.boolean().optional().openapi({ example: true }),
});

const updateOnboardingRoute = createRoute({
  method: 'patch',
  path: '/onboarding',
  tags: ['Users'],
  summary: 'Update onboarding state',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: OnboardingSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Onboarding state updated',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invalid onboarding payload',
    },
  },
});

usersRouter.openapi(updateOnboardingRoute, async (c) => {
  const user = c.get('user');
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);
  
  const updateData: Record<string, unknown> = {};
  
  if (data.primaryRole !== undefined) {
    updateData.primaryRole = data.primaryRole;
  }
  
  if (data.onboardingChecklist !== undefined) {
    updateData.onboardingChecklist = JSON.stringify(data.onboardingChecklist);
  }
  
  if (data.markCompleted) {
    updateData.onboardingCompletedAt = new Date();
  }
  
  // Nothing to update
  if (Object.keys(updateData).length === 0) {
    return c.json({ success: true as const, data: user }, 200);
  }
  
  updateData.updatedAt = new Date();
  
  await db.update(userTable).set(updateData).where(eq(userTable.id, user.id));
  
  const [updatedUser] = await db.select().from(userTable).where(eq(userTable.id, user.id));
  
  return c.json({ success: true as const, data: updatedUser }, 200);
});

export default usersRouter;
