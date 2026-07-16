import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // API routes: every /api endpoint requires a valid admin session, EXCEPT
  //  - /api/auth/*        NextAuth's own login/callback routes
  //  - /api/sync/*        machine-to-machine (guarded by the x-drain-token / inbound secret)
  // This is the central guard for the admin API (defense-in-depth checks also live in the
  // sensitive routes themselves). Returns 401 JSON instead of redirecting.
  if (pathname.startsWith("/api")) {
    const isOpenApi =
      pathname.startsWith("/api/auth") || pathname.startsWith("/api/sync");
    if (!isOpenApi && !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const isAuthPage = pathname.startsWith("/login");

  const isProtectedPage =
    pathname === "/" ||
    pathname.startsWith("/properties") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/messaging") ||
    pathname.startsWith("/admins") ||
    pathname.startsWith("/roles") ||
    pathname.startsWith("/logs");

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
    "/messaging/:path*",
    "/admins/:path*",
    "/roles/:path*",
    "/logs/:path*",
    "/api/:path*",
  ],
};
