import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("vault_unlocked");
  return new NextResponse(null, { status: 200 });
}
