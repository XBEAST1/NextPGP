import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit, generateCSRFToken, addSecurityHeaders } from "@/lib/security";
import { validateRequestSize } from "@/lib/request-limits";

export async function GET(req: Request) {
  const sizeError = validateRequestSize(req as any);
  if (sizeError) return sizeError;

  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 200,  // IP limit: 200 requests per minute
    userId: session.user.id,
    endpoint: 'csrf-token',
    userMaxRequests: 200  // User limit: 200 requests per minute
  }, req as any);

  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const csrfToken = generateCSRFToken(session.user.id);

  const response = NextResponse.json({
    csrfToken
  });
  return addSecurityHeaders(response);
}
