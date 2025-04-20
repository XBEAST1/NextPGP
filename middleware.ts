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

  // Allow unauthenticated access to authRoutes (eg "/login")
  if (authRoutes.some((route) => pathname.startsWith(route))) {
    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL("/vault", request.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // For protected routes, require a session
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  // Check for vault existence
  const response = await fetch(`${request.nextUrl.origin}/api/vault/check`, {
    headers: {
      Authorization: `Bearer ${session.sub}`,
    },
  });

  const hasVault = response.ok;

  if (pathname === "/vault" && !hasVault) {
    return NextResponse.redirect(
      new URL("/create-vault", request.nextUrl.origin)
    );
  }

  if (pathname === "/create-vault" && hasVault) {
    return NextResponse.redirect(new URL("/vault", request.nextUrl.origin));
  }

  // For vault‑only routes, verify the vault_token JWT
  if (vaultOnlyRoutes.some((r) => pathname.startsWith(r))) {
    const vaultJwt = request.cookies.get("vault_token")?.value;
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
