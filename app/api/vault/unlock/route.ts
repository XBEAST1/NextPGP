import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import Vault from "@/models/Vault";

await connectToDatabase();

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse(null, { status: 401 });
  }

  await Vault.updateMany(
    { userId: session.user.id },
    {
      $set: {
        isLocked: false,
        lastActivity: new Date(),
      },
    }
  );

  return new NextResponse(null, { status: 200 });
}
