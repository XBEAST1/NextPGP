import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, addSecurityHeaders } from "@/lib/security";
import { validateRequestSize } from "@/lib/request-limits";

export async function GET(req: Request) {
  const sizeError = validateRequestSize(req as any);
  if (sizeError) return sizeError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 60,  // IP limit: 60 requests per minute
    userId: session.user.id,
    endpoint: 'vault-check',
    userMaxRequests: 60  // User limit: 60 requests per minute
  }, req as any);

  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const vault = await prisma.vault.findUnique({ 
    where: { userId: session.user.id } 
  });

  if (vault) {
    const response = NextResponse.json({ 
      exists: true
    }, { status: 200 });
    return addSecurityHeaders(response);
  }

  const response = NextResponse.json({ 
    exists: false
  }, { status: 404 });
  return addSecurityHeaders(response);
}
