import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/token";

export async function POST() {
  const res = NextResponse.json({ success: true });
  // Overwrite the cookie with an empty value and maxAge=0 to delete it
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return res;
}
