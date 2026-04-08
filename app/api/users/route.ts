import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();
    const users = await db.collection("users").find({}).sort({ createdAt: 1 }).toArray();
    return NextResponse.json(
      users.map((u) => ({ ...u, _id: u._id.toString() }))
    );
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, color } = body;
    if (!name || !color) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const db = await getDb();
    const doc = { name, color, createdAt: new Date() };
    const result = await db.collection("users").insertOne(doc);
    return NextResponse.json({ ...doc, _id: result.insertedId.toString() }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
