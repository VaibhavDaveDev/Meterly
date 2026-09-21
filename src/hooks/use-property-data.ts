import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tenancy } from "../types/db";
import { apiClient } from "../lib/api-client";
import { queryKeys } from "../lib/query-keys";
import type { ActiveBillingPeriod } from "../components/properties/types";

type PropertyBillsResponse = {
  bills: Array<{
    id: string;
    periodMonth: string;
    calculationMode: "solar" | "grid_only";
    periodStatus: string;
    tenants: Array<{
      billId: string;
      tenantName: string;
      splitPercentage: number;
      totalDue: number;
      status: "pending" | "paid";
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

export function usePropertyData(
  propertyId: string,
  activeTab: string,
  filterYear: string,
  filterStatus: string,
  initialTenantCount: number,
  isOwner: boolean
) {
  const qc = useQueryClient();

  // ── Active period (always fetched) ────────────────────────────────────────
  const periodQuery = useQuery({
    queryKey: queryKeys.propertyPeriod(propertyId),
    queryFn: () =>
      apiClient
        .get<{
          activePeriod: ActiveBillingPeriod | null;
          stats?: { totalTenants: number; paidThisPeriod: number } | null;
        }>(`/properties/${propertyId}/periods?limit=1&context=current`)
        .then((r) => r.data ?? { activePeriod: null }),
  });

  // ── Pending edit-request count (owner only) ──────────────────────────────
  const editCountQuery = useQuery({
    queryKey: queryKeys.propertyEditRequestCount(propertyId),
    queryFn: () =>
      apiClient
        .get<{
          pendingCount: number;
        }>(`/properties/${propertyId}/edit-requests/count`)
        .then((r) => r.data?.pendingCount ?? 0),
    enabled: isOwner,
  });

  // ── Tenancies (only when Tenants tab is active) ───────────────────────────
  const tenanciesQuery = useQuery({
    queryKey: queryKeys.propertyTenancies(propertyId),
    queryFn: () =>
      apiClient
        .get<{
          active: Tenancy[];
          invited: Tenancy[];
          past: Tenancy[];
        }>(`/properties/${propertyId}/tenancies`)
        .then((r) => r.data ?? { active: [], invited: [], past: [] }),
    select: (d) => ({
      all: [...d.active, ...d.invited, ...d.past],
      activeCount: d.active.length,
    }),
    enabled: activeTab === "tenants",
  });

  // ── Bills (owner only, bills or overview tab) ────────────────────────────
  const billsQuery = useQuery({
    queryKey: queryKeys.propertyBills(
      propertyId,
      filterYear,
      filterStatus,
      activeTab
    ),
    queryFn: async () => {
      const qs =
        activeTab === "bills"
          ? `?year=${filterYear}&status=${filterStatus}`
          : "";
      const r = await apiClient.get<PropertyBillsResponse>(
        `/properties/${propertyId}/bills${qs}`
      );
      return r.data ?? null;
    },
    enabled: isOwner && (activeTab === "bills" || activeTab === "overview"),
  });

  // ── Public refetch helpers ────────────────────────────────────────────────
  const refetchTenancies = () =>
    qc.invalidateQueries({ queryKey: queryKeys.propertyTenancies(propertyId) });

  const refetchLatestPeriod = () =>
    qc.invalidateQueries({ queryKey: queryKeys.propertyPeriod(propertyId) });

  const refetchPendingEditRequestCount = () =>
    qc.invalidateQueries({
      queryKey: queryKeys.propertyEditRequestCount(propertyId),
    });

  const refetchBills = () =>
    qc.invalidateQueries({
      queryKey: ["property", propertyId, "bills"],
      exact: false,
    });

  return {
    tenancies: activeTab === "tenants" ? (tenanciesQuery.data?.all ?? []) : [],
    billsData:
      isOwner && (activeTab === "bills" || activeTab === "overview")
        ? (billsQuery.data ?? null)
        : null,
    isLoadingTenants: tenanciesQuery.isLoading && activeTab === "tenants",
    isLoadingBills:
      billsQuery.isLoading &&
      isOwner &&
      (activeTab === "bills" || activeTab === "overview"),
    tenantCount: tenanciesQuery.data?.activeCount ?? initialTenantCount,
    activePeriod: periodQuery.data?.activePeriod ?? null,
    pendingEditRequestCount: isOwner ? (editCountQuery.data ?? 0) : 0,
    refetchTenancies,
    refetchBills,
    refetchLatestPeriod,
    refetchPendingEditRequestCount,
  };
}
