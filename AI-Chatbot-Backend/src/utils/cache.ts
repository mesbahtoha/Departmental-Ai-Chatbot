/**
 * Tiny in-memory TTL cache.
 * Used to memoize frequently-read values (settings, prompt templates)
 * that change rarely, cutting repeated MongoDB round-trips per request.
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  clear(): void;
}

export function createTtlCache<T>(ttlMs: number): TtlCache<T> {
  const store = new Map<string, CacheEntry<T>>();

  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set(key: string, value: T): void {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },

    clear(): void {
      store.clear();
    },
  };
}

export default createTtlCache;
