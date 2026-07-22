import { eq, and } from 'drizzle-orm';
import { properties, tenancies } from '../../db/schema';
import type { Database } from '../../db';

export async function requirePropertyAccess(
  db: Database,
  propertyId: string,
  userId: string
) {
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  if (!property) return null;

  if (property.ownerId === userId) {
    return { property, role: 'owner' as const };
  }

  const [tenancy] = await db
    .select()
    .from(tenancies)
    .where(
      and(
        eq(tenancies.propertyId, propertyId),
        eq(tenancies.tenantId, userId),
        eq(tenancies.status, 'active')
      )
    )
    .limit(1);

  if (tenancy) {
    return { property, role: 'tenant' as const, tenancy };
  }

  return null;
}

export async function requireOwner(
  db: Database,
  propertyId: string,
  userId: string
) {
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  if (!property) return null;
  if (property.ownerId !== userId) return null;

  return property;
}
