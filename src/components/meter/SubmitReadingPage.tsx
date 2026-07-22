import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { MeterInput } from './MeterInput';
import { LiveCalculationPreview } from './LiveCalculationPreview';
import { Loader2, ArrowLeft, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useReadingSubmit } from '../../hooks/use-reading-submit';
import { BillPhotoUpload } from './BillPhotoUpload';
import { OcrConflictDialog } from './OcrConflictDialog';
import { useReadingValidation } from '../../hooks/use-reading-validation';
import { useOcrData } from '../../hooks/use-ocr-data';
import { UploadedPhotos } from './UploadedPhotos';
import { SubmitConfirmDialog } from './SubmitConfirmDialog';

interface SubmitReadingPageProps {
  propertyId: string;
  periodId: string;
}

export function SubmitReadingPage({ periodId }: SubmitReadingPageProps) {
  // ponytail: Unconditional hook execution at the top level to comply with React hook rules.
  // We use safe fallback defaults when data is loading or null.
  const {
    data,
    isLoading,
    isSubmitting,
    setIsSubmitting,
    solarGenerationEnd,
    setSolarGenerationEnd,
    exportEnd,
    setExportEnd,
    importEnd,
    setImportEnd,
    reason,
    setReason,
    acknowledgedWarning,
    setAcknowledgedWarning,
    oneOffCharges,
    setOneOffCharges,
    newChargeName,
    setNewChargeName,
    newChargeAmount,
    setNewChargeAmount,
    newChargeToTenant,
    setNewChargeToTenant,
    toast
  } = useReadingSubmit(periodId);
  
  const handleAddCharge = () => {
    if (!newChargeName || !newChargeAmount) return;
    setOneOffCharges([...oneOffCharges, { name: newChargeName, amount: parseFloat(newChargeAmount), chargedToTenant: newChargeToTenant }]);
    setNewChargeName('');
    setNewChargeAmount('');
    setNewChargeToTenant(true);
  };

  const handleRemoveCharge = (index: number) => {
    setOneOffCharges(oneOffCharges.filter((_, i) => i !== index));
  };
  
  const [allowRollover, setAllowRollover] = useState(false);
  const [editRates, setEditRates] = useState(false);
  const [consumptionRate, setConsumptionRate] = useState('');
  const [exportRate, setExportRate] = useState('');

  useEffect(() => {
    if (data?.currentRates) {
      setConsumptionRate(data.currentRates.consumptionRate.toString());
      setExportRate(data.currentRates.exportRate.toString());
    }
  }, [data?.currentRates]);
  // ═══════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingPhotoCount, setPendingPhotoCount] = useState(0);
  
  const isSolar = data?.property.hasSolar ?? false;
  const existingReading = data?.existingReading;
  const canEdit = data?.canEdit ?? false;
  const startValues = data?.startValues ?? { solarGenerationStart: 0, exportStart: 0, importStart: 0 };
  
  const {
    hasWarning,
    validationErrors,
    canSave,
    numericSolar,
    numericExport,
    numericImport
  } = useReadingValidation({
    isSolar,
    importEnd,
    exportEnd,
    solarGenerationEnd,
    startValues,
    allowRollover,
    acknowledgedWarning,
    existingReading: !!existingReading,
    canEdit,
    reason
  });

  const {
    hasOcrData,
    pendingProposals,
    handleOcrExtracted,
    handleResolveConflicts
  } = useOcrData({
    isSolar,
    importEnd,
    exportEnd,
    solarGenerationEnd,
    setImportEnd,
    setExportEnd,
    setSolarGenerationEnd
  });
  
  const [photoRefreshKey, setPhotoRefreshKey] = useState(0);

  // ═══════════════════════════════════════════════════════════
  // END OF HOOKS SECTION - CONDITIONAL RENDERING STARTS HERE ↓
  // ═══════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <p className="text-lg font-medium text-foreground">Failed to load period data</p>
      <p className="text-sm text-muted-foreground">The period may not exist or you may not have access.</p>
      <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
    </div>
  );

  const { period, property, currentRates, activeTenancySplit, canSubmit, canRequestEdit, tenancyId, isOwner } = data;
  const isConfirmed = period.status === 'confirmed';
  // Owner can override rates on any submitted or confirmed period (backend enforces this too)
  const canOverrideRates = isOwner && (period.status === 'submitted' || period.status === 'confirmed');

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSave) return;

    try {
      const photosRes = await fetch(`/api/uploads/bill-photos?periodId=${periodId}`);
      const photosData = await photosRes.json() as { success: boolean; data?: unknown[] };
      const hasPhotos = photosData.success && photosData.data && photosData.data.length > 0;
      
      if (hasPhotos) {
        setPendingPhotoCount(photosData.data?.length || 0);
        setShowConfirmDialog(true);
        return;
      }
    } catch (err) {
      console.error('Error checking photo count:', err);
    }

    await doSubmit();
  };

  const doSubmit = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);
    try {
      // If only overriding rates (confirmed period, no reading edit), skip the readings PATCH entirely
      const shouldSaveReadings = canSubmit || canEdit;

      if (shouldSaveReadings) {
        const endpoint = `/api/periods/${periodId}/readings`;
        const method = (existingReading && canEdit) ? 'PATCH' : 'POST';
        
        const payload = {
          solarGenerationEnd: isSolar ? numericSolar : 0,
          exportEnd: isSolar ? numericExport : 0,
          importEnd: numericImport,
          reason: (existingReading && canEdit) ? reason : undefined,
          allowRollover,
          oneOffCharges: (isOwner && oneOffCharges.length > 0) ? oneOffCharges : undefined
        };

        const res = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.status === 409) {
        toast({ 
          variant: 'destructive', 
          title: 'Already Submitted', 
          description: 'A reading has already been saved for this period.' 
        });
        return;
      }

        const json = await res.json() as { success: boolean; error?: { message: string } };
        if (!json.success) {
          toast({ variant: 'destructive', title: 'Error saving readings', description: json.error?.message });
          setIsSubmitting(false);
          return;
        }
      } // end shouldSaveReadings

      if (editRates && canOverrideRates) {
        const ratesPayload = {
          consumptionRate: parseFloat(consumptionRate),
          exportRate: parseFloat(exportRate || '0'),
          reason: reason || 'Rates updated alongside readings.',
        };
        const ratesRes = await fetch(`/api/periods/${periodId}/rates`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ratesPayload)
        });
        const ratesJson = await ratesRes.json() as { success: boolean; error?: { message: string } };
        if (!ratesJson.success) {
          toast({ variant: 'destructive', title: 'Error saving rates', description: ratesJson.error?.message });
          setIsSubmitting(false);
          return;
        }
      }

      toast({ title: 'Success', description: 'Period updated successfully.' });
      window.location.href = `/properties/${property.id}`;
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Network error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {pendingProposals.length > 0 && (
        <OcrConflictDialog proposals={pendingProposals} onResolve={handleResolveConflicts} />
      )}

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => data.isOwner ? (window.location.href = `/properties/${property.id}`) : (data.tenancyId ? (window.location.href = `/tenancies/${data.tenancyId}`) : window.history.back())}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <h1 className="text-2xl font-bold tracking-tight">
                  Submit Readings
                </h1>
                {data.allPeriods && data.allPeriods.length > 0 ? (
                  <select
                    value={period.id}
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected !== period.id) {
                        window.location.href = `/properties/${property.id}/periods/${selected}`;
                      }
                    }}
                    className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 w-fit"
                  >
                    {data.allPeriods.map(p => (
                      <option key={p.id} value={p.id}>
                        {new Date(p.periodMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                        {p.status === 'confirmed' ? ' (Confirmed)' : ''}
                        {p.status === 'draft' ? ' (Draft)' : ''}
                        {p.status === 'submitted' ? ' (Submitted)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xl font-medium text-muted-foreground">
                    — {new Date(period.periodMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-muted-foreground text-sm">{property.name}</span>
                <Badge variant={isSolar ? 'success' : 'muted'}>{isSolar ? 'Solar' : 'Grid-only'}</Badge>
              </div>
            </div>
          </div>
        </div>

        {(existingReading && canEdit) && (
          <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 text-sm">
            <strong>Editing Mode:</strong> Editing this reading will recalculate bills for all tenants and notify them. A reason is required.
          </div>
        )}

        {period.status === 'submitted' && isOwner && existingReading && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 flex items-center gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Period Re-opened</p>
              <p className="text-xs text-muted-foreground">
                Edit readings below, then go back to the property overview and confirm the period to lock it again.
              </p>
            </div>
          </div>
        )}

        {period.status === 'pending_approval' && isOwner && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Tenant Reading Pending Approval</p>
              <p className="text-xs text-muted-foreground">
                A tenant has submitted readings for this period. Go to{' '}
                <a href={`/properties/${property.id}/edit-requests`} className="underline text-accent hover:text-accent/80">
                  Edit Requests
                </a>{' '}
                to approve or reject it.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            {isConfirmed && (
              <div className="rounded-lg border border-border bg-surface/50 p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Period Confirmed</p>
                  <p className="text-xs text-muted-foreground">
                    {isOwner 
                      ? 'This period is locked. Use "Re-open Period" from the property overview to make changes.'
                      : 'Bills are finalized. Contact your owner or use "Request Edit" if you spot an error.'}
                  </p>
                </div>
              </div>
            )}
            
            {canRequestEdit && tenancyId && (
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 text-center">
                <p className="text-sm font-medium text-foreground mb-2">See an error in your readings?</p>
                <p className="text-xs text-muted-foreground mb-3">
                  The billing period is confirmed. You can submit a correction request to your owner.
                </p>
                <Button asChild size="sm">
                  <a href={`/tenancies/${tenancyId}/edit-requests/new?periodId=${period.id}`}>Request a Correction</a>
                </Button>
              </div>
            )}
            <div className="rounded-xl border border-border bg-surface p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Your readings</h2>
                <p className="text-sm text-muted-foreground">Enter the numbers from your meters right now.</p>
              </div>
              
              {(canSubmit || canEdit) && (
                <BillPhotoUpload 
                  periodId={periodId} 
                  propertyId={property.id}
                  onReadingExtracted={handleOcrExtracted} 
                  onUploadSuccess={() => setPhotoRefreshKey(k => k + 1)}
                />
              )}

              <UploadedPhotos 
                key={`uploaded-photos-${photoRefreshKey}`}
                periodId={periodId} 
                canDelete={canSubmit || canEdit}
              />

              {hasOcrData && (canSubmit || canEdit) && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
                  <strong>Verify before submitting.</strong> These figures were extracted automatically.
                  OCR can make mistakes — always check against your physical meter or bill before submitting.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {isSolar && (
                  <>
                    <MeterInput
                      label="Solar Generation"
                      value={solarGenerationEnd || (existingReading?.solarGenerationEnd.toString() ?? '')}
                      startValue={startValues.solarGenerationStart}
                      onChangeValue={setSolarGenerationEnd}
                      disabled={(!canSubmit && !canEdit)}
                      color="emerald"
                      required
                    />
                    <MeterInput
                      label="Export to Grid"
                      value={exportEnd || (existingReading?.exportEnd.toString() ?? '')}
                      startValue={startValues.exportStart}
                      onChangeValue={setExportEnd}
                      disabled={(!canSubmit && !canEdit)}
                      color="emerald"
                      required
                    />
                  </>
                )}
                
                <div className="space-y-3">
                  <MeterInput
                    label="Import from Grid"
                    value={importEnd || (existingReading?.importEnd.toString() ?? '')}
                    startValue={startValues.importStart}
                    onChangeValue={setImportEnd}
                    disabled={(!canSubmit && !canEdit)}
                    color="emerald"
                    required
                  />
                  {(canSubmit || canEdit) && (allowRollover || validationErrors.some(e => e.includes('lower than the previous reading'))) && (
                    <div className="space-y-1 pl-1">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="rollover" 
                          className="rounded border-border text-primary focus:ring-primary"
                          checked={allowRollover}
                          onChange={(e) => setAllowRollover(e.target.checked)}
                        />
                        <label htmlFor="rollover" className="text-xs text-muted-foreground">
                          Meter reached maximum and rolled over to zero
                        </label>
                      </div>
                      {allowRollover && (
                        <p className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                          Only check this if your meter actually reached its maximum and rolled back to zero. 
                          If you made a mistake in the previous reading, ask your landlord to correct it instead.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {canOverrideRates && (
                  <div className="space-y-3 pt-4 border-t border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <input 
                        type="checkbox" 
                        id="editRates" 
                        className="rounded border-border text-primary focus:ring-primary"
                        checked={editRates}
                        onChange={(e) => setEditRates(e.target.checked)}
                      />
                      <label htmlFor="editRates" className="text-sm font-medium text-foreground">
                        Override Rates for this Period
                      </label>
                    </div>
                    {editRates && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-surface/50 border border-border">
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Consumption Rate (₹)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            required={editRates}
                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={consumptionRate}
                            onChange={(e) => setConsumptionRate(e.target.value)}
                          />
                        </div>
                        {isSolar && (
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Export Rate (₹)</label>
                            <input 
                              type="number" 
                              step="0.01"
                              min="0"
                              required={editRates}
                              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              value={exportRate}
                              onChange={(e) => setExportRate(e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {isOwner && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <h4 className="text-sm font-medium text-foreground">One-off Custom Charges</h4>
                  <div className="space-y-2 max-w-lg">
                    {oneOffCharges.map((c, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted/50 p-2 rounded-md border text-sm">
                        <div className="flex flex-col">
                          <span>{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.chargedToTenant ? 'Charged to Tenant' : 'Paid by Owner'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono">₹{c.amount}</span>
                          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => handleRemoveCharge(i)}>×</Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 items-end mt-2">
                      <div className="flex-1 space-y-1">
                        <Input placeholder="Charge name" value={newChargeName} onChange={e => setNewChargeName(e.target.value)} className="h-9 text-sm" />
                      </div>
                      <div className="w-24 space-y-1">
                        <Input type="number" placeholder="Amt" value={newChargeAmount} onChange={e => setNewChargeAmount(e.target.value)} className="h-9 text-sm" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                      <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor="charge-tenant-switch">
                        Charge to Tenant
                      </Label>
                      <div className="flex items-center gap-3">
                        <Switch 
                          id="charge-tenant-switch"
                          checked={newChargeToTenant} 
                          onCheckedChange={setNewChargeToTenant} 
                          className="scale-75"
                        />
                        <Button type="button" variant="secondary" size="sm" className="h-8 text-xs px-3" onClick={handleAddCharge}>Add</Button>
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {(canSubmit || canEdit || editRates) && (
                  <>
                    {validationErrors.length > 0 && (
                      <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 space-y-1">
                        {validationErrors.map((err, i) => (
                          <p key={i} className="text-sm text-red-600 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{err}</span>
                          </p>
                        ))}
                      </div>
                    )}

                    {hasWarning && (
                      <label className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                        <input 
                          type="checkbox" 
                          checked={acknowledgedWarning} 
                          onChange={e => setAcknowledgedWarning(e.target.checked)}
                          className="mt-1"
                        />
                        <span className="text-sm text-amber-600 dark:text-amber-500">
                          I acknowledge that some readings have unusually high increases or decimals and I have double-checked them.
                        </span>
                      </label>
                    )}

                    {((existingReading && canEdit) || (editRates && canOverrideRates)) && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Reason for edit <span className="text-destructive">*</span></label>
                        <textarea
                          className="w-full h-20 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                          placeholder="Provide a detailed reason..."
                          value={reason}
                          onChange={(e) => setReason(e.target.value.slice(0, 1000))}
                          required
                          minLength={10}
                          maxLength={1000}
                        />
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>Must be at least 10 characters.</span>
                          <span>{reason.length} / 1000 characters</span>
                        </div>
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={(!(canSave || editRates)) || isSubmitting || (editRates && reason.length < 10)}>
                      {isSubmitting ? 'Submitting...' : (property.readingsRequireApproval && !isOwner ? 'Submit for Owner Approval' : 'Review & Submit')}
                    </Button>
                  </>
                )}
              </form>
            </div>

          </div>

          <div className="lg:sticky lg:top-6 space-y-6 h-fit">
            <LiveCalculationPreview
              isSolar={isSolar}
              rates={currentRates || { consumptionRate: 0, exportRate: 0 }}
              splitPercentage={activeTenancySplit || 0}
              startValues={startValues}
              currentValues={{
                solarGenerationEnd: isNaN(numericSolar) ? null : numericSolar,
                exportEnd: isNaN(numericExport) ? null : numericExport,
                importEnd: isNaN(numericImport) ? null : numericImport,
              }}
            />
          </div>
        </div>
      </div>

      {showConfirmDialog && (
        <SubmitConfirmDialog
          photoCount={pendingPhotoCount}
          onConfirm={doSubmit}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}
    </>
  );
}
