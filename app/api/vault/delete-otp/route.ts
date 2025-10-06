import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendEmail } from "@/lib/gmail";
import { prisma } from "@/lib/prisma";
import { validateCSRFToken, rateLimit, generateSecureOTP, addSecurityHeaders } from "@/lib/security";
import argon2 from "argon2";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    windowMs: 60000,
    maxRequests: 5,  // IP limit: 5 requests per minute
    userId: session.user.id,
    endpoint: 'delete-otp',
    userMaxRequests: 5  // User limit: 5 requests per minute
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

  // Generate a 6-digit OTP
  const otp = generateSecureOTP();

  try {
    const otpHash = await argon2.hash(otp, {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 2 ** 16,
      parallelism: 1,
    });

    const emailContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; background-color: #f9f9f9;">
      <h2 style="color: #333;">Hello ${session.user.name || "User"}!</h2>
      <p style="font-size: 16px; color: #555;">
        We received a request to delete your vault.
      </p>
      <p style="font-size: 16px; color: #555;">
        Please use the following One-Time Password (OTP) to confirm your request: 🔑
      </p>
      <div style="font-size: 24px; font-weight: bold; margin: 20px 0; color: #cc0000;">
        ${otp}
      </div>
      <p style="font-size: 16px; color: #555; margin-bottom: 10px;">
        Do not share this OTP with anyone. ⚠️
      </p>
      <p style="font-size: 16px; color: #555; margin-top: 10px;">
        If this wasn't you, take immediate action to secure your account. 🔒
      </p>
      <p style="font-size: 14px; color: #999; margin-top: 15px;">
        Thank you for choosing NextPGP,<br/>Best regards, XBEAST 🖤✨
      </p>
    </div>
    `;

    await sendEmail(
      session.user.email,
      "Vault Deletion Confirmation - Your OTP Code",
      emailContent
    );

    // Update the vault for this user with the OTP and expiry (5 minutes from now)
    await prisma.vault.updateMany({
      where: { userId: session.user.id },
      data: { 
        deleteOtp: otpHash, 
        otpExpiresAt: new Date(Date.now() + 300000) 
      }
    });

    // Mask the user's email show only first 3 and last 3 characters of the local part
    const [local, domain] = session.user.email.split("@");
    const localMasked =
      local.length > 6
        ? local.slice(0, 3) + "*****" + local.slice(-3)
        : local;
    const maskedEmail = `${localMasked}@${domain}`;

    const response = NextResponse.json({
      message: "Email sent successfully",
      maskedEmail,
    });
    return addSecurityHeaders(response);
  } catch (error) {
    console.error('Error generating OTP:', error);
    return NextResponse.json(
      { error: "OTP generation failed" },
      { status: 500 }
    );
  }
}
