import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    let doc = await db.collection("drawing").findOne({});
    if (!doc) {
      const seed = { shapes: [], updatedAt: new Date() };
      const result = await db.collection("drawing").insertOne(seed);
      return NextResponse.json({ ...seed, _id: result.insertedId.toString() });
    }
    return NextResponse.json({ ...doc, _id: doc._id.toString() });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch drawing" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const shapes = Array.isArray(body.shapes) ? body.shapes : [];
    const db = await getDb();
    await db.collection("drawing").updateOne(
      {},
      { $set: { shapes, updatedAt: new Date() } },
      { upsert: true }
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to update drawing" }, { status: 500 });
  }
}
