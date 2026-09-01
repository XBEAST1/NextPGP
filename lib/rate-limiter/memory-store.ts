export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

const MAX_STORE_KEYS = 10_000;
const CLEANUP_INTERVAL_MS = 30_000; // 30 seconds

// In-memory map: key -> array of request timestamps (epoch ms)
const store = new Map<string, number[]>();
let lastCleanupTime = Date.now();

function cleanupExpiredEntries(now: number, maxWindowMs: number): void {
  const threshold = now - maxWindowMs;
  for (const [key, timestamps] of store.entries()) {
    const valid = timestamps.filter((t) => t > threshold);
    if (valid.length === 0) {
      store.delete(key);
    } else {
      store.set(key, valid);
    }
  }

  // If store still exceeds MAX_STORE_KEYS, drop oldest inserted keys
  if (store.size > MAX_STORE_KEYS) {
    const keysToDelete = Array.from(store.keys()).slice(0, store.size - MAX_STORE_KEYS);
    for (const key of keysToDelete) {
      store.delete(key);
    }
  }
}

export function checkMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  // Periodically clean up stale entries
  if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
    cleanupExpiredEntries(now, windowMs);
    lastCleanupTime = now;
  }

  const windowStart = now - windowMs;
  const existing = store.get(key) || [];
  const validTimestamps = existing.filter((t) => t > windowStart);

  if (validTimestamps.length >= maxRequests) {
    // Window resets when the oldest request in the current window expires
    const oldestTimestamp = validTimestamps[0] ?? now;
    const resetTime = oldestTimestamp + windowMs;

    store.set(key, validTimestamps);

    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetTime,
    };
  }

  validTimestamps.push(now);
  store.set(key, validTimestamps);

  const resetTime = now + windowMs;
  const remaining = Math.max(0, maxRequests - validTimestamps.length);

  return {
    success: true,
    limit: maxRequests,
    remaining,
    resetTime,
  };
}

export function clearMemoryStore(): void {
  store.clear();
  lastCleanupTime = Date.now();
}

export function getMemoryStoreSize(): number {
  return store.size;
}
