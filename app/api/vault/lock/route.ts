import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { prisma } from "@/prisma";

export async function POST(request: Request) {
  // Pass only the supported properties to getToken.
  const session = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET!, // ensure AUTH_SECRET is defined in your environment
  });

  if (!session?.sub) {
    return new NextResponse(null, { status: 401 });
  }

  await prisma.vault.updateMany({
    where: {
      userId: session.sub,
    },
    data: {
      isLocked: true,
    },
  });

  return new NextResponse(null, { status: 200 });
}
