import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sectionId = searchParams.get("sectionId");
    const db = await getDb();
    const filter = sectionId ? { sectionId } : {};
    const tasks = await db.collection("tasks").find(filter).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(tasks.map((t) => ({ ...t, _id: t._id.toString() })));
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description = "", project = "", assignedUserId = null, sectionId = null } = body;
    if (!title) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }
    if (!sectionId) {
      return NextResponse.json({ error: "sectionId required" }, { status: 400 });
    }
    const now = new Date();
    const doc = {
      title,
      description,
      project,
      assignedUserId,
      sectionId,
      status: "todo",
      createdAt: now,
      updatedAt: now,
    };
    const db = await getDb();
    const result = await db.collection("tasks").insertOne(doc);
    return NextResponse.json({ ...doc, _id: result.insertedId.toString() }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
