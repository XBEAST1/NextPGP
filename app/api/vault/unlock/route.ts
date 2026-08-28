import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateCSRFToken, rateLimit, addSecurityHeaders, addRateLimitHeaders } from "@/lib/security";
import { validateBody, CsrfOnlySchema, ApiMessageResponse } from "@/lib/validations/api";
import jwt from "jsonwebtoken";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 20,  // 20 requests per minute
    userId: session.user.id,
    endpoint: 'vault-unlock',
    failClosed: true 
  });

  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const parsed = await validateBody(request, CsrfOnlySchema);
  if (!parsed.success) {
    return parsed.errorResponse;
  }

  const { csrfToken } = parsed.data;

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
  const res = NextResponse.json<ApiMessageResponse>({ message: "Vault unlocked successfully" });
  res.cookies.set({
    name: "vault_token",
    value: token,
    httpOnly: true,
    path: "/",
    maxAge: 30 * 60, // 30 minutes
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  addRateLimitHeaders(res, rateLimitResult);
  return addSecurityHeaders(res);
}
