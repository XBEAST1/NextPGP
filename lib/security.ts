import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// CSRF Token Functions
export function generateCSRFToken(userId: string): string {
  const timestamp = Math.floor(Date.now() / 1800000); // 30-min window
  const payload = `${userId}:${timestamp}`;
  return createHmac('sha256', process.env.AUTH_SECRET!)
    .update(payload)
    .digest('hex');
}

export function validateCSRFToken(token: string, userId: string): boolean {
  try {
    if (!token || token.length !== 64) return false; // SHA-256 hex is 64 chars
    
    const currentTime = Math.floor(Date.now() / 1800000);
    const previousTime = currentTime - 1; // allow previous 30-min block
    
    // Try current time window
    const currentPayload = `${userId}:${currentTime}`;
    const currentToken = createHmac('sha256', process.env.AUTH_SECRET!)
      .update(currentPayload)
      .digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    const currentTokenBuffer = Buffer.from(currentToken, 'hex');
    const tokenBuffer = Buffer.from(token, 'hex');
    
    if (currentTokenBuffer.length !== tokenBuffer.length) {
      return false;
    }
    
    if (timingSafeEqual(currentTokenBuffer as unknown as Uint8Array, tokenBuffer as unknown as Uint8Array)) {
      return true;
    }
    
    // Try previous time window (for clock skew tolerance)
    const previousPayload = `${userId}:${previousTime}`;
    const previousToken = createHmac('sha256', process.env.AUTH_SECRET!)
      .update(previousPayload)
      .digest('hex');
    
    const previousTokenBuffer = Buffer.from(previousToken, 'hex');
    return timingSafeEqual(previousTokenBuffer as unknown as Uint8Array, tokenBuffer as unknown as Uint8Array);
  } catch {
    return false;
  }
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  userId: string;
  endpoint: string;
  failClosed?: boolean;
}

export async function rateLimit(
  options: RateLimitOptions
): Promise<{ success: boolean; limit: number; remaining: number; resetTime: number }> {
  const { userId, endpoint, maxRequests, windowMs, failClosed = false } = options;
  const now = new Date();
  
  const currentWindowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const currentWindowStart = new Date(currentWindowStartMs);
  const resetTime = currentWindowStartMs + windowMs;
  const cleanupBefore = new Date(currentWindowStartMs);
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Probabilistic cleanup: 1% of requests clean old records (99% overhead reduction)
      if (Math.random() < 0.01) {
        await tx.rateLimit.deleteMany({
          where: { 
            windowStart: { lt: cleanupBefore } 
          }
        });
      }
      
      // Upsert: create if first request in window, else increment count
      const rateLimitRecord = await tx.rateLimit.upsert({
        where: {
          userId_endpoint_windowStart: {
            userId,
            endpoint,
            windowStart: currentWindowStart
          }
        },
        update: {
          count: { increment: 1 }
        },
        create: {
          userId,
          endpoint,
          count: 1,
          windowStart: currentWindowStart
        }
      });

      if (rateLimitRecord.count > maxRequests) {
        return {
          success: false,
          limit: maxRequests,
          remaining: 0,
          resetTime
        };
      }

      return {
        success: true,
        limit: maxRequests,
        remaining: maxRequests - rateLimitRecord.count,
        resetTime
      };
    }, {
      isolationLevel: 'Serializable', // Prevents race conditions in concurrent requests
      timeout: 5000
    });

    return result;
  } catch (error) {
    console.error('Rate limit error:', error);
    
    // failClosed: true → deny (security), false → allow (availability)
    if (failClosed) {
      console.error(`Rate limit check failed for user ${userId} on critical endpoint ${endpoint} - DENYING request for security`);
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        resetTime
      };
    }
    
    console.warn(`Rate limit check failed for user ${userId} on ${endpoint} - allowing request`);
    return {
      success: true,
      limit: maxRequests,
      remaining: 0, // Assume worst case
      resetTime
    };
  }
}

export function addRateLimitHeaders(
  response: NextResponse, 
  rateLimitResult: { limit: number; remaining: number; resetTime: number }
): NextResponse {
  response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
  response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.floor(rateLimitResult.resetTime / 1000).toString());
  return response;
}

export function validateCipherFormat(cipher: string): { valid: boolean; error?: string } {
  if (!cipher || typeof cipher !== 'string') {
    return { valid: false, error: "Invalid cipher" };
  }

  try {
    const decoded = Buffer.from(cipher, 'base64');
    
    if (decoded.length < 50) {
      return { valid: false, error: "Invalid cipher format" };
    }

    const magicBytes = decoded.subarray(0, 2);
    if (magicBytes.toString() !== 'NP') {
      return { valid: false, error: "Invalid cipher format" };
    }

    const version = decoded[2];
    if (version !== 1) {
      return { valid: false, error: "Unsupported cipher version" };
    }

    const purpose = decoded[3];
    if (purpose !== 1) {
      return { valid: false, error: "Invalid cipher purpose" };
    }

    if (decoded.length < 45 + 1 + 12 + 16 + 32) {
      return { valid: false, error: "Incomplete cipher data" };
    }

    const kdfId = decoded[4];
    if (kdfId !== 1) {
      return { valid: false, error: "Unsupported key derivation function" };
    }

    const cipherId = decoded[5];
    if (cipherId !== 1) {
      return { valid: false, error: "Unsupported cipher algorithm" };
    }

    const flags = decoded[6];
    if (flags !== 1) {
      return { valid: false, error: "Invalid cipher flags" };
    }

    const iterations = decoded.readUInt32BE(7);
    if (iterations < 10000 || iterations > 1000000) {
      return { valid: false, error: "Invalid iteration count" };
    }

    // Check reserved bytes are zero
    const reserved = decoded.readUInt16BE(11);
    if (reserved !== 0) {
      return { valid: false, error: "Invalid cipher format" };
    }

    // Validate header hash (bytes 13-44 should be SHA-256 hash)
    const expectedHash = decoded.subarray(13, 45);
    const isAllZeros = expectedHash.every(byte => byte === 0);
    if (isAllZeros) {
      return { valid: false, error: "Invalid header hash" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid cipher structure" };
  }
}

export function generateSecureOTP(): string {
  // Generate a 6-digit OTP
  const randomValue = randomBytes(4).readUInt32BE(0);
  return (100000 + (randomValue % 900000)).toString();
}

export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://keyserver.ubuntu.com https://keys.openpgp.org; frame-ancestors 'none';");
  return response;
}
