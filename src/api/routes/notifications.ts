import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc, lt, isNull } from 'drizzle-orm';
import { getDb } from '../../db';
import { notifications } from '../../db/schema';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../app';
import { SuccessResponse, ErrorResponse, IdParam } from '../lib/openapi-schemas';

const notificationsRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

notificationsRouter.use('*', authMiddleware);

const getNotificationsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Notifications'],
  summary: 'List user notifications',
  security: [{ cookieAuth: [] }],
  request: {
    query: z.object({
      before: z.string().openapi({ format: 'date-time', description: 'Cursor for pagination (ISO datetime)' }).optional(),
      limit: z.coerce.number().min(1).max(50).default(20).optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Notifications retrieved successfully',
    },
  },
});

notificationsRouter.openapi(getNotificationsRoute, async (c) => {
  const user = c.get('user');
  const { before, limit } = c.req.valid('query');
  const actualLimit = limit ?? 20;
  const db = getDb(c.env.DB);

  let query = db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(actualLimit);

  if (before) {
    const beforeDate = new Date(before);
    if (!isNaN(beforeDate.getTime())) {
      query = db
        .select()
        .from(notifications)
        .where(and(
          eq(notifications.userId, user.id),
          lt(notifications.createdAt, beforeDate)
        ))
        .orderBy(desc(notifications.createdAt))
        .limit(actualLimit);
    }
  }

  const result = await query;

  return c.json({
    success: true as const,
    data: result,
  }, 200);
});

const markReadRoute = createRoute({
  method: 'patch',
  path: '/{id}/read',
  tags: ['Notifications'],
  summary: 'Mark notification as read',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } },
      description: 'Notification marked as read',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Validation error',
    }
  },
});

notificationsRouter.openapi(markReadRoute, async (c) => {
  const { id: notificationId } = c.req.valid('param');
  const user = c.get('user');
  const db = getDb(c.env.DB);

  await db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, user.id)
    ));

  return c.json({ success: true as const }, 200);
});

const markAllReadRoute = createRoute({
  method: 'post',
  path: '/read-all',
  tags: ['Notifications'],
  summary: 'Mark all notifications as read',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } },
      description: 'All notifications marked as read',
    },
  },
});

notificationsRouter.openapi(markAllReadRoute, async (c) => {
  const user = c.get('user');
  const db = getDb(c.env.DB);

  await db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(
      eq(notifications.userId, user.id),
      isNull(notifications.readAt)
    ));

  return c.json({ success: true as const }, 200);
});

export { notificationsRouter };
