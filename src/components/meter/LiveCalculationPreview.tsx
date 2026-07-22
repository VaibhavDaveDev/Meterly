import { formatCurrency } from '../../lib/format';
import { calculateSolarBill, calculateGridOnlyBill } from '../../api/lib/billing-engine';

interface LiveCalculationPreviewProps {
  isSolar: boolean;
  rates: {
    consumptionRate: number;
    exportRate: number;
  };
  splitPercentage: number;
  startValues: {
    solarGenerationStart: number;
    exportStart: number;
    importStart: number;
  };
  currentValues: {
    solarGenerationEnd: number | null;
    exportEnd: number | null;
    importEnd: number | null;
  };
}

export function LiveCalculationPreview({ isSolar, rates, splitPercentage, startValues, currentValues }: LiveCalculationPreviewProps) {
  
  // Safe extraction (fallback to start value if null so delta is 0 for preview)
  const solarEnd = currentValues.solarGenerationEnd ?? startValues.solarGenerationStart;
  const exportEnd = currentValues.exportEnd ?? startValues.exportStart;
  const importEnd = currentValues.importEnd ?? startValues.importStart;

  let calculation;
  
  if (isSolar) {
    calculation = calculateSolarBill(
      {
        solarGenerationStart: startValues.solarGenerationStart,
        solarGenerationEnd: solarEnd,
        exportStart: startValues.exportStart,
        exportEnd: exportEnd,
        importStart: startValues.importStart,
        importEnd: importEnd,
      },
      rates,
      splitPercentage
    );
  } else {
    calculation = calculateGridOnlyBill(
      {
        importStart: startValues.importStart,
        importEnd: importEnd,
      },
      rates,
      splitPercentage
    );
  }

  const renderDeltaRow = (label: string, start: number, end: number | null, delta: number) => (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground w-1/3">{label}</span>
      <div className="flex-1 flex justify-between font-mono text-xs">
        <span className="text-muted-foreground">{start.toFixed(2)}</span>
        <span className="text-muted-foreground">→</span>
        <span className={end === null ? 'text-muted-foreground opacity-50' : 'text-foreground'}>
          {end !== null ? end.toFixed(2) : '--'}
        </span>
      </div>
      <span className={`w-1/4 text-right font-mono text-xs ${delta > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
        +{delta.toFixed(2)} units
      </span>
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Live Calculation Preview</h3>
      </div>
      <div className="p-5 space-y-6">
        
        {/* Readings Delta Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground border-b border-border pb-1">
            <span className="w-1/3">Meter</span>
            <div className="flex-1 flex justify-between px-2">
              <span>Start</span>
              <span>End</span>
            </div>
            <span className="w-1/4 text-right">Change</span>
          </div>
          {isSolar && (
            <>
              {renderDeltaRow('Solar Gen', startValues.solarGenerationStart, currentValues.solarGenerationEnd, calculation.solarGenerated)}
              {renderDeltaRow('Export', startValues.exportStart, currentValues.exportEnd, calculation.gridExported)}
            </>
          )}
          {renderDeltaRow('Import', startValues.importStart, currentValues.importEnd, calculation.gridImported)}
        </div>

        {/* Breakdown Steps */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
            {isSolar ? 'Solar Breakdown' : 'Grid Breakdown'}
          </h4>
          
          <div className="text-sm space-y-3 font-mono">
            {isSolar && (
              <>
                <div>
                  <div className="text-foreground">(1) Solar Generated</div>
                  <div className="text-muted-foreground text-xs ml-6">Solar End - Solar Start = {calculation.solarGenerated.toFixed(2)} units</div>
                </div>
                <div>
                  <div className="text-foreground">(2) Exported to Grid</div>
                  <div className="text-muted-foreground text-xs ml-6">Export End - Export Start = {calculation.gridExported.toFixed(2)} units</div>
                </div>
                <div>
                  <div className="text-foreground">(3) Solar Self-Consumed</div>
                  <div className="text-muted-foreground text-xs ml-6">Generated ({calculation.solarGenerated.toFixed(2)}) - Exported ({calculation.gridExported.toFixed(2)}) = {calculation.solarSelfConsumed.toFixed(2)} units</div>
                </div>
              </>
            )}
            
            <div>
              <div className="text-foreground">({isSolar ? '4' : '1'}) Imported from Grid</div>
              <div className="text-muted-foreground text-xs ml-6">Import End - Import Start = {calculation.gridImported.toFixed(2)} units</div>
            </div>

            <div className="pt-2 border-t border-border border-dashed">
              <div className="text-foreground font-semibold">Total Consumption</div>
              <div className="text-muted-foreground text-xs ml-6">
                {isSolar 
                  ? `Imported (${calculation.gridImported.toFixed(2)}) + Self-Consumed (${calculation.solarSelfConsumed.toFixed(2)})`
                  : `Imported (${calculation.gridImported.toFixed(2)})`
                }
                {' '}= {calculation.totalConsumption.toFixed(2)} units
              </div>
            </div>
            
            <div className="pt-2">
              <div className="text-foreground">Your Share: {splitPercentage}%</div>
              <div className="text-muted-foreground text-xs ml-6">
                {calculation.totalConsumption.toFixed(2)} × {splitPercentage}% = {calculation.tenantConsumption.toFixed(2)} units
              </div>
            </div>
          </div>
        </div>

        {/* Bill Summary */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">Your Bill Estimate</h4>
          
          <div className="space-y-2 text-sm font-mono">
            <div className="flex justify-between items-center">
              <span>Consumption ({calculation.tenantConsumption.toFixed(2)} u × ₹{rates.consumptionRate})</span>
              <span>{formatCurrency(calculation.consumptionCost)}</span>
            </div>
            {/* Note: Custom charges would be added here normally, but we omit for preview complexity as per plan */}
            <div className="flex justify-between items-center font-bold text-base border-t border-border border-dashed pt-2">
              <span>Total Due</span>
              <span>{formatCurrency(calculation.totalDue)}</span>
            </div>
          </div>

          {isSolar && (
            <div className="p-3 bg-muted/10 rounded-md border border-border text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Owner's Export Credit (not charged to you):</p>
              <p className="font-mono">
                {calculation.gridExported.toFixed(2)} × ₹{rates.exportRate} = <span className="text-emerald-500 font-semibold">{formatCurrency(calculation.exportRefund || 0)}</span>
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
