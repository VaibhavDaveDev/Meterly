import { createIDBCache } from './cache';

// Using any internally but returning generic T
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = createIDBCache<any>('meterly-dashboard', 'stats', 1, 5 * 60 * 1000);

export async function getCachedDashboard<T>(key: string): Promise<T | null> {
  return cache.get(key) as Promise<T | null>;
}

export async function setCachedDashboard<T>(key: string, data: T): Promise<void> {
  await cache.set(key, data);
}
