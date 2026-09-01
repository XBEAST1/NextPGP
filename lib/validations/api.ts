import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequestSize, validateRequestBodySize } from "@/lib/request-limits";

// ============================================================================
// 1. Security Primitives & Field Schemas
// ============================================================================

export const csrfTokenSchema = z
  .string({ message: "CSRF token required" })
  .length(64, { message: "Invalid CSRF token format" })
  .regex(/^[a-f0-9]{64}$/i, { message: "Invalid CSRF token format" });

export const sha256HashSchema = z
  .string({ message: "Hash required" })
  .length(64, { message: "Invalid hash format" })
  .regex(/^[a-f0-9]{64}$/i, { message: "Invalid hash format" });

export const otpSchema = z
  .string({ message: "OTP is required" })
  .length(6, { message: "Invalid OTP format" })
  .regex(/^\d{6}$/, { message: "Invalid OTP format" });

export const cipherStringSchema = z
  .string({ message: "Cipher text required" })
  .min(1, { message: "Cipher text cannot be empty" });

// ============================================================================
// 2. Request Schemas
// ============================================================================

/** Schema for /api/create-vault (POST) */
export const CreateVaultSchema = z.object({
  verificationCipher: cipherStringSchema,
  csrfToken: csrfTokenSchema,
}).strict();

/** Schema for /api/vault, /api/vault/unlock, /api/vault/lock, /api/vault/delete-otp, /api/manage-keys/fetch-keys (POST/DELETE) */
export const CsrfOnlySchema = z.object({
  csrfToken: csrfTokenSchema,
}).strict();

/** Schema for /api/vault/verify-otp (POST) */
export const VerifyOtpSchema = z.object({
  otp: otpSchema,
  csrfToken: csrfTokenSchema,
}).strict();

/** Schema for /api/manage-keys (POST) */
export const ManageKeysPostSchema = z
  .object({
    encryptedPrivateKey: z.string().optional(),
    encryptedPublicKey: z.string().optional(),
    privateKeyHash: sha256HashSchema.optional(),
    publicKeyHash: sha256HashSchema.optional(),
    csrfToken: csrfTokenSchema,
  })
  .strict()
  .refine(
    (data) => Boolean(data.encryptedPrivateKey || data.encryptedPublicKey),
    {
      message: "At least one key (private or public) is required",
    }
  );

/** Schema for /api/manage-keys (DELETE) */
export const ManageKeysDeleteSchema = z
  .object({
    keyId: z.string({ message: "Missing required parameters" }).min(1, { message: "Missing required parameters" }),
    publicKeyHash: sha256HashSchema.optional(),
    privateKeyHash: sha256HashSchema.optional(),
    csrfToken: csrfTokenSchema,
  })
  .strict()
  .refine(
    (data) => Boolean(data.publicKeyHash || data.privateKeyHash),
    {
      message: "Missing required parameters",
    }
  );

/** Schema for /api/manage-keys/fetch-keys (POST) */
export const FetchKeysSchema = z
  .object({
    offset: z.number().optional(),
    limit: z.number().optional(),
    csrfToken: csrfTokenSchema,
  })
  .strict();

/** Schema for /api/keyserver (POST) */
export const KeyserverPublishSchema = z.object({
  publicKey: z
    .string({ message: "Missing publicKey in request body" })
    .min(1, { message: "Missing publicKey in request body" }),
}).strict();

/** Schema for /api/keyserver (GET search query) */
export const KeyserverSearchQuerySchema = z.object({
  search: z
    .string({ message: "Missing search parameter" })
    .min(1, { message: "Missing search parameter" })
    .max(500, { message: "Search parameter too long" }),
});

// ============================================================================
// 3. Inferred TypeScript Types
// ============================================================================

export type CreateVaultInput = z.infer<typeof CreateVaultSchema>;
export type CsrfOnlyInput = z.infer<typeof CsrfOnlySchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ManageKeysPostInput = z.infer<typeof ManageKeysPostSchema>;
export type ManageKeysDeleteInput = z.infer<typeof ManageKeysDeleteSchema>;
export type FetchKeysInput = z.infer<typeof FetchKeysSchema>;
export type KeyserverPublishInput = z.infer<typeof KeyserverPublishSchema>;
export type KeyserverSearchQueryInput = z.infer<typeof KeyserverSearchQuerySchema>;

// Response interfaces for structured API returns
export interface CsrfTokenResponse {
  csrfToken: string;
}

export interface VaultExistsResponse {
  exists: boolean;
  verificationCipher?: string | null;
}

export interface VaultDeleteOtpResponse {
  message: string;
  maskedEmail: string;
}

export interface FetchKeysResponseKey {
  id: string;
  privateKey: string;
  privateKeyHash: string;
  publicKey: string;
  publicKeyHash: string;
}

export interface FetchKeysResponse {
  keys: FetchKeysResponseKey[];
}

export interface ApiMessageResponse {
  message: string;
  key?: unknown;
  vault?: unknown;
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
}

// ============================================================================
// 4. Standard Validation Helper
// ============================================================================

export type ValidationResult<T> =
  | { success: true; data: T; errorResponse: null }
  | { success: false; data: null; errorResponse: NextResponse };

/**
 * Validates request size, parses JSON safely, and executes Zod schema parsing.
 * Returns { success: true, data, errorResponse: null } or { success: false, data: null, errorResponse: NextResponse }.
 */
export async function validateBody<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<ValidationResult<T>> {
  const sizeError = validateRequestSize(req as any);
  if (sizeError) return { success: false, data: null, errorResponse: sizeError };

  const jsonSizeError = await validateRequestBodySize(req as any);
  if (jsonSizeError) return { success: false, data: null, errorResponse: jsonSizeError };

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return {
      success: false,
      data: null,
      errorResponse: NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(rawBody);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const errorMessage = firstIssue?.message || "Invalid request payload";
    return {
      success: false,
      data: null,
      errorResponse: NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data, errorResponse: null };
}
