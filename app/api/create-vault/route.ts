import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateCipherFormat, rateLimit, validateCSRFToken, addSecurityHeaders, addRateLimitHeaders } from "@/lib/security";
import { validateRequestSize, validateRequestBodySize } from "@/lib/request-limits";

export async function GET() {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 10,  // 10 requests per minute
    userId: session.user.id,
    endpoint: 'create-vault-get'
  });

  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Find any vault for this user
  const vault = await prisma.vault.findUnique({ 
    where: { userId: session.user.id } 
  });

  const response = NextResponse.json({ 
    exists: Boolean(vault)
  });
  addRateLimitHeaders(response, rateLimitResult);
  return addSecurityHeaders(response);
}

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
    maxRequests: 10,  // 10 requests per minute
    userId: session.user.id,
    endpoint: 'create-vault-post',
    failClosed: true
  });

  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { verificationCipher, csrfToken } = payload;
  
  if (!csrfToken || typeof csrfToken !== 'string') {
    return NextResponse.json(
      { error: "CSRF token required" },
      { status: 403 }
    );
  }

  const isValidCSRF = validateCSRFToken(csrfToken, session.user.id);
  if (!isValidCSRF) {
    return NextResponse.json(
      { error: "Invalid CSRF token" },
      { status: 403 }
    );
  }

  const validation = validateCipherFormat(verificationCipher);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  try {
    const vault = await prisma.$transaction(async (tx) => {
        const existingVault = await tx.vault.findUnique({ 
          where: { userId: session.user!.id } 
        });
      if (existingVault) {
        throw new Error("Vault already exists");
      }

      // Create the vault
      const userId = session.user!.id;
      return await tx.vault.create({
        data: {
          name: session.user!.name ? `${session.user!.name}'s Vault` : "Vault",
          verificationCipher,
          userId: userId as string,
        },
      });
    });

    const response = NextResponse.json({ vault });
    addRateLimitHeaders(response, rateLimitResult);
    return addSecurityHeaders(response);
  } catch (error) {
    if (error instanceof Error && error.message === "Vault already exists") {
      return NextResponse.json(
        { error: "Vault already exists" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Vault creation failed" },
      { status: 500 }
    );
  }
}
