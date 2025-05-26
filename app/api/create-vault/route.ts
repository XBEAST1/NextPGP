import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongoose";
import Vault from "@/models/Vault";

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

  const { verificationCipher } = await req.json();

  try {
    const vaultDoc = new Vault({
      name: session.user.name ? `${session.user.name}'s Vault` : "Vault",
      verificationCipher,
      userId: session.user.id,
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
