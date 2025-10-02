import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST: Store new key
export async function POST(req: Request) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
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

  const vault = await prisma.vault.findFirst({ 
    where: { userId: session.user.id } 
  });
  if (!vault) {
    return NextResponse.json({ error: "Vault not found for current user" }, { status: 404 });
  }

  // Duplicate check conditions using the hash values sent from client
  const orConditions: any[] = [];
  if (privateKeyHash) orConditions.push({ privateKeyHash });
  if (publicKeyHash) orConditions.push({ publicKeyHash });

  const existingKey = await prisma.pGPKeys.findFirst({
    where: {
      vaultId: vault.id,
      OR: orConditions,
    },
  });

  if (existingKey) {
    return NextResponse.json({ message: "Key already backed up." }, { status: 200 });
  }

  try {
    const storedKey = await prisma.pGPKeys.create({
      data: {
        vaultId: vault.id,
        ...(encryptedPrivateKey && { privateKey: encryptedPrivateKey }),
        ...(encryptedPublicKey && { publicKey: encryptedPublicKey }),
        ...(privateKeyHash && { privateKeyHash }),
        ...(publicKeyHash && { publicKeyHash }),
      },
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

    const vault = await prisma.vault.findFirst({ 
      where: { userId: session.user.id } 
    });
    if (!vault) {
      return NextResponse.json(
        { error: "Vault not found for current user" },
        { status: 404 }
      );
    }

    let keyQuery: any = { 
      id: keyId, 
      vaultId: vault.id 
    };

    if (publicKeyHash) {
      keyQuery.publicKeyHash = publicKeyHash;
    } else if (privateKeyHash) {
      keyQuery.privateKeyHash = privateKeyHash;
    }

    const keyToDelete = await prisma.pGPKeys.findFirst({ 
      where: keyQuery 
    });

    if (!keyToDelete) {
      return NextResponse.json(
        { error: "Key not found in user's vault" },
        { status: 404 }
      );
    }

    await prisma.pGPKeys.delete({ 
      where: { id: keyId } 
    });

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
