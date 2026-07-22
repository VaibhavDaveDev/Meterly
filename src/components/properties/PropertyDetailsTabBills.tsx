import React from 'react';
import type { Property } from '../../types/db';
import { EmptyState } from '../common/LoadingStates';
import { formatCurrency } from '../../lib/format';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { useToast } from '../../hooks/use-toast';

type PropertyBillsResponse = {
  bills: Array<{
    id: string;
    periodMonth: string;
    calculationMode: 'solar' | 'grid_only';
    periodStatus: string;
    tenants: Array<{
      billId: string;
      tenantName: string;
      splitPercentage: number;
      totalDue: number;
      status: 'pending' | 'paid';
      markedPaidAt: string | null;
    }>;
    totalConsumption: number;
    exportRefund: number | null;
  }>;
  summary: {
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
  };
};

interface PropertyDetailsTabBillsProps {
  property: Property;
  billsData: PropertyBillsResponse | null;
  isLoadingBills: boolean;
  filterYear: string;
  setFilterYear: (year: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  availableYears: string[];
  downloadCsv: () => void;
  isOwner: boolean;
}

export function PropertyDetailsTabBills({
  property,
  billsData,
  isLoadingBills,
  filterYear,
  setFilterYear,
  filterStatus,
  setFilterStatus,
  availableYears,
  downloadCsv,
  isOwner,
}: PropertyDetailsTabBillsProps) {
  // ponytail: Reusable states and hook for reopen dialog.
  const { toast } = useToast();
  const [periodToReopen, setPeriodToReopen] = React.useState<{ id: string; month: string } | null>(null);
  const [isReopening, setIsReopening] = React.useState(false);
  
  const flattenedBills = React.useMemo(() => {
    if (!billsData) return [];
    return billsData.bills.flatMap(p => 
      p.tenants.map(t => ({
        ...t,
        periodId: p.id,
        periodMonth: p.periodMonth,
        periodStatus: p.periodStatus,
        totalConsumption: p.totalConsumption, // property total
      }))
    ).sort((a, b) => new Date(b.periodMonth).getTime() - new Date(a.periodMonth).getTime());
  }, [billsData]);

  // Mark bills that are before the mode change
  const getMarkerPosition = (): string | null => {
    if (!property.soloModeChangedAt) return null;
    const changeDate = new Date(property.soloModeChangedAt);
    const firstBefore = flattenedBills.find(b => new Date(b.periodMonth) < changeDate);
    return firstBefore?.billId ?? null;
  };
  const markerBillId = getMarkerPosition();
  let markerRendered = false;

  return (
    <>
      <div className="space-y-6">
      {/* ── Summary Stats ── */}
      {billsData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total Billed</h3>
            <div className="text-2xl font-bold font-numbers text-foreground">{formatCurrency(billsData.summary.totalBilled)}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-1">Collected</h3>
            <div className="text-2xl font-bold font-numbers text-emerald-600">{formatCurrency(billsData.summary.totalCollected)}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-600 mb-1">Outstanding</h3>
            <div className="text-2xl font-bold font-numbers text-rose-600">{formatCurrency(billsData.summary.totalOutstanding)}</div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {/* Card header with filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Billing History</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Year filter */}
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y === 'all' ? 'All years' : y}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>

            {/* Export CSV */}
            <button
              onClick={downloadCsv}
              disabled={flattenedBills.length === 0}
              className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              title="Export to CSV"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Table body */}
        {isLoadingBills ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}
          </div>
        ) : !billsData || (billsData.bills.length === 0 && filterYear === 'all' && filterStatus === 'all') ? (
          <div className="p-6">
            <EmptyState
              title="No bills generated"
              description="Submit meter readings to automatically generate bills for this property."
              icon={
                <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
          </div>
        ) : flattenedBills.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No matches found" description="No bills match the selected filters." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Period</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenant</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Consumption</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Total Due</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flattenedBills.map((b, ri) => {
                  const isBeforeChange = property.soloModeChangedAt && new Date(b.periodMonth) < new Date(property.soloModeChangedAt);
                  const showMarker = isBeforeChange && !markerRendered && b.billId === markerBillId;
                  if (showMarker) markerRendered = true;

                  return (
                    <React.Fragment key={b.billId}>
                      {showMarker && (
                        <tr>
                          <td colSpan={6} className="px-4 py-2.5 bg-surface-raised/30 text-center border-y border-dashed border-border">
                            <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <span className="h-px w-8 bg-border inline-block" />
                              Tracking mode switched to {property.soloMode ? 'Solo' : 'Landlord'} on{' '}
                              {new Date(property.soloModeChangedAt!).toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })}
                              <span className="h-px w-8 bg-border inline-block" />
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr
                        className={`group transition-colors hover:bg-surface-raised/60 ${ri % 2 === 1 ? 'bg-surface-raised/20' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium">
                          {new Date(b.periodMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{b.tenantName || 'Unknown'}</td>
                        <td className="px-4 py-3 text-right font-numbers">
                          {b.totalConsumption ? (b.totalConsumption * (b.splitPercentage / 100)).toFixed(2) : '0.00'} kWh
                        </td>
                        <td className="px-4 py-3 text-right font-numbers font-medium">{formatCurrency(b.totalDue)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={b.status === 'paid' ? 'success' : 'warning'}>
                            {b.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`/bills/${b.billId}`}
                              className="text-xs font-medium px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors inline-flex items-center gap-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                              View
                            </a>
                            {b.periodStatus === 'confirmed' && isOwner && (
                              <button
                                onClick={() => setPeriodToReopen({ id: b.periodId, month: b.periodMonth })}
                                className="text-xs font-medium px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors inline-flex items-center gap-1"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                                  <path d="M21 3v5h-5"/>
                                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                                  <path d="M3 21v-5h5"/>
                                </svg>
                                Reopen
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
      
      <Dialog open={!!periodToReopen} onOpenChange={(open) => !open && setPeriodToReopen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen Billing Period</DialogTitle>
            <DialogDescription>
              Are you sure you want to reopen the billing period for {periodToReopen && new Date(periodToReopen.month + 'T00:00:00Z').toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}? Tenants will be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPeriodToReopen(null)} disabled={isReopening}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              disabled={isReopening}
              onClick={async () => {
                if (!periodToReopen) return;
                setIsReopening(true);
                try {
                  const res = await fetch(`/api/periods/${periodToReopen.id}/reopen`, { method: 'PATCH' });
                  const json = await res.json() as { success: boolean; error?: { message: string } };
                  if (json.success) {
                    toast({
                      title: 'Success',
                      description: 'Billing period reopened successfully.',
                    });
                    window.location.reload();
                  } else {
                    toast({
                      variant: 'destructive',
                      title: 'Error',
                      description: json.error?.message || 'Failed to reopen period.',
                    });
                  }
                } catch {
                  toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Network error occurred.',
                  });
                } finally {
                  setIsReopening(false);
                  setPeriodToReopen(null);
                }
              }}
            >
              {isReopening ? 'Reopening...' : 'Reopen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
