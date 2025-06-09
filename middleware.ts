import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";

const vaultOnlyRoutes = ["/cloud-backup", "/cloud-manage"];
const authRoutes = ["/login"];
const protectedAuthRoutes = ["/create-vault", "/vault", ...vaultOnlyRoutes];

export default async function middleware(request: NextRequest) {
  const { pathname, origin, searchParams } = request.nextUrl;

  // Welcome check
  const hasSeenWelcome = request.cookies.get("hasSeenWelcome")?.value === "true";
  if (!hasSeenWelcome && pathname !== "/getting-started") {
    const res = NextResponse.redirect(new URL("/getting-started", origin));
    res.cookies.set("hasSeenWelcome", "true", { path: "/" });
    return res;
  }

  if (pathname === "/getting-started") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/about")) {
    return NextResponse.rewrite(new URL("/getting-started", request.url));
  }

  // Auth token check
  const session = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  // Allow public access to login
  if (authRoutes.some(route => pathname.startsWith(route))) {
    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL("/vault", origin));
    }
    return NextResponse.next();
  }

  if (protectedAuthRoutes.some(route => pathname.startsWith(route))) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", origin));
    }

    // Check if the vault exists in the database
    if (pathname === "/vault" || pathname === "/create-vault" || vaultOnlyRoutes.some(r => pathname.startsWith(r))) {
      const response = await fetch(`${origin}/api/vault/check`, {
        headers: { Authorization: `Bearer ${session.sub}` },
      });
      const hasVault = response.ok;

      if (pathname === "/create-vault") {
        if (hasVault) {
          return NextResponse.redirect(new URL("/vault", origin));
        }
        return NextResponse.next();
      }

      if (pathname === "/vault") {
        if (!hasVault) {
          return NextResponse.redirect(new URL("/create-vault", origin));
        }
        const vaultJwt = request.cookies.get("vault_token")?.value;
        if (vaultJwt) {
          try {
            await jwtVerify(vaultJwt, new TextEncoder().encode(process.env.AUTH_SECRET!));
            const redirectTarget = searchParams.get("redirect") ?? "/cloud-backup";
            return NextResponse.redirect(new URL(redirectTarget, origin));
          } catch {
            // show vault page
          }
        }
        return NextResponse.next();
      }

      // vault-only routes
      // Protect vault-only routes by requiring a valid vault_token
      if (vaultOnlyRoutes.some(r => pathname.startsWith(r))) {
        const vaultJwt = request.cookies.get("vault_token")?.value;

        if (!vaultJwt) {
          const url = new URL("/vault", request.url);
          url.searchParams.set("redirect", pathname);
          return NextResponse.redirect(url);
        }
        
        try {
          await jwtVerify(vaultJwt, new TextEncoder().encode(process.env.AUTH_SECRET!));
          return NextResponse.next();
        } catch {
          const url = new URL("/vault", request.url);
          url.searchParams.set("redirect", pathname);
          return NextResponse.redirect(url);
        }
      }
    }
  }

  // everything else is public
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/generate",
    "/import",
    "/encrypt",
    "/decrypt",
    "/login",
    "/create-vault",
    "/vault",
    "/cloud-backup",
    "/cloud-manage",
    "/getting-started",
    "/about",
  ],
};
