import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await req.json();
    const name = (body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    const db = await getDb();
    await db.collection("sections").updateOne(
      { _id: new ObjectId(params.id) },
      { $set: { name } }
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to update section" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const db = await getDb();
    await db.collection("sections").deleteOne({ _id: new ObjectId(params.id) });
    // Cascade: delete all tasks in this section
    await db.collection("tasks").deleteMany({ sectionId: params.id });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete section" }, { status: 500 });
  }
}
