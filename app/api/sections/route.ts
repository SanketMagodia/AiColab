import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();
    const docs = await db.collection("sections").find({}).sort({ createdAt: 1 }).toArray();
    return NextResponse.json(docs.map((d) => ({ ...d, _id: d._id.toString() })));
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch sections" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    const db = await getDb();
    const doc = { name, createdAt: new Date() };
    const result = await db.collection("sections").insertOne(doc);
    return NextResponse.json({ ...doc, _id: result.insertedId.toString() }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create section" }, { status: 500 });
  }
}
