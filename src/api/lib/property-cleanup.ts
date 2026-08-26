import { eq, and, isNull, isNotNull, inArray, or } from "drizzle-orm";
import { logger } from "./logger";
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
  r2CleanupBacklog,
} from "../../db/schema";

const R2_MAX_RETRIES = 3; // attempts per key during sweep
const R2_BASE_DELAY_MS = 200; // 200ms ? 400ms between attempts
const BACKLOG_DRAIN_CAP = 50; // max entries drained per sweep call
const BACKLOG_MAX_ATTEMPTS = 10; // give up and log after this many total attempts

async function drainR2Backlog(db: Database, env: Bindings): Promise<void> {
  if (!env.BILL_PHOTOS) return;

  const pending = await db
    .select()
    .from(r2CleanupBacklog)
    .orderBy(r2CleanupBacklog.failedAt)
    .limit(BACKLOG_DRAIN_CAP);

  if (pending.length === 0) return;

  await Promise.all(
    pending.map(async (entry) => {
      // Hard-give-up path: too many attempts, log and purge
      if (entry.attemptCount >= BACKLOG_MAX_ATTEMPTS) {
        logger.error(
          {
            id: entry.id,
            objectKey: entry.objectKey,
            propertyId: entry.propertyId,
            attemptCount: entry.attemptCount,
            action: "Giving up. Manual R2 deletion required.",
          },
          "[property-cleanup] r2_backlog_permanent_orphan"
        );
        await db
          .delete(r2CleanupBacklog)
          .where(eq(r2CleanupBacklog.id, entry.id));
        return;
      }

      try {
        await env.BILL_PHOTOS!.delete(entry.objectKey);
        // Success  remove from backlog
        await db
          .delete(r2CleanupBacklog)
          .where(eq(r2CleanupBacklog.id, entry.id));
      } catch (e) {
        const nextCount = entry.attemptCount + 1;
        if (nextCount >= BACKLOG_MAX_ATTEMPTS) {
          // ponytail: Final attempt failed — log as permanent orphan and purge immediately
          logger.error(
            {
              id: entry.id,
              objectKey: entry.objectKey,
              propertyId: entry.propertyId,
              attemptCount: nextCount,
              action: "Giving up. Manual R2 deletion required.",
              error: String(e),
            },
            "[property-cleanup] r2_backlog_permanent_orphan"
          );
          await db
            .delete(r2CleanupBacklog)
            .where(eq(r2CleanupBacklog.id, entry.id));
        } else {
          // Still retrying — increment count and log
          await db
            .update(r2CleanupBacklog)
            .set({ attemptCount: nextCount })
            .where(eq(r2CleanupBacklog.id, entry.id));
          logger.error(
            {
              objectKey: entry.objectKey,
              propertyId: entry.propertyId,
              attemptCount: nextCount,
              error: String(e),
            },
            "[property-cleanup] r2_backlog_retry_failed"
          );
        }
      }
    })
  );
}

/**
 * Checks if a property has been deleted by the owner AND every real tenant
 * (isOwnerTenancy=false) has explicitly deleted their record (deletedByTenantAt IS NOT NULL).
 *
 * If both conditions are met, permanently deletes all historical data
 * (R2 photos, bill_photos, meter_reading_edits, meter_readings, bills,
 * billing_periods, tenancies) to free up space.
 *
 * Safe to call speculatively � returns false and does nothing if either
 * condition is not yet satisfied.
 */
export async function sweepOrphanedPropertyData(
  db: Database,
  env: Bindings,
  propertyId: string
): Promise<boolean> {
  // Drain any globally stranded R2 keys before doing anything else.
  // This runs on every call (including ones that return false early) to
  // maximise retry opportunities without adding new trigger points.
  try {
    await drainR2Backlog(db, env);
  } catch (e) {
    logger.error(
      { error: String(e) },
      "[property-cleanup] r2_backlog_drain_failed"
    );
  }

  // 1. Is the property still alive? (Owner hasn't deleted it yet)
  const [prop] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (prop) return false;

  // 2. Are there any real tenancies that haven't been deleted by the tenant?
  //    isOwnerTenancy=false ensures solo-mode properties (owner-only) sweep immediately.
  const [retainedTenancy] = await db
    .select({ id: tenancies.id })
    .from(tenancies)
    .where(
      and(
        eq(tenancies.propertyId, propertyId),
        or(
          eq(tenancies.isOwnerTenancy, false),
          isNull(tenancies.isOwnerTenancy)
        ),
        isNotNull(tenancies.tenantId),
        inArray(tenancies.status, ["active", "inactive", "property_deleted"]),
        isNull(tenancies.deletedByTenantAt)
      )
    )
    .limit(1);

  if (retainedTenancy) return false;

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
    await Promise.all(
      photos.map(async (p) => {
        let lastError: unknown;
        for (let attempt = 0; attempt < R2_MAX_RETRIES; attempt++) {
          try {
            await env.BILL_PHOTOS!.delete(p.objectKey);
            return; // success
          } catch (e) {
            lastError = e;
            if (attempt < R2_MAX_RETRIES - 1) {
              await new Promise((res) =>
                setTimeout(res, R2_BASE_DELAY_MS * 2 ** attempt)
              );
            }
          }
        }
        // All retries exhausted  persist to backlog, do NOT abort DB cleanup
        logger.error(
          {
            propertyId,
            objectKey: p.objectKey,
            error: String(lastError),
          },
          "[property-cleanup] r2_enqueue_backlog"
        );
        await db.insert(r2CleanupBacklog).values({
          id: crypto.randomUUID(),
          objectKey: p.objectKey,
          propertyId,
          failedAt: new Date(),
          attemptCount: R2_MAX_RETRIES, // already used 3 attempts
        });
      })
    );
  }

  // 3d. Delete DB rows leaf ? root (respecting FK order)
  const sweepOps = [];

  sweepOps.push(
    db.delete(billPhotos).where(eq(billPhotos.propertyId, propertyId))
  );

  if (periodIds.length > 0) {
    // Collect reading IDs first so we can delete their edits (which FK to meterReadingId, not billingPeriodId)
    const readings = await db
      .select({ id: meterReadings.id })
      .from(meterReadings)
      .where(inArray(meterReadings.billingPeriodId, periodIds));
    const readingIds = readings.map((r) => r.id);

    if (readingIds.length > 0) {
      sweepOps.push(
        db
          .delete(meterReadingEdits)
          .where(inArray(meterReadingEdits.meterReadingId, readingIds))
      );
    }
    sweepOps.push(
      db
        .delete(meterReadings)
        .where(inArray(meterReadings.billingPeriodId, periodIds))
    );
  }

  if (tenancyIds.length > 0) {
    sweepOps.push(db.delete(bills).where(inArray(bills.tenancyId, tenancyIds)));
  }

  sweepOps.push(
    db.delete(billingPeriods).where(eq(billingPeriods.propertyId, propertyId)),
    db.delete(tenancies).where(eq(tenancies.propertyId, propertyId))
  );

  await db.batch(sweepOps as unknown as Parameters<typeof db.batch>[0]);

  return true;
}
