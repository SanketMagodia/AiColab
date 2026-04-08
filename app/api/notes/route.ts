import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();
    const notes = await db.collection("notes").find({}).sort({ createdAt: 1 }).toArray();
    return NextResponse.json(notes.map((n) => ({ ...n, _id: n._id.toString() })));
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title = "",
      body: noteBody = "",
      color = "#fde68a",
      x = 100,
      y = 100,
    } = body;
    const now = new Date();
    const doc = { title, body: noteBody, color, x, y, createdAt: now, updatedAt: now };
    const db = await getDb();
    const result = await db.collection("notes").insertOne(doc);
    return NextResponse.json({ ...doc, _id: result.insertedId.toString() }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
