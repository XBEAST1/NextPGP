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
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 2 ** 16,
      parallelism: 1,
    });

    const vault = await prisma.vault.create({
      data: {
        name: session.user.name ? `${session.user.name}'s Vault` : "Vault",
        password: hash,
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
