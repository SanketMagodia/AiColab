import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    if (typeof password !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const success = verifyPassword(password);
    return NextResponse.json({ success }, { status: success ? 200 : 401 });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
