import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  renderHook as rtlRenderHook,
  act,
  waitFor,
  type RenderHookOptions,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useDashboardData } from "./use-dashboard-data";
import { apiClient } from "../lib/api-client";

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

function renderHook<Result, Props>(
  render: (initialProps: Props) => Result,
  options?: RenderHookOptions<Props>
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: 0,
      },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return rtlRenderHook(render, {
    wrapper: options?.wrapper || Wrapper,
    ...options,
  });
}

describe("useDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("fetches user, invites, and owner stats when role is owner", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (path === "/users/me") {
        return {
          data: {
            id: "u1",
            name: "Owner User",
            primaryRole: "owner",
          },
          error: null,
        } as never;
      }
      if (path === "/invites/pending") {
        return { data: [], error: null } as never;
      }
      if (path === "/dashboard/owner") {
        return {
          data: { properties: [], stats: { totalUnits: 10 } },
          error: null,
        } as never;
      }
      return { data: null, error: null } as never;
    });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user?.name).toBe("Owner User");
    expect(result.current.activeView).toBe("owner");
    expect(result.current.ownerStats).not.toBeNull();
    expect(result.current.tenantStats).toBeNull();
    expect(apiClient.get).toHaveBeenCalledWith("/users/me");
    expect(apiClient.get).toHaveBeenCalledWith("/invites/pending");
    expect(apiClient.get).toHaveBeenCalledWith("/dashboard/owner");
    expect(apiClient.get).not.toHaveBeenCalledWith("/dashboard/tenant");
  });

  it("fetches tenant stats and defaults activeView to tenant when role is tenant", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (path === "/users/me") {
        return {
          data: {
            id: "u2",
            name: "Tenant User",
            primaryRole: "tenant",
          },
          error: null,
        } as never;
      }
      if (path === "/invites/pending") {
        return { data: [], error: null } as never;
      }
      if (path === "/dashboard/tenant") {
        return {
          data: { tenancies: [], stats: { pendingBills: 1 } },
          error: null,
        } as never;
      }
      return { data: null, error: null } as never;
    });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user?.name).toBe("Tenant User");
    expect(result.current.activeView).toBe("tenant");
    expect(result.current.tenantStats).not.toBeNull();
    expect(result.current.ownerStats).toBeNull();
    expect(apiClient.get).toHaveBeenCalledWith("/dashboard/tenant");
    expect(apiClient.get).not.toHaveBeenCalledWith("/dashboard/owner");
  });

  it("handles dual role ('both') and syncs activeView with localStorage", async () => {
    localStorage.setItem("meterly-active-view", "tenant");

    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (path === "/users/me") {
        return {
          data: {
            id: "u3",
            name: "Both User",
            primaryRole: "both",
          },
          error: null,
        } as never;
      }
      if (path === "/invites/pending") {
        return { data: [], error: null } as never;
      }
      if (path === "/dashboard/owner") {
        return { data: { properties: [] }, error: null } as never;
      }
      if (path === "/dashboard/tenant") {
        return { data: { tenancies: [] }, error: null } as never;
      }
      return { data: null, error: null } as never;
    });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeView).toBe("tenant");
    expect(apiClient.get).toHaveBeenCalledWith("/dashboard/owner");
    expect(apiClient.get).toHaveBeenCalledWith("/dashboard/tenant");

    act(() => {
      result.current.setActiveView("owner");
    });

    expect(result.current.activeView).toBe("owner");
    expect(localStorage.getItem("meterly-active-view")).toBe("owner");
  });

  it("captures query error and surfaces error message", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (path === "/users/me") {
        return {
          data: null,
          error: { message: "Failed to fetch user profile" },
        } as never;
      }
      return { data: null, error: null } as never;
    });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.error).toBe("Failed to fetch user profile");
    });
  });
});
