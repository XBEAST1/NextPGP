import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateCSRFToken, rateLimit, addSecurityHeaders } from "@/lib/security";
import { validateRequestSize, validateRequestBodySize } from "@/lib/request-limits";
import jwt from "jsonwebtoken";

export async function POST(request: Request) {
  const sizeError = validateRequestSize(request as any);
  if (sizeError) return sizeError;
  
  const jsonSizeError = await validateRequestBodySize(request as any);
  if (jsonSizeError) return jsonSizeError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 20,  // IP limit: 20 requests per minute
    userId: session.user.id,
    endpoint: 'vault-unlock',
    userMaxRequests: 20  // User limit: 20 requests per minute
  }, request as any);

  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { csrfToken } = body;

  if (!csrfToken || typeof csrfToken !== 'string') {
    return NextResponse.json({ error: "CSRF token required" }, { status: 403 });
  }

  if (!validateCSRFToken(csrfToken, session.user.id)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  // Update lastActivity in the DB
  await prisma.vault.updateMany({
    where: { userId: session.user.id },
    data: { lastActivity: new Date() }
  });

  // Issue a vault‑unlock JWT for 30 minutes
  const token = jwt.sign(
    { sub: session.user.id, type: "vault-unlock" },
    process.env.AUTH_SECRET!,
    { expiresIn: "30m" }
  );

  // Set HttpOnly cookie for middleware to verify
  const res = NextResponse.json({ message: "Vault unlocked successfully" });
  res.cookies.set({
    name: "vault_token",
    value: token,
    httpOnly: true,
    path: "/",
    maxAge: 30 * 60, // 30 minutes
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  return addSecurityHeaders(res);
}
