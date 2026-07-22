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
import { ChartCard, TOOLTIP_STYLE } from '../dashboard/SharedUI';

interface TenancyGraphsSectionProps {
  chartData: {
    monthlyBills?: Array<{ month: string; amount: number; status: string }>;
    monthlyConsumption?: Array<{ month: string; units: number }>;
    solarSavings?: Array<{ month: string; actual: number; withoutSolar: number }> | null;
    costTrend?: Array<{ month: string; bill: number; exportRefund: number; net: number }> | null;
    cumulativeBills?: Array<{ month: string; cumulative: number }>;
  };
  isLoading: boolean;
}

export function TenancyGraphsSection({ chartData, isLoading }: TenancyGraphsSectionProps) {
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

  const { monthlyBills = [], monthlyConsumption = [], solarSavings, costTrend, cumulativeBills = [] } = chartData;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ChartCard id="ten-bills" title="Monthly Bills (₹)" data={monthlyBills}>
        {(data) => (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--border)', opacity: 0.4 }} formatter={(val) => [`₹${val}`, 'Bill Amount']} />
              <Bar dataKey="amount" name="Bill Amount" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard id="ten-consumption" title="Grid Consumption (Units)" data={monthlyConsumption}>
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

      {costTrend && costTrend.length > 0 && (
        <ChartCard id="ten-cost-trend" title="Cost Trend (Bill vs Net)" data={costTrend}>
          {(data) => (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--border)', opacity: 0.4 }} />
                <Legend wrapperStyle={{ color: 'var(--foreground)', fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="bill" name="Gross Bill (₹)" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="net" name="Net Cost after Export (₹)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} connectNulls={true} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}

      {cumulativeBills && cumulativeBills.length > 0 && (
        <ChartCard id="ten-cumulative" title="Cumulative Spend (₹)" data={cumulativeBills}>
          {(data) => (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="cumulative" name="Total Spent" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}

      {solarSavings && solarSavings.length > 0 && (
        <ChartCard id="ten-solar-savings" title="Total Savings Impact (₹)" data={solarSavings}>
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
