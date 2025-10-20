import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  rateLimit,
  validateCSRFToken,
  validateCipherFormat,
  addSecurityHeaders,
  addRateLimitHeaders,
} from "@/lib/security";
import { validateRequestSize, validateRequestBodySize } from "@/lib/request-limits";

export async function POST(req: Request) {
  const sizeError = validateRequestSize(req as any);
  if (sizeError) return sizeError;
  
  const jsonSizeError = await validateRequestBodySize(req as any);
  if (jsonSizeError) return jsonSizeError;

  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 60, // 60 requests per minute
    userId: session.user.id,
    endpoint: "manage-keys-post",
    failClosed: true
  });

  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const {
    encryptedPrivateKey,
    encryptedPublicKey,
    privateKeyHash,
    publicKeyHash,
    csrfToken,
  } = payload;

  if (!csrfToken || typeof csrfToken !== 'string') {
    return NextResponse.json({ error: "CSRF token required" }, { status: 403 });
  }

  if (!validateCSRFToken(csrfToken, session.user.id)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  if (!encryptedPrivateKey && !encryptedPublicKey) {
    return NextResponse.json(
      { message: "At least one key (private or public) is required" },
      { status: 400 }
    );
  }

  if (encryptedPrivateKey) {
    const validation = validateCipherFormat(encryptedPrivateKey);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }
  if (encryptedPublicKey) {
    const validation = validateCipherFormat(encryptedPublicKey);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  const vault = await prisma.vault.findUnique({
    where: { userId: session.user.id },
  });
  if (!vault) {
    return NextResponse.json(
      { error: "Vault not found for current user" },
      { status: 404 }
    );
  }

  let existingKey = null;
  if (privateKeyHash) {
    existingKey = await prisma.pGPKeys.findUnique({
      where: { privateKeyHash, vault: { userId: session.user.id } },
    });
  } else if (publicKeyHash) {
    existingKey = await prisma.pGPKeys.findUnique({
      where: { publicKeyHash, vault: { userId: session.user.id } },
    });
  }

  if (existingKey) {
    return NextResponse.json(
      { message: "Key already backed up." },
      { status: 200 }
    );
  }

  try {
    const storedKey = await prisma.pGPKeys.create({
      data: {
        vaultId: vault.id,
        ...(encryptedPrivateKey && { privateKey: encryptedPrivateKey }),
        ...(encryptedPublicKey && { publicKey: encryptedPublicKey }),
        ...(privateKeyHash && { privateKeyHash }),
        ...(publicKeyHash && { publicKeyHash }),
      },
    });

    const response = NextResponse.json(
      { message: "Key stored successfully", key: storedKey },
      { status: 200 }
    );
    addRateLimitHeaders(response, rateLimitResult);
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Failed to store key data:", error);
    return NextResponse.json({ error: "Key storage failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const sizeError = validateRequestSize(req as any);
    if (sizeError) return sizeError;

    let payload;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const session = await auth();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = await rateLimit({
      windowMs: 60000,
      maxRequests: 60, // 60 requests per minute
      userId: session.user.id,
      endpoint: "manage-keys-delete"
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const { keyId, publicKeyHash, privateKeyHash, csrfToken } = payload;

    if (!csrfToken || typeof csrfToken !== 'string') {
      return NextResponse.json({ error: "CSRF token required" }, { status: 403 });
    }

    if (!validateCSRFToken(csrfToken, session.user.id)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    if (!keyId || (!publicKeyHash && !privateKeyHash)) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const vault = await prisma.vault.findUnique({
      where: { userId: session.user.id },
    });
    if (!vault) {
      return NextResponse.json(
        { error: "Vault not found for current user" },
        { status: 404 }
      );
    }

    let keyToDelete = null;
    if (publicKeyHash) {
      keyToDelete = await prisma.pGPKeys.findUnique({
        where: { publicKeyHash, vault: { userId: session.user.id } },
      });
    } else if (privateKeyHash) {
      keyToDelete = await prisma.pGPKeys.findUnique({
        where: { privateKeyHash, vault: { userId: session.user.id } },
      });
    }

    if (!keyToDelete) {
      return NextResponse.json(
        { error: "Key not found in user's vault" },
        { status: 404 }
      );
    }

    await prisma.pGPKeys.delete({
      where: { id: keyId },
    });

    const response = NextResponse.json(
      { message: "Key deleted successfully" },
      { status: 200 }
    );
    addRateLimitHeaders(response, rateLimitResult);
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Error deleting key:", error);
    return NextResponse.json({ error: "Key deletion failed" }, { status: 500 });
  }
}
