import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedRoutes = ["/create-vault", "/vault"];
const authRoutes = ["/login"];

export default async function middleware(request: NextRequest) {
  const session = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  const pathname = request.nextUrl.pathname;

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthPage = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtected && !session) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/vault", request.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/create-vault", "/vault", "/login"],
};