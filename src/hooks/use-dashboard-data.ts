import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiClient } from "../lib/api-client";
import { queryKeys } from "../lib/query-keys";
import type {
  PendingInvite,
  UserProfile,
  OwnerDashboardStats,
  TenantDashboardStats,
} from "../components/dashboard/types";

export function useDashboardData() {
  const userQuery = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () =>
      apiClient.get<UserProfile>("/users/me").then((r) => {
        if (r.error) throw new Error(r.error.message);
        return r.data!;
      }),
  });

  const user = userQuery.data ?? null;
  const role = user?.primaryRole;

  const invitesQuery = useQuery({
    queryKey: queryKeys.pendingInvites(),
    queryFn: () =>
      apiClient.get<PendingInvite[]>("/invites/pending").then((r) => {
        if (r.error) throw new Error(r.error.message);
        return r.data ?? [];
      }),
    enabled: !!user,
  });

  const ownerQuery = useQuery({
    queryKey: queryKeys.dashboardOwner(),
    queryFn: () =>
      apiClient.get<OwnerDashboardStats>("/dashboard/owner").then((r) => {
        if (r.error) throw new Error(r.error.message);
        return r.data!;
      }),
    enabled: role === "owner" || role === "both",
    staleTime: 5 * 60 * 1000,
  });

  const tenantQuery = useQuery({
    queryKey: queryKeys.dashboardTenant(),
    queryFn: () =>
      apiClient.get<TenantDashboardStats>("/dashboard/tenant").then((r) => {
        if (r.error) throw new Error(r.error.message);
        return r.data!;
      }),
    enabled: role === "tenant" || role === "both",
    staleTime: 5 * 60 * 1000,
  });

  const [activeView, setActiveViewState] = useState<"owner" | "tenant">(
    "owner"
  );

  useEffect(() => {
    if (role === "both") {
      const saved = localStorage.getItem("meterly-active-view");
      if (saved === "owner" || saved === "tenant") {
        setActiveViewState(saved);
      }
    } else if (role === "owner" || role === "tenant") {
      setActiveViewState(role);
    }
  }, [role]);

  const setActiveView = (view: "owner" | "tenant") => {
    setActiveViewState(view);
    localStorage.setItem("meterly-active-view", view);
  };

  const ownerPending =
    (role === "owner" || role === "both") && ownerQuery.isPending;
  const tenantPending =
    (role === "tenant" || role === "both") && tenantQuery.isPending;
  const loading = userQuery.isLoading || ownerPending || tenantPending;
  const error =
    userQuery.error?.message ??
    ownerQuery.error?.message ??
    tenantQuery.error?.message ??
    null;

  return {
    user,
    invites: invitesQuery.data ?? [],
    ownerStats: ownerQuery.data ?? null,
    tenantStats: tenantQuery.data ?? null,
    loading,
    error,
    activeView,
    setActiveView,
  };
}
