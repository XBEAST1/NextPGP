import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongoose";
import Vault from "@/models/Vault";
import PGPKey from "@/models/PGPKey";

await connectToDatabase();

// POST: Retrieve keys (encrypted) from the database
export async function POST(req: Request) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const vault = await Vault.findOne({ userId: session.user.id });
  if (!vault) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }

  const keys = await PGPKey.find({ vaultId: vault._id }).lean();

  try {
    // Return the keys as stored (encrypted)
    const responseKeys = keys.map((key) => ({
      id: key._id.toString(),
      privateKey: key.privateKey || "",
      publicKey: key.publicKey || "",
    }));

    return NextResponse.json({ keys: responseKeys });
  } catch (error) {
    console.error("Error fetching keys:", error);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}
