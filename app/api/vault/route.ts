import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, validateCSRFToken, addSecurityHeaders, addRateLimitHeaders } from "@/lib/security";
import { validateRequestSize, validateRequestBodySize } from "@/lib/request-limits";

export async function GET() {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 20,  // 20 requests per minute
    userId: session.user.id,
    endpoint: 'vault-get'
  });

  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const vault = await prisma.vault.findUnique({ 
    where: { userId: session.user.id } 
  });

  const response = NextResponse.json({
    exists: Boolean(vault),
    verificationCipher: vault ? vault.verificationCipher : null
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
    maxRequests: 20,  // 20 requests per minute
    userId: session.user.id,
    endpoint: 'vault-post'
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

  const { csrfToken } = payload;

  if (!csrfToken || typeof csrfToken !== 'string') {
    return NextResponse.json(
      { error: "CSRF token required" },
      { status: 403 }
    );
  }

  if (!validateCSRFToken(csrfToken, session.user.id)) {
    return NextResponse.json(
      { error: "Invalid CSRF token" },
      { status: 403 }
    );
  }

  const vault = await prisma.vault.findUnique({ 
    where: { userId: session.user.id } 
  });

  if (!vault) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }

  const response = NextResponse.json(
    { message: "Vault opened successfully" },
    { status: 200 }
  );
  addRateLimitHeaders(response, rateLimitResult);
  return addSecurityHeaders(response);
}

export async function DELETE(req: Request) {
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
    maxRequests: 20,  // 20 requests per minute
    userId: session.user.id,
    endpoint: 'vault-delete',
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

  const { csrfToken } = payload;

  if (!csrfToken || typeof csrfToken !== 'string') {
    return NextResponse.json(
      { error: "CSRF token required" },
      { status: 403 }
    );
  }

  if (!validateCSRFToken(csrfToken, session.user.id)) {
    return NextResponse.json(
      { error: "Invalid CSRF token" },
      { status: 403 }
    );
  }

  try {
    const vault = await prisma.vault.findUnique({ 
      where: { userId: session.user.id } 
    });

    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    await prisma.vault.delete({ 
      where: { id: vault.id } 
    });

    const response = NextResponse.json(
      { message: "Vault deleted successfully" },
      { status: 200 }
    );
    addRateLimitHeaders(response, rateLimitResult);
    return addSecurityHeaders(response);
  } catch {
    return NextResponse.json(
      { error: "Vault deletion failed" },
      { status: 500 }
    );
  }
}
