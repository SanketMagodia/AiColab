import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    await db.collection("users").deleteOne({ _id: new ObjectId(params.id) });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
