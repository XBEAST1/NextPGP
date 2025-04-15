import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const vaultOnlyRoutes = ["/cloud-backup", "/cloud-import"];
const authRoutes = ["/login"];

export default async function middleware(request: NextRequest) {
  const session = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  const pathname = request.nextUrl.pathname;

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  const response = await fetch(`${request.nextUrl.origin}/api/vault/check`, {
    headers: {
      Authorization: `Bearer ${session.sub}`,
    },
  });

  const hasVault = response.ok;

  // Check for vault status
  if (vaultOnlyRoutes.some((route) => pathname.startsWith(route))) {
    const isVaultUnlocked = request.cookies.has("vault_unlocked");
    if (!isVaultUnlocked) {
      return NextResponse.redirect(new URL("/vault", request.nextUrl.origin));
    }
  }

  // Check for vault existence
  if (pathname === "/vault" && !hasVault) {
    return NextResponse.redirect(
      new URL("/create-vault", request.nextUrl.origin)
    );
  }

  if (pathname === "/create-vault" && hasVault) {
    return NextResponse.redirect(new URL("/vault", request.nextUrl.origin));
  }

  if (authRoutes.some((route) => pathname.startsWith(route)) && session) {
    return NextResponse.redirect(new URL("/vault", request.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/create-vault",
    "/vault",
    "/login",
    "/cloud-backup",
    "/cloud-import",
  ],
};
