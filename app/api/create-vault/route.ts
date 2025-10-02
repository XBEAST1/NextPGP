import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find any vault for this user
  const vault = await prisma.vault.findFirst({ 
    where: { userId: session.user.id } 
  });

  return NextResponse.json({ exists: Boolean(vault) });
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if vault already exists for this user
  const existingVault = await prisma.vault.findFirst({ 
    where: { userId: session.user.id } 
  });
  if (existingVault) {
    return NextResponse.json(
      { error: "Vault already exists" },
      { status: 400 }
    );
  }

  const { verificationCipher } = await req.json();

  try {
    const vault = await prisma.vault.create({
      data: {
        name: session.user.name ? `${session.user.name}'s Vault` : "Vault",
        verificationCipher,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ vault });
  } catch (error) {
    console.error("Vault creation failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
