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

// AES-GCM decryption
async function decrypt(
  encryptedBase64: string,
  password: string
): Promise<string> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const encryptedBytes = new Uint8Array(Buffer.from(encryptedBase64, "base64"));
  const salt = encryptedBytes.slice(0, 16);
  const iv = encryptedBytes.slice(16, 28);
  const data = encryptedBytes.slice(28);

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
    ["decrypt"]
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return dec.decode(decryptedBuffer);
}

// GET: Retrieve and decrypt keys
export async function GET(req: Request) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const vaultPassword = searchParams.get("vaultPassword");

  if (!vaultPassword) {
    return NextResponse.json(
      { error: "Vault password is required" },
      { status: 400 }
    );
  }

  const vault = await Vault.findOne({ userId: session.user.id });
  if (!vault) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }

  const keys = await PGPKey.find({ vaultId: vault._id }).lean();

  try {
    const decryptedKeys = await Promise.all(
      keys.map(async (key) => ({
        id: key._id.toString(),
        privateKey: key.privateKey
          ? await decrypt(key.privateKey, vaultPassword)
          : "",
        publicKey: key.publicKey
          ? await decrypt(key.publicKey, vaultPassword)
          : "",
      }))
    );

    return NextResponse.json({ keys: decryptedKeys });
  } catch (error) {
    console.error("Decryption failed:", error);
    return NextResponse.json(
      { error: "Failed to decrypt keys. Invalid password?" },
      { status: 400 }
    );
  }
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
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const { privateKey, publicKey, vaultPassword } = payload;

  if (!vaultPassword) {
    return NextResponse.json(
      { error: "Vault password is required" },
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

  try {
    const privateKeyHash = await hashKey(privateKey);
    const publicKeyHash = await hashKey(publicKey);

    const existingKey = await PGPKey.findOne({
      vaultId: vault._id,
      $or: [{ privateKeyHash }, { publicKeyHash }],
    });

    if (existingKey) {
      return NextResponse.json(
        { message: "Key already backed up." },
        { status: 200 }
      );
    }

    const encryptedPrivateKey = await encrypt(privateKey, vaultPassword);
    const encryptedPublicKey = await encrypt(publicKey, vaultPassword);

    const storedKey = await PGPKey.create({
      privateKey: encryptedPrivateKey,
      publicKey: encryptedPublicKey,
      privateKeyHash,
      publicKeyHash,
      vaultId: vault._id,
    });

    return NextResponse.json({
      message: "Key stored successfully",
      key: storedKey,
    });
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

    const { keyId, vaultPassword, publicKey } = await req.json();
    if (!keyId || !vaultPassword || !publicKey) {
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

    const publicKeyHash = await hashKey(publicKey);

    const keyToDelete = await PGPKey.findOne({
      _id: keyId,
      vaultId: vault._id,
      publicKeyHash,
    });

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
