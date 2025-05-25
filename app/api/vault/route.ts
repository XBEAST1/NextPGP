import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongoose";
import Vault from "@/models/Vault";
import PGPKeys from "@/models/PGPKey";

await connectToDatabase();

export async function GET() {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vault = await Vault.findOne({ userId: session.user.id }).lean();

  return NextResponse.json({
    exists: Boolean(vault),
    verificationCipher: vault ? vault.verificationCipher : null,
  });
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vault = await Vault.findOne({ userId: session.user.id });

  if (!vault) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }

  return NextResponse.json(
    { message: "Vault opened successfully" },
    { status: 200 }
  );
}

export async function DELETE(req: Request) {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const vault = await Vault.findOne({ userId: session.user.id });

    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    await Vault.deleteOne({ _id: vault._id });
    // Delete the associated PGP keys with the vault
    await PGPKeys.deleteMany({ vaultId: vault._id });

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
