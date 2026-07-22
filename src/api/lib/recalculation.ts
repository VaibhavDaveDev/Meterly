import { eq, and, asc, gt, lte, desc } from 'drizzle-orm';
import { getDb } from '../../db';
import { billingPeriods, meterReadings, propertyRates, tenancies, customCharges, bills, properties } from '../../db/schema';

import { generateAndSaveBills } from './bill-generation';

export async function recalculateChain(db: ReturnType<typeof getDb>, startPeriodId: string) {
  // 1. Get the starting period and property
  const [startPeriod] = await db.select().from(billingPeriods).where(eq(billingPeriods.id, startPeriodId)).limit(1);
  if (!startPeriod) return;

  // 2. Get all subsequent periods for this property, in chronological order
  const subsequentPeriods = await db
    .select()
    .from(billingPeriods)
    .where(and(
      eq(billingPeriods.propertyId, startPeriod.propertyId),
      gt(billingPeriods.periodMonth, startPeriod.periodMonth)
    ))
    .orderBy(asc(billingPeriods.periodMonth));

  // 3. Process the chain
  // This is simplified. In a production environment, we'd handle errors and atomicity carefully.
  const periodsToProcess = [startPeriod, ...subsequentPeriods];

  for (let i = 0; i < periodsToProcess.length; i++) {
    const period = periodsToProcess[i];
    
    // Never recalculate a confirmed period in a cascade (i > 0)
    // Note: The target period (i === 0) ALWAYS recalculates, even if confirmed, 
    // because this function is called explicitly by the owner to override a confirmed period.
    if (i > 0 && period.status === 'confirmed') {
      console.warn('[Recalc] Stopping cascade at confirmed period', period.id);
      break; 
    }
    
    // Update start values from previous period's end values (except for the first in the chain)
    if (i > 0) {
      const prevPeriod = periodsToProcess[i - 1];
      const [prevReading] = await db.select().from(meterReadings).where(eq(meterReadings.billingPeriodId, prevPeriod.id)).limit(1);
      const [currentReading] = await db.select().from(meterReadings).where(eq(meterReadings.billingPeriodId, period.id)).limit(1);
      
      if (prevReading && currentReading) {
        await db.update(meterReadings)
          .set({
            solarGenerationStart: prevReading.solarGenerationEnd,
            exportStart: prevReading.exportEnd,
            importStart: prevReading.importEnd,
          })
          .where(eq(meterReadings.id, currentReading.id));
      }
    }

    // Recalculate bills for this period
    await recalculateBillsForPeriod(db, period.id);
  }
}

async function recalculateBillsForPeriod(db: ReturnType<typeof getDb>, periodId: string) {
  const [period] = await db.select().from(billingPeriods).where(eq(billingPeriods.id, periodId)).limit(1);
  if (!period) return;

  const [property] = await db.select().from(properties).where(eq(properties.id, period.propertyId)).limit(1);

  const [reading] = await db.select().from(meterReadings).where(eq(meterReadings.billingPeriodId, periodId)).limit(1);
  if (!reading) return;

  // Resolve Rates
  const [rate] = await db
    .select()
    .from(propertyRates)
    .where(and(
      eq(propertyRates.propertyId, period.propertyId),
      lte(propertyRates.effectiveFrom, period.periodMonth)
    ))
    .orderBy(desc(propertyRates.effectiveFrom))
    .limit(1);

  const activeTenancies = (await db.select().from(tenancies).where(and(eq(tenancies.propertyId, period.propertyId), eq(tenancies.status, 'active')))).map(t => ({
    ...t,
    isOwnerTenancy: t.isOwnerTenancy ?? false
  }));
  const activeCharges = (await db.select().from(customCharges).where(and(eq(customCharges.propertyId, period.propertyId), eq(customCharges.isActive, true)))).map(c => ({
    ...c,
    chargedToTenant: c.chargedToTenant ?? true
  }));

  let oneOffChargesList: Array<{ chargedToTenant: boolean; amount: number; name: string }> = [];
  if (period.oneOffCharges) {
    try {
      oneOffChargesList = JSON.parse(period.oneOffCharges);
    } catch (e) {
      console.error('Failed to parse oneOffCharges in recalculation', e);
    }
  }

  const combinedCharges = [...activeCharges, ...oneOffChargesList];

  // Delete old bills for this period and recreate them
  await db.delete(bills).where(eq(bills.billingPeriodId, periodId));

  const rates = { 
    consumptionRate: rate?.consumptionRate || 0, 
    exportRate: rate?.exportRate || 0
  };

  if (period.rateOverride) {
    try {
      const override = JSON.parse(period.rateOverride);
      rates.consumptionRate = override.consumptionRate;
      if (override.exportRate !== undefined) {
        rates.exportRate = override.exportRate;
      }
    } catch (e) {
      console.error('Failed to parse rateOverride in recalculation', e);
    }
  }

  const readings = {
    solarGenerationStart: reading.solarGenerationStart || 0,
    solarGenerationEnd: reading.solarGenerationEnd || 0,
    exportStart: reading.exportStart || 0,
    exportEnd: reading.exportEnd || 0,
    importStart: reading.importStart || 0,
    importEnd: reading.importEnd || 0,
    meterMaxReading: property?.meterMaxReading ?? undefined,
  };

  await generateAndSaveBills(
    db,
    periodId,
    period.calculationMode,
    readings,
    rates,
    activeTenancies,
    combinedCharges,
    true // isRecalculation
  );
}
