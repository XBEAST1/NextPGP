import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendEmail } from "@/lib/gmail";
import Vault from "@/models/Vault";
import argon2 from "argon2";

export async function POST() {
  const session = await auth();

  if (!session?.user?.email || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

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
          Please use the following One-Time Password (OTP) to confirm your request:
        </p>
        <div style="font-size: 24px; font-weight: bold; margin: 20px 0; color: #cc0000;">
          ${otp}
        </div>
        <p style="font-size: 16px; color: #555;">
          If this wasn't you, please secure your account immediately.
        </p>
        <p style="font-size: 14px; color: #999;">
          Thank you,<br/>Support Team
        </p>
      </div>
    `;

    await sendEmail(
      session.user.email,
      "Vault Deletion Confirmation - Your OTP Code",
      emailContent
    );

    // Update the vault for this user with the OTP and expiry (5 minutes from now)
    await Vault.findOneAndUpdate(
      { userId: session.user.id },
      { deleteOtp: otpHash, otpExpiresAt: new Date(Date.now() + 300000) }
    );

    return NextResponse.json({
      message: "Email sent successfully"
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
