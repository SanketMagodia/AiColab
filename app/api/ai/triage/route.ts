import { NextResponse } from "next/server";

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are an email triage assistant. Classify each email into exactly one category.

Categories:
- "urgent": requires action from the user TODAY — deadlines, urgent requests, critical issues, time-sensitive asks
- "action": requires a response or action but not necessarily today — questions, requests, follow-ups
- "fyi": informational only, no action needed — reports, announcements, read-only notifications
- "newsletter": bulk mail, newsletters, marketing, automated system notifications, subscriptions

Rules:
- Be conservative with "urgent" — only mark truly time-sensitive items
- Most work emails are "action", not "urgent"
- Automated alerts, receipts, confirmations → "fyi" or "newsletter"
- Output STRICT JSON — no markdown, no extra text

Output: { "triage": [ { "id": "string", "label": "urgent" | "action" | "fyi" | "newsletter" } ] }`;

export async function POST(req: Request) {
  if (!GROQ_KEY) return NextResponse.json({ error: "Groq not configured. Set GROQ_API_KEY in .env.local" }, { status: 500 });

  let body: { emails: Array<{ id: string; subject: string; preview: string; sender: string; receivedAt: string }> };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  if (!body.emails?.length) return NextResponse.json({ triage: [] });

  const userContent = body.emails
    .slice(0, 20)
    .map((e, i) => `${i + 1}. id="${e.id}" | from: ${e.sender} | subject: ${e.subject} | preview: ${e.preview.slice(0, 150)}`)
    .join("\n");

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Classify these emails:\n${userContent}` },
        ],
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) { const t = await r.text().catch(() => r.statusText); return NextResponse.json({ error: `Groq ${r.status}: ${t}` }, { status: 502 }); }
    const data = await r.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
    return NextResponse.json({ triage: Array.isArray(parsed?.triage) ? parsed.triage : [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
