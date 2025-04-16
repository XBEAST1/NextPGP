import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { prisma } from "@/prisma";

export async function POST(request: Request) {
  const session = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  if (!session?.sub) {
    return new NextResponse(null, { status: 401 });
  }

  await prisma.vault.updateMany({
    where: {
      userId: session.sub,
    },
    data: {
      isLocked: false,
      lastActivity: new Date(),
    },
  });

  return new NextResponse(null, { status: 200 });
}
