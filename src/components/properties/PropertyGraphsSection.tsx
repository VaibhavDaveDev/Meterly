import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { ChartCard, TOOLTIP_STYLE, CHART_COLORS } from '../dashboard/SharedUI';

interface PropertyGraphsSectionProps {
  chartData: {
    monthlyRevenue?: Array<{ month: string; revenue: number }>;
    monthlyConsumption?: Array<{ month: string; units: number }>;
    solarSavings?: Array<{ month: string; actual: number; withoutSolar: number }> | null;
    importExport?: Array<{ month: string; import: number; export: number }>;
    billVsCollected?: Array<{ month: string; billed: number; paid: number }>;
    tenantBreakdown?: Array<Record<string, number>> | null;
    solarDetail?: Array<{ month: string; generated: number; exported: number; exportEarnings: number }> | null;
    cumulativeExportEarnings?: Array<{ month: string; cumulative: number }> | null;
  };
  isLoading: boolean;
}

export function PropertyGraphsSection({ chartData, isLoading }: PropertyGraphsSectionProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5 flex flex-col justify-center min-h-[300px]">
          <div className="skeleton h-full w-full rounded" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 flex flex-col justify-center min-h-[300px]">
          <div className="skeleton h-full w-full rounded" />
        </div>
      </div>
    );
  }

  const {
    monthlyRevenue = [],
    monthlyConsumption = [],
    solarSavings,
    importExport = [],
    billVsCollected = [],
    tenantBreakdown = [],
    solarDetail,
    cumulativeExportEarnings
  } = chartData;

  const hasMultipleTenants = tenantBreakdown && tenantBreakdown.length > 0 && Object.keys(tenantBreakdown[0]).filter(k => k !== 'month').length > 1;
  const tenantNames = hasMultipleTenants ? Object.keys(tenantBreakdown![0]).filter(k => k !== 'month') : [];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ChartCard id="prop-revenue" title="Monthly Revenue (₹)" data={monthlyRevenue}>
        {(data) => (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--border)', opacity: 0.4 }} formatter={(val) => [`₹${val}`, 'Revenue']} />
              <Bar dataKey="revenue" name="Revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard id="prop-bill-vs-collected" title="Billed vs Collected (₹)" data={billVsCollected}>
        {(data) => (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--border)', opacity: 0.4 }} formatter={(val) => [`₹${val}`]} />
              <Legend wrapperStyle={{ color: 'var(--foreground)', fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="billed" name="Billed" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="paid" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {hasMultipleTenants && (
        <div className="col-span-1 md:col-span-2">
          <ChartCard id="prop-tenant-breakdown" title="Revenue per Tenant (₹)" data={tenantBreakdown!}>
            {(data) => (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--border)', opacity: 0.4 }} formatter={(val) => [`₹${val}`]} />
                  <Legend wrapperStyle={{ color: 'var(--foreground)', fontSize: '12px', paddingTop: '10px' }} />
                  {tenantNames.map((name, i) => (
                    <Bar key={name} dataKey={name} name={name} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === tenantNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      <ChartCard id="prop-consumption" title="Grid Consumption (Units)" data={monthlyConsumption}>
        {(data) => (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval={0} height={40} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="units" name="Consumption" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls={true} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {importExport && importExport.length > 0 && (
        <ChartCard id="prop-import-export" title="Import vs Export (Units)" data={importExport}>
          {(data) => (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--border)', opacity: 0.4 }} />
                <Legend wrapperStyle={{ color: 'var(--foreground)', fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="import" name="Grid Import" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                <Bar dataKey="export" name="Grid Export" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}

      {solarDetail && solarDetail.length > 0 && (
        <div className="col-span-1 md:col-span-2">
          <ChartCard id="prop-solar-detail" title="Solar Generation vs Export Earnings" data={solarDetail}>
            {(data) => (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--border)', opacity: 0.4 }} />
                  <Legend wrapperStyle={{ color: 'var(--foreground)', fontSize: '12px', paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="generated" name="Generated (Units)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="exportEarnings" name="Export Earnings (₹)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} connectNulls={true} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      {cumulativeExportEarnings && cumulativeExportEarnings.length > 0 && (
        <ChartCard id="prop-cumulative-export" title="Cumulative Export Earnings (₹)" data={cumulativeExportEarnings}>
          {(data) => (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="cumulative" name="Total Earned" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}

      {solarSavings && solarSavings.length > 0 && (
        <ChartCard id="prop-solar-savings" title="Total Savings Impact (₹)" data={solarSavings}>
          {(data) => (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ color: 'var(--foreground)', fontSize: '12px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="withoutSolar" name="Without Solar" stroke="var(--muted-foreground)" fill="var(--muted-foreground)" fillOpacity={0.1} />
                <Area type="monotone" dataKey="actual" name="Actual Cost" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}
    </div>
  );
}
