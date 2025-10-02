import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const userId = authHeader?.replace("Bearer ", "");

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const vault = await prisma.vault.findFirst({ 
    where: { userId } 
  });

  if (vault) {
    return new NextResponse(null, { status: 200 });
  }

  return new NextResponse(null, { status: 404 });
}
