import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      message: "I knew you'd check here 😏",
      tip: "There's no treasure at this endpoint. Have a nice day!",
      cat: "(=^･ω･^=)",
    },
    {
      status: 418,
      headers: { "x-surprise": "its-just-a-proxy", "x-hint": "go-touch-grass" },
    },
  );
}

export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
