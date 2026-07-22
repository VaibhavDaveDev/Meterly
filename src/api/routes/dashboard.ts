import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { getDb } from '../../db';
import { authMiddleware } from '../middleware/auth';
import { getOwnerDashboardStats, getTenantDashboardStats } from '../lib/dashboard-queries';
import type { Bindings, Variables } from '../app';
import { SuccessResponse } from '../lib/openapi-schemas';

const dashboardRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// Guard: require auth for all routes in this router
dashboardRouter.use('*', authMiddleware);

const getOwnerStatsRoute = createRoute({
  method: 'get',
  path: '/owner',
  tags: ['Dashboard'],
  summary: 'Get owner dashboard stats',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Owner dashboard stats retrieved successfully',
    },
  },
});

dashboardRouter.openapi(getOwnerStatsRoute, async (c) => {
  const currentUser = c.get('user');
  const db = getDb(c.env.DB);
  const data = await getOwnerDashboardStats(db, currentUser.id);
  
  return c.json({
    success: true as const,
    data
  }, 200);
});

const getTenantStatsRoute = createRoute({
  method: 'get',
  path: '/tenant',
  tags: ['Dashboard'],
  summary: 'Get tenant dashboard stats',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Tenant dashboard stats retrieved successfully',
    },
  },
});

dashboardRouter.openapi(getTenantStatsRoute, async (c) => {
  const currentUser = c.get('user');
  const db = getDb(c.env.DB);
  const data = await getTenantDashboardStats(db, currentUser.id);
  
  return c.json({
    success: true as const,
    data
  }, 200);
});

export { dashboardRouter };
