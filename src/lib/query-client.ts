import { QueryClient } from "@tanstack/react-query";

let client: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          // Show stale data immediately, refetch in background
          staleTime: 30 * 1000, // 30 s
          gcTime: 5 * 60 * 1000, // 5 min (was cacheTime in v4)
          retry: 1,
          refetchOnWindowFocus: true,
        },
      },
    });
  }
  return client;
}
