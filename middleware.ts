import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  });

  const isAuthPage = request.nextUrl.pathname.startsWith("/login");

  const isProtectedPage =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/properties") ||
    request.nextUrl.pathname.startsWith("/users") ||
    request.nextUrl.pathname.startsWith("/admins") ||
    request.nextUrl.pathname.startsWith("/roles") ||
    request.nextUrl.pathname.startsWith("/logs");

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!token && isProtectedPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/",
    "/properties/:path*",
    "/users/:path*",
    "/admins/:path*",
    "/roles/:path*",
    "/logs/:path*",
  ],
};
