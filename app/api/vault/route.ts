import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, generateCSRFToken, validateCSRFToken, addSecurityHeaders } from "@/lib/security";

export async function GET(req: Request) {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 10,  // IP limit: 10 requests per minute
    userId: session.user.id,
    endpoint: 'vault-get',
    userMaxRequests: 10  // User limit: 10 requests per minute
  }, req as any);

  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const vault = await prisma.vault.findUnique({ 
    where: { userId: session.user.id } 
  });

  const csrfToken = generateCSRFToken(session.user.id);

  const response = NextResponse.json({
    exists: Boolean(vault),
    verificationCipher: vault ? vault.verificationCipher : null,
    csrfToken
  });
  return addSecurityHeaders(response);
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 10,  // IP limit: 10 requests per minute
    userId: session.user.id,
    endpoint: 'vault-post',
    userMaxRequests: 10  // User limit: 10 requests per minute
  }, req as any);

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
  return addSecurityHeaders(response);
}

export async function DELETE(req: Request) {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 10,  // IP limit: 10 requests per minute
    userId: session.user.id,
    endpoint: 'vault-delete',
    userMaxRequests: 10  // User limit: 10 requests per minute
  }, req as any);

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
    return addSecurityHeaders(response);
  } catch {
    return NextResponse.json(
      { error: "Vault deletion failed" },
      { status: 500 }
    );
  }
}
