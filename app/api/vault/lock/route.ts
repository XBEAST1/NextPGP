import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { validateCSRFToken, rateLimit, addSecurityHeaders } from "@/lib/security";
import { validateRequestSize, validateRequestBodySize } from "@/lib/request-limits";

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
    endpoint: 'vault-lock',
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

  // Clear the vault_token cookie
  const res = NextResponse.json({ message: "Vault locked successfully" });
  res.cookies.delete({
    name: "vault_token",
    path: "/",
  });

  return addSecurityHeaders(res);
}
