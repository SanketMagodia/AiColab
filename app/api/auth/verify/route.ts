import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/token";

// Simple in-memory rate limiter.
// State is per serverless instance and resets on cold start — this is an
// acceptable trade-off on Vercel's free tier where persistent KV isn't included.
// It still effectively blocks rapid brute-force attacks within a live instance.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Returns true if the IP is currently rate-limited (and increments the counter). */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (entry.count >= MAX_ATTEMPTS) return true;

  entry.count++;
  return false;
}

export async function POST(req: Request) {
  const ip = getIp(req);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();

    if (typeof body?.password !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const success = verifyPassword(body.password);

    if (!success) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    // Clear the attempt counter on a successful login
    attempts.delete(ip);

    const token = await signToken();
    const res = NextResponse.json({ success: true });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,                                      // not readable by JS
      secure: process.env.NODE_ENV === "production",       // HTTPS only in prod
      sameSite: "strict",                                  // blocks CSRF
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
