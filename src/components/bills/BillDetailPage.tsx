import React from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { formatCurrency, formatUnits, formatMeterReading, formatMonth } from '../../lib/format';
import { ChevronRight, Download, Edit3, ArrowRight, Info, History, Clock } from 'lucide-react';
import { useBillDetail, type BillDetailData, type CustomCharge, type ProposedValues } from '../../hooks/use-bill-detail';

interface BillDetailPageProps {
  tenancyId: string;
  billId: string;
}

export function BillDetailPage({ tenancyId, billId }: BillDetailPageProps) {
  const {
    data,
    loading,
    error,
    isEditModalOpen,
    setIsEditModalOpen,
    editReason,
    setEditReason,
    proposedValues,
    setProposedValues,
    isSubmittingEdit,
    editSuccess,
    editError,
    isCancelling,
    cancelError,
    handleCancelEditRequest,
    handleMarkPaid,
    handleSubmitEditRequest
  } = useBillDetail(billId, tenancyId);

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 w-1/3 bg-surface rounded"></div>
        <div className="h-32 bg-surface rounded-xl border border-border"></div>
        <div className="h-64 bg-surface rounded-xl border border-border"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
        {error || 'Failed to load data'}
      </div>
    );
  }

  const { bill, period, property, reading, editHistory, isOwner, isTenant, canRequestEdit, pendingEditRequestCount } = data;
  const isSolar = period.calculationMode === 'solar';

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a href={`/tenancies/${tenancyId}/bills`} className="hover:text-foreground transition-colors">My Bills</a>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-medium">{formatMonth(period.periodMonth)}</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-1">{formatMonth(period.periodMonth)} — {property.name}</h1>
          
          <div className="flex items-center gap-4 mt-6">
            <div className="text-4xl font-bold font-numbers">{formatCurrency(bill.totalDue)}</div>
            <BillStatusBadge status={bill.status} />
          </div>
          
          {bill.recalculationCount > 0 && (
            <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
              <History className="w-4 h-4" />
              <span>This bill was recalculated {bill.recalculationCount} time(s). Last updated {new Date(bill.recalculatedAt || '').toLocaleDateString()}.</span>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Download className="w-4 h-4" /> Download PDF
          </Button>
          
          {isTenant && canRequestEdit && pendingEditRequestCount === 0 && (
            <Button variant="outline" onClick={() => setIsEditModalOpen(true)} className="gap-2">
              <Edit3 className="w-4 h-4" /> Request Edit
            </Button>
          )}
          
          {isTenant && !canRequestEdit && pendingEditRequestCount > 0 && (
            <Button variant="outline" disabled className="gap-2 opacity-50 cursor-not-allowed">
              <Clock className="w-4 h-4" /> Edit Pending Review
            </Button>
          )}
          
          {isOwner && bill.status === 'pending' && (
            <Button onClick={handleMarkPaid} className="gap-2">
              <Badge variant="success" className="w-4 h-4 p-0 rounded-full flex items-center justify-center mr-1">✓</Badge> Mark as Received
            </Button>
          )}
        </div>
      </div>

      {isEditModalOpen && (
        <EditRequestModal 
          editSuccess={editSuccess}
          editReason={editReason}
          setEditReason={setEditReason}
          proposedValues={proposedValues}
          setProposedValues={setProposedValues}
          isSolar={isSolar}
          editError={editError}
          isSubmittingEdit={isSubmittingEdit}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleSubmitEditRequest}
        />
      )}

      {/* ponytail: show active pending request details block if present */}
      {isTenant && data.pendingEditRequest && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400">Correction Request Pending</h4>
              <p className="text-xs text-muted-foreground">Submitted on {new Date(data.pendingEditRequest.createdAt).toLocaleDateString()}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleCancelEditRequest(data.pendingEditRequest!.id)} 
              disabled={isCancelling}
              className="text-xs border-blue-500/20 text-blue-600 hover:bg-blue-500/10 hover:text-blue-700 shrink-0 h-8 gap-1.5"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Request'}
            </Button>
          </div>
          {cancelError && <p className="text-xs text-destructive">{cancelError}</p>}
          <div className="text-sm text-foreground bg-surface border border-border rounded-lg p-3">
            <span className="font-semibold text-xs text-muted-foreground block mb-1">Reason:</span>
            "{data.pendingEditRequest.reason}"
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <span className="text-muted-foreground block font-sans">Import</span>
              <span className="font-numbers font-medium text-foreground">{data.pendingEditRequest.proposedValues.importEnd ?? '—'}</span>
            </div>
            {isSolar && (
              <>
                <div>
                  <span className="text-muted-foreground block font-sans">Export</span>
                  <span className="font-numbers font-medium text-foreground">{data.pendingEditRequest.proposedValues.exportEnd ?? '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-sans">Solar Gen</span>
                  <span className="font-numbers font-medium text-foreground">{data.pendingEditRequest.proposedValues.solarGenerationEnd ?? '—'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {reading && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold font-heading">Meter Readings</h2>
          <div className="rounded-xl border border-border overflow-hidden bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 font-medium text-muted-foreground w-1/4">Meter</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground text-right">Start</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground text-center w-12"></th>
                    <th className="px-6 py-3 font-medium text-muted-foreground text-left">End</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground text-right text-primary">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-numbers">
                  {isSolar && (
                    <>
                      <tr className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-sans font-medium text-foreground">Solar Generation</td>
                        <td className="px-6 py-4 text-right text-muted-foreground">{formatMeterReading(reading.solarGenerationStart)}</td>
                        <td className="px-6 py-4 text-center text-muted-foreground"><ArrowRight className="w-4 h-4 mx-auto opacity-50" /></td>
                        <td className="px-6 py-4 text-left">{formatMeterReading(reading.solarGenerationEnd)}</td>
                        <td className="px-6 py-4 text-right text-primary font-bold">+ {formatUnits((reading.solarGenerationEnd || 0) - (reading.solarGenerationStart || 0))}</td>
                      </tr>
                      <tr className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-sans font-medium text-foreground">Export to Grid</td>
                        <td className="px-6 py-4 text-right text-muted-foreground">{formatMeterReading(reading.exportStart)}</td>
                        <td className="px-6 py-4 text-center text-muted-foreground"><ArrowRight className="w-4 h-4 mx-auto opacity-50" /></td>
                        <td className="px-6 py-4 text-left">{formatMeterReading(reading.exportEnd)}</td>
                        <td className="px-6 py-4 text-right text-primary font-bold">+ {formatUnits((reading.exportEnd || 0) - (reading.exportStart || 0))}</td>
                      </tr>
                    </>
                  )}
                  <tr className="hover:bg-muted/30 transition-colors bg-primary/5">
                    <td className="px-6 py-4 font-sans font-medium text-foreground">Import from Grid</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">{formatMeterReading(reading.importStart)}</td>
                    <td className="px-6 py-4 text-center text-muted-foreground"><ArrowRight className="w-4 h-4 mx-auto opacity-50" /></td>
                    <td className="px-6 py-4 text-left">{formatMeterReading(reading.importEnd)}</td>
                    <td className="px-6 py-4 text-right text-primary font-bold">+ {formatUnits(reading.importEnd - reading.importStart)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-muted/30 border-t border-border text-xs text-muted-foreground flex justify-between items-center">
              <span>Submitted by <span className="font-medium text-foreground">{data.submitterName || 'Unknown'}</span></span>
              <span>{new Date(reading.submittedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

      <CalculationBreakdown bill={bill} reading={reading} isSolar={isSolar} />
      <BillLineItems bill={bill} isSolar={isSolar} />

      {isSolar && (
        <div className="rounded-xl border border-border bg-muted/30 p-6 font-mono text-sm mt-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <SunMedium className="w-24 h-24" />
          </div>
          <div className="relative z-10 space-y-2">
            <div className="font-bold font-sans text-foreground flex items-center gap-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              Owner's Export Credit <span className="text-muted-foreground font-normal text-xs">(not your charge)</span>
            </div>
            <div className="text-muted-foreground">
              Exported ({formatUnits(bill.gridExported)}) x {formatCurrency(bill.exportRate)}/unit = <span className="text-foreground font-medium">{formatCurrency(bill.exportRefund)}</span>
            </div>
            <div className="text-xs font-sans text-muted-foreground italic mt-2">
              Your landlord earns this amount from the electricity grid for exporting solar power.
            </div>
          </div>
        </div>
      )}

      {editHistory && editHistory.length > 0 && (
        <div className="space-y-4 mt-12">
          <h2 className="text-lg font-bold font-heading flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" /> 
            Edit History <Badge variant="muted" className="ml-2">{editHistory.length}</Badge>
          </h2>
          <div className="rounded-xl border border-border overflow-hidden bg-surface divide-y divide-border">
            {editHistory.map((history) => (
              <div key={history.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {history.editedByName} requested an edit
                      <Badge variant="muted" className="text-xs font-mono">v{history.versionBefore} &rarr; v{history.versionAfter}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 text-balance">"{history.reason}"</div>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                    {new Date(history.editedAt).toLocaleString()}
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/50">
                        <th className="pb-2 font-medium">Field</th>
                        <th className="pb-2 font-medium">Old Value</th>
                        <th className="pb-2 font-medium text-primary">New Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 font-numbers">
                      {Object.entries(history.newValues).map(([key, newVal]) => {
                        const oldVal = history.oldValues?.[key] ?? '—';
                        if (oldVal === newVal) return null;
                        
                        return (
                          <tr key={key} className="hover:bg-muted/50">
                            <td className="py-2 text-foreground/80">{key}</td>
                            <td className="py-2 text-muted-foreground">{oldVal}</td>
                            <td className="py-2 text-primary font-medium">{newVal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BillStatusBadge({ status }: { status: 'paid' | 'pending' }) {
  return (
    <Badge variant={status === 'paid' ? 'success' : 'warning'} className="text-sm px-3 py-1 uppercase tracking-wide">
      {status === 'paid' ? 'PAID' : 'UNPAID'}
    </Badge>
  );
}

function EditRequestModal({ 
  editSuccess, 
  editReason, 
  setEditReason, 
  proposedValues, 
  setProposedValues, 
  isSolar, 
  editError, 
  isSubmittingEdit, 
  onClose, 
  onSubmit 
}: {
  editSuccess: boolean;
  editReason: string;
  setEditReason: (reason: string) => void;
  proposedValues: ProposedValues;
  setProposedValues: (values: ProposedValues) => void;
  isSolar: boolean;
  editError: string | null;
  isSubmittingEdit: boolean;
  onClose: () => void;
  onSubmit: (e: React.SubmitEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold font-heading">Request a Correction</h2>
          <p className="text-sm text-muted-foreground mt-1">Submit correct meter readings to your landlord.</p>
        </div>
        
        <form onSubmit={onSubmit} className="p-6 overflow-y-auto space-y-6">
          {editSuccess ? (
            <div className="p-4 bg-success/10 text-success rounded-lg border border-success/20 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center shrink-0">✓</div>
              <p>Your edit request has been submitted successfully.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <label className="block text-sm font-medium">Reason for edit <span className="text-destructive">*</span></label>
                <textarea 
                  required
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px]"
                  placeholder="e.g., I misread the import meter, it should be 709 not 790."
                />
              </div>
              
              <div className="space-y-4">
                <h3 className="text-sm font-semibold border-b border-border pb-2">Proposed Readings</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Import Start</label>
                    <input 
                      type="number" step="0.01" required
                      value={proposedValues.importStart ?? ''} onChange={e => setProposedValues({...proposedValues, importStart: parseFloat(e.target.value)})}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Import End</label>
                    <input 
                      type="number" step="0.01" required
                      value={proposedValues.importEnd ?? ''} onChange={e => setProposedValues({...proposedValues, importEnd: parseFloat(e.target.value)})}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                
                {isSolar && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Export Start</label>
                        <input 
                          type="number" step="0.01" required
                          value={proposedValues.exportStart ?? ''} onChange={e => setProposedValues({...proposedValues, exportStart: parseFloat(e.target.value)})}
                          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Export End</label>
                        <input 
                          type="number" step="0.01" required
                          value={proposedValues.exportEnd ?? ''} onChange={e => setProposedValues({...proposedValues, exportEnd: parseFloat(e.target.value)})}
                          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Solar Gen Start</label>
                        <input 
                          type="number" step="0.01" required
                          value={proposedValues.solarGenerationStart ?? ''} onChange={e => setProposedValues({...proposedValues, solarGenerationStart: parseFloat(e.target.value)})}
                          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Solar Gen End</label>
                        <input 
                          type="number" step="0.01" required
                          value={proposedValues.solarGenerationEnd ?? ''} onChange={e => setProposedValues({...proposedValues, solarGenerationEnd: parseFloat(e.target.value)})}
                          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {editError && <div className="text-sm text-destructive">{editError}</div>}
              
              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={isSubmittingEdit}>
                  {isSubmittingEdit ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function CalculationBreakdown({ bill, reading, isSolar }: { bill: BillDetailData['bill'], reading: BillDetailData['reading'], isSolar: boolean }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold font-heading">Calculation Breakdown</h2>
      
      <div className="rounded-xl border border-border bg-surface p-6 font-mono text-sm space-y-8 leading-relaxed">
        {isSolar ? (
          <>
            <div className="space-y-2">
              <div className="font-bold font-sans text-foreground flex items-center gap-2">
                <Badge variant="muted" className="px-2 py-0.5 rounded text-xs font-mono">1</Badge> 
                Solar Generated
              </div>
              <div className="pl-9 text-muted-foreground">
                Solar End ({formatMeterReading(reading.solarGenerationEnd)}) - Solar Start ({formatMeterReading(reading.solarGenerationStart)}) = <span className="text-foreground font-medium">{formatUnits(bill.solarGenerated)}</span>
              </div>
              <div className="pl-9 text-xs font-sans text-muted-foreground opacity-80 italic">Your panels generated this much electricity this month.</div>
            </div>

            <div className="space-y-2">
              <div className="font-bold font-sans text-foreground flex items-center gap-2">
                <Badge variant="muted" className="px-2 py-0.5 rounded text-xs font-mono">2</Badge> 
                Exported to Grid
              </div>
              <div className="pl-9 text-muted-foreground">
                Export End ({formatMeterReading(reading.exportEnd)}) - Export Start ({formatMeterReading(reading.exportStart)}) = <span className="text-foreground font-medium">{formatUnits(bill.gridExported)}</span>
              </div>
              <div className="pl-9 text-xs font-sans text-muted-foreground opacity-80 italic">This much solar power went back to the electricity grid.</div>
            </div>

            <div className="space-y-2">
              <div className="font-bold font-sans text-foreground flex items-center gap-2">
                <Badge variant="muted" className="px-2 py-0.5 rounded text-xs font-mono">3</Badge> 
                Solar Self-Consumed
              </div>
              <div className="pl-9 text-muted-foreground">
                Generated ({formatUnits(bill.solarGenerated)}) - Exported ({formatUnits(bill.gridExported)}) = <span className="text-foreground font-medium">{formatUnits(bill.solarSelfConsumed)}</span>
              </div>
              <div className="pl-9 text-xs font-sans text-muted-foreground opacity-80 italic">This is the solar power you actually used at home before the rest was exported.</div>
            </div>

            <div className="space-y-2">
              <div className="font-bold font-sans text-foreground flex items-center gap-2">
                <Badge variant="muted" className="px-2 py-0.5 rounded text-xs font-mono">4</Badge> 
                Imported from Grid
              </div>
              <div className="pl-9 text-muted-foreground">
                Import End ({formatMeterReading(reading.importEnd)}) - Import Start ({formatMeterReading(reading.importStart)}) = <span className="text-foreground font-medium">{formatUnits(bill.gridImported)}</span>
              </div>
              <div className="pl-9 text-xs font-sans text-muted-foreground opacity-80 italic">When solar wasn't enough, you drew this from the grid.</div>
            </div>

            <div className="space-y-2 bg-primary/5 p-4 rounded-lg -mx-4 border border-primary/10">
              <div className="font-bold font-sans text-foreground flex items-center gap-2">
                <Badge className="px-2 py-0.5 rounded text-xs font-mono">5</Badge> 
                Total Consumption
              </div>
              <div className="pl-9 text-muted-foreground mt-2">
                Imported ({formatUnits(bill.gridImported)}) + Self-Consumed ({formatUnits(bill.solarSelfConsumed)}) = <span className="text-primary font-bold">{formatUnits(bill.totalConsumption)}</span>
              </div>
              <div className="pl-9 text-xs font-sans text-primary/80 italic mt-1">Every unit you used this month, regardless of source.</div>
            </div>
          </>
        ) : (
          <div className="space-y-2 bg-primary/5 p-4 rounded-lg -mx-4 border border-primary/10">
            <div className="font-bold font-sans text-foreground flex items-center gap-2">
              <Badge className="px-2 py-0.5 rounded text-xs font-mono">1</Badge> 
              Total Consumption
            </div>
            <div className="pl-9 text-muted-foreground mt-2">
              Import End ({formatMeterReading(reading.importEnd)}) - Import Start ({formatMeterReading(reading.importStart)}) = <span className="text-primary font-bold">{formatUnits(bill.totalConsumption)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BillLineItems({ bill, isSolar }: { bill: BillDetailData['bill'], isSolar: boolean }) {
  const customCharges = bill.customChargesJson ? JSON.parse(bill.customChargesJson) : [];
  
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold font-heading">Your Bill</h2>
      <div className="rounded-xl border border-border bg-surface p-6 font-mono text-sm">
        
        <div className="mb-6 pb-6 border-b border-border border-dashed space-y-2">
          <div className="text-foreground font-sans font-medium">Your share: {bill.splitPercentage}% of the property</div>
          <div className="text-muted-foreground">
            Total Consumption ({formatUnits(bill.totalConsumption)}) x {bill.splitPercentage}% = <span className="text-foreground font-medium">{formatUnits(bill.tenantConsumption)}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>Consumption <span className="text-muted-foreground text-xs ml-2">{formatUnits(bill.tenantConsumption)} x {formatCurrency(bill.consumptionRate)}/unit</span></div>
            <div className="font-medium text-right w-24">{formatCurrency(bill.consumptionCost)}</div>
          </div>
          
          {(customCharges as CustomCharge[]).map((charge, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {charge.name}
                {charge.chargedToTenant && <Badge variant="muted" className="text-[10px] px-1.5 py-0">Tenant Share</Badge>}
              </div>
              <div className="font-medium text-right w-24">
                {formatCurrency(charge.chargedToTenant ? (charge.amount * bill.splitPercentage / 100) : charge.amount)}
              </div>
            </div>
          ))}
          
          <div className="pt-4 border-t border-border flex justify-between items-center text-base font-bold font-sans">
            <div>Total Due</div>
            <div className="text-xl font-numbers text-primary">{formatCurrency(bill.totalDue)}</div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border border-dashed text-xs text-muted-foreground font-sans">
          <div className="font-medium text-foreground mb-2">Rates applied:</div>
          <ul className="space-y-1 list-disc list-inside">
            <li>Consumption rate: {formatCurrency(bill.consumptionRate)}/unit</li>
            {isSolar && <li>Export rate: {formatCurrency(bill.exportRate)}/unit (owner earns this, not charged to you)</li>}

          </ul>
        </div>
      </div>
    </div>
  );
}

const SunMedium = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
);
