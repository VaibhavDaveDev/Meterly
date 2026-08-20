import { eq, and, desc, lt } from "drizzle-orm";
import { billingPeriods, meterReadings } from "../../db/schema";
import type { Database } from "../../db";
import type { Property, BillingPeriod } from "../../types/db";

export interface MeterReadingInput {
  solarGenerationStart: number;
  solarGenerationEnd: number;
  exportStart: number;
  exportEnd: number;
  importStart: number;
  importEnd: number;
  meterMaxReading?: number;
}

export interface RateSnapshot {
  consumptionRate: number;
  exportRate: number;
}

export interface BillCalculation {
  solarGenerated: number;
  gridExported: number;
  gridImported: number;
  solarSelfConsumed: number;
  totalConsumption: number;
  tenantConsumption: number;
  consumptionCost: number;
  exportRefund: number;
  totalDue: number;
}

function calcMeterDelta(start: number, end: number, meterMaxReading?: number) {
  if (end >= start) return end - start;
  if (meterMaxReading) return meterMaxReading - start + end;
  return end - start; // fallback (might be negative, which is caught in tests)
}

/**
 * Pure function to calculate solar-adjusted bills.
 * Follows the step-by-step logic in Plan.md Section 5.
 */
export function calculateSolarBill(
  input: MeterReadingInput,
  rates: RateSnapshot,
  splitPercentage: number = 100
): BillCalculation {
  const calcDelta = (start: number, end: number) =>
    calcMeterDelta(start, end, input.meterMaxReading);

  const solarGenerated = calcDelta(
    input.solarGenerationStart,
    input.solarGenerationEnd
  );
  const gridExported = calcDelta(input.exportStart, input.exportEnd);
  const gridImported = calcDelta(input.importStart, input.importEnd);

  const solarSelfConsumed = Math.max(0, solarGenerated - gridExported);
  const totalConsumption = gridImported + solarSelfConsumed;

  const tenantConsumption = totalConsumption * (splitPercentage / 100);
  const consumptionCost = tenantConsumption * rates.consumptionRate;

  const exportRefund = gridExported * rates.exportRate;

  return {
    solarGenerated,
    gridExported,
    gridImported,
    solarSelfConsumed,
    totalConsumption,
    tenantConsumption,
    consumptionCost,
    exportRefund,
    totalDue: consumptionCost, // Custom charges added separately in the API layer
  };
}

/**
 * Pure function to calculate grid-only bills.
 */
export function calculateGridOnlyBill(
  input: Pick<
    MeterReadingInput,
    "importStart" | "importEnd" | "meterMaxReading"
  >,
  rates: Pick<RateSnapshot, "consumptionRate">,
  splitPercentage: number = 100
): BillCalculation {
  const calcDelta = (start: number, end: number) =>
    calcMeterDelta(start, end, input.meterMaxReading);
  const gridImported = calcDelta(input.importStart, input.importEnd);
  const totalConsumption = gridImported;

  const tenantConsumption = totalConsumption * (splitPercentage / 100);
  const consumptionCost = tenantConsumption * rates.consumptionRate;

  return {
    solarGenerated: 0,
    gridExported: 0,
    gridImported,
    solarSelfConsumed: 0,
    totalConsumption,
    tenantConsumption,
    consumptionCost,
    exportRefund: 0,
    totalDue: consumptionCost,
  };
}

// Types from db for validation

export interface ResolveAndValidateStartValuesInput {
  allowRollover?: boolean;
  importEnd: number;
  solarGenerationEnd?: number;
  exportEnd?: number;
}

export interface StartValues {
  solarGenerationStart: number;
  exportStart: number;
  importStart: number;
}

export type ResolveStartValuesResult =
  | { ok: false; error: { code: "READING_BELOW_PREVIOUS"; message: string } }
  | { ok: true; startValues: StartValues };

export async function resolveAndValidateStartValues(
  db: Database,
  property: Property,
  period: BillingPeriod,
  data: ResolveAndValidateStartValuesInput
): Promise<ResolveStartValuesResult> {
  // Latest prior period that has a reading — skips draft/empty periods
  const [prevReading] = await db
    .select({
      solarGenerationEnd: meterReadings.solarGenerationEnd,
      exportEnd: meterReadings.exportEnd,
      importEnd: meterReadings.importEnd,
    })
    .from(meterReadings)
    .innerJoin(
      billingPeriods,
      eq(meterReadings.billingPeriodId, billingPeriods.id)
    )
    .where(
      and(
        eq(billingPeriods.propertyId, period.propertyId),
        lt(billingPeriods.periodMonth, period.periodMonth)
      )
    )
    .orderBy(desc(billingPeriods.periodMonth))
    .limit(1);

  const startValues = prevReading
    ? {
        solarGenerationStart: prevReading.solarGenerationEnd,
        exportStart: prevReading.exportEnd,
        importStart: prevReading.importEnd,
      }
    : {
        solarGenerationStart: property.solarGenInitial || 0,
        exportStart: property.solarExportInitial || 0,
        importStart: 0,
      };

  if (!data.allowRollover) {
    if (data.importEnd < startValues.importStart) {
      return {
        ok: false,
        error: {
          code: "READING_BELOW_PREVIOUS",
          message: "Import reading cannot be lower than the previous reading",
        },
      };
    }
    if (property.hasSolar) {
      if (
        data.solarGenerationEnd !== undefined &&
        data.solarGenerationEnd < startValues.solarGenerationStart
      ) {
        return {
          ok: false,
          error: {
            code: "READING_BELOW_PREVIOUS",
            message:
              "Solar Generation reading cannot be lower than the previous reading",
          },
        };
      }
      if (
        data.exportEnd !== undefined &&
        data.exportEnd < startValues.exportStart
      ) {
        return {
          ok: false,
          error: {
            code: "READING_BELOW_PREVIOUS",
            message: "Export reading cannot be lower than the previous reading",
          },
        };
      }
    }
  }

  return { ok: true, startValues };
}
