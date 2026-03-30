const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  text: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedInsight(symbol: string): string | null {
  const key = symbol.toUpperCase();
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.text;
}

export function setCachedInsight(symbol: string, text: string): void {
  cache.set(symbol.toUpperCase(), { text, timestamp: Date.now() });
}
