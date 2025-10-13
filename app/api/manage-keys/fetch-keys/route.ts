import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, validateCSRFToken, addSecurityHeaders } from "@/lib/security";
import { validateRequestSize, validateRequestBodySize } from "@/lib/request-limits";

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
    maxRequests: 60,  // IP limit: 60 requests per minute
    userId: session.user.id,
    endpoint: 'fetch-keys',
    userMaxRequests: 60  // User limit: 60 requests per minute
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
    return NextResponse.json({ error: "CSRF token required" }, { status: 403 });
  }

  if (!validateCSRFToken(csrfToken, session.user.id)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const vault = await prisma.vault.findUnique({ 
    where: { userId: session.user.id } 
  });
  if (!vault) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }

  const keys = await prisma.pGPKeys.findMany({ 
    where: { vaultId: vault.id } 
  });

  try {
    const responseKeys = keys.map((key: any) => ({
      id: key.id,
      privateKey: key.privateKey || "",
      privateKeyHash: key.privateKeyHash || "",
      publicKey: key.publicKey || "",
      publicKeyHash: key.publicKeyHash || "",
    }));

    const response = NextResponse.json({ keys: responseKeys });
    return addSecurityHeaders(response);
  } catch {
    return NextResponse.json({ error: "Key retrieval failed" }, { status: 500 });
  }
}
