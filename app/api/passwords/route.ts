import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const ENVS = ["DEV", "QA", "UAT", "STAGING", "PROD"];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const env = searchParams.get("env");
    const db = await getDb();
    const filter = env && ENVS.includes(env) ? { env } : {};
    const docs = await db.collection("passwords").find(filter).sort({ createdAt: 1 }).toArray();
    return NextResponse.json(docs.map((d) => ({ ...d, _id: d._id.toString() })));
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch passwords" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { env, label = "", username = "", password = "" } = body;
    if (!env || !ENVS.includes(env)) {
      return NextResponse.json({ error: "Invalid env" }, { status: 400 });
    }
    const doc = { env, label, username, password, createdAt: new Date() };
    const db = await getDb();
    const result = await db.collection("passwords").insertOne(doc);
    return NextResponse.json({ ...doc, _id: result.insertedId.toString() }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create credential" }, { status: 500 });
  }
}
