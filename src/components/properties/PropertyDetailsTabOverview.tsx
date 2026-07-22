import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { TooltipIcon } from '../ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { formatCurrency } from '../../lib/format';
import type { PropertyDetailState } from './types';
import { PropertyGraphsSection } from './PropertyGraphsSection';
import { PropertyRatesTable } from './PropertyRatesTable';
import { useToast } from '../../hooks/use-toast';

// Period status → badge variant
function periodStatusVariant(status: string): 'success' | 'warning' | 'info' | 'muted' {
  if (status === 'confirmed') return 'success';
  if (status === 'submitted') return 'info';
  if (status === 'draft') return 'warning';
  return 'muted';
}

function periodStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    submitted: 'Submitted',
    confirmed: 'Confirmed',
  };
  return labels[status] ?? status;
}

export function PropertyDetailsTabOverview({ state }: { state: PropertyDetailState }) {
  const {
    property: localProperty,
    isOwner,
    activePeriod,
    isPeriodModalOpen,
    setIsPeriodModalOpen,
    periodMonth,
    setPeriodMonth,
    isStartingPeriod,
    handleStartPeriod,
    tenantCount,
  } = state;
  const property = localProperty;

  const [chartData, setChartData] = React.useState<{
    monthlyRevenue?: Array<{ month: string; revenue: number }>;
    monthlyConsumption?: Array<{ month: string; units: number }>;
    solarSavings?: Array<{ month: string; actual: number; withoutSolar: number }> | null;
  }>({});
  const [isLoadingChart, setIsLoadingChart] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      if (!isOwner) return;
      setIsLoadingChart(true);
      try {
        const res = await fetch(`/api/properties/${property.id}/chart-data`);
        const data = (await res.json()) as { success: boolean; data: Parameters<typeof setChartData>[0] };
        if (data.success) {
          setChartData(data.data);
        }
      } catch (err) {
        console.error('Failed to load chart data', err);
      } finally {
        setIsLoadingChart(false);
      }
    }
    load();
  }, [property.id]);

  const { toast } = useToast();
  const [isReopening, setIsReopening] = React.useState(false);
  const [isConfirming, setIsConfirming] = React.useState(false);

  const handleConfirmPeriod = async () => {
    if (!activePeriod || isConfirming) return;
    setIsConfirming(true);
    try {
      const res = await fetch(`/api/periods/${activePeriod.id}/confirm`, { method: 'PATCH' });
      const data = (await res.json()) as { error?: { message: string } };
      if (!res.ok) throw new Error(data.error?.message || 'Failed to confirm period');
      toast({ title: 'Success', description: 'Period confirmed successfully' });
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsConfirming(false);
    }
  };



  const handleReopenPeriod = async () => {
    if (!activePeriod || isReopening) return;
    setIsReopening(true);
    try {
      const res = await fetch(`/api/periods/${activePeriod.id}/reopen`, { method: 'PATCH' });
      const data = (await res.json()) as { error?: { message: string } };
      if (!res.ok) throw new Error(data.error?.message || 'Failed to reopen period');
      toast({ title: 'Success', description: 'Period reopened for editing' });
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Billing Period Status Banner ── */}
      <div className="rounded-xl border border-border bg-surface p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-foreground">Current Billing Period</h3>
            <TooltipIcon content="The active billing period for this property. Submit readings to generate bills." />
          </div>
          {activePeriod ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                {new Date(activePeriod.periodMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <Badge variant={periodStatusVariant(activePeriod.status)}>
                {periodStatusLabel(activePeriod.status)}
              </Badge>
              <Badge variant={activePeriod.calculationMode === 'solar' ? 'success' : 'info'}>
                {activePeriod.calculationMode === 'solar' ? 'Solar' : 'Grid Only'}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground m-0">No active billing period.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isOwner && (
            <div className="flex gap-2">
              <Dialog open={isPeriodModalOpen} onOpenChange={setIsPeriodModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Start New Period</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <form onSubmit={handleStartPeriod}>
                    <DialogHeader>
                      <DialogTitle>Start Billing Period</DialogTitle>
                      <DialogDescription>
                        Select the month to start tracking. You can backfill past months too — useful if you're catching up on older data.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="periodMonth">Month Starting Date <span className="text-red-500">*</span></Label>
                        <Input
                          id="periodMonth"
                          type="month"
                          required
                          value={periodMonth ? periodMonth.slice(0, 7) : ''}
                          onChange={(e) => setPeriodMonth(e.target.value + '-01')}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsPeriodModalOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={isStartingPeriod || !periodMonth}>
                        {isStartingPeriod ? 'Starting...' : 'Start Period'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" asChild>
                <a href={`/properties/${localProperty.id}/periods/new?past=true`}>Add Past Data</a>
              </Button>
            </div>
          )}

          {activePeriod && activePeriod.status !== 'pending_approval' && (
            <Button size="sm" variant={activePeriod.status === 'draft' ? 'default' : 'outline'} asChild>
              <a href={`/properties/${localProperty.id}/periods/${activePeriod.id}`}>
                {activePeriod.status === 'draft' ? 'Submit Readings' : 'View/Edit Readings'}
              </a>
            </Button>
          )}

          {activePeriod?.status === 'pending_approval' && isOwner && (
            <Button size="sm" variant="outline" asChild>
              <a href={`/properties/${localProperty.id}/edit-requests`}>
                Review Pending Reading
              </a>
            </Button>
          )}

          {activePeriod?.status === 'pending_approval' && !isOwner && (
            <Button size="sm" variant="outline" asChild>
              <a href={`/properties/${localProperty.id}/periods/${activePeriod.id}`}>
                View Submitted Reading
              </a>
            </Button>
          )}

          {activePeriod?.status === 'confirmed' && isOwner && (
            <Button size="sm" variant="ghost" onClick={handleReopenPeriod} disabled={isReopening}>
              {isReopening ? 'Reopening...' : 'Re-open Period'}
            </Button>
          )}

          {activePeriod?.status === 'submitted' && isOwner && (
            <Button size="sm" variant="default" onClick={handleConfirmPeriod} disabled={isConfirming}>
              {isConfirming ? 'Confirming...' : 'Confirm Period'}
            </Button>
          )}
        </div>
      </div>

      {activePeriod?.status === 'draft' && activePeriod.bills?.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-accent/30 bg-accent/5 p-6 text-center mt-6">
          <p className="font-semibold text-foreground mb-2">Ready to add this month's readings?</p>
          <p className="text-sm text-muted-foreground mb-4">
            Enter meter readings to generate bills for all tenants.
          </p>
          <Button asChild>
            <a href={`/properties/${localProperty.id}/periods/${activePeriod.id}`}>
              Add Readings Now
            </a>
          </Button>
        </div>
      )}

      {activePeriod?.status === 'draft' && (activePeriod.bills?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-warning bg-warning/10 p-4 text-warning-foreground mt-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold mb-1">Period Re-opened</p>
            <p className="text-sm">This billing period is open for corrections. Bills will be recalculated and notifications resent when confirmed.</p>
          </div>
        </div>
      )}

      {/* ── Current Period Bills ── */}
      {activePeriod?.bills && activePeriod.bills.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {isOwner ? `Current Period Bills (${new Date(activePeriod.periodMonth).toLocaleString('default', { month: 'long', year: 'numeric' })})` : 'Your Current Bill'}
            </h3>
          </div>
          <div className="divide-y divide-border">
            {activePeriod.bills.filter(b => isOwner || b.isSelf).map(bill => (
              <div key={bill.billId} className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors">
                <div className="flex flex-col gap-1">
                  {isOwner && <span className="font-medium text-foreground">{bill.tenantName}</span>}
                  <span className="text-xl font-numbers font-bold text-foreground">{formatCurrency(bill.amount)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={bill.status === 'paid' ? 'success' : 'warning'}>
                    {bill.status === 'paid' ? 'Paid' : 'Unpaid'}
                  </Badge>
                  <a href={`/bills/${bill.billId}`} className="text-sm font-medium text-accent hover:underline">
                    View Detail →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-0.5 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active Tenants</span>
            <TooltipIcon content="Number of tenants with accepted invites" />
          </div>
          <span className="text-3xl font-bold font-numbers">{tenantCount}</span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-0.5 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Solar</span>
            <TooltipIcon content="Whether this property has solar generation tracking enabled" />
          </div>
          <Badge variant={property.hasSolar ? 'success' : 'muted'} className="text-sm px-2.5 py-1">
            {property.hasSolar ? 'Enabled' : 'Grid Only'}
          </Badge>
        </div>


      </div>

      {/* ── Historical Trends Chart ── */}
      <PropertyGraphsSection 
        chartData={chartData} 
        isLoading={isLoadingChart} 
      />
      {/* ── Rates Table ── */}
      <div className="pt-4">
        <PropertyRatesTable propertyId={localProperty.id} isOwner={isOwner} />
      </div>
    </div>
  );
}
