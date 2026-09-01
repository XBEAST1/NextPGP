import Redis from 'ioredis';
import { RateLimitResult } from './memory-store';

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])
local member = ARGV[4]

local windowStart = now - windowMs

-- 1. Remove expired timestamps outside the rolling window
redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

-- 2. Count remaining requests in current window
local currentCount = redis.call('ZCARD', key)

if currentCount < maxRequests then
    -- 3. Add new request timestamp
    redis.call('ZADD', key, now, member)
    -- 4. Set TTL slightly longer than window (in milliseconds)
    redis.call('PEXPIRE', key, windowMs + 1000)
    
    local remaining = maxRequests - currentCount - 1
    local resetTime = now + windowMs
    return { 1, remaining, resetTime }
else
    -- Find the oldest request to calculate exact resetTime
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local resetTime = now + windowMs
    if #oldest >= 2 then
        resetTime = tonumber(oldest[2]) + windowMs
    end
    
    return { 0, 0, resetTime }
end
`;

export async function checkRedisRateLimit(
  client: Redis,
  key: string,
  maxRequests: number,
  windowMs: number,
  now: number = Date.now()
): Promise<RateLimitResult> {
  const member = `${now}:${Math.random().toString(36).slice(2, 9)}`;

  const result = (await client.eval(
    SLIDING_WINDOW_LUA,
    1,
    key,
    now.toString(),
    windowMs.toString(),
    maxRequests.toString(),
    member
  )) as [number, number, number];

  const [allowed, remaining, resetTime] = result;

  return {
    success: allowed === 1,
    limit: maxRequests,
    remaining: Number(remaining),
    resetTime: Number(resetTime),
  };
}
