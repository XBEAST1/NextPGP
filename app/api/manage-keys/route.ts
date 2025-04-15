import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/prisma";

async function hashKey(text: string): Promise<string> {
  const enc = new TextEncoder();
  const buffer = enc.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Buffer.from(digest).toString("hex");
}


// Encryption function using AES-GCM
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

  const vault = await prisma.vault.findFirst({
    where: { userId: session.user.id },
  });

  if (!vault) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }

  const keys = await prisma.pGPKey.findMany({
    where: { vaultId: vault.id },
  });

  try {
    const decryptedKeys = await Promise.all(
      keys.map(async (key) => ({
        id: key.id,
        privateKey: key.privateKey ? await decrypt(key.privateKey, vaultPassword) : "",
        publicKey: key.publicKey ? await decrypt(key.publicKey, vaultPassword): "",
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

export async function POST(req: Request) {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("Invalid JSON payload:", error);
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

  const vault = await prisma.vault.findFirst({
    where: {
      userId: session.user.id,
    },
  });

  if (!vault) {
    return NextResponse.json(
      { error: "Vault not found for current user" },
      { status: 404 }
    );
  }

  try {
    // Hash the plaintext keys
    const privateKeyHash = await hashKey(privateKey);
    const publicKeyHash = await hashKey(publicKey);

    // Check if already backed up
    const existingKey = await prisma.pGPKey.findFirst({
      where: {
        vaultId: vault.id,
        OR: [{ privateKeyHash }, { publicKeyHash }],
      },
    });

    if (existingKey) {
      return NextResponse.json(
        { message: "Key already backed up." },
        { status: 200 }
      );
    }

    // Encrypt the keys
    const encryptedPrivateKey = await encrypt(privateKey, vaultPassword);
    const encryptedPublicKey = await encrypt(publicKey, vaultPassword);

    // Store the new key
    const storedKey = await prisma.pGPKey.create({
      data: {
        privateKey: encryptedPrivateKey,
        publicKey: encryptedPublicKey,
        privateKeyHash,
        publicKeyHash,
        vaultId: vault.id,
      },
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

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("Invalid JSON payload:", error);
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const { keyValue } = payload;
  if (!keyValue) {
    return NextResponse.json({ error: "Missing keyValue" }, { status: 400 });
  }

  const vault = await prisma.vault.findFirst({
    where: { userId: session.user.id },
  });

  if (!vault) {
    return NextResponse.json(
      { error: "Vault not found for current user" },
      { status: 404 }
    );
  }

  const keyToDelete = await prisma.pGPKey.findFirst({
    where: {
      vaultId: vault.id,
      OR: [{ privateKey: keyValue }, { publicKey: keyValue }],
    },
  });

  if (!keyToDelete) {
    return NextResponse.json(
      { error: "Key not found in user's vault" },
      { status: 404 }
    );
  }

  try {
    const deletedKey = await prisma.pGPKey.delete({
      where: { id: keyToDelete.id },
    });
    return NextResponse.json(
      { message: "Key deleted successfully", deletedKey },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting key:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
