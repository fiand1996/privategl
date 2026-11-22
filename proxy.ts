import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth?.user;
  const userRole = req.auth?.user?.role;

  // 1. Allow public authentication endpoints and login page
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/users/count" ||
    (pathname === "/api/users" && req.method === "POST" && !isAuthenticated)
  ) {
    // If user is already authenticated and visits /login, redirect to gallery home
    if (isAuthenticated && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 2. Unauthenticated check: redirect to /login or return 401
  if (!isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 3. Authenticated: Enforce read-only restrictions for Viewer role
  if (userRole === "viewer") {
    // Prevent viewers from accessing system settings page
    if (pathname.startsWith("/settings")) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Prevent viewers from performing any state-modifying mutations
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    if (isMutation && !pathname.startsWith("/api/auth")) {
      return NextResponse.json(
        { error: "Forbidden. Viewer accounts have read-only access." },
        { status: 403 }
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
