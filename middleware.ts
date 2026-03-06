import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  });

  const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  
  // Check if the path is any of the protected admin pages
  const isProtectedPage =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/articles") ||
    request.nextUrl.pathname.startsWith("/users") ||
    request.nextUrl.pathname.startsWith("/courses") ||
    request.nextUrl.pathname.startsWith("/orders") ||
    request.nextUrl.pathname.startsWith("/admins") ||
    request.nextUrl.pathname.startsWith("/roles") ||
    request.nextUrl.pathname.startsWith("/logs") ||
    request.nextUrl.pathname.startsWith("/attendance") ||
    request.nextUrl.pathname.startsWith("/batches") ||
    request.nextUrl.pathname.startsWith("/recordings");

  // Debug logging (only in development)
  if (process.env.NODE_ENV === "development") {
    console.log("Middleware Debug:", {
      path: request.nextUrl.pathname,
      hasToken: !!token,
      isAuthPage,
      isProtectedPage,
      token: token ? { id: token.id, email: token.email } : null
    });
  }

  if (token && isAuthPage) {
    // ✅ Logged in user trying to access /login → redirect to main page
    console.log("Redirecting authenticated user to main page");
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!token && isProtectedPage) {
    // ❌ Unauthenticated user trying to access protected page → redirect to /login
    console.log("Redirecting unauthenticated user to login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/",
    "/articles/:path*",
    "/users/:path*",
    "/courses/:path*",
    "/orders/:path*",
    "/admins/:path*",
    "/roles/:path*",
    "/logs/:path*",
    "/attendance/:path*",
    "/batches/:path*",
    "/recordings/:path*"
  ],
};
