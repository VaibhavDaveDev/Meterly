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

/**
 * Pure function to calculate solar-adjusted bills.
 * Follows the step-by-step logic in Plan.md Section 5.
 */
export function calculateSolarBill(
  input: MeterReadingInput,
  rates: RateSnapshot,
  splitPercentage: number = 100
): BillCalculation {
  const calcDelta = (start: number, end: number) => {
    if (end >= start) return end - start;
    if (input.meterMaxReading) return (input.meterMaxReading - start) + end;
    return end - start; // fallback (might be negative, which is caught in tests)
  };

  const solarGenerated = calcDelta(input.solarGenerationStart, input.solarGenerationEnd);
  const gridExported = calcDelta(input.exportStart, input.exportEnd);
  const gridImported = calcDelta(input.importStart, input.importEnd);
  
  const solarSelfConsumed = Math.max(0, solarGenerated - gridExported);
  const totalConsumption = gridImported + solarSelfConsumed;
  
  const tenantConsumption = totalConsumption * (splitPercentage / 100);
  const consumptionCost = tenantConsumption * rates.consumptionRate;
  
  const exportRefund = (gridExported * rates.exportRate);
  
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
  input: Pick<MeterReadingInput, 'importStart' | 'importEnd' | 'meterMaxReading'>,
  rates: Pick<RateSnapshot, 'consumptionRate'>,
  splitPercentage: number = 100
): BillCalculation {
  const calcDelta = (start: number, end: number) => {
    if (end >= start) return end - start;
    if (input.meterMaxReading) return (input.meterMaxReading - start) + end;
    return end - start;
  };
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
