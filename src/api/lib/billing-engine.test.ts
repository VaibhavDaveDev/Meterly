import { describe, it, expect } from 'vitest';
import { calculateSolarBill, calculateGridOnlyBill } from './billing-engine';

describe('calculateSolarBill', () => {
  it('should calculate the bill correctly with 100% split', () => {
    const input = {
      solarGenerationStart: 1000,
      solarGenerationEnd: 1100, // 100 generated
      exportStart: 200,
      exportEnd: 250, // 50 exported
      importStart: 500,
      importEnd: 520, // 20 imported
    };
    const rates = {
      consumptionRate: 0.15,
      exportRate: 0.05,
    };
    const splitPercentage = 100;

    const result = calculateSolarBill(input, rates, splitPercentage);

    expect(result.solarGenerated).toBe(100);
    expect(result.gridExported).toBe(50);
    expect(result.gridImported).toBe(20);
    expect(result.solarSelfConsumed).toBe(50);
    expect(result.totalConsumption).toBe(70);
    expect(result.tenantConsumption).toBe(70);
    expect(result.consumptionCost).toBeCloseTo(10.5);
    expect(result.exportRefund).toBeCloseTo(2.5);
    expect(result.totalDue).toBeCloseTo(10.5); // consumptionCost
  });

  it('should calculate the bill correctly with a 50% split', () => {
    const input = {
      solarGenerationStart: 1000,
      solarGenerationEnd: 1100, // 100 generated
      exportStart: 200,
      exportEnd: 250, // 50 exported
      importStart: 500,
      importEnd: 520, // 20 imported
    };
    const rates = {
      consumptionRate: 0.15,
      exportRate: 0.05,
    };
    const splitPercentage = 50;

    const result = calculateSolarBill(input, rates, splitPercentage);

    expect(result.tenantConsumption).toBe(35);
    expect(result.consumptionCost).toBeCloseTo(5.25);
    expect(result.totalDue).toBeCloseTo(5.25); // consumptionCost
  });

  it('should handle 0% split percentage', () => {
    const input = {
      solarGenerationStart: 1000,
      solarGenerationEnd: 1100,
      exportStart: 200,
      exportEnd: 250,
      importStart: 500,
      importEnd: 520,
    };
    const rates = {
      consumptionRate: 0.15,
      exportRate: 0.05,
    };
    
    const result = calculateSolarBill(input, rates, 0);

    expect(result.tenantConsumption).toBe(0);
    expect(result.consumptionCost).toBe(0);
    expect(result.totalDue).toBe(0);
  });

  it('should handle negative solar generation due to meter reset', () => {
    // If end is less than start, calculation will be negative initially 
    // Plan.md says meter resets are handled by a soft warning, 
    // but the engine will process whatever inputs it receives.
    const input = {
      solarGenerationStart: 5000,
      solarGenerationEnd: 100, // Reset to 0, then 100
      exportStart: 200,
      exportEnd: 250,
      importStart: 500,
      importEnd: 520,
    };
    const rates = {
      consumptionRate: 0.15,
      exportRate: 0.05,
    };
    
    const result = calculateSolarBill(input, rates, 100);

    expect(result.solarGenerated).toBe(-4900);
    expect(result.gridExported).toBe(50);
    // solarSelfConsumed = Math.max(0, -4900 - 50) = 0
    expect(result.solarSelfConsumed).toBe(0);
    expect(result.totalConsumption).toBe(20); // only grid imported
  });

  it('should ensure solarSelfConsumed is never negative', () => {
    // A scenario where export > generated (physically impossible normally, but could be a bad manual entry)
    const input = {
      solarGenerationStart: 1000,
      solarGenerationEnd: 1010, // 10 generated
      exportStart: 200,
      exportEnd: 250, // 50 exported
      importStart: 500,
      importEnd: 520, // 20 imported
    };
    const rates = {
      consumptionRate: 0.15,
      exportRate: 0.05,
    };

    const result = calculateSolarBill(input, rates, 100);
    
    expect(result.solarSelfConsumed).toBe(0); // rather than -40
    expect(result.totalConsumption).toBe(20);
  });
  it('calculates solar bill: gen > export, tenant gets solar discount', () => {
    const input = {
      solarGenerationStart: 0,
      solarGenerationEnd: 500, // 500 generated
      exportStart: 0,
      exportEnd: 100, // 100 exported
      importStart: 0,
      importEnd: 200, // 200 imported
    };
    const rates = {
      consumptionRate: 10,
      exportRate: 5,
    };
    
    const result = calculateSolarBill(input, rates, 100);
    
    expect(result.solarGenerated).toBe(500);
    expect(result.gridExported).toBe(100);
    expect(result.solarSelfConsumed).toBe(400);
    expect(result.totalConsumption).toBe(600); // 400 self-consumed + 200 imported
    expect(result.tenantConsumption).toBe(600);
    expect(result.consumptionCost).toBe(6000); // 600 * 10
    expect(result.exportRefund).toBe(500); // 100 * 5
    expect(result.totalDue).toBe(6000);
  });

  it('calculates solar bill: no gen (pure grid period after solar enabled)', () => {
    const input = {
      solarGenerationStart: 500,
      solarGenerationEnd: 500, // 0 generated
      exportStart: 100,
      exportEnd: 100, // 0 exported
      importStart: 200,
      importEnd: 400, // 200 imported
    };
    const rates = {
      consumptionRate: 10,
      exportRate: 5,
    };
    
    const result = calculateSolarBill(input, rates, 100);
    
    expect(result.solarGenerated).toBe(0);
    expect(result.gridExported).toBe(0);
    expect(result.solarSelfConsumed).toBe(0);
    expect(result.totalConsumption).toBe(200);
    expect(result.tenantConsumption).toBe(200);
    expect(result.consumptionCost).toBe(2000);
    expect(result.exportRefund).toBe(0);
    expect(result.totalDue).toBe(2000);
  });

  it('calculates solar bill with meter rollover', () => {
    const input = {
      solarGenerationStart: 9900,
      solarGenerationEnd: 50, // rolled over
      exportStart: 100,
      exportEnd: 150,
      importStart: 9950,
      importEnd: 20, // rolled over
      meterMaxReading: 10000,
    };
    const rates = { consumptionRate: 10, exportRate: 5 };
    const result = calculateSolarBill(input, rates, 100);
    
    // Solar: (10000 - 9900) + 50 = 150
    expect(result.solarGenerated).toBe(150);
    // Export: 150 - 100 = 50
    expect(result.gridExported).toBe(50);
    // Self-consumed: 150 - 50 = 100
    expect(result.solarSelfConsumed).toBe(100);
    // Import: (10000 - 9950) + 20 = 70
    expect(result.gridImported).toBe(70);
    // Total consumption: 100 + 70 = 170
    expect(result.totalConsumption).toBe(170);
  });
});

describe('calculateGridOnlyBill', () => {
  it('should calculate the grid only bill correctly', () => {
    const input = {
      importStart: 500,
      importEnd: 600, // 100 units
    };
    const rates = {
      consumptionRate: 0.20,
    };
    
    const result = calculateGridOnlyBill(input, rates, 100);
    
    expect(result.gridImported).toBe(100);
    expect(result.totalConsumption).toBe(100);
    expect(result.tenantConsumption).toBe(100);
    expect(result.consumptionCost).toBe(20);
    expect(result.solarGenerated).toBe(0);
    expect(result.exportRefund).toBe(0);
    expect(result.totalDue).toBe(20);
  });

  it('should respect split percentage', () => {
    const input = {
      importStart: 500,
      importEnd: 600, // 100 units
    };
    const rates = {
      consumptionRate: 0.20,
    };
    
    const result = calculateGridOnlyBill(input, rates, 25);
    
    expect(result.tenantConsumption).toBe(25);
    expect(result.consumptionCost).toBe(5);
    expect(result.totalDue).toBe(5); // 5
  });

  it('calculates grid only bill with meter rollover', () => {
    const input = {
      importStart: 9950,
      importEnd: 25,
      meterMaxReading: 10000,
    };
    const rates = { consumptionRate: 0.20 };
    
    const result = calculateGridOnlyBill(input, rates, 100);
    
    // (10000 - 9950) + 25 = 75
    expect(result.gridImported).toBe(75);
    expect(result.totalConsumption).toBe(75);
    expect(result.consumptionCost).toBe(15);
  });
});
