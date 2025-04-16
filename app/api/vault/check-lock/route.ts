import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { prisma } from "@/prisma";

export async function GET(request: Request) {
  const session = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  if (!session?.sub) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        session: null,
      },
      { status: 401 }
    );
  }

  const vault = await prisma.vault.findFirst({
    where: {
      userId: session.sub,
    },
    select: {
      isLocked: true,
    },
  });

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
