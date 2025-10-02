import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import argon2 from "argon2";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { otp } = await request.json();
    if (!otp) {
      return NextResponse.json({ error: "OTP is required" }, { status: 400 });
    }

    const vault = await prisma.vault.findFirst({ 
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

    return NextResponse.json({ message: "OTP Verified Successfully" });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}