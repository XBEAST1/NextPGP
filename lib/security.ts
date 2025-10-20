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
      isolationLevel: 'ReadCommitted',
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

// Constants for validating cipher format
const MAGIC = [0x4e, 0x50]; // 'NP' for "NextPGP"
const ENCRYPTION_VERSION = 0x01;
const PURPOSE = 0x01;
const KDF_ID = 0x01; // 0x01 = PBKDF2
const CIPHER_ID = 0x01; // 0x01 = AES-GCM
const FLAGS = 0x01; // Compression used flag
const RESERVED = [0x00, 0x00]; // 2 bytes reserved for future extensions
const DEFAULT_ITERATIONS = 1_000_000; // PBKDF2 iteration count

// Lengths for validating cipher format
const SALT_LENGTH = 16; // 16 bytes salt
const IV_LENGTH = 12; // 12 bytes IV for AES-GCM
const HMAC_LENGTH = 32; // 32 bytes HMAC-SHA256 tag
const HEADER_LENGTH = 2 + 1 + 1 + 1 + 1 + 1 + 4 + 2 + 32; // 45 bytes total

// Byte offsets in header for validating cipher format
const HEADER_INDEX = {
  MAGIC: 0,
  VERSION: 2,
  PURPOSE: 3,
  KDF_ID: 4,
  CIPHER_ID: 5,
  FLAGS: 6,
  ITERATIONS: 7, // 4 bytes: 7-10
  RESERVED: 11, // 2 bytes: 11-12
  HEADER_HASH: 13, // 32 bytes: 13-44
};

// Minimum valid cipher length: header + at least 1 byte encrypted + IV + salt + HMAC
const MIN_CIPHER_LENGTH = HEADER_LENGTH + 1 + IV_LENGTH + SALT_LENGTH + HMAC_LENGTH;

export function validateCipherFormat(cipher: string): { valid: boolean; error?: string } {
  if (!cipher || typeof cipher !== 'string') {
    return { valid: false, error: "Invalid cipher" };
  }

  try {
    const decoded = Buffer.from(cipher, 'base64');
    
    // Ensure minimum length: 45 (header) + 1 (min encrypted) + 12 (IV) + 16 (salt) + 32 (HMAC) = 106 bytes
    if (decoded.length < MIN_CIPHER_LENGTH) {
      return { valid: false, error: "Invalid cipher format" };
    }

    // Validate magic bytes: 0x4E, 0x50 ('NP')
    if (decoded[HEADER_INDEX.MAGIC] !== MAGIC[0] || decoded[HEADER_INDEX.MAGIC + 1] !== MAGIC[1]) {
      return { valid: false, error: "Invalid cipher format" };
    }

    // Validate version: 0x01
    if (decoded[HEADER_INDEX.VERSION] !== ENCRYPTION_VERSION) {
      return { valid: false, error: "Unsupported cipher version" };
    }

    // Validate purpose: 0x01
    if (decoded[HEADER_INDEX.PURPOSE] !== PURPOSE) {
      return { valid: false, error: "Invalid cipher purpose" };
    }

    // Validate KDF ID: 0x01 (PBKDF2)
    if (decoded[HEADER_INDEX.KDF_ID] !== KDF_ID) {
      return { valid: false, error: "Unsupported key derivation function" };
    }

    // Validate cipher ID: 0x01 (AES-GCM)
    if (decoded[HEADER_INDEX.CIPHER_ID] !== CIPHER_ID) {
      return { valid: false, error: "Unsupported cipher algorithm" };
    }

    // Validate flags: 0x01 (compression enabled)
    if (decoded[HEADER_INDEX.FLAGS] !== FLAGS) {
      return { valid: false, error: "Invalid cipher flags" };
    }

    // Validate reserved bytes are zero (2 bytes at offset 11-12)
    const reserved1 = decoded[HEADER_INDEX.RESERVED];
    const reserved2 = decoded[HEADER_INDEX.RESERVED + 1];
    if (reserved1 !== RESERVED[0] || reserved2 !== RESERVED[1]) {
      return { valid: false, error: "Invalid cipher format" };
    }

    // Validate iteration count (4 bytes, big-endian at offset 7-10)
    const iterations = decoded.readUInt32BE(HEADER_INDEX.ITERATIONS);
    if (iterations === 0 || iterations > DEFAULT_ITERATIONS) {
      return { valid: false, error: "Invalid iteration count" };
    }

    // Validate header hash exists and is not all zeros (32 bytes at offset 13-44)
    const headerHash = decoded.subarray(HEADER_INDEX.HEADER_HASH, HEADER_INDEX.HEADER_HASH + 32);
    const isAllZeros = headerHash.every(byte => byte === 0);
    if (isAllZeros) {
      return { valid: false, error: "Invalid header hash" };
    }

    // All validations passed
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
