import { useState, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { formatCurrency, formatMonth } from '../../lib/format';
import { SunMedium, FileText, ChevronRight, AlertCircle, Info, Building2, User, Download, Edit3 } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useToast } from '../../hooks/use-toast';
import { TenancyGraphsSection } from './TenancyGraphsSection';

interface TenancyOverviewProps {
  tenancyId: string;
}

interface TenancyOverviewData {
  tenancy: {
    id: string;
    propertyId: string;
    propertyName: string;
    hasSolar: boolean;
    ownerName: string;
    resolvedSplitPercentage: number;
    joinedAt: string | null;
    status: 'active' | 'inactive';
  };
  currentPeriod: {
    periodId: string;
    periodMonth: string;
    canSubmit: boolean;
    bill: {
      billId: string;
      totalDue: number | string;
      status: 'pending' | 'paid';
    } | null;
  } | null;
  recentBills: Array<{
    billId: string;
    periodMonth: string;
    totalDue: number | string;
    status: 'pending' | 'paid';
  }>;
  pendingEditRequests: number;
}

// ---------------------------
// Child Components
// ---------------------------

function TenancyHeader({ tenancy }: { tenancy: TenancyOverviewData['tenancy'] }) {
  const joinedDate = tenancy.joinedAt ? new Date(tenancy.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown';

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold font-heading">{tenancy.propertyName}</h1>
        {tenancy.hasSolar && (
          <Badge variant="warning" className="ml-2 flex items-center gap-1">
            <SunMedium className="w-3 h-3" /> Solar
          </Badge>
        )}
      </div>
      
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground bg-surface border border-border rounded-lg px-4 py-3">
        <div className="flex items-center gap-1.5">
          <User className="w-4 h-4" />
          <span>Landlord: <span className="font-medium text-foreground">{tenancy.ownerName}</span></span>
        </div>
        <div className="w-px h-4 bg-border hidden sm:block"></div>
        <div>
          Your share: <span className="font-medium text-foreground font-numbers">{tenancy.resolvedSplitPercentage}%</span>
        </div>
        <div className="w-px h-4 bg-border hidden sm:block"></div>
        <div>
          Active since <span className="font-medium text-foreground">{joinedDate}</span>
        </div>
      </div>
    </div>
  );
}

function TenancyAlerts({ tenancy, pendingEditRequests }: { tenancy: TenancyOverviewData['tenancy'], pendingEditRequests: number }) {
  return (
    <>
      {tenancy.status === 'inactive' && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/50 text-muted-foreground">
          <Info className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm">
            You are no longer a tenant at this property. You can still view your historical bills.
          </p>
        </div>
      )}

      {pendingEditRequests > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/20 bg-warning/5 text-warning">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm">
            You have {pendingEditRequests} edit {pendingEditRequests === 1 ? 'request' : 'requests'} pending review.
          </p>
        </div>
      )}
    </>
  );
}

function TenancyCurrentMonth({ tenancy, currentPeriod }: { tenancy: TenancyOverviewData['tenancy'], currentPeriod: TenancyOverviewData['currentPeriod'] }) {
  if (tenancy.status !== 'active') return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {currentPeriod ? `${formatMonth(currentPeriod.periodMonth)} — Current Month` : 'Current Month'}
      </h2>

      {!currentPeriod ? (
        <div className="p-6 rounded-xl border border-border text-center">
          <p className="text-sm text-muted-foreground mb-4">No billing period started for this month yet. Your landlord will create one.</p>
        </div>
      ) : currentPeriod.bill ? (
        <div className="p-6 rounded-xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl font-bold font-numbers">{formatCurrency(currentPeriod.bill.totalDue)}</span>
              <Badge variant={currentPeriod.bill.status === 'paid' ? 'success' : 'warning'} className="uppercase">
                {currentPeriod.bill.status}
              </Badge>
            </div>
            {currentPeriod.bill.status === 'pending' && (
              <p className="text-sm text-muted-foreground">Please pay this bill as soon as possible.</p>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild>
              <a href={`/tenancies/${tenancy.id}/edit-requests/new?periodId=${currentPeriod.periodId}`}>Request Edit</a>
            </Button>
            <Button asChild>
              <a href={`/tenancies/${tenancy.id}/bills/${currentPeriod.bill.billId}`}>View Bill</a>
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-xl border border-border text-center">
          <p className="text-sm text-foreground mb-4">Readings not submitted yet?</p>
          {currentPeriod.canSubmit ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">Submit your readings to generate your bill.</p>
              <Button asChild>
                <a href={`/properties/${tenancy.propertyId}/periods/${currentPeriod.periodId}`}>Submit Readings</a>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">Readings are currently being processed or you've already submitted them.</p>
          )}
        </div>
      )}
    </div>
  );
}

function TenancyRecentBills({ tenancy, recentBills }: { tenancy: TenancyOverviewData['tenancy'], recentBills: TenancyOverviewData['recentBills'] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Bills</h2>
      
      {recentBills.length === 0 ? (
        <p className="text-sm text-muted-foreground">No past bills found.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {recentBills.map((bill) => (
              <a 
                key={bill.billId} 
                href={`/tenancies/${tenancy.id}/bills/${bill.billId}`}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium">{formatMonth(bill.periodMonth)}</div>
                    <div className="text-sm font-numbers text-muted-foreground">{formatCurrency(bill.totalDue)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={bill.status === 'paid' ? 'success' : 'warning'} className="uppercase">
                    {bill.status}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2">
        <Button variant="ghost" asChild className="w-full sm:w-auto">
          <a href={`/tenancies/${tenancy.id}/bills`}>View All Bills <ChevronRight className="w-4 h-4 ml-1" /></a>
        </Button>
      </div>
    </div>
  );
}

function TenancyDangerZone({ tenancy, pendingEditRequests, isLeaving, handleLeaveProperty, showLeaveConfirm, setShowLeaveConfirm, leaveWarningMessage, setLeaveWarningMessage }: { 
  tenancy: TenancyOverviewData['tenancy'], 
  pendingEditRequests: number, 
  isLeaving: boolean, 
  handleLeaveProperty: () => void,
  showLeaveConfirm: boolean,
  setShowLeaveConfirm: (v: boolean) => void,
  leaveWarningMessage: string | null,
  setLeaveWarningMessage: (v: string | null) => void
}) {
  if (tenancy.status !== 'active') return null;

  return (
    <div className="space-y-4 pt-8">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-destructive">Danger Zone</h2>
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground m-0 mb-1">Leave this property</h3>
          <p className="text-sm text-muted-foreground m-0 max-w-[400px]">
            You will no longer be an active tenant here. Your past bills will remain available in your archives. This action cannot be undone.
          </p>
        </div>
        <Button 
          variant="destructive" 
          onClick={() => {
            const msg = pendingEditRequests > 0 
              ? `Are you sure you want to leave ${tenancy.propertyName}? You have ${pendingEditRequests} pending edit request(s) which will be orphaned. This cannot be undone.`
              : `Are you sure you want to leave ${tenancy.propertyName}? This cannot be undone.`;
            setLeaveWarningMessage(msg);
            setShowLeaveConfirm(true);
          }}
          disabled={isLeaving}
        >
          {isLeaving ? 'Leaving...' : 'Leave Property'}
        </Button>
      </div>
      <ConfirmDialog
        isOpen={showLeaveConfirm}
        onOpenChange={setShowLeaveConfirm}
        title="Leave Property"
        description={leaveWarningMessage || "Are you sure you want to leave this property?"}
        confirmLabel="Leave Property"
        variant="destructive"
        onConfirm={handleLeaveProperty}
      />
    </div>
  );
}

function TenancyQuickActions({ tenancy }: { tenancy: TenancyOverviewData['tenancy'] }) {
  const [includeReadings, setIncludeReadings] = useState(false);

  const handleDownloadCsv = () => {
    window.open(`/api/tenancies/${tenancy.id}/export/csv?includeReadings=${includeReadings}`, '_blank');
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-surface">
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Quick Actions</span>
        <span>Download your billing history or request corrections.</span>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="include-readings"
            checked={includeReadings}
            onChange={(e) => setIncludeReadings(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary/20"
          />
          <label htmlFor="include-readings" className="text-sm cursor-pointer select-none">
            Include reading data
          </label>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="outline" onClick={handleDownloadCsv} className="gap-2 flex-1 sm:flex-none">
            <Download className="w-4 h-4" /> Download CSV
          </Button>
          <Button variant="outline" asChild className="gap-2 flex-1 sm:flex-none">
            <a href={`/tenancies/${tenancy.id}/edit-requests/new`}>
              <Edit3 className="w-4 h-4" /> Request Correction
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------
// Main Component
// ---------------------------

export function TenancyOverview({ tenancyId }: TenancyOverviewProps) {
  const [data, setData] = useState<TenancyOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveWarningMessage, setLeaveWarningMessage] = useState<string | null>(null);
  const { isLeaving, handleLeaveProperty } = useLeaveProperty(tenancyId, data?.tenancy?.propertyName || 'this property');

  const [chartData, setChartData] = useState<{
    monthlyBills?: Array<{ month: string; amount: number; status: string }>;
    monthlyConsumption?: Array<{ month: string; units: number }>;
    solarSavings?: Array<{ month: string; actual: number; withoutSolar: number }> | null;
  }>({});
  const [isLoadingChart, setIsLoadingChart] = useState(true);

  useEffect(() => {
    fetchTenancyData();
    fetchChartData();
  }, [tenancyId]);

  const fetchChartData = async () => {
    setIsLoadingChart(true);
    try {
      const res = await fetch(`/api/tenancies/${tenancyId}/chart-data`);
      const json = (await res.json()) as { success: boolean; data: Parameters<typeof setChartData>[0] };
      if (json.success) {
        setChartData(json.data);
      }
    } catch (err) {
      console.error('Failed to load chart data:', err);
    } finally {
      setIsLoadingChart(false);
    }
  };

  const fetchTenancyData = async () => {
    try {
      const res = await fetch(`/api/tenancies/${tenancyId}`);
      const json = await res.json() as TenancyOverviewData & { error?: { message: string } };
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to fetch tenancy data');
      }
      setData(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-surface rounded-xl border border-border"></div>
        <div className="h-40 bg-surface rounded-xl border border-border"></div>
        <div className="h-32 bg-surface rounded-xl border border-border"></div>
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

  const { tenancy, currentPeriod, recentBills, pendingEditRequests } = data;

  return (
    <div className="space-y-8">
      <TenancyHeader tenancy={tenancy} />
      
      <TenancyQuickActions tenancy={tenancy} />
      
      <TenancyAlerts tenancy={tenancy} pendingEditRequests={pendingEditRequests} />

      <TenancyCurrentMonth tenancy={tenancy} currentPeriod={currentPeriod} />

      <TenancyRecentBills tenancy={tenancy} recentBills={recentBills} />

      <TenancyGraphsSection chartData={chartData} isLoading={isLoadingChart} />

      <TenancyDangerZone 
        tenancy={tenancy} 
        pendingEditRequests={pendingEditRequests} 
        isLeaving={isLeaving} 
        handleLeaveProperty={handleLeaveProperty}
        showLeaveConfirm={showLeaveConfirm}
        setShowLeaveConfirm={setShowLeaveConfirm}
        leaveWarningMessage={leaveWarningMessage}
        setLeaveWarningMessage={setLeaveWarningMessage}
      />
    </div>
  );
}

function useLeaveProperty(tenancyId: string, propertyName: string) {
  const [isLeaving, setIsLeaving] = useState(false);
  const { toast } = useToast();

  const handleLeaveProperty = async () => {
    setIsLeaving(true);
    try {
      const res = await fetch(`/api/tenancies/${tenancyId}/leave`, {
        method: 'PATCH',
      });
      const data = await res.json() as { error?: { message: string }, data?: { warning?: string } };
      
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to leave property');
      }

      if (data.data?.warning) {
        toast({ title: 'You have left the property', description: data.data.warning });
      } else {
        toast({ title: 'Left property', description: `You have successfully left ${propertyName}.` });
      }
      
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsLeaving(false);
    }
  };

  return { isLeaving, handleLeaveProperty };
}
