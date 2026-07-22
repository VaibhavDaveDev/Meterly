import { eq, and, isNull, inArray } from "drizzle-orm";
import type { Database } from "../../db";
import type { Bindings } from "../app";
import {
  properties,
  tenancies,
  bills,
  billingPeriods,
  meterReadings,
  meterReadingEdits,
  billPhotos,
} from "../../db/schema";

/**
 * Checks if a property has been deleted by the owner AND all tenants have
 * archived their tenancies. If both conditions are met, permanently deletes
 * all historical data (bill_photos, meter_reading_edits, meter_readings,
 * bills, billing_periods, tenancies) to free up space.
 *
 * Safe to call speculatively — returns false and does nothing if either
 * condition is not yet satisfied.
 */
export async function sweepOrphanedPropertyData(
  db: Database,
  env: Bindings,
  propertyId: string
): Promise<boolean> {
  // 1. Is the property still alive? (Owner hasn't deleted it yet)
  const [prop] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (prop) return false;

  // 2. Are there any tenancies that haven't been archived by the tenant?
  const [unarchived] = await db
    .select({ id: tenancies.id })
    .from(tenancies)
    .where(
      and(
        eq(tenancies.propertyId, propertyId),
        isNull(tenancies.archivedByTenantAt)
      )
    )
    .limit(1);

  if (unarchived) return false;

  // --- All clear. Full sweep. ---

  // 3a. Collect billing period IDs (needed for child deletes)
  const periods = await db
    .select({ id: billingPeriods.id })
    .from(billingPeriods)
    .where(eq(billingPeriods.propertyId, propertyId));
  const periodIds = periods.map((p) => p.id);

  // 3b. Collect tenancy IDs (needed to delete bills)
  const allTenancies = await db
    .select({ id: tenancies.id })
    .from(tenancies)
    .where(eq(tenancies.propertyId, propertyId));
  const tenancyIds = allTenancies.map((t) => t.id);

  // 3c. Delete R2 photos before the DB rows that reference them
  const photos = await db
    .select({ objectKey: billPhotos.objectKey })
    .from(billPhotos)
    .where(eq(billPhotos.propertyId, propertyId));

  if (env.BILL_PHOTOS && photos.length > 0) {
    try {
      await Promise.all(photos.map((p) => env.BILL_PHOTOS!.delete(p.objectKey)));
    } catch (e) {
      // Log but continue — orphan R2 objects are cheaper than a partial DB sweep
      console.error("[property-cleanup] R2 sweep failed, continuing with DB cleanup", e);
    }
  }

  // 3d. Delete DB rows leaf → root (respecting FK order)
  await db.delete(billPhotos).where(eq(billPhotos.propertyId, propertyId));

  if (periodIds.length > 0) {
    // Collect reading IDs first so we can delete their edits (which FK to meterReadingId, not billingPeriodId)
    const readings = await db
      .select({ id: meterReadings.id })
      .from(meterReadings)
      .where(inArray(meterReadings.billingPeriodId, periodIds));
    const readingIds = readings.map((r) => r.id);

    if (readingIds.length > 0) {
      await db.delete(meterReadingEdits).where(inArray(meterReadingEdits.meterReadingId, readingIds));
    }
    await db.delete(meterReadings).where(inArray(meterReadings.billingPeriodId, periodIds));
  }

  if (tenancyIds.length > 0) {
    await db.delete(bills).where(inArray(bills.tenancyId, tenancyIds));
  }

  await db.delete(billingPeriods).where(eq(billingPeriods.propertyId, propertyId));
  await db.delete(tenancies).where(eq(tenancies.propertyId, propertyId));

  return true;
}
