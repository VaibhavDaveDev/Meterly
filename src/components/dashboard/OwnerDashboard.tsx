import { formatCurrency } from '../../lib/format';
import type { OwnerDashboardStats } from './types';
import { KpiCard, ChartCard, SectionHeading, CHART_COLORS, DashboardCard, TOOLTIP_STYLE, MomComparisonTable, MomComparisonRow } from './SharedUI';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend, ComposedChart } from 'recharts';
import { DataTable } from '../ui/data-table';
import { useToast } from '../../hooks/use-toast';
import { apiClient } from '../../lib/api-client';

export function OwnerDashboard({ stats, onUpdate }: { stats: OwnerDashboardStats, onUpdate: (s: OwnerDashboardStats) => void }) {
  const { toast } = useToast();

  const handleMarkPaid = async (billId: string) => {
    const { error: err } = await apiClient.patch(`/bills/${billId}/mark-paid`, {});
    if (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      return;
    }
    toast({ title: 'Success', description: 'Bill marked as paid.' });
    onUpdate({
      ...stats,
      outstandingBills: stats.outstandingBills.filter(b => b.id !== billId),
    });
  };

  // Convert consumption list to recharts friendly format
  let consumptionData: Record<string, unknown>[] = [];
  const propertyNames: string[] = [];
  if (stats.propertyConsumption) {
    const map = new Map<string, Record<string, unknown>>();
    stats.propertyConsumption.forEach(c => {
      if (!propertyNames.includes(c.property)) propertyNames.push(c.property);
      let entry = map.get(c.month);
      if (!entry) { entry = { month: c.month }; map.set(c.month, entry); }
      entry[c.property] = c.consumption;
    });
    consumptionData = Array.from(map.values()).sort((a, b) =>
      ((a.month as string) || '').localeCompare((b.month as string) || '')
    );
  }


  return (
    <section className="space-y-6">
      {/* NEXT STEP CARD */}
      {stats.totalProperties > 0 && stats.activeTenants === 0 && stats.totalInvitedTenants === 0 && (
        <div className="bg-surface border border-accent bg-accent/5 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-heading font-semibold text-lg text-foreground mb-1">Invite your first tenant</h3>
            <p className="text-muted-foreground text-[0.9375rem] m-0">Send an invite link to your tenant to start tracking their bills.</p>
          </div>
          <a href="/properties" className="btn btn-primary whitespace-nowrap text-sm font-semibold">Go to Properties</a>
        </div>
      )}

      {stats.totalProperties > 0 && (stats.activeTenants > 0 || stats.totalInvitedTenants > 0) && stats.totalPeriods === 0 && (
        <div className="bg-surface border border-accent bg-accent/5 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-heading font-semibold text-lg text-foreground mb-1">Start a billing period</h3>
            <p className="text-muted-foreground text-[0.9375rem] m-0">When the month ends, add meter readings to generate your first bill.</p>
          </div>
          <a href="/properties" className="btn btn-primary whitespace-nowrap text-sm font-semibold">Go to Properties</a>
        </div>
      )}

      {/* LEVEL 1 — KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Properties"
          value={stats.totalProperties}
          tooltip="Number of properties you manage"
        />
        <KpiCard
          label="Active Tenants"
          value={stats.activeTenants}
          tooltip="Currently active tenancies"
        />
        <KpiCard
          label="Amount Due"
          value={formatCurrency(stats.outstandingAmount)}
          variant={stats.outstandingAmount > 0 ? 'warning' : 'default'}
          tooltip="Total unpaid across all tenants"
          delta={
            stats.momComparison && stats.momComparison.lastMonth.billed > 0
              ? { value: ((stats.momComparison.thisMonth.billed - stats.momComparison.lastMonth.billed) / stats.momComparison.lastMonth.billed) * 100 }
              : undefined
          }
        />
        <KpiCard
          label="Solar Earnings"
          value={formatCurrency(stats.totalExportEarnings)}
          variant="success"
          tooltip="All-time solar export earnings"
          delta={
            stats.momComparison && stats.momComparison.lastMonth.solarEarnings > 0
              ? { value: ((stats.momComparison.thisMonth.solarEarnings - stats.momComparison.lastMonth.solarEarnings) / stats.momComparison.lastMonth.solarEarnings) * 100 }
              : undefined
          }
        />
      </div>

      {/* LEVEL 2 — Charts */}
      {stats.momComparison && (() => {
        const momRows: MomComparisonRow[] = [
          { label: 'Total Units Consumed', lastMonthValue: stats.momComparison.lastMonth.units, thisMonthValue: stats.momComparison.thisMonth.units, format: 'units', invertColors: true },
          { label: 'Total Billed', lastMonthValue: stats.momComparison.lastMonth.billed, thisMonthValue: stats.momComparison.thisMonth.billed, format: 'currency', invertColors: true },
          { label: 'Total Collected', lastMonthValue: stats.momComparison.lastMonth.collected, thisMonthValue: stats.momComparison.thisMonth.collected, format: 'currency', invertColors: false },
          ...(stats.momComparison.lastMonth.solarEarnings > 0 || stats.momComparison.thisMonth.solarEarnings > 0 ? [
            { label: 'Solar Earnings', lastMonthValue: stats.momComparison.lastMonth.solarEarnings, thisMonthValue: stats.momComparison.thisMonth.solarEarnings, format: 'currency' as const, invertColors: false }
          ] : [])
        ];
        return <MomComparisonTable rows={momRows} />;
      })()}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {stats.solarGenVsIncome.length > 0 ? (
          <>
            <ChartCard id="owner-cost-trend" title="Cost Trend (Bills vs Export)" data={stats.billsVsPaid.map(b => ({
              month: b.month,
              billed: b.billed,
              exportEarnings: stats.monthlyExportEarnings.find(e => e.month === b.month)?.earnings || 0
            }))}>
              {(slicedData) => (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={slicedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickFormatter={(val) => `₹${val}`} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: unknown) => formatCurrency(Number(val))} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="billed" name="Billed" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="exportEarnings" name="Export Earnings" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard id="owner-solar-gen-income" title="Solar Gen vs Income" data={stats.solarGenVsIncome}>
              {(slicedData) => (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <ComposedChart data={slicedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickFormatter={(val) => `₹${val}`} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: unknown, name: unknown) => name === 'Earnings' ? formatCurrency(Number(val)) : `${val} kWh`} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Bar yAxisId="left" dataKey="solarKwh" name="Generated (kWh)" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Line yAxisId="right" type="monotone" dataKey="exportEarnings" name="Earnings" stroke="#10b981" strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard id="owner-import-export" title="Import vs Export (kWh)" data={stats.importVsExport}>
              {(slicedData) => (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart layout="vertical" data={slicedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                    <YAxis type="category" dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: unknown) => `${val} kWh`} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="exported" name="Exported" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="imported" name="Imported" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard id="owner-cumulative-profit" title="Cumulative Solar Profit" data={stats.cumulativeProfit}>
              {(slicedData) => (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={slicedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickFormatter={(val) => `₹${val}`} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: unknown) => formatCurrency(Number(val))} />
                    <Area type="monotone" dataKey="cumulative" name="Total Profit" stroke="#10b981" strokeWidth={2} fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </>
        ) : (
          <>
            <ChartCard id="owner-bills-vs-paid" title="Billed vs Paid" data={stats.billsVsPaid}>
              {(slicedData) => (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={slicedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickFormatter={(val) => `₹${val}`} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: unknown) => formatCurrency(Number(val))} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="billed" name="Billed" fill="var(--border)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="paid" name="Paid" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {stats.totalProperties > 1 && propertyNames.length > 0 && (
              <ChartCard id="owner-property-consumption" title="Property Consumption (kWh)" data={consumptionData}>
                {(slicedData) => (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <LineChart data={slicedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      {propertyNames.map((name, i) => (
                        <Line key={name} type="monotone" dataKey={name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            )}
          </>
        )}
      </div>

      {stats.properties && stats.properties.length > 0 && (
        <div>
          <SectionHeading>My Properties</SectionHeading>
          <DashboardCard className="p-6">
            <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 m-0 p-0 list-none">
              {stats.properties.map(p => (
                <li key={p.id} className="m-0 p-0">
                  <a 
                    href={`/properties/${p.id}`}
                    className="flex flex-col p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 hover:border-accent/40 transition duration-200 no-underline group"
                  >
                    <span className="font-heading font-semibold text-foreground text-sm group-hover:text-accent transition duration-200">
                      {p.name} &rarr;
                    </span>
                    {p.address && (
                      <span className="text-xs text-muted-foreground mt-1 truncate">
                        {p.address}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </DashboardCard>
        </div>
      )}

      {/* LEVEL 3 — Actionable Tables */}
      {stats.outstandingBills.length > 0 && (
        <div>
          <SectionHeading>Outstanding Bills</SectionHeading>
          <DashboardCard className="overflow-hidden">
            <DataTable
              columns={[
                { accessor: 'property', header: 'Property' },
                { accessor: 'tenant', header: 'Tenant' },
                { accessor: 'month', header: 'Month' },
                { accessor: (row: OwnerDashboardStats['outstandingBills'][number]) => <span className="font-numbers">{formatCurrency(row.amount)}</span>, header: 'Amount' },
                { 
                  accessor: (row: OwnerDashboardStats['outstandingBills'][number]) => (
                    <button
                      onClick={() => handleMarkPaid(row.id)}
                      className="text-xs font-semibold px-3 py-1 rounded border border-accent text-accent hover:bg-accent hover:text-white transition-colors duration-200"
                    >
                      Mark Paid
                    </button>
                  ),
                  header: '',
                  align: 'right'
                }
              ]}
              data={stats.outstandingBills}
              emptyState="No outstanding bills."
            />
          </DashboardCard>
        </div>
      )}
    </section>
  );
}
