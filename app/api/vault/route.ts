import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vault = await prisma.vault.findFirst({ 
    where: { userId: session.user.id } 
  });

  return NextResponse.json({
    exists: Boolean(vault),
    verificationCipher: vault ? vault.verificationCipher : null,
  });
}

export async function POST() {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vault = await prisma.vault.findFirst({ 
    where: { userId: session.user.id } 
  });

  if (!vault) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }

  return NextResponse.json(
    { message: "Vault opened successfully" },
    { status: 200 }
  );
}

export async function DELETE() {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const vault = await prisma.vault.findFirst({ 
      where: { userId: session.user.id } 
    });

    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    await prisma.vault.delete({ 
      where: { id: vault.id } 
    });

    return NextResponse.json(
      { message: "Vault deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting vault:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
