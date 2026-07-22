import { createIDBCache } from './cache';

const cache = createIDBCache<Blob>('meterly-bill-photos', 'photos', 1, 30 * 24 * 60 * 60 * 1000);

export async function setCachedPhoto(key: string, blob: Blob): Promise<void> {
  await cache.set(key, blob);
}
