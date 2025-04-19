import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongoose";
import Vault from "@/models/Vault";
import PGPKey from "@/models/PGPKey";

await connectToDatabase();

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

// POST: Retrieve and decrypt keys
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

  const { vaultPassword } = payload;

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
