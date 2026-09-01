import { getRedisClient } from '@/lib/redis';
import { checkMemoryRateLimit, RateLimitResult } from './memory-store';
import { checkRedisRateLimit } from './redis-store';

export interface RateLimitOptions {
  userId: string;
  endpoint: string;
  maxRequests: number;
  windowMs: number;
  failClosed?: boolean;
}

export type { RateLimitResult };

let lastFallbackLogTime = 0;
const FALLBACK_LOG_THROTTLE_MS = 10_000; // Log at most once per 10s

function logFallbackWarning(reason: string, endpoint: string): void {
  const now = Date.now();
  if (now - lastFallbackLogTime > FALLBACK_LOG_THROTTLE_MS) {
    console.warn(`[RateLimiter] Falling back to in-memory store for endpoint "${endpoint}". Reason: ${reason}`);
    lastFallbackLogTime = now;
  }
}

export async function executeRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { userId, endpoint, maxRequests, windowMs, failClosed = false } = options;
  const key = `ratelimit:${endpoint}:${userId}`;
  const now = Date.now();

  const redis = getRedisClient();

  if (redis) {
    try {
      // Execute Redis sliding window check
      const redisResult = await checkRedisRateLimit(redis, key, maxRequests, windowMs, now);
      return redisResult;
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Unknown Redis error';
      logFallbackWarning(errMessage, endpoint);
    }
  } else {
    logFallbackWarning('Redis client unavailable', endpoint);
  }

  // In-Memory Fallback
  try {
    const memoryResult = checkMemoryRateLimit(key, maxRequests, windowMs, now);
    return memoryResult;
  } catch (memError) {
    console.error(`[RateLimiter] Critical error in in-memory fallback for ${key}:`, memError);

    if (failClosed) {
      console.error(`[RateLimiter] failClosed=true on ${endpoint} for ${userId} - DENYING request`);
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        resetTime: now + windowMs,
      };
    }

    // Availability fallback
    return {
      success: true,
      limit: maxRequests,
      remaining: 0,
      resetTime: now + windowMs,
    };
  }
}

export { checkMemoryRateLimit, clearMemoryStore } from './memory-store';
export { checkRedisRateLimit } from './redis-store';
