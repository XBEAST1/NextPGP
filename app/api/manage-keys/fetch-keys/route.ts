import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, validateCSRFToken, addSecurityHeaders, addRateLimitHeaders } from "@/lib/security";
import { validateBody, FetchKeysSchema, FetchKeysResponse, FetchKeysResponseKey } from "@/lib/validations/api";

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 60,  // 60 requests per minute
    userId: session.user.id,
    endpoint: 'fetch-keys'
  });

  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const parsed = await validateBody(req, FetchKeysSchema);
  if (!parsed.success) {
    return parsed.errorResponse;
  }

  const { csrfToken } = parsed.data;

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
    const responseKeys: FetchKeysResponseKey[] = keys.map((key) => ({
      id: key.id,
      privateKey: key.privateKey || "",
      privateKeyHash: key.privateKeyHash || "",
      publicKey: key.publicKey || "",
      publicKeyHash: key.publicKeyHash || "",
    }));

    const response = NextResponse.json<FetchKeysResponse>({ keys: responseKeys });
    addRateLimitHeaders(response, rateLimitResult);
    return addSecurityHeaders(response);
  } catch {
    return NextResponse.json({ error: "Key retrieval failed" }, { status: 500 });
  }
}
