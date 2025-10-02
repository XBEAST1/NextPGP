import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST: Retrieve keys (encrypted) from the database
export async function POST(req: Request) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const vault = await prisma.vault.findFirst({ 
    where: { userId: session.user.id } 
  });
  if (!vault) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }

  const keys = await prisma.pGPKeys.findMany({ 
    where: { vaultId: vault.id } 
  });

  try {
    // Return the keys as stored (encrypted)
    const responseKeys = keys.map((key: any) => ({
      id: key.id,
      privateKey: key.privateKey || "",
      publicKey: key.publicKey || "",
    }));

    return NextResponse.json({ keys: responseKeys });
  } catch (error) {
    console.error("Error fetching keys:", error);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}
