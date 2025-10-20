import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateCSRFToken, rateLimit, addSecurityHeaders, addRateLimitHeaders } from "@/lib/security";
import { validateRequestSize, validateRequestBodySize } from "@/lib/request-limits";
import argon2 from "argon2";

export async function POST(request: Request) {
  try {
    const sizeError = validateRequestSize(request as any);
    if (sizeError) return sizeError;
    
    const jsonSizeError = await validateRequestBodySize(request as any);
    if (jsonSizeError) return jsonSizeError;

    const session = await auth();
    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = await rateLimit({
      windowMs: 60000,
      maxRequests: 5,  // 5 requests per minute
      userId: session.user.id,
      endpoint: 'verify-otp',
      failClosed: true
    });

    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const { otp, csrfToken } = payload;

    if (!csrfToken || typeof csrfToken !== 'string') {
      return NextResponse.json({ error: "CSRF token required" }, { status: 403 });
    }

    if (!validateCSRFToken(csrfToken, session.user.id)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }
    if (!otp) {
      return NextResponse.json({ error: "OTP is required" }, { status: 400 });
    }

    const vault = await prisma.vault.findUnique({ 
      where: { userId: session.user.id } 
    });
    if (!vault) {
      return NextResponse.json({ error: "Vault Not Found" }, { status: 404 });
    }

    if (!vault.deleteOtp || !vault.otpExpiresAt) {
      return NextResponse.json({ error: "OTP Not Generated" }, { status: 400 });
    }

    if (new Date() > vault.otpExpiresAt) {
      return NextResponse.json({ error: "OTP Expired" }, { status: 400 });
    }

    const isOtpValid = await argon2.verify(vault.deleteOtp, otp);
    if (!isOtpValid) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    const response = NextResponse.json({ message: "OTP verified successfully" });
    addRateLimitHeaders(response, rateLimitResult);
    return addSecurityHeaders(response);
  } catch {
    return NextResponse.json({ error: "OTP verification failed" }, { status: 500 });
  }
}