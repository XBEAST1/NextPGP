import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Clear the vault_token cookie
  const res = new NextResponse(null, { status: 200 });
  res.cookies.delete({
    name: "vault_token",
    path: "/",
  });

  return res;
}
