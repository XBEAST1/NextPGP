import { NextResponse } from "next/server";
import { prisma } from "@/prisma";

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const userId = authHeader?.replace("Bearer ", "");

  if (!userId) {
    return new NextResponse(null, { status: 401 });
  }

  const vault = await prisma.vault.findFirst({
    where: {
      userId: userId,
    },
  });

  if (vault) {
    return new NextResponse(null, { status: 200 });
  }

  return new NextResponse(null, { status: 404 });
}
