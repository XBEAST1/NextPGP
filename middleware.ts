import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

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

  // For vault only routes, check if vault exists and is unlocked
  if (vaultOnlyRoutes.some((route) => pathname.startsWith(route))) {
    if (!hasVault) {
      return NextResponse.redirect(
        new URL("/create-vault", request.nextUrl.origin)
      );
    }

    const lockStatusResponse = await fetch(
      `${request.nextUrl.origin}/api/vault/check-lock`,
      {
        headers: {
          Authorization: `Bearer ${session.sub}`,
          cookie: request.headers.get("cookie") || "",
        },
      }
    );

    if (!lockStatusResponse.ok) {
      const url = new URL("/vault", request.nextUrl.origin);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    const lockStatus = await lockStatusResponse.json();

    if (lockStatus.isLocked === true) {
      const url = new URL("/vault", request.nextUrl.origin);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
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
