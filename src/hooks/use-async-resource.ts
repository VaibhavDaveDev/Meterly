import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "../lib/api-client";

export function useAsyncResource<T>(endpoint: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchResource = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!endpoint) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);
    try {
      const { data: resData, error: resError } =
        await apiClient.get<T>(endpoint);

      if (requestId !== requestIdRef.current) return; // stale response, discard

      if (resError) {
        setError(resError.message);
      } else {
        setData(resData);
      }
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void fetchResource();
  }, [fetchResource]);

  return {
    data,
    loading,
    isLoading: loading,
    error,
    refetch: fetchResource,
    setData,
  };
}
