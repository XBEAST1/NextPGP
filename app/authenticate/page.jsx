import { auth } from "@/auth";
import { prisma } from "@/prisma";
import { redirect } from "next/navigation";

export default async function CheckVaultPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const vault = await prisma.vault.findFirst({
    where: { userId: session.user.id },
  });

  if (vault) {
    redirect("/vault");
  } else {
    redirect("/create-vault");
  }
}