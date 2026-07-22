import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { properties, tenancies, billingPeriods, bills } from '../../db/schema';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../app';

const exportRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// Guard: require auth for all routes in this router
exportRouter.use('*', authMiddleware);

const DownloadItemSchema = z.object({
  label: z.string(),
  url: z.string(),
  type: z.enum(['owner-property', 'tenancy']),
  description: z.string()
});

const exportAllRoute = createRoute({
  method: 'get',
  path: '/all',
  tags: ['Export'],
  summary: 'Returns links to download all data for the user',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            downloads: z.array(DownloadItemSchema)
          })
        }
      },
      description: 'List of download links retrieved successfully',
    },
  },
});

exportRouter.openapi(exportAllRoute, async (c) => {
  const user = c.get('user');
  const db = getDb(c.env.DB);

  // Find all properties owned by the user
  const ownedProperties = await db.select().from(properties).where(eq(properties.ownerId, user.id));
  
  // Find all tenancies where the user is a tenant
  const userTenancies = await db
    .select({ tenancyId: tenancies.id, propertyName: properties.name })
    .from(tenancies)
    .innerJoin(properties, eq(properties.id, tenancies.propertyId))
    .where(eq(tenancies.tenantId, user.id));

  const downloads: Array<{ label: string; url: string; type: 'owner-property' | 'tenancy'; description: string }> = [];

  // Links for property owners
  for (const p of ownedProperties) {
    const [periodCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(billingPeriods)
      .where(eq(billingPeriods.propertyId, p.id));
      
    downloads.push({
      type: 'owner-property',
      label: `${p.name} — Billing History`,
      url: `/api/properties/${p.id}/export/csv`,
      description: `${periodCount?.count || 0} billing periods`
    });
  }

  // Links for tenants
  for (const t of userTenancies) {
    const [billCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bills)
      .where(eq(bills.tenancyId, t.tenancyId));
      
    downloads.push({
      type: 'tenancy',
      label: `${t.propertyName} — My Bills`,
      url: `/api/tenancies/${t.tenancyId}/export/csv`,
      description: `${billCount?.count || 0} bills`
    });
  }

  return c.json({
    downloads
  }, 200);
});

export { exportRouter };
