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
  ComposedChart,
} from "recharts";
import { ChartCard, TOOLTIP_STYLE, CHART_COLORS } from "../dashboard/SharedUI";

interface PropertyGraphsSectionProps {
  chartData: {
    monthlyRevenue?: Array<{ month: string; revenue: number }>;
    monthlyConsumption?: Array<{ month: string; units: number }>;
    solarSavings?: Array<{
      month: string;
      actual: number;
      withoutSolar: number;
    }> | null;
    importExport?: Array<{ month: string; import: number; export: number }>;
    billVsCollected?: Array<{ month: string; billed: number; paid: number }>;
    tenantBreakdown?: Array<Record<string, number>> | null;
    solarDetail?: Array<{
      month: string;
      generated: number;
      exported: number;
      exportEarnings: number;
    }> | null;
    cumulativeExportEarnings?: Array<{
      month: string;
      cumulative: number;
    }> | null;
  };
  isLoading: boolean;
}

export function PropertyGraphsSection({
  chartData,
  isLoading,
}: PropertyGraphsSectionProps) {
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
    cumulativeExportEarnings,
  } = chartData;

  const hasMultipleTenants =
    tenantBreakdown &&
    tenantBreakdown.length > 0 &&
    Object.keys(tenantBreakdown[0]).filter((k) => k !== "month").length > 1;
  const tenantNames = hasMultipleTenants
    ? Object.keys(tenantBreakdown![0]).filter((k) => k !== "month")
    : [];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <RevenueChart data={monthlyRevenue} />
      <BilledVsCollectedChart data={billVsCollected} />
      {hasMultipleTenants && (
        <TenantBreakdownChart
          data={tenantBreakdown!}
          tenantNames={tenantNames}
        />
      )}
      <ConsumptionChart data={monthlyConsumption} />
      {importExport && importExport.length > 0 && (
        <ImportExportChart data={importExport} />
      )}
      {solarDetail && solarDetail.length > 0 && (
        <SolarDetailChart data={solarDetail} />
      )}
      {cumulativeExportEarnings && cumulativeExportEarnings.length > 0 && (
        <CumulativeExportChart data={cumulativeExportEarnings} />
      )}
      {solarSavings && solarSavings.length > 0 && (
        <SolarSavingsChart data={solarSavings} />
      )}
    </div>
  );
}

function RevenueChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ChartCard id="prop-revenue" title="Monthly Revenue (₹)" data={data}>
      {(chartData) => (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
        >
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₹${v}`}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: "var(--border)", opacity: 0.4 }}
              formatter={(val) => [`₹${val}`, "Revenue"]}
            />
            <Bar
              dataKey="revenue"
              name="Revenue"
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function BilledVsCollectedChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ChartCard
      id="prop-bill-vs-collected"
      title="Billed vs Collected (₹)"
      data={data}
    >
      {(chartData) => (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
        >
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₹${v}`}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: "var(--border)", opacity: 0.4 }}
              formatter={(val) => [`₹${val}`]}
            />
            <Legend
              wrapperStyle={{
                color: "var(--foreground)",
                fontSize: "12px",
                paddingTop: "10px",
              }}
            />
            <Bar
              dataKey="billed"
              name="Billed"
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="paid"
              name="Collected"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function TenantBreakdownChart({
  data,
  tenantNames,
}: {
  data: Record<string, unknown>[];
  tenantNames: string[];
}) {
  return (
    <div className="col-span-1 md:col-span-2">
      <ChartCard
        id="prop-tenant-breakdown"
        title="Revenue per Tenant (₹)"
        data={data}
      >
        {(chartData) => (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
          >
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${v}`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "var(--border)", opacity: 0.4 }}
                formatter={(val) => [`₹${val}`]}
              />
              <Legend
                wrapperStyle={{
                  color: "var(--foreground)",
                  fontSize: "12px",
                  paddingTop: "10px",
                }}
              />
              {tenantNames.map((name, i) => (
                <Bar
                  key={name}
                  dataKey={name}
                  name={name}
                  stackId="a"
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  radius={
                    i === tenantNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

function ConsumptionChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ChartCard
      id="prop-consumption"
      title="Grid Consumption (Units)"
      data={data}
    >
      {(chartData) => (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
        >
          <LineChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              interval={0}
              height={40}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line
              type="monotone"
              dataKey="units"
              name="Consumption"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls={true}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function ImportExportChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ChartCard
      id="prop-import-export"
      title="Import vs Export (Units)"
      data={data}
    >
      {(chartData) => (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
        >
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: "var(--border)", opacity: 0.4 }}
            />
            <Legend
              wrapperStyle={{
                color: "var(--foreground)",
                fontSize: "12px",
                paddingTop: "10px",
              }}
            />
            <Bar
              dataKey="import"
              name="Grid Import"
              stackId="a"
              fill="#ef4444"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="export"
              name="Grid Export"
              stackId="a"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function SolarDetailChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <div className="col-span-1 md:col-span-2">
      <ChartCard
        id="prop-solar-detail"
        title="Solar Generation vs Export Earnings"
        data={data}
      >
        {(chartData) => (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
          >
            <ComposedChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${v}`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "var(--border)", opacity: 0.4 }}
              />
              <Legend
                wrapperStyle={{
                  color: "var(--foreground)",
                  fontSize: "12px",
                  paddingTop: "10px",
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="generated"
                name="Generated (Units)"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="exportEarnings"
                name="Export Earnings (₹)"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls={true}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

function CumulativeExportChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ChartCard
      id="prop-cumulative-export"
      title="Cumulative Export Earnings (₹)"
      data={data}
    >
      {(chartData) => (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
        >
          <AreaChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₹${v}`}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area
              type="monotone"
              dataKey="cumulative"
              name="Total Earned"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function SolarSavingsChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ChartCard
      id="prop-solar-savings"
      title="Total Savings Impact (₹)"
      data={data}
    >
      {(chartData) => (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
        >
          <AreaChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₹${v}`}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend
              wrapperStyle={{
                color: "var(--foreground)",
                fontSize: "12px",
                paddingTop: "10px",
              }}
            />
            <Area
              type="monotone"
              dataKey="withoutSolar"
              name="Without Solar"
              stroke="var(--muted-foreground)"
              fill="var(--muted-foreground)"
              fillOpacity={0.1}
            />
            <Area
              type="monotone"
              dataKey="actual"
              name="Actual Cost"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
