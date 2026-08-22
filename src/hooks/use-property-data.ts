import { useState, useEffect, useRef, useCallback } from "react";
import type { Tenancy } from "../types/db";
import { apiClient } from "../lib/api-client";
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
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [billsData, setBillsData] = useState<PropertyBillsResponse | null>(
    null
  );
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [tenantCount, setTenantCount] = useState(initialTenantCount);
  const [activePeriod, setActivePeriod] = useState<ActiveBillingPeriod | null>(
    null
  );
  const [pendingEditRequestCount, setPendingEditRequestCount] = useState(0);

  // ── Four independent domain generation counters ──────────────────────────
  const tenanciesGenRef = useRef(0);
  const periodGenRef = useRef(0);
  const billsGenRef = useRef(0);
  const countGenRef = useRef(0);

  // ── Internal guarded helpers ──────────────────────────────────────────────

  const fetchTenanciesGuarded = async (gen: number) => {
    setIsLoadingTenants(true);
    try {
      const { data } = await apiClient.get<{
        active: Tenancy[];
        invited: Tenancy[];
        past: Tenancy[];
      }>(`/properties/${propertyId}/tenancies`);
      if (gen !== tenanciesGenRef.current) return;
      if (data) {
        const allTenancies = [...data.active, ...data.invited, ...data.past];
        setTenancies(allTenancies);
        setTenantCount(data.active.length);
      }
    } finally {
      if (gen === tenanciesGenRef.current) setIsLoadingTenants(false);
    }
  };

  const fetchLatestPeriodGuarded = async (gen: number) => {
    const { data } = await apiClient.get<{
      activePeriod: ActiveBillingPeriod | null;
      stats?: { totalTenants: number; paidThisPeriod: number } | null;
    }>(`/properties/${propertyId}/periods?limit=1&context=current`);
    if (gen !== periodGenRef.current) return;
    setActivePeriod(data?.activePeriod ?? null);
  };

  const fetchBillsGuarded = async (gen: number) => {
    if (!isOwner) return;
    setIsLoadingBills(true);
    const qs =
      activeTab === "bills" ? `?year=${filterYear}&status=${filterStatus}` : "";
    try {
      const { data } = await apiClient.get<PropertyBillsResponse>(
        `/properties/${propertyId}/bills${qs}`
      );
      if (gen !== billsGenRef.current) return;
      setBillsData(data ?? null);
    } finally {
      if (gen === billsGenRef.current) setIsLoadingBills(false);
    }
  };

  const fetchPendingEditRequestCountGuarded = async (gen: number) => {
    if (!isOwner) return;
    const { data } = await apiClient.get<{ pendingCount: number }>(
      `/properties/${propertyId}/edit-requests/count`
    );
    if (gen !== countGenRef.current) return;
    setPendingEditRequestCount(data?.pendingCount ?? 0);
  };

  // ── Public helpers (returned as refetch* callbacks) ───────────────────────

  const fetchTenancies = useCallback(async () => {
    await fetchTenanciesGuarded(++tenanciesGenRef.current);
  }, [propertyId]);

  const fetchBills = useCallback(async () => {
    await fetchBillsGuarded(++billsGenRef.current);
  }, [activeTab, propertyId, filterYear, filterStatus, isOwner]);

  const fetchLatestPeriod = useCallback(async () => {
    await fetchLatestPeriodGuarded(++periodGenRef.current);
  }, [propertyId]);

  const fetchPendingEditRequestCount = useCallback(async () => {
    await fetchPendingEditRequestCountGuarded(++countGenRef.current);
  }, [propertyId, isOwner]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const pGen = ++periodGenRef.current;
    void fetchLatestPeriodGuarded(pGen).catch((err) =>
      console.error("[usePropertyData] period fetch failed", err)
    );
    return () => {
      periodGenRef.current++;
    };
  }, [propertyId]);

  useEffect(() => {
    const cGen = ++countGenRef.current;
    if (isOwner) {
      void fetchPendingEditRequestCountGuarded(cGen).catch((err) =>
        console.error("[usePropertyData] count fetch failed", err)
      );
    } else {
      setPendingEditRequestCount(0);
    }
    return () => {
      countGenRef.current++;
    };
  }, [propertyId, isOwner]);

  // Reset tenancies state when the property changes so stale data from the
  // previous property is never visible. Split from the fetch effect so that
  // tab switches do not blank the list unnecessarily.
  useEffect(() => {
    setTenancies([]);
  }, [propertyId]);

  useEffect(() => {
    const tGen = ++tenanciesGenRef.current;
    if (activeTab === "tenants") {
      void fetchTenanciesGuarded(tGen).catch((err) =>
        console.error("[usePropertyData] tenancies fetch failed", err)
      );
    }
    return () => {
      tenanciesGenRef.current++;
      setIsLoadingTenants(false);
    };
  }, [activeTab, propertyId]);

  useEffect(() => {
    const bGen = ++billsGenRef.current;
    if ((activeTab === "bills" || activeTab === "overview") && isOwner) {
      void fetchBillsGuarded(bGen).catch((err) =>
        console.error("[usePropertyData] bills fetch failed", err)
      );
    } else if (!isOwner) {
      setBillsData(null);
    }
    return () => {
      billsGenRef.current++;
      setIsLoadingBills(false);
    };
  }, [activeTab, propertyId, filterYear, filterStatus, isOwner]);

  return {
    tenancies,
    billsData,
    isLoadingTenants,
    isLoadingBills,
    tenantCount,
    activePeriod,
    pendingEditRequestCount,
    refetchTenancies: fetchTenancies,
    refetchBills: fetchBills,
    refetchLatestPeriod: fetchLatestPeriod,
    refetchPendingEditRequestCount: fetchPendingEditRequestCount,
  };
}
