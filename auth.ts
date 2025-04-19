import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { MongooseAdapter } from "@brendon1555/authjs-mongoose-adapter";
import { connectToDatabase } from "@/lib/mongoose";

await connectToDatabase();

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  adapter: MongooseAdapter(process.env.MONGODB_URI || ""),
  providers: [Google, GitHub],
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
});
