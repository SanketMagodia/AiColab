import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "aicolab_token";
export const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function secret(): Uint8Array {
  const key = process.env.JWT_SECRET;
  if (!key) throw new Error("JWT_SECRET env var is not set");
  return new TextEncoder().encode(key);
}

export async function signToken(): Promise<string> {
  return new SignJWT({ v: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}
