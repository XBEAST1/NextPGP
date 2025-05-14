import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongoose";
import Vault from "@/models/Vault";
import PGPKey from "@/models/PGPKey";

await connectToDatabase();

// Utility: Hash with SHA-256
async function hashKey(text: string): Promise<string> {
  const enc = new TextEncoder();
  const buffer = enc.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Buffer.from(digest).toString("hex");
}

// AES-GCM encryption
async function encrypt(text: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );
  const encryptedBytes = new Uint8Array([
    ...salt,
    ...iv,
    ...new Uint8Array(encrypted),
  ]);
  return Buffer.from(encryptedBytes).toString("base64");
}

// POST: Encrypt and store new key
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

  const { privateKey, publicKey, vaultPassword } = payload;

  if (!vaultPassword) {
    return NextResponse.json({ error: "Vault password is required" }, { status: 400 });
  }

  const vault = await Vault.findOne({ userId: session.user.id });
  if (!vault) {
    return NextResponse.json({ error: "Vault not found for current user" }, { status: 404 });
  }

  const hasPrivate = typeof privateKey === 'string' && privateKey.trim() !== '';
  const hasPublic = typeof publicKey === 'string' && publicKey.trim() !== '';

  if (!hasPrivate && !hasPublic) {
    return NextResponse.json(
      { message: "At least one key (private or public) is required" },
      { status: 400 }
    );
  }

  try {
    // When both keys provided, only backup private key
    const shouldBackupPrivate = hasPrivate;
    const shouldBackupPublic = !hasPrivate && hasPublic;

    let privateKeyHash: string | null = null;
    let encryptedPrivateKey: string | null = null;
    let publicKeyHash: string | null = null;
    let encryptedPublicKey: string | null = null;

    if (shouldBackupPrivate) {
      privateKeyHash = await hashKey(privateKey);
      encryptedPrivateKey = await encrypt(privateKey, vaultPassword);
    }

    if (shouldBackupPublic) {
      publicKeyHash = await hashKey(publicKey);
      encryptedPublicKey = await encrypt(publicKey, vaultPassword);
    }

    // Duplicate check conditions
    const orConditions: any[] = [];
    if (privateKeyHash) orConditions.push({ privateKeyHash });
    if (publicKeyHash) orConditions.push({ publicKeyHash });

    const existingKey = await PGPKey.findOne({
      vaultId: vault._id,
      $or: orConditions,
    });

    if (existingKey) {
      return NextResponse.json(
        { message: "Key already backed up." },
        { status: 200 }
      );
    }

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
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a stored key
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { keyId, vaultPassword, publicKey, privateKey } = await req.json();
    if (!keyId || !vaultPassword || (!publicKey && !privateKey)) {
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

    if (publicKey) {
      const publicKeyHash = await hashKey(publicKey);
      keyQuery.publicKeyHash = publicKeyHash;
    } else if (privateKey) {
      const privateKeyHash = await hashKey(privateKey);
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
