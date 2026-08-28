import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { validateCSRFToken, rateLimit, addSecurityHeaders, addRateLimitHeaders } from "@/lib/security";
import { validateBody, CsrfOnlySchema, ApiMessageResponse } from "@/lib/validations/api";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 20,  // 20 requests per minute
    userId: session.user.id,
    endpoint: 'vault-lock'
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

  // Clear the vault_token cookie
  const res = NextResponse.json<ApiMessageResponse>({ message: "Vault locked successfully" });
  res.cookies.delete({
    name: "vault_token",
    path: "/",
  });

  addRateLimitHeaders(res, rateLimitResult);
  return addSecurityHeaders(res);
}
