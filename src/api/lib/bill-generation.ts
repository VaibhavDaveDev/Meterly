import { getDb } from '../../db';
import { bills } from '../../db/schema';
import { calculateSolarBill, calculateGridOnlyBill } from './billing-engine';

import { logger } from './logger';

export async function generateAndSaveBills(
  db: ReturnType<typeof getDb>,
  periodId: string,
  calculationMode: string,
  readings: {
    solarGenerationStart: number;
    solarGenerationEnd: number;
    exportStart: number;
    exportEnd: number;
    importStart: number;
    importEnd: number;
    meterMaxReading?: number;
  },
  rates: {
    consumptionRate: number;
    exportRate: number;
  },
  activeTenancies: Array<{ id: string; splitPercentage: number | null; isOwnerTenancy: boolean; tenantId: string | null }>,
  activeCharges: Array<{ chargedToTenant: boolean; amount: number }>,
  isRecalculation: boolean = false
) {
  const generatedBills = [];
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const explicit = activeTenancies.filter(t => t.splitPercentage !== null);
  const nullCount = activeTenancies.length - explicit.length;
  const remaining = 100 - explicit.reduce((sum, t) => sum + (t.splitPercentage || 0), 0);
  const autoSplit = nullCount === 0 ? 0 : remaining / nullCount;

  for (const tenancy of activeTenancies) {
    const splitPercentage = tenancy.splitPercentage ?? autoSplit;
    
    let calculation;
    if (calculationMode === 'solar') {
      calculation = calculateSolarBill(
        readings,
        rates,
        splitPercentage
      );
    } else {
      calculation = calculateGridOnlyBill(
        { importStart: readings.importStart, importEnd: readings.importEnd, meterMaxReading: readings.meterMaxReading },
        rates,
        splitPercentage
      );
    }

    const tenantCharges = activeCharges.filter(c => c.chargedToTenant);
    const customChargesTotal = tenantCharges.reduce((sum, c) => sum + c.amount, 0);

    const billData = {
      id: crypto.randomUUID(),
      billingPeriodId: periodId,
      tenancyId: tenancy.id,
      solarGenerated: calculation.solarGenerated,
      gridExported: calculation.gridExported,
      gridImported: calculation.gridImported,
      solarSelfConsumed: round2(calculation.solarSelfConsumed),
      totalConsumption: round2(calculation.totalConsumption),
      splitPercentage: round2(splitPercentage),
      tenantConsumption: round2(calculation.tenantConsumption),
      consumptionRate: rates.consumptionRate,
      consumptionCost: round2(calculation.consumptionCost),
      exportRate: rates.exportRate,
      exportRefund: round2(calculation.exportRefund),
      customChargesJson: JSON.stringify(tenantCharges),
      customChargesTotal: round2(customChargesTotal),
      totalDue: round2(calculation.totalDue + customChargesTotal),
      status: 'pending' as const,
      ...(isRecalculation ? { recalculatedAt: new Date() } : {})
    };

    try {
      await db.insert(bills).values(billData);
      logger.info({ periodId, tenancyId: tenancy.id, event: 'bill.generated' }, 'bill generated');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error({ periodId, tenancyId: tenancy.id, error: errorMessage, event: 'bill.error' }, 'bill generation failed');
      throw err;
    }



    generatedBills.push({
      tenancy,
      billData,
      totalDue: round2(calculation.totalDue + customChargesTotal)
    });
  }

  return generatedBills;
}
