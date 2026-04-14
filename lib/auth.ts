import { timingSafeEqual } from "crypto";

export function verifyPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected || !input) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  // Length check first (leaks length, but password length isn't sensitive here)
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
