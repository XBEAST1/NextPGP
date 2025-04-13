"use server"

import { signIn, signOut } from "@/auth";
import { revalidatePath } from "next/cache";

export const login = async (provider: string) => {
    await signIn (provider, { redirectTo: "/authenticate" })
    revalidatePath("/authenticate")
}

export const logout = async () => {
    await signOut({ redirectTo: "/login" });
    revalidatePath("/login")
}