import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db';
import { tenancies } from '../../db/schema';

/**
 * Ensures an owner tenancy exists for a solo-mode property.
 * Idempotent — safe to call multiple times. Creates a new record only if one
 * doesn't already exist. Reactivates if one was previously deactivated.
 */
export async function ensureOwnerTenancy(
  db: ReturnType<typeof getDb>,
  propertyId: string,
  ownerId: string
): Promise<string> {
  // Look for an existing owner tenancy (active or inactive)
  const [existing] = await db
    .select()
    .from(tenancies)
    .where(
      and(
        eq(tenancies.propertyId, propertyId),
        eq(tenancies.tenantId, ownerId),
        eq(tenancies.isOwnerTenancy, true)
      )
    )
    .limit(1);

  if (existing) {
    if (existing.status !== 'active') {
      // Reactivate it
      await db
        .update(tenancies)
        .set({ status: 'active', leftAt: null, joinedAt: new Date() })
        .where(eq(tenancies.id, existing.id));
    }
    return existing.id;
  }

  // Create a fresh owner tenancy
  const id = crypto.randomUUID();
  await db.insert(tenancies).values({
    id,
    propertyId,
    tenantId: ownerId,
    status: 'active',
    splitPercentage: 100, // owner gets 100% of their own bill
    isOwnerTenancy: true,
    joinedAt: new Date(),
  });

  return id;
}

/**
 * Deactivates the owner tenancy for a property when switching back to landlord mode.
 * The record is preserved for historical bill continuity.
 */
export async function deactivateOwnerTenancy(
  db: ReturnType<typeof getDb>,
  propertyId: string,
  ownerId: string
): Promise<void> {
  await db
    .update(tenancies)
    .set({ status: 'inactive', leftAt: new Date() })
    .where(
      and(
        eq(tenancies.propertyId, propertyId),
        eq(tenancies.tenantId, ownerId),
        eq(tenancies.isOwnerTenancy, true),
        eq(tenancies.status, 'active')
      )
    );
}

/**
 * After a non-owner tenant is removed, checks if remaining active tenants'
 * explicit split percentages still sum to 100. If not, resets all to null
 * (equal auto-split). Returns true if a reset was performed.
 */
export async function reconcileSplitsAfterRemoval(
  db: ReturnType<typeof getDb>,
  propertyId: string
): Promise<boolean> {
  const active = await db
    .select()
    .from(tenancies)
    .where(
      and(
        eq(tenancies.propertyId, propertyId),
        eq(tenancies.status, 'active'),
        eq(tenancies.isOwnerTenancy, false)
      )
    );

  if (active.length === 0) return false;

  const allHaveExplicit = active.every(t => t.splitPercentage !== null);
  if (!allHaveExplicit) return false; // already using auto-split, nothing to fix

  const total = active.reduce((sum, t) => sum + (t.splitPercentage ?? 0), 0);
  const isValid = Math.abs(total - 100) < 0.01;
  if (isValid) return false; // splits are still valid

  // Reset all remaining tenants to equal auto-split
  for (const t of active) {
    await db
      .update(tenancies)
      .set({ splitPercentage: null })
      .where(eq(tenancies.id, t.id));
  }

  return true; // caller should notify owner
}
