import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";

const vaultOnlyRoutes = ["/cloud-backup", "/cloud-manage"];
const authRoutes = ["/login"];

export default async function middleware(request: NextRequest) {
  const session = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  const pathname = request.nextUrl.pathname;

  // Allow unauthenticated access to login
  if (authRoutes.some((route) => pathname.startsWith(route))) {
    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL("/vault", request.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Require a valid session for everything else
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  // Check if the vault exist in the database
  const response = await fetch(`${request.nextUrl.origin}/api/vault/check`, {
    headers: { Authorization: `Bearer ${session.sub}` },
  });
  const hasVault = response.ok;

  // /vault or /create-vault will be redirected to /cloud-backup if already hold a valid vault_token
  if (pathname === "/vault" || pathname === "/create-vault") {
    const vaultJwt = request.cookies.get("vault_token")?.value;
    if (vaultJwt) {
      try {
        await jwtVerify(
          vaultJwt,
          new TextEncoder().encode(process.env.AUTH_SECRET!)
        );
        return NextResponse.redirect(
          new URL("/cloud-backup", request.nextUrl.origin)
        );
      } catch {
      }
    }
  }

  // If vault doesn't exist redirect to create-vault
  if (pathname === "/vault" && !hasVault) {
    return NextResponse.redirect(
      new URL("/create-vault", request.nextUrl.origin)
    );
  }

  // If vault exists redirect from create-vault to vault
  if (pathname === "/create-vault" && hasVault) {
    return NextResponse.redirect(new URL("/vault", request.nextUrl.origin));
  }

  // Protect your vault only routes by requiring vault_token
  if (vaultOnlyRoutes.some((r) => pathname.startsWith(r))) {
    const vaultJwt = request.cookies.get("vault_token")?.value;

    // If vault token isn't found redirect to /vault
    if (!vaultJwt) {
      const url = new URL("/vault", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    try {
      await jwtVerify(
        vaultJwt,
        new TextEncoder().encode(process.env.AUTH_SECRET!)
      );
      return NextResponse.next();
    } catch {
      const url = new URL("/vault", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/create-vault",
    "/vault",
    "/login",
    "/cloud-backup",
    "/cloud-manage",
  ],
};
