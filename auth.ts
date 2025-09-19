import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { MongooseAdapter } from "@brendon1555/authjs-mongoose-adapter";
import { connectToDatabase } from "@/lib/mongoose";

export const { handlers, signIn, signOut, auth } = NextAuth(async () => {
  await connectToDatabase();

  return {
    secret: process.env.AUTH_SECRET,
    session: { strategy: "jwt" },
    adapter: MongooseAdapter(process.env.MONGODB_URI || ""),
    providers: [Google, GitHub],
    trustHost: true,
    callbacks: {
      async jwt({ token, user }) {
        if (user) token.id = user.id;
        return token;
      },
      async session({ session, token }) {
        if (session?.user) session.user.id = token.id as string;
        return session;
      },
    },
  };
});