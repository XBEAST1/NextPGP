import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/prisma";
import argon2 from "argon2";

export async function GET() {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vault = await prisma.vault.findFirst({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ exists: !!vault });
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password } = await req.json();

  try {
    const vault = await prisma.vault.findFirst({
      where: { userId: session.user.id },
    });

    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    // Verify password against the hash stored in the database
    const isValidPassword = await argon2.verify(vault.passwordHash, password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { message: "Vault opened successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error opening vault:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Retrieve the vault associated with the current user session using userId
    const vault = await prisma.vault.findFirst({
      where: { userId: session.user.id },
    });

    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    // Delete the vault associated with the user
    await prisma.vault.delete({
      where: { id: vault.id },
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