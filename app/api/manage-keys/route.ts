import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/prisma";

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

  // Now we only expect privateKey and publicKey from the client payload.
  const { privateKey, publicKey } = payload;

  // Fetch the Vault for the current user.
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
    const storedKey = await prisma.pGPKey.create({
      data: {
        privateKey,
        publicKey,
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

  // Retrieve the vault for the current user (like in POST)
  const vault = await prisma.vault.findFirst({
    where: { userId: session.user.id },
  });

  if (!vault) {
    return NextResponse.json(
      { error: "Vault not found for current user" },
      { status: 404 }
    );
  }

  // Find a key in the user's vault matching either privateKey or publicKey equals keyValue
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