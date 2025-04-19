import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import Vault from "@/models/Vault";

await connectToDatabase();

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        session: null,
      },
      { status: 401 }
    );
  }

  const vault = await Vault.findOne(
    { userId: session.user.id },
    { isLocked: 1 }
  ).lean();

  if (!vault || vault.isLocked) {
    return NextResponse.json(
      {
        error: "Vault is locked or does not exist",
        isLocked: vault?.isLocked,
        exists: !!vault,
      },
      { status: 403 }
    );
  }

  return NextResponse.json(
    {
      status: "Vault is unlocked",
      isLocked: false,
    },
    { status: 200 }
  );
}
