import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Github from "next-auth/providers/github";
import Discord from "next-auth/providers/discord"
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [Google, Github, Discord],
  callbacks: {
    async signIn({ user, account }) {
      // Allow sign in if user already exists with this email
      if (user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
        
        if (existingUser) {
          // Check if this account provider is already linked
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account?.provider || "",
                providerAccountId: account?.providerAccountId || "",
              },
            },
          });
          
          // If account doesn't exist, link it to the existing user
          if (!existingAccount && account) {
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token as string | null,
                access_token: account.access_token as string | null,
                expires_at: account.expires_at ? Math.floor(account.expires_at as number) : null,
                token_type: account.token_type as string | null,
                scope: account.scope as string | null,
                id_token: account.id_token as string | null,
                session_state: account.session_state as string | null,
              },
            });
          }
          
          // Update user info if needed
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: user.name || existingUser.name,
              image: user.image || existingUser.image,
            },
          });
        }
      }
      
      return true;
    },
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
