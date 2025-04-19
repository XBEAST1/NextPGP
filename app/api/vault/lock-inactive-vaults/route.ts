import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import Vault from "@/models/Vault";

export async function POST() {
  try {
    await connectToDatabase();

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const result = await Vault.updateMany(
      {
        isLocked: false,
        lastActivity: { $lt: tenMinutesAgo },
      },
      { $set: { isLocked: true } }
    );

    return NextResponse.json({ locked: result.modifiedCount }, { status: 200 });
  } catch (err) {
    console.error("Vault auto-lock error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
