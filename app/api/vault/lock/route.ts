import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { validateCSRFToken, rateLimit, addSecurityHeaders } from "@/lib/security";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 10,  // IP limit: 10 requests per minute
    userId: session.user.id,
    endpoint: 'vault-lock',
    userMaxRequests: 10  // User limit: 10 requests per minute
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

  if (!csrfToken || !validateCSRFToken(csrfToken, session.user.id)) {
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
