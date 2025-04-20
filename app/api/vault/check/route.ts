import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import Vault from "@/models/Vault";

await connectToDatabase();

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const userId = authHeader?.replace("Bearer ", "");

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const vault = await Vault.findOne({ userId }).lean();

  if (vault) {
    return new NextResponse(null, { status: 200 });
  }

  return new NextResponse(null, { status: 404 });
}
