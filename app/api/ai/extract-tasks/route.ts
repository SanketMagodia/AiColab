import { NextResponse } from "next/server";

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are an assistant that extracts actionable tasks from emails.

Read the email and extract concrete tasks the RECIPIENT needs to do.

Rules:
- Only extract tasks the user (recipient) must do — not what others are doing
- Must be concrete and actionable, not vague ("review the document", "send the file", "confirm attendance")
- Keep titles short and imperative — e.g. "Send Q3 report to Sarah by Friday"
- Extract a due date only if explicitly stated (YYYY-MM-DD), otherwise null
- reason: one short sentence explaining why (who asked and what for)
- Return 0–4 tasks maximum — quality over quantity
- If no clear tasks exist, return empty array

Output STRICT JSON: { "tasks": [ { "title": "string", "due": "YYYY-MM-DD | null", "reason": "string" } ] }`;

export async function POST(req: Request) {
  if (!GROQ_KEY) return NextResponse.json({ error: "Groq not configured. Set GROQ_API_KEY in .env.local" }, { status: 500 });

  let body: { subject?: string; sender?: string; body?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const userContent = [
    body.sender ? `From: ${body.sender}` : "",
    body.subject ? `Subject: ${body.subject}` : "",
    "",
    (body.body ?? "").slice(0, 3000),
  ].filter(Boolean).join("\n");

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) { const t = await r.text().catch(() => r.statusText); return NextResponse.json({ error: `Groq ${r.status}: ${t}` }, { status: 502 }); }
    const data = await r.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
    return NextResponse.json({ tasks: Array.isArray(parsed?.tasks) ? parsed.tasks : [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
