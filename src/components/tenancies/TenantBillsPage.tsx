import { useState, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { formatCurrency, formatUnits, formatMonth } from '../../lib/format';
import { ChevronRight, FileText, Download, Edit3 } from 'lucide-react';

interface TenantBillsPageProps {
  tenancyId: string;
}

interface TenantBillItem {
  id: string;
  periodMonth: string;
  tenantConsumption: number | null;
  totalConsumption: number;
  splitPercentage: number;
  totalDue: number;
  status: 'pending' | 'paid';
  markedPaidAt?: string | null;
  billingPeriodId: string;
  hasPendingRequest: number;
}

interface TenantBillsData {
  propertyName: string;
  yearlyStats: {
    totalPaid: number;
    totalPending: number;
    avgMonthlyBill: number;
  };
  bills: TenantBillItem[];
}

export function TenantBillsPage({ tenancyId }: TenantBillsPageProps) {
  const [data, setData] = useState<TenantBillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [status, setStatus] = useState<'all' | 'pending' | 'paid'>('all');

  useEffect(() => {
    fetchBills();
  }, [tenancyId, year, status]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tenancies/${tenancyId}/bills?year=${year}&status=${status}`);
      const json = await res.json() as TenantBillsData & { error?: { message: string } };
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to fetch bills');
      }
      setData(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    window.open(`/api/tenancies/${tenancyId}/export/csv?year=${year}`, '_blank');
  };

  // Generate an array of years from 2024 to current year + 1 for the dropdown
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2024 + 2 }, (_, i) => (2024 + i).toString()).reverse();

  if (error) {
    return (
      <div className="p-8 text-center text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading mb-6">
          {data?.propertyName ? `${data.propertyName} — Bills` : 'Bills'}
        </h1>
        
        {/* Stats Bar */}
        {data && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground bg-surface border border-border rounded-lg px-4 py-3">
            <div>
              <span className="font-medium text-foreground font-numbers">{formatCurrency(data.yearlyStats.totalPaid)}</span> paid this year
            </div>
            <div className="w-px h-4 bg-border hidden sm:block"></div>
            <div>
              <span className="font-medium text-foreground font-numbers">{formatCurrency(data.yearlyStats.totalPending)}</span> outstanding
            </div>
            <div className="w-px h-4 bg-border hidden sm:block"></div>
            <div>
              <span className="font-medium text-foreground font-numbers">{formatCurrency(data.yearlyStats.avgMonthlyBill)}</span> avg/month
            </div>
          </div>
        )}
      </div>

      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <select 
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          
          <div className="flex bg-surface border border-border rounded-md p-1">
            <button
              onClick={() => setStatus('all')}
              className={`px-3 py-1 text-sm rounded-sm transition-colors ${status === 'all' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              All
            </button>
            <button
              onClick={() => setStatus('pending')}
              className={`px-3 py-1 text-sm rounded-sm transition-colors ${status === 'pending' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Unpaid
            </button>
            <button
              onClick={() => setStatus('paid')}
              className={`px-3 py-1 text-sm rounded-sm transition-colors ${status === 'paid' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Paid
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" onClick={handleDownloadCsv} className="gap-2">
            <Download className="w-4 h-4" /> Download CSV
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <a href={`/tenancies/${tenancyId}/edit-requests/new`}>
              <Edit3 className="w-4 h-4" /> Request Correction
            </a>
          </Button>
        </div>
      </div>

      {/* Bill List */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-16 bg-surface rounded-xl border border-border"></div>
          <div className="h-16 bg-surface rounded-xl border border-border"></div>
          <div className="h-16 bg-surface rounded-xl border border-border"></div>
        </div>
      ) : (!data || data.bills.length === 0) ? (
        <div className="p-12 rounded-xl border border-border text-center bg-surface/50">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-1">No bills found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {status !== 'all' 
              ? `You don't have any ${status} bills for ${year}.` 
              : `Your landlord hasn't generated any bills for ${year} yet. When they do, they'll appear here.`}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-surface">
          <div className="divide-y divide-border">
            {data.bills.map((bill) => (
              <a 
                key={bill.id} 
                href={`/tenancies/${tenancyId}/bills/${bill.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-muted/50 transition-colors group gap-4"
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-semibold text-base mb-0.5">{formatMonth(bill.periodMonth).toUpperCase()}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatUnits(bill.tenantConsumption ?? (bill.totalConsumption * bill.splitPercentage / 100))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/2">
                  <div className="text-right">
                    <div className="font-bold text-lg font-numbers">{formatCurrency(bill.totalDue)}</div>
                    {bill.markedPaidAt && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Paid on {new Date(bill.markedPaidAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {bill.hasPendingRequest > 0 ? (
                      <Badge variant="info">Correction Pending</Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.location.href = `/tenancies/${tenancyId}/edit-requests/new?periodId=${bill.billingPeriodId}`;
                        }}
                        className="h-8 text-xs gap-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-all hover:bg-muted hidden sm:inline-flex"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Request Edit
                      </Button>
                    )}
                    <Badge variant={bill.status === 'paid' ? 'success' : 'warning'} className="uppercase">
                      {bill.status === 'pending' ? 'Unpaid' : 'Paid'}
                    </Badge>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
