/** Simple in-memory stale-while-revalidate cache for feed aggregation. */

interface CacheEntry<T> {
  data: T;
  freshUntil: number;
  staleUntil: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const FRESH_MS = 5 * 60 * 1000; // 5 minutes fresh
const STALE_MS = 30 * 60 * 1000; // serve stale up to 30 minutes

export function getCached<T>(
  key: string
): { data: T; stale: boolean } | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  const now = Date.now();
  if (now <= entry.freshUntil) {
    return { data: entry.data, stale: false };
  }
  if (now <= entry.staleUntil) {
    return { data: entry.data, stale: true };
  }
  store.delete(key);
  return null;
}

export function setCache<T>(key: string, data: T): void {
  const now = Date.now();
  store.set(key, {
    data,
    freshUntil: now + FRESH_MS,
    staleUntil: now + STALE_MS,
  });
}

export function cacheKey(parts: string[]): string {
  return parts.join("::");
}
