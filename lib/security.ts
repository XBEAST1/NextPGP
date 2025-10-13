import { createHmac, randomBytes } from "crypto";
import { NextRequest, NextResponse } from 'next/server';
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
    const currentTime = Math.floor(Date.now() / 1800000);
    const previousTime = currentTime - 1; // allow previous 30-min block
    
    // Try current time window
    const currentPayload = `${userId}:${currentTime}`;
    const currentToken = createHmac('sha256', process.env.AUTH_SECRET!)
      .update(currentPayload)
      .digest('hex');
    
    if (currentToken === token) return true;
    
    // Try previous time window (for clock skew tolerance)
    const previousPayload = `${userId}:${previousTime}`;
    const previousToken = createHmac('sha256', process.env.AUTH_SECRET!)
      .update(previousPayload)
      .digest('hex');
    
    return previousToken === token;
  } catch {
    return false;
  }
}

interface IPRateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

interface UserRateLimitOptions extends IPRateLimitOptions {
  userId: string;
  endpoint: string;
  userMaxRequests: number;
}

export async function ipRateLimit(options: IPRateLimitOptions, request: NextRequest): Promise<{ success: boolean; limit: number; remaining: number; resetTime: number }> {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const now = new Date();

  try {
    // Clean up expired entries first
    await prisma.iPRateLimit.deleteMany({
      where: {
        resetTime: {
          lt: now
        }
      }
    });

    // Get or create rate limit entry
    const existing = await prisma.iPRateLimit.findUnique({
      where: { ip }
    });

    if (!existing || existing.resetTime < now) {
      // First request or window expired
      const resetTime = new Date(now.getTime() + options.windowMs);
      
      await prisma.iPRateLimit.upsert({
        where: { ip },
        update: {
          count: 1,
          resetTime,
          lastRequest: now
        },
        create: {
          ip,
          count: 1,
          resetTime,
          lastRequest: now
        }
      });
      
      return {
        success: true,
        limit: options.maxRequests,
        remaining: options.maxRequests - 1,
        resetTime: resetTime.getTime()
      };
    }

    if (existing.count >= options.maxRequests) {
      // Rate limit exceeded
      return {
        success: false,
        limit: options.maxRequests,
        remaining: 0,
        resetTime: existing.resetTime.getTime()
      };
    }

    // Increment counter
    await prisma.iPRateLimit.update({
      where: { ip },
      data: {
        count: existing.count + 1,
        lastRequest: now
      }
    });

    return {
      success: true,
      limit: options.maxRequests,
      remaining: options.maxRequests - (existing.count + 1),
      resetTime: existing.resetTime.getTime()
    };
  } catch {
    return {
      success: true,
      limit: options.maxRequests,
      remaining: options.maxRequests - 1,
      resetTime: now.getTime() + options.windowMs
    };
  }
}

export async function userRateLimit(
  userId: string, 
  endpoint: string,
  maxRequests: number,
  windowMs: number
): Promise<{ success: boolean; limit: number; remaining: number; resetTime: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  
  try {
    // Clean up old entries (runs in background)
    await prisma.userRateLimit.deleteMany({
      where: { 
        windowStart: { lt: windowStart } 
      }
    });
    
    // Get or create rate limit entry
    const existing = await prisma.userRateLimit.findUnique({
      where: {
        userId_endpoint_windowStart: {
          userId,
          endpoint,
          windowStart: now
        }
      }
    });

    if (!existing) {
      // First request in this window
      await prisma.userRateLimit.create({
        data: {
        userId,
        endpoint,
        count: 1,
        windowStart: now
      }
    });
    
      return {
        success: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        resetTime: now.getTime() + windowMs
      };
    }

    if (existing.count >= maxRequests) {
      // Rate limit exceeded
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        resetTime: existing.windowStart.getTime() + windowMs
      };
    }

    // Increment counter
    await prisma.userRateLimit.update({
      where: {
        userId_endpoint_windowStart: {
          userId,
          endpoint,
          windowStart: now
        }
      },
      data: {
        count: existing.count + 1
      }
    });

    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - (existing.count + 1),
      resetTime: existing.windowStart.getTime() + windowMs
    };
  } catch {
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetTime: now.getTime() + windowMs
    };
  }
}

// Combined rate limiting - checks both user and IP limits
export async function rateLimit(
  options: UserRateLimitOptions,
  request: NextRequest
): Promise<{ success: boolean; limit: number; remaining: number; resetTime: number }> {
  const ipResult = await ipRateLimit(options, request);
  if (!ipResult.success) {
    return ipResult;
  }

  const userResult = await userRateLimit(
    options.userId,
    options.endpoint,
    options.userMaxRequests,
    options.windowMs
  );
  if (!userResult.success) {
    return userResult;
  }
  
  return {
    success: true,
    limit: Math.min(ipResult.limit, userResult.limit),
    remaining: Math.min(ipResult.remaining, userResult.remaining),
    resetTime: Math.min(ipResult.resetTime, userResult.resetTime)
  };
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
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://keyserver.ubuntu.com https://keys.openpgp.org; frame-ancestors 'none';");
  return response;
}
