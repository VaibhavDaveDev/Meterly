export function safeChartData<T extends Record<string, unknown>>(
  data: T[] | undefined | null,
  fallback: T
): T[] {
  // ponytail: ensure charts don't crash on empty or undefined datasets
  if (!data || data.length === 0) {
    return [fallback];
  }
  return data;
}
