import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongoose";
import Vault from "@/models/Vault";
import PGPKey from "@/models/PGPKey";

await connectToDatabase();

// Utility: Rehashing for duplicate check or for verifying key integrity using SHA-256
async function serverHashKey(text: string): Promise<string> {
  const enc = new TextEncoder();
  const buffer = enc.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Buffer.from(digest).toString("hex");
}

// POST: Store new key
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

  const {
    encryptedPrivateKey,
    encryptedPublicKey,
    privateKeyHash,
    publicKeyHash,
  } = payload;

  if (!encryptedPrivateKey && !encryptedPublicKey) {
    return NextResponse.json(
      { message: "At least one key (private or public) is required" },
      { status: 400 }
    );
  }

  const vault = await Vault.findOne({ userId: session.user.id });
  if (!vault) {
    return NextResponse.json({ error: "Vault not found for current user" }, { status: 404 });
  }

  // Duplicate check conditions using the hash values sent from client
  const orConditions: any[] = [];
  if (privateKeyHash) orConditions.push({ privateKeyHash });
  if (publicKeyHash) orConditions.push({ publicKeyHash });

  const existingKey = await PGPKey.findOne({
    vaultId: vault._id,
    $or: orConditions,
  });

  if (existingKey) {
    return NextResponse.json({ message: "Key already backed up." }, { status: 200 });
  }

  try {
    const storedKey = await PGPKey.create({
      vaultId: vault._id,
      ...(encryptedPrivateKey && { privateKey: encryptedPrivateKey }),
      ...(encryptedPublicKey && { publicKey: encryptedPublicKey }),
      ...(privateKeyHash && { privateKeyHash }),
      ...(publicKeyHash && { publicKeyHash }),
    });

    return NextResponse.json(
      { message: "Key stored successfully", key: storedKey },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to store key data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE: Remove a stored key
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Expect keyId and a hash of the key (either publicKeyHash or privateKeyHash)
    const { keyId, publicKeyHash, privateKeyHash } = await req.json();
    if (!keyId || (!publicKeyHash && !privateKeyHash)) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const vault = await Vault.findOne({ userId: session.user.id });
    if (!vault) {
      return NextResponse.json(
        { error: "Vault not found for current user" },
        { status: 404 }
      );
    }

    let keyQuery: any = { _id: keyId, vaultId: vault._id };

    if (publicKeyHash) {
      keyQuery.publicKeyHash = publicKeyHash;
    } else if (privateKeyHash) {
      keyQuery.privateKeyHash = privateKeyHash;
    }

    const keyToDelete = await PGPKey.findOne(keyQuery);

    if (!keyToDelete) {
      return NextResponse.json(
        { error: "Key not found in user's vault" },
        { status: 404 }
      );
    }

    await PGPKey.deleteOne({ _id: keyId });

    return NextResponse.json(
      { message: "Key deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
