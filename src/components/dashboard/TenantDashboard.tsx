import { useState } from "react";
import { useToast } from "../../hooks/use-toast";
import { formatCurrency } from "../../lib/format";
import type { TenantDashboardStats } from "./types";
import {
  KpiCard,
  ChartCard,
  SectionHeading,
  DashboardCard,
  TOOLTIP_STYLE,
  MomComparisonTable,
  MomComparisonRow,
} from "./SharedUI";
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  ComposedChart,
} from "recharts";
import { Badge } from "../ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ArchivePropertyModal } from "../tenant/ArchivePropertyModal";

export function TenantDashboard({ stats }: { stats: TenantDashboardStats }) {
  const [showPastTenancies, setShowPastTenancies] = useState(false);
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTenancy, setSelectedTenancy] = useState<{
    tenancyId: string;
    propertyName: string;
    isPropertyDeleted: boolean;
    allPaid: boolean;
  } | null>(null);

  const [pastTenancies, setPastTenancies] = useState(stats.pastTenancies || []);
  const [archivedTenancies, setArchivedTenancies] = useState(stats.archivedTenancies || []);

  const handleAction = async (
    tenancyId: string,
    action: "archive" | "unarchive"
  ) => {
    // Find tenancy for optimistic update and toast message
    const tenancy = pastTenancies.find(t => t.tenancyId === tenancyId) || archivedTenancies.find(t => t.tenancyId === tenancyId);
    
    // Optimistic UI Update
    if (action === "archive") {
      const t = pastTenancies.find(t => t.tenancyId === tenancyId);
      if (t) {
        setPastTenancies(prev => prev.filter(p => p.tenancyId !== tenancyId));
        setArchivedTenancies(prev => [...prev, t]);
      }
    } else {
      const t = archivedTenancies.find(t => t.tenancyId === tenancyId);
      if (t) {
        setArchivedTenancies(prev => prev.filter(p => p.tenancyId !== tenancyId));
        setPastTenancies(prev => [...prev, t]);
      }
    }

    try {
      const res = await fetch(`/api/tenancies/${tenancyId}/${action}`, {
        method: "PATCH",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error?.message || "Failed to update");
      
      let description = "Action successful.";
      if (action === "archive") {
        description = tenancy?.isPropertyDeleted 
          ? "Records deleted and property hidden." 
          : "Property hidden. Restore it anytime from 'Hidden Properties'.";
      } else {
        description = "Property restored to your history.";
      }
      
      toast({
        title: "Success",
        description,
      });
    } catch (e) {
      const err = e as Error;
      // Revert optimistic update
      if (action === "archive") {
        const t = archivedTenancies.find(t => t.tenancyId === tenancyId) || tenancy;
        if (t) {
          setArchivedTenancies(prev => prev.filter(p => p.tenancyId !== tenancyId));
          setPastTenancies(prev => [...prev, t]);
        }
      } else {
        const t = pastTenancies.find(t => t.tenancyId === tenancyId) || tenancy;
        if (t) {
          setPastTenancies(prev => prev.filter(p => p.tenancyId !== tenancyId));
          setArchivedTenancies(prev => [...prev, t]);
        }
      }

      if (err.message === "Not Found" || err.message.includes("permanently removed")) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "This record has been permanently removed and cannot be restored.",
        });
        // Remove from UI completely
        setArchivedTenancies(prev => prev.filter(p => p.tenancyId !== tenancyId));
        setPastTenancies(prev => prev.filter(p => p.tenancyId !== tenancyId));
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: err.message || `Failed to ${action} tenancy.`,
        });
      }
    }
  };

  const momRows: MomComparisonRow[] | null = stats.momComparison
    ? [
        {
          label: "Units Consumed",
          lastMonthValue: stats.momComparison.lastMonth.units,
          thisMonthValue: stats.momComparison.thisMonth.units,
          format: "units",
          invertColors: true,
        },
        {
          label: "Bill Amount",
          lastMonthValue: stats.momComparison.lastMonth.amount,
          thisMonthValue: stats.momComparison.thisMonth.amount,
          format: "currency",
          invertColors: true,
        },
        ...(stats.momComparison.lastMonth.solarSavings > 0 ||
        stats.momComparison.thisMonth.solarSavings > 0
          ? [
              {
                label: "Solar Savings",
                lastMonthValue: stats.momComparison.lastMonth.solarSavings,
                thisMonthValue: stats.momComparison.thisMonth.solarSavings,
                format: "currency" as const,
                invertColors: false,
              },
            ]
          : []),
      ]
    : null;

  return (
    <section className="space-y-6">
      {/* LEVEL 1 — KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="This Month"
          value={
            stats.currentBill
              ? formatCurrency(stats.currentBill.totalDue || 0)
              : "—"
          }
          variant={
            stats.currentBill?.status === "paid"
              ? "success"
              : stats.currentBill?.status === "pending"
                ? "warning"
                : "default"
          }
          subtext={
            stats.currentBill?.status
              ? stats.currentBill.status.toUpperCase()
              : "No current bill"
          }
          delta={{ value: stats.momChange }}
        />
        <KpiCard
          label="Last Month"
          value={
            stats.lastBill ? formatCurrency(stats.lastBill.totalDue || 0) : "—"
          }
        />
        <KpiCard
          label="YTD Paid"
          value={formatCurrency(stats.ytdPaid)}
          variant="success"
        />
      </div>

      {/* Active Tenancies */}
      {stats.activeTenancies && stats.activeTenancies.length > 0 && (
        <div>
          <SectionHeading>Active Tenancies</SectionHeading>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {stats.activeTenancies.map((t) => (
              <DashboardCard
                key={t.tenancyId}
                className="p-5 flex flex-col justify-between min-h-[160px]"
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-foreground m-0 font-heading">
                      {t.propertyName}
                    </h3>
                    {t.billStatus && (
                      <Badge
                        variant={
                          t.billStatus === "paid" ? "success" : "warning"
                        }
                      >
                        {t.billStatus.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  {t.propertyAddress && (
                    <p className="text-sm text-muted-foreground m-0 mb-4">
                      {t.propertyAddress}
                    </p>
                  )}

                  {t.currentBillAmount !== null ? (
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        Current bill:{" "}
                      </span>
                      <span className="font-numbers font-medium text-foreground">
                        {formatCurrency(t.currentBillAmount)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic mb-2">
                      No bill for current period yet.
                    </p>
                  )}

                  {t.currentRates && (
                    <div className="text-xs space-y-1 mt-3 p-3 rounded-lg bg-muted/40 border border-border">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Grid Rate</span>
                        <span className="font-numbers font-medium">
                          ₹{t.currentRates.consumptionRate} / kWh
                        </span>
                      </div>
                      {t.currentRates.exportRate !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">
                            Solar Export Rate
                          </span>
                          <span className="font-numbers font-medium">
                            ₹{t.currentRates.exportRate} / kWh
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <a
                  href={`/tenancies/${t.tenancyId}`}
                  className="mt-4 text-sm font-semibold text-accent hover:text-accent/80 no-underline self-start"
                >
                  View Tenancy →
                </a>
              </DashboardCard>
            ))}
          </div>
        </div>
      )}

      {(!stats.activeTenancies || stats.activeTenancies.length === 0) && (
        <DashboardCard className="p-6 text-center">
          <p className="font-semibold text-foreground mb-1">
            No active tenancies
          </p>
          <p className="text-sm text-muted-foreground">
            You will appear here once a property owner adds you to their
            property.
          </p>
        </DashboardCard>
      )}

      {momRows && <MomComparisonTable rows={momRows} />}

      {/* LEVEL 2 — Charts */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <ChartCard
          id="tenant-consumption-trend"
          title="Monthly Consumption Trend"
          data={stats.unitsConsumed}
        >
          {(slicedData) => (
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={0}
            >
              <AreaChart
                data={slicedData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: unknown) => `${val} kWh`}
                />
                <Area
                  type="monotone"
                  dataKey="units"
                  name="Units Consumed"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fillOpacity={0.08}
                  fill="var(--primary)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          id="tenant-bill-trend"
          title="Monthly Bill Trend"
          data={stats.monthlyTrend}
        >
          {(slicedData) => (
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={0}
            >
              <BarChart
                data={slicedData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: unknown) => formatCurrency(Number(val))}
                />
                <Bar
                  dataKey="amount"
                  name="Bill Amount"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          id="tenant-consumption-vs-bill"
          title="Consumption vs Bill"
          data={stats.consumptionVsBill}
        >
          {(slicedData) => (
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={0}
            >
              <ComposedChart
                data={slicedData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  dy={10}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => `${v}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: unknown, name: unknown) =>
                    name === "Bill Amount"
                      ? formatCurrency(Number(val))
                      : `${val} kWh`
                  }
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{
                    fontSize: "12px",
                    color: "var(--foreground)",
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="units"
                  name="Units Consumed"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="amount"
                  name="Bill Amount"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {stats.solarSavings && stats.solarSavings.length > 0 && (
          <ChartCard
            id="tenant-solar-savings"
            title="Solar Savings Impact"
            data={stats.solarSavings}
          >
            {(slicedData) => (
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
              >
                <AreaChart
                  data={slicedData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(val: unknown) => formatCurrency(Number(val))}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{
                      fontSize: "12px",
                      color: "var(--foreground)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="withoutSolar"
                    name="Without Solar"
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    fill="none"
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    name="Actual Bill"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={0}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}
      </div>

      {/* Past Tenancies Accordion */}
      {(pastTenancies.length > 0 || archivedTenancies.length > 0) && (
        <PastTenanciesAccordion
          pastTenancies={pastTenancies}
          archivedTenancies={archivedTenancies}
          showPastTenancies={showPastTenancies}
          setShowPastTenancies={setShowPastTenancies}
          onAction={handleAction}
          onRequestModal={(tenancy) => {
            setSelectedTenancy(tenancy);
            setModalOpen(true);
          }}
        />
      )}

      {selectedTenancy && (
        <ArchivePropertyModal
          isOpen={modalOpen}
          propertyName={selectedTenancy.propertyName}
          isPropertyDeleted={selectedTenancy.isPropertyDeleted}
          allPaid={selectedTenancy.allPaid}
          onConfirm={() => {
            handleAction(selectedTenancy.tenancyId, "archive");
            setModalOpen(false);
          }}
          onCancel={() => setModalOpen(false)}
        />
      )}
    </section>
  );
}

function PastTenanciesAccordion({
  pastTenancies,
  archivedTenancies,
  showPastTenancies,
  setShowPastTenancies,
  onAction,
  onRequestModal,
}: {
  pastTenancies: NonNullable<TenantDashboardStats["pastTenancies"]>;
  archivedTenancies: NonNullable<TenantDashboardStats["archivedTenancies"]>;
  showPastTenancies: boolean;
  setShowPastTenancies: (val: boolean) => void;
  onAction: (tenancyId: string, action: "archive" | "unarchive") => void;
  onRequestModal: (tenancy: { tenancyId: string; propertyName: string; isPropertyDeleted: boolean; allPaid: boolean }) => void;
}) {
  const [inlineConfirmId, setInlineConfirmId] = useState<string | null>(null);

  return (
    <DashboardCard className="overflow-hidden p-0">
      <button
        onClick={() => setShowPastTenancies(!showPastTenancies)}
        className="w-full flex items-center justify-between p-5 hover:bg-surface-raised transition-colors"
      >
        <span className="font-semibold text-sm uppercase tracking-wider text-muted-foreground font-heading">
          Past Tenancies (
          {(pastTenancies?.length || 0) + (archivedTenancies?.length || 0)})
        </span>
        {showPastTenancies ? (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {showPastTenancies && (
        <div className="p-5 pt-0 divide-y divide-border border-t border-border">
          {pastTenancies?.map((pt) => (
            <div
              key={pt.tenancyId}
              className="py-4 first:pt-4 last:pb-0 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-foreground m-0">
                    {pt.propertyName}
                  </p>
                  {pt.isPropertyDeleted && (
                    <Badge
                      variant="muted"
                      className="text-[10px] font-normal leading-none px-1.5 py-0.5 uppercase tracking-wide"
                    >
                      Property closed
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground m-0">
                  {pt.stayRange} · {pt.totalBills} bills
                </p>
              </div>
              {inlineConfirmId === pt.tenancyId ? (
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                  <span className="text-xs text-muted-foreground mr-1 hidden sm:inline-block">Hide this property from your history?</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInlineConfirmId(null)}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => onAction(pt.tenancyId, "archive")}
                      className="text-xs font-medium bg-foreground text-background rounded-md px-3 py-1 hover:bg-foreground/90 transition-colors"
                    >
                      Yes, hide it
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (!pt.isPropertyDeleted && pt.allPaid) {
                        setInlineConfirmId(pt.tenancyId);
                      } else {
                        onRequestModal({
                          tenancyId: pt.tenancyId,
                          propertyName: pt.propertyName,
                          isPropertyDeleted: pt.isPropertyDeleted ?? false,
                          allPaid: pt.allPaid,
                        });
                      }
                    }}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Hide
                  </button>
                  <a
                    href={`/tenancies/${pt.tenancyId}/bills`}
                    className="text-xs font-medium text-accent hover:text-accent/80"
                  >
                    View Bills
                  </a>
                </div>
              )}
            </div>
          ))}

          {archivedTenancies && archivedTenancies.length > 0 && (
            <div className="pt-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Hidden Properties
                </div>
                <Badge variant="muted" className="text-[10px] font-numbers leading-none px-1.5 py-0.5">
                  {archivedTenancies.length}
                </Badge>
              </div>
              <div className="divide-y divide-border opacity-70">
                {archivedTenancies.map((pt) => (
                  <div
                    key={pt.tenancyId}
                    className="py-3 first:pt-0 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground m-0">
                          {pt.propertyName}
                        </p>
                        {pt.isPropertyDeleted && (
                          <Badge
                            variant="muted"
                            className="text-[9px] font-normal leading-none px-1 py-0.5 uppercase tracking-wide"
                          >
                            Property closed
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground m-0">
                        {pt.stayRange}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onAction(pt.tenancyId, "unarchive")}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Restore
                      </button>
                      <a
                        href={`/tenancies/${pt.tenancyId}/bills`}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        View
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  );
}
