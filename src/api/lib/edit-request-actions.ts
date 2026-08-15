import { eq } from "drizzle-orm";
import { meterReadings, meterReadingEdits } from "../../db/schema";
import type { Database } from "../../db";
import * as schema from "../../db/schema";

export type ApplyApprovedReadingsResult =
  | { success: true }
  | {
      success: false;
      code:
        | "READING_NOT_FOUND"
        | "INVALID_READING_EXPORT_EXCEEDS_GENERATION"
        | "READING_BELOW_PREVIOUS"
        | "INVALID_SOLAR_GENERATION";
      error: string;
    };

export interface ApplyApprovedReadingsInput {
  db: Database;
  reading: typeof schema.meterReadings.$inferSelect | undefined;
  proposedValues: Partial<typeof schema.meterReadings.$inferSelect>;
  property: typeof schema.properties.$inferSelect;
  period: typeof schema.billingPeriods.$inferSelect;
  user: typeof schema.user.$inferSelect;
  requestReason: string;
}

export async function applyApprovedReadings({
  db,
  reading,
  proposedValues,
  property,
  period,
  user,
  requestReason,
}: ApplyApprovedReadingsInput): Promise<ApplyApprovedReadingsResult> {
  if (!reading)
    return {
      success: false,
      code: "READING_NOT_FOUND" as const,
      error: "No reading exists for this billing period",
    };

  if (property.hasSolar) {
    const proposedSolarEnd =
      proposedValues.solarGenerationEnd ?? reading.solarGenerationEnd;
    if (proposedSolarEnd < (reading.solarGenerationStart || 0)) {
      return {
        success: false,
        code: "INVALID_SOLAR_GENERATION" as const,
        error: `Proposed solar generation end (${proposedSolarEnd}) is less than solar generation start (${reading.solarGenerationStart || 0}).`,
      };
    }

    const solarGenerated =
      (proposedValues.solarGenerationEnd ?? reading.solarGenerationEnd) -
      (reading.solarGenerationStart || 0);
    const gridExported =
      (proposedValues.exportEnd ?? reading.exportEnd) -
      (reading.exportStart || 0);
    if (gridExported > solarGenerated) {
      return {
        success: false,
        code: "INVALID_READING_EXPORT_EXCEEDS_GENERATION" as const,
        error: `Proposed Export (${gridExported}) exceeds Solar Generated (${solarGenerated}). Cannot approve.`,
      };
    }

    // Also validate proposed exportEnd doesn't roll back below start
    const proposedExportEnd = proposedValues.exportEnd ?? reading.exportEnd;
    if (
      proposedExportEnd !== null &&
      proposedExportEnd !== undefined &&
      reading.exportStart !== null &&
      reading.exportStart !== undefined &&
      proposedExportEnd < reading.exportStart
    ) {
      return {
        success: false,
        code: "READING_BELOW_PREVIOUS" as const,
        error: `Proposed export end (${proposedExportEnd}) is less than export start (${reading.exportStart}).`,
      };
    }
  }

  // Validate importEnd >= importStart (applies to all properties)
  const proposedImportEnd = proposedValues.importEnd ?? reading.importEnd;
  if (proposedImportEnd < (reading.importStart || 0)) {
    return {
      success: false,
      code: "READING_BELOW_PREVIOUS" as const,
      error: `Proposed import end (${proposedImportEnd}) is less than import start (${reading.importStart || 0}).`,
    };
  }

  const editId = crypto.randomUUID();
  const newValues = {
    solarGenerationEnd:
      proposedValues.solarGenerationEnd ?? reading.solarGenerationEnd,
    exportEnd: proposedValues.exportEnd ?? reading.exportEnd,
    importEnd: proposedValues.importEnd ?? reading.importEnd,
  };

  await db.batch([
    db.insert(meterReadingEdits).values({
      id: editId,
      meterReadingId: reading.id,
      editedBy: user.id,
      reason: `Edit request approved: ${requestReason}`,
      oldValues: JSON.stringify({
        solarGenerationEnd: reading.solarGenerationEnd,
        exportEnd: reading.exportEnd,
        importEnd: reading.importEnd,
      }),
      newValues: JSON.stringify(newValues),
      versionBefore: reading.version || 1,
      versionAfter: (reading.version || 1) + 1,
      affectedPeriods: JSON.stringify([period.id]),
    }),
    db
      .update(meterReadings)
      .set({
        ...newValues,
        version: (reading.version || 1) + 1,
        updatedAt: new Date(),
      })
      .where(eq(meterReadings.id, reading.id)),
  ]);

  return { success: true };
}
