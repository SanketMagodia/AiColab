import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Duplicated here (not imported from lib/token.ts) so the edge runtime
// never pulls in Node.js-only modules from lib/auth.ts via re-exports.
const COOKIE_NAME = "aicolab_token";

// Auth endpoints that are always public
const PUBLIC_API_PATHS = new Set(["/api/auth/verify", "/api/auth/logout"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // Token missing, expired, or tampered
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export const config = {
  // Run on every /api/* request
  matcher: "/api/:path*",
};
