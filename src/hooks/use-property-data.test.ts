import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePropertyData } from "./use-property-data";
import { apiClient } from "../lib/api-client";

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("usePropertyData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: null, error: null });
  });

  const defaultProps = {
    propertyId: "prop-1",
    activeTab: "overview",
    filterYear: "2023",
    filterStatus: "all",
    initialTenantCount: 0,
    isOwner: true,
  };

  it("T5: count stays 0 and no request is made when isOwner is false on mount", async () => {
    const { result } = renderHook(() =>
      usePropertyData(
        defaultProps.propertyId,
        defaultProps.activeTab,
        defaultProps.filterYear,
        defaultProps.filterStatus,
        defaultProps.initialTenantCount,
        false
      )
    );

    // activePeriod will still be fetched
    expect(apiClient.get).toHaveBeenCalledWith(
      `/properties/prop-1/periods?limit=1&context=current`
    );

    // edit-requests/count should NOT be called
    const countCalls = vi
      .mocked(apiClient.get)
      .mock.calls.filter((call) => call[0].includes("edit-requests/count"));
    expect(countCalls).toHaveLength(0);

    expect(result.current.pendingEditRequestCount).toBe(0);

    // Flush the in-flight period request so its state update runs inside act
    await act(async () => {});
  });

  it("T1: pendingEditRequestCount resets to 0 when isOwner transitions true -> false (late response discarded)", async () => {
    let resolveCountRequest: (value: unknown) => void = () => {};
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes("edit-requests/count")) {
        return new Promise((resolve) => {
          resolveCountRequest = resolve as unknown as (value: unknown) => void;
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result, rerender } = renderHook(
      (props) =>
        usePropertyData(
          props.propertyId,
          props.activeTab,
          props.filterYear,
          props.filterStatus,
          props.initialTenantCount,
          props.isOwner
        ),
      { initialProps: defaultProps }
    );

    // Transition to false while the owner request is still in flight
    rerender({ ...defaultProps, isOwner: false });

    // It should immediately reset to 0
    expect(result.current.pendingEditRequestCount).toBe(0);

    // The in-flight owner request resolves late and must be discarded
    await act(async () => {
      resolveCountRequest({ data: { pendingCount: 5 }, error: null });
    });

    // Still 0 — the late response was guarded
    expect(result.current.pendingEditRequestCount).toBe(0);
  });

  it("T1b: pendingEditRequestCount reaches 5 when isOwner stays true (happy path)", async () => {
    let resolveCountRequest: (value: unknown) => void = () => {};
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes("edit-requests/count")) {
        return new Promise((resolve) => {
          resolveCountRequest = resolve as unknown as (value: unknown) => void;
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() =>
      usePropertyData(
        defaultProps.propertyId,
        defaultProps.activeTab,
        defaultProps.filterYear,
        defaultProps.filterStatus,
        defaultProps.initialTenantCount,
        true
      )
    );

    await act(async () => {
      resolveCountRequest({ data: { pendingCount: 5 }, error: null });
    });

    expect(result.current.pendingEditRequestCount).toBe(5);
  });

  it("T2: stale response does NOT overwrite activePeriod for new property (propertyId change)", async () => {
    let resolveProp1: (value: unknown) => void = () => {};
    let resolveProp2: (value: unknown) => void = () => {};

    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes("/properties/prop-1/periods")) {
        return new Promise((resolve) => {
          resolveProp1 = resolve as unknown as (value: unknown) => void;
        });
      }
      if (url.includes("/properties/prop-2/periods")) {
        return new Promise((resolve) => {
          resolveProp2 = resolve as unknown as (value: unknown) => void;
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result, rerender } = renderHook(
      (props) =>
        usePropertyData(
          props.propertyId,
          props.activeTab,
          props.filterYear,
          props.filterStatus,
          props.initialTenantCount,
          props.isOwner
        ),
      { initialProps: defaultProps }
    );

    // Rerender with prop-2 before prop-1 resolves
    rerender({ ...defaultProps, propertyId: "prop-2" });

    // Resolve prop-2 first
    await act(async () => {
      resolveProp2({
        data: { activePeriod: { id: "period-2", periodMonth: "2023-02" } },
        error: null,
      });
    });

    expect(result.current.activePeriod?.id).toBe("period-2");

    // Now resolve the stale prop-1 request
    await act(async () => {
      resolveProp1({
        data: { activePeriod: { id: "period-1", periodMonth: "2023-01" } },
        error: null,
      });
    });

    // The stale response should be ignored, keeping period-2
    expect(result.current.activePeriod?.id).toBe("period-2");
  });

  it("T3: stale bills response does NOT overwrite billsData for new tab (activeTab change)", async () => {
    let resolveBillsOverview: (value: unknown) => void = () => {};
    let resolveBillsTab: (value: unknown) => void = () => {};

    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes("/bills")) {
        // The URL for "overview" doesn't have qs by default, but "bills" has ?year=2023&status=all
        if (url.includes("year=")) {
          return new Promise((resolve) => {
            resolveBillsTab = resolve as unknown as (value: unknown) => void;
          });
        }
        return new Promise((resolve) => {
          resolveBillsOverview = resolve as unknown as (value: unknown) => void;
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result, rerender } = renderHook(
      (props) =>
        usePropertyData(
          props.propertyId,
          props.activeTab,
          props.filterYear,
          props.filterStatus,
          props.initialTenantCount,
          props.isOwner
        ),
      { initialProps: { ...defaultProps, activeTab: "overview" } }
    );

    // Loading bills starts for overview
    expect(result.current.isLoadingBills).toBe(true);

    // Switch tab to "bills" before overview bills resolve
    rerender({ ...defaultProps, activeTab: "bills" });

    // Resolve bills tab request
    await act(async () => {
      resolveBillsTab({
        data: { bills: [{ id: "bill-from-tab" }] },
        error: null,
      });
    });

    expect(result.current.billsData?.bills[0].id).toBe("bill-from-tab");

    // Resolve the stale overview request
    await act(async () => {
      resolveBillsOverview({
        data: { bills: [{ id: "bill-from-overview" }] },
        error: null,
      });
    });

    // Stale overview response should be ignored
    expect(result.current.billsData?.bills[0].id).toBe("bill-from-tab");
    expect(result.current.isLoadingBills).toBe(false);
  });

  it("T3b: isLoadingBills is false after tab switch away while request is in flight (loading flag not stuck)", async () => {
    let resolveStaleBills: (value: unknown) => void = () => {};

    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes("/bills")) {
        return new Promise((resolve) => {
          resolveStaleBills = resolve as unknown as (value: unknown) => void;
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result, rerender } = renderHook(
      (props) =>
        usePropertyData(
          props.propertyId,
          props.activeTab,
          props.filterYear,
          props.filterStatus,
          props.initialTenantCount,
          props.isOwner
        ),
      { initialProps: { ...defaultProps, activeTab: "bills" } }
    );

    // Bills request is in-flight
    expect(result.current.isLoadingBills).toBe(true);

    // Switch to "tenants" tab — bills request is now stale
    rerender({ ...defaultProps, activeTab: "tenants" });

    // Resolve the stale bills request
    await act(async () => {
      resolveStaleBills({
        data: { bills: [{ id: "stale-bill" }] },
        error: null,
      });
    });

    // Loading flag must be cleared even though the stale response was discarded
    expect(result.current.isLoadingBills).toBe(false);
    // State must not be polluted with stale data
    expect(result.current.billsData).toBeNull();
  });

  it("T4: refetchPendingEditRequestCount uses the guarded path correctly", async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes("edit-requests/count")) {
        return Promise.resolve({ data: { pendingCount: 42 }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() =>
      usePropertyData(
        defaultProps.propertyId,
        defaultProps.activeTab,
        defaultProps.filterYear,
        defaultProps.filterStatus,
        defaultProps.initialTenantCount,
        defaultProps.isOwner
      )
    );

    // Wait for the initial mount effect to resolve
    await waitFor(() => {
      expect(result.current.pendingEditRequestCount).toBe(42);
    });

    // Update the mock to return a new count
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes("edit-requests/count")) {
        return Promise.resolve({ data: { pendingCount: 99 }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Call refetch
    await act(async () => {
      await result.current.refetchPendingEditRequestCount();
    });

    expect(result.current.pendingEditRequestCount).toBe(99);

    // Two overlapping refetches: the older response must be discarded
    const resolvers: Array<(value: unknown) => void> = [];
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes("edit-requests/count")) {
        return new Promise((resolve) => {
          resolvers.push(resolve as unknown as (value: unknown) => void);
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    let first: Promise<void>;
    let second: Promise<void>;
    act(() => {
      first = result.current.refetchPendingEditRequestCount();
      second = result.current.refetchPendingEditRequestCount();
    });

    await act(async () => {
      expect(resolvers).toHaveLength(2);
      resolvers[1]({ data: { pendingCount: 2 }, error: null });
      await second!;
    });
    expect(result.current.pendingEditRequestCount).toBe(2);

    await act(async () => {
      resolvers[0]({ data: { pendingCount: 1 }, error: null });
      await first!;
    });
    // Older value must be discarded, count stays 2
    expect(result.current.pendingEditRequestCount).toBe(2);
  });

  it("T6: refetchPendingEditRequestCount does NOT cancel an in-flight period request", async () => {
    let resolvePeriod: (value: unknown) => void = () => {};

    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes("/periods")) {
        return new Promise((resolve) => {
          resolvePeriod = resolve as unknown as (value: unknown) => void;
        });
      }
      if (url.includes("edit-requests/count")) {
        return Promise.resolve({ data: { pendingCount: 7 }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() =>
      usePropertyData(
        defaultProps.propertyId,
        defaultProps.activeTab,
        defaultProps.filterYear,
        defaultProps.filterStatus,
        defaultProps.initialTenantCount,
        defaultProps.isOwner
      )
    );

    // activePeriod is still in-flight (resolvePeriod not called yet).
    // Now trigger a manual refetch of just the count.
    await act(async () => {
      await result.current.refetchPendingEditRequestCount();
    });

    // Count should have updated.
    expect(result.current.pendingEditRequestCount).toBe(7);

    // Now resolve the original period request.
    await act(async () => {
      resolvePeriod({
        data: { activePeriod: { id: "period-1", periodMonth: "2023-01" } },
        error: null,
      });
    });

    // The period response should still be applied — refetch did NOT cancel it.
    expect(result.current.activePeriod?.id).toBe("period-1");
  });

  it("T7: refetchBills uses the current activeTab after a tab change", async () => {
    const { result, rerender } = renderHook(
      (props) =>
        usePropertyData(
          props.propertyId,
          props.activeTab,
          props.filterYear,
          props.filterStatus,
          props.initialTenantCount,
          props.isOwner
        ),
      { initialProps: { ...defaultProps, activeTab: "overview" } }
    );

    // Switch to bills tab (this also triggers the bills effect automatically)
    rerender({ ...defaultProps, activeTab: "bills" });

    const callsAfterRerender = vi
      .mocked(apiClient.get)
      .mock.calls.filter((call) => call[0].includes("/bills")).length;

    // Manually trigger refetch
    await act(async () => {
      await result.current.refetchBills();
    });

    // The last bills request must include the query string (activeTab === "bills")
    const billsCalls = vi
      .mocked(apiClient.get)
      .mock.calls.filter((call) => call[0].includes("/bills"));
    expect(billsCalls.length).toBe(callsAfterRerender + 1);
    const lastBillsCall = billsCalls[billsCalls.length - 1][0] as string;
    expect(lastBillsCall).toContain("?year=2023&status=all");
  });

  it("T8: stale tenancies response is discarded when propertyId changes mid-flight", async () => {
    let resolveProp1Tenants: (value: unknown) => void = () => {};
    let resolveProp2Tenants: (value: unknown) => void = () => {};

    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes("/properties/prop-1/tenancies")) {
        return new Promise((resolve) => {
          resolveProp1Tenants = resolve as unknown as (value: unknown) => void;
        });
      }
      if (url.includes("/properties/prop-2/tenancies")) {
        return new Promise((resolve) => {
          resolveProp2Tenants = resolve as unknown as (value: unknown) => void;
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result, rerender } = renderHook(
      (props) =>
        usePropertyData(
          props.propertyId,
          props.activeTab,
          props.filterYear,
          props.filterStatus,
          props.initialTenantCount,
          props.isOwner
        ),
      { initialProps: { ...defaultProps, activeTab: "tenants" } }
    );

    // Switch to prop-2 before prop-1 resolves
    rerender({ ...defaultProps, activeTab: "tenants", propertyId: "prop-2" });

    // Resolve prop-2 first
    await act(async () => {
      resolveProp2Tenants({
        data: {
          active: [{ id: "t-prop2" }],
          invited: [],
          past: [],
        },
        error: null,
      });
    });

    expect(result.current.tenancies[0].id).toBe("t-prop2");

    // Resolve the stale prop-1 request — must be discarded
    await act(async () => {
      resolveProp1Tenants({
        data: {
          active: [{ id: "t-prop1" }],
          invited: [],
          past: [],
        },
        error: null,
      });
    });

    expect(result.current.tenancies[0].id).toBe("t-prop2");
  });

  it("T9: tenancies reset to [] on propertyId change before new data arrives", async () => {
    // First property resolves immediately
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes("/properties/prop-1/tenancies")) {
        return Promise.resolve({
          data: {
            active: [{ id: "t-prop1" }],
            invited: [],
            past: [],
          },
          error: null,
        });
      }
      // prop-2 requests pend indefinitely
      return new Promise(() => {});
    });

    const { result, rerender } = renderHook(
      (props) =>
        usePropertyData(
          props.propertyId,
          props.activeTab,
          props.filterYear,
          props.filterStatus,
          props.initialTenantCount,
          props.isOwner
        ),
      { initialProps: { ...defaultProps, activeTab: "tenants" } }
    );

    // Let prop-1 data settle
    await act(async () => {});
    expect(result.current.tenancies.length).toBeGreaterThan(0);

    // Switch to prop-2 — new requests stay pending
    rerender({ ...defaultProps, activeTab: "tenants", propertyId: "prop-2" });

    // tenancies should reset immediately (before prop-2 data arrives)
    expect(result.current.tenancies).toHaveLength(0);
  });
});
