import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongoose";
import Vault from "@/models/Vault";
import argon2 from "argon2";

await connectToDatabase();

export async function GET() {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find any vault for this user
  const vault = await Vault.findOne({ userId: session.user.id }).lean();

  return NextResponse.json({ exists: Boolean(vault) });
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if vault already exists for this user
  const existingVault = await Vault.findOne({ userId: session.user.id }).lean();
  if (existingVault) {
    return NextResponse.json(
      { error: "Vault already exists" },
      { status: 400 }
    );
  }

  const { SHA256PasswordHash, encryptionSalt } = await req.json();

  try {
    // Rehash the SHA256 hash using argon2
    const hashedPassword = await argon2.hash(SHA256PasswordHash, {
      type: argon2.argon2id,
      timeCost: 5,
      memoryCost: 2 ** 17,
      parallelism: 1,
    });

    const vaultDoc = new Vault({
      name: session.user.name ? `${session.user.name}'s Vault` : "Vault",
      passwordHash: hashedPassword,
      userId: session.user.id,
      encryptionSalt, // PBKDF2 salt for future login derivation
    });

    await vaultDoc.save();

    const vault = vaultDoc.toObject();
    delete (vault as any).__v;

    return NextResponse.json({ vault });
  } catch (error) {
    console.error("Vault creation failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
