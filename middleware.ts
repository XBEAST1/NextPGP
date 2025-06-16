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

  // Check if the vault exists in the database
  const response = await fetch(`${request.nextUrl.origin}/api/vault/check`, {
    headers: { Authorization: `Bearer ${session.sub}` },
  });
  const hasVault = response.ok;

  // Handle /vault route
  if (pathname === "/vault") {
    if (hasVault) {
      const vaultJwt = request.cookies.get("vault_token")?.value;
      if (vaultJwt) {
        try {
          await jwtVerify(
            vaultJwt,
            new TextEncoder().encode(process.env.AUTH_SECRET!)
          );
          // If the vault page has a search param "redirect", forward the user there.
          const redirectTarget =
            request.nextUrl.searchParams.get("redirect") ?? "/cloud-backup";
          return NextResponse.redirect(
            new URL(redirectTarget, request.nextUrl.origin)
          );
        } catch {
          // Fall through if token verification fails so the user sees the vault page.
        }
      }
      return NextResponse.next();
    } else {
      // If vault does not exist, force create it.
      return NextResponse.redirect(
        new URL("/create-vault", request.nextUrl.origin)
      );
    }
  }

  // Handle /create-vault route
  if (pathname === "/create-vault") {
    if (hasVault) {
      return NextResponse.redirect(new URL("/vault", request.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Protect vault-only routes by requiring a valid vault_token
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

  if (pathname.startsWith("/about")) {
    return NextResponse.rewrite(new URL("/getting-started", request.url));
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
    "/getting-started",
    "/about",
  ],
};
