import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkMemoryRateLimit,
  clearMemoryStore,
  getMemoryStoreSize,
} from '@/lib/rate-limiter/memory-store';
import { executeRateLimit } from '@/lib/rate-limiter';
import { addRateLimitHeaders, rateLimit } from '@/lib/security';
import { NextResponse } from 'next/server';

describe('In-Memory Sliding Window Rate Limiter', () => {
  beforeEach(() => {
    clearMemoryStore();
  });

  it('allows requests within maxRequests limit', () => {
    const key = 'test-user-1';
    const maxRequests = 3;
    const windowMs = 60_000;
    const baseTime = 1_000_000;

    const res1 = checkMemoryRateLimit(key, maxRequests, windowMs, baseTime);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);
    expect(res1.limit).toBe(3);

    const res2 = checkMemoryRateLimit(key, maxRequests, windowMs, baseTime + 100);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = checkMemoryRateLimit(key, maxRequests, windowMs, baseTime + 200);
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('blocks requests exceeding maxRequests within the window', () => {
    const key = 'test-user-2';
    const maxRequests = 2;
    const windowMs = 60_000;
    const baseTime = 1_000_000;

    checkMemoryRateLimit(key, maxRequests, windowMs, baseTime);
    checkMemoryRateLimit(key, maxRequests, windowMs, baseTime + 100);

    // Exceeded limit
    const blockedRes = checkMemoryRateLimit(key, maxRequests, windowMs, baseTime + 200);
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.remaining).toBe(0);
    expect(blockedRes.limit).toBe(2);
    expect(blockedRes.resetTime).toBe(baseTime + windowMs);
  });

  it('allows new requests once older requests roll out of the sliding window', () => {
    const key = 'test-user-3';
    const maxRequests = 2;
    const windowMs = 10_000; // 10s window
    const baseTime = 1_000_000;

    // 2 requests at t=0 and t=2000
    checkMemoryRateLimit(key, maxRequests, windowMs, baseTime);
    checkMemoryRateLimit(key, maxRequests, windowMs, baseTime + 2000);

    // Blocked at t=5000
    const blocked = checkMemoryRateLimit(key, maxRequests, windowMs, baseTime + 5000);
    expect(blocked.success).toBe(false);

    // At t=10001 (1ms after t=0 window expired), the first request rolled out
    const allowed = checkMemoryRateLimit(key, maxRequests, windowMs, baseTime + 10_001);
    expect(allowed.success).toBe(true);
    expect(allowed.remaining).toBe(0); // 1 request from t=2000 + 1 new request = 2 / 2
  });

  it('isolates rate limits between different users and endpoints', () => {
    const userA = 'user-A';
    const userB = 'user-B';
    const maxRequests = 1;
    const windowMs = 60_000;
    const now = 1_000_000;

    const resA1 = checkMemoryRateLimit(userA, maxRequests, windowMs, now);
    expect(resA1.success).toBe(true);

    const resA2 = checkMemoryRateLimit(userA, maxRequests, windowMs, now + 10);
    expect(resA2.success).toBe(false);

    // User B should not be affected by User A's rate limit
    const resB1 = checkMemoryRateLimit(userB, maxRequests, windowMs, now + 20);
    expect(resB1.success).toBe(true);
  });

  it('clears memory store correctly', () => {
    checkMemoryRateLimit('user-clear-1', 5, 60_000);
    checkMemoryRateLimit('user-clear-2', 5, 60_000);
    expect(getMemoryStoreSize()).toBe(2);

    clearMemoryStore();
    expect(getMemoryStoreSize()).toBe(0);
  });
});

describe('Rate Limiter Fallback & Security Integration', () => {
  beforeEach(() => {
    clearMemoryStore();
  });

  it('executeRateLimit falls back to in-memory store cleanly', async () => {
    const result = await executeRateLimit({
      userId: 'test-fallback-user',
      endpoint: 'test-endpoint',
      maxRequests: 5,
      windowMs: 60_000,
    });

    expect(result.success).toBe(true);
    expect(result.limit).toBe(5);
    expect(result.remaining).toBe(4);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  it('rateLimit wrapper in lib/security preserves contract', async () => {
    const result = await rateLimit({
      userId: 'sec-user',
      endpoint: 'sec-endpoint',
      maxRequests: 10,
      windowMs: 60_000,
    });

    expect(result.success).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
  });

  it('addRateLimitHeaders sets standard HTTP rate-limiting headers', () => {
    const response = NextResponse.json({ ok: true });
    const resetTime = 1_700_000_000_000; // ms

    addRateLimitHeaders(response, {
      limit: 50,
      remaining: 42,
      resetTime,
    });

    expect(response.headers.get('X-RateLimit-Limit')).toBe('50');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('42');
    expect(response.headers.get('X-RateLimit-Reset')).toBe(
      Math.floor(resetTime / 1000).toString()
    );
  });

  it('handles mock Redis sliding window responses correctly', async () => {
    const { checkRedisRateLimit } = await import('@/lib/rate-limiter/redis-store');
    
    // Mock Redis client returning allowed
    const mockClientAllowed = {
      eval: async () => [1, 4, 1700000060000],
    } as any;

    const resAllowed = await checkRedisRateLimit(mockClientAllowed, 'key', 5, 60_000, 1700000000000);
    expect(resAllowed.success).toBe(true);
    expect(resAllowed.remaining).toBe(4);
    expect(resAllowed.limit).toBe(5);
    expect(resAllowed.resetTime).toBe(1700000060000);

    // Mock Redis client returning blocked
    const mockClientBlocked = {
      eval: async () => [0, 0, 1700000060000],
    } as any;

    const resBlocked = await checkRedisRateLimit(mockClientBlocked, 'key', 5, 60_000, 1700000000000);
    expect(resBlocked.success).toBe(false);
    expect(resBlocked.remaining).toBe(0);
  });
});
