import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { MeterInput } from '../meter/MeterInput';
import { Loader2, ArrowLeft, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

interface PeriodDetails {
  property: {
    id: string;
    name: string;
    hasSolar: boolean;
  };
  period: {
    id: string;
    periodMonth: string;
    status: string;
  };
  existingReading: {
    importEnd: number;
    exportEnd?: number;
    solarGenerationEnd?: number;
  } | null;
  startValues: {
    importStart: number;
    exportStart: number;
    solarGenerationStart: number;
  };
}

interface EditRequest {
  id: string;
  billingPeriodId: string;
  reason: string;
  proposedValues: string;
  status: string;
}

interface ConfirmedPeriod {
  id: string;
  periodMonth: string;
  hasPendingRequest: boolean;
}

interface NewEditRequestPageProps {
  tenancyId: string;
  periodId?: string | null;
}

interface ValidationErrors {
  importEnd?: string;
  exportEnd?: string;
  solarGenerationEnd?: string;
  form?: string;
}



export function NewEditRequestPage({ tenancyId, periodId: propPeriodId }: NewEditRequestPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<PeriodDetails | null>(null);
  const [pendingRequest, setPendingRequest] = useState<EditRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(propPeriodId || '');
  const [confirmedPeriods, setConfirmedPeriods] = useState<ConfirmedPeriod[]>([]);

  const [importEnd, setImportEnd] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [solarGenerationEnd, setSolarGenerationEnd] = useState('');
  const [reason, setReason] = useState('');

  // ponytail: Simple API endpoints used directly instead of complicated abstractions
  useEffect(() => {
    async function loadConfirmedPeriods() {
      try {
        const res = await fetch(`/api/tenancies/${tenancyId}/confirmed-periods`);
        const json = (await res.json()) as { success: boolean; data: ConfirmedPeriod[] };
        if (json.success) {
          setConfirmedPeriods(json.data);
          if (!selectedPeriodId && json.data.length > 0) {
            setSelectedPeriodId(json.data[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching confirmed periods:', err);
      }
    }
    loadConfirmedPeriods();
  }, [tenancyId]);

  useEffect(() => {
    if (!selectedPeriodId) return;

    async function loadPeriodDetails() {
      setIsLoading(true);
      try {
        // Get period details (for existing readings)
        const pRes = await fetch(`/api/periods/${selectedPeriodId}`);
        const pData = (await pRes.json()) as { success: boolean; data: PeriodDetails };
        if (!pData.success) throw new Error('Could not load period data');

        // Get pending edit requests
        const rRes = await fetch(`/api/tenancies/${tenancyId}/pending-edit-requests`);
        const rData = (await rRes.json()) as { data?: EditRequest[] };
        
        const existing = rData.data?.find((r: EditRequest) => r.billingPeriodId === selectedPeriodId);

        setData(pData.data);
        if (existing) {
          setPendingRequest(existing);
          const pv = JSON.parse(existing.proposedValues || '{}') as {
            importEnd?: number;
            exportEnd?: number;
            solarGenerationEnd?: number;
          };
          setImportEnd(pv.importEnd !== undefined ? String(pv.importEnd) : String(pData.data.existingReading?.importEnd || ''));
          setExportEnd(pv.exportEnd !== undefined ? String(pv.exportEnd) : String(pData.data.existingReading?.exportEnd || ''));
          setSolarGenerationEnd(pv.solarGenerationEnd !== undefined ? String(pv.solarGenerationEnd) : String(pData.data.existingReading?.solarGenerationEnd || ''));
          setReason(existing.reason || '');
        } else {
          setPendingRequest(null);
          setImportEnd(String(pData.data.existingReading?.importEnd || ''));
          setExportEnd(String(pData.data.existingReading?.exportEnd || ''));
          setSolarGenerationEnd(String(pData.data.existingReading?.solarGenerationEnd || ''));
          setReason('');
        }

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'An unknown error occurred';
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    }
    loadPeriodDetails();
  }, [selectedPeriodId, tenancyId]);

  // ponytail: compute validation errors on-the-fly during render to prevent state-sync infinite loops
  const getErrors = () => {
    const errors: ValidationErrors = {};
    if (!data) return { errors, hasErrors: false };

    const startValues = data.startValues;
    const existingReading = data.existingReading;
    const isSolar = data.property.hasSolar;

    const impVal = Number(importEnd);
    if (importEnd !== '' && !isNaN(impVal) && impVal < startValues.importStart) {
      errors.importEnd = `Cannot be less than start reading (${startValues.importStart})`;
    }

    if (isSolar) {
      const expVal = Number(exportEnd);
      const solVal = Number(solarGenerationEnd);

      if (exportEnd !== '' && !isNaN(expVal) && expVal < startValues.exportStart) {
        errors.exportEnd = `Cannot be less than start reading (${startValues.exportStart})`;
      }

      if (solarGenerationEnd !== '' && !isNaN(solVal) && solVal < startValues.solarGenerationStart) {
        errors.solarGenerationEnd = `Cannot be less than start reading (${startValues.solarGenerationStart})`;
      }

      // Export cannot exceed generation
      if (exportEnd !== '' && solarGenerationEnd !== '' && !isNaN(expVal) && !isNaN(solVal)) {
        const solarGenDiff = solVal - startValues.solarGenerationStart;
        const exportDiff = expVal - startValues.exportStart;
        if (exportDiff > solarGenDiff) {
          errors.exportEnd = `Proposed export difference (${exportDiff.toFixed(2)} units) cannot exceed solar generation difference (${solarGenDiff.toFixed(2)} units)`;
        }
      }
    }

    // Check if any value actually changed from the original readings
    const currentImport = existingReading?.importEnd ?? 0;
    const currentExport = existingReading?.exportEnd ?? 0;
    const currentSolar = existingReading?.solarGenerationEnd ?? 0;

    const impValNum = importEnd !== '' ? Number(importEnd) : currentImport;
    const expValNum = exportEnd !== '' ? Number(exportEnd) : currentExport;
    const solValNum = solarGenerationEnd !== '' ? Number(solarGenerationEnd) : currentSolar;

    const hasChange =
      (importEnd !== '' && impValNum !== currentImport) ||
      (exportEnd !== '' && isSolar && expValNum !== currentExport) ||
      (solarGenerationEnd !== '' && isSolar && solValNum !== currentSolar);

    const allFilled = importEnd !== '' && (isSolar ? exportEnd !== '' && solarGenerationEnd !== '' : true);
    if (allFilled && !hasChange) {
      errors.form = 'You must change at least one reading value';
    }

    return { errors, hasErrors: Object.keys(errors).length > 0 };
  };

  const { errors, hasErrors } = getErrors();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (confirmedPeriods.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No confirmed periods found for this tenancy.</p>
        <Button variant="outline" className="mt-4" onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  if (!data || !data.existingReading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No confirmed readings found for the selected period.</p>
        <Button variant="outline" className="mt-4" onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  const { property, period, startValues } = data;
  const isSolar = property.hasSolar;

  // ponytail: period status guard to prevent correction requests on open/draft periods
  if (period.status === 'draft' || period.status === 'submitted') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground m-0">Request Edit</h1>
            <p className="text-sm text-muted-foreground m-0">{property.name} • {new Date(period.periodMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-6 text-center max-w-lg mx-auto mt-8">
          <Info className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">This Period Is Still Open</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Correction requests are only needed for billing periods your landlord has already confirmed.
            This period is still open, so you can edit the readings directly.
          </p>
          <Button asChild>
            <a href={`/properties/${property.id}/periods/${period.id}`}>
              Edit Your Readings
            </a>
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (reason.length < 10) {
      toast({ title: 'Invalid Input', description: 'Please provide a detailed reason (at least 10 characters).', variant: 'destructive' });
      return;
    }

    if (hasErrors) {
      toast({ title: 'Validation Error', description: 'Please resolve all highlighted errors before submitting.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        billingPeriodId: selectedPeriodId,
        reason,
        proposedValues: {
          importEnd: importEnd ? Number(importEnd) : undefined,
          ...(isSolar ? {
            exportEnd: exportEnd ? Number(exportEnd) : undefined,
            solarGenerationEnd: solarGenerationEnd ? Number(solarGenerationEnd) : undefined,
          } : {})
        }
      };

      const res = await fetch('/api/edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = (await res.json()) as { error?: { message: string }; data?: { overwrote?: boolean } };
      if (!res.ok) throw new Error(resData.error?.message || 'Failed to submit request');

      if (resData.data?.overwrote) {
        toast({ title: 'Request Updated', description: 'Your previous pending request was overwritten.' });
      } else {
        toast({ title: 'Request Submitted', description: 'The property owner will review your proposed changes.' });
      }

      window.location.href = `/tenancies/${tenancyId}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground m-0">Request Edit</h1>
          <p className="text-sm text-muted-foreground m-0">{property.name} • {new Date(period.periodMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="period-select" className="text-sm font-medium text-muted-foreground">Select Period</label>
        <select
          id="period-select"
          value={selectedPeriodId}
          onChange={(e) => setSelectedPeriodId(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-border bg-surface focus:border-accent focus:outline-none"
        >
          <option value="">Choose a period...</option>
          {confirmedPeriods.map(p => (
            <option key={p.id} value={p.id}>
              {new Date(p.periodMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
              {p.hasPendingRequest ? ' (Pending request)' : ''}
            </option>
          ))}
        </select>
      </div>

      {period.status === 'confirmed' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground m-0">Period Already Confirmed</p>
            <p className="text-xs text-muted-foreground m-0 mt-1">
              This billing period has been locked by your landlord. Your correction request will be reviewed.
              If approved, your bill will be recalculated.
            </p>
          </div>
        </div>
      )}

      {pendingRequest && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400 m-0">Pending Request Exists</h4>
            <p className="text-sm text-amber-600/80 dark:text-amber-400/80 m-0 mt-1">
              You already have a pending edit request for this billing period. Submitting this form will overwrite your previous request.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-border bg-surface p-6 space-y-6">
          <h3 className="text-lg font-semibold text-foreground m-0">Proposed Readings</h3>
          
          <div className="grid gap-6 sm:grid-cols-2">
            <MeterInput
              id="importEnd"
              label="Grid Import"
              value={importEnd}
              onChangeValue={setImportEnd}
              startValue={startValues.importStart}
              placeholder="e.g. 15042"
              error={errors.importEnd}
              required
            />

            {isSolar && (
              <>
                <MeterInput
                  id="exportEnd"
                  label="Grid Export"
                  value={exportEnd}
                  onChangeValue={setExportEnd}
                  startValue={startValues.exportStart}
                  placeholder="e.g. 4021"
                  error={errors.exportEnd}
                  required
                />
                <MeterInput
                  id="solarGenerationEnd"
                  label="Solar Generation"
                  value={solarGenerationEnd}
                  onChangeValue={setSolarGenerationEnd}
                  startValue={startValues.solarGenerationStart}
                  placeholder="e.g. 8500"
                  error={errors.solarGenerationEnd}
                  required
                />
              </>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="reason" className="text-sm font-medium text-foreground">Reason for Edit <span className="text-red-500">*</span></label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 1000))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
              placeholder="Please explain why you are requesting this change..."
              required
              minLength={10}
              maxLength={1000}
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>The property owner will see this reason when reviewing your request.</span>
              <span>{reason.length} / 1000 characters</span>
            </div>
          </div>
        </div>

        {errors.form && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600">
            {errors.form}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting || hasErrors}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {pendingRequest ? 'Overwrite Request' : 'Submit Request'}
          </Button>
        </div>
      </form>
    </div>
  );
}
