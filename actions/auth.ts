"use server"

import { signIn, signOut } from "@/auth";
import { revalidatePath } from "next/cache";

export const login = async (provider: string) => {
    await signIn (provider, { redirectTo: "/vault" })
    revalidatePath("/vault")
}

export const logout = async () => {
    await signOut({ redirectTo: "/login" });
    revalidatePath("/login")
}