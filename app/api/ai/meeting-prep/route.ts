import { NextResponse } from "next/server";

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are a meeting preparation assistant. Given an upcoming meeting and the user's recent emails and chats, produce a concise meeting brief.

Output STRICT JSON:
{
  "summary": "1–2 sentence context summary explaining what this meeting is about",
  "points": ["talking point 1", "talking point 2", "talking point 3"],
  "questions": ["smart question to raise 1", "question 2"],
  "actions": ["thing to do before meeting 1", "thing 2"]
}

Rules:
- summary: use available context to explain purpose; if no context, describe based on meeting title
- points: 3–5 specific, concrete talking points — reference email/chat details when available
- questions: 2–3 smart questions to clarify or advance the meeting objective
- actions: pre-meeting prep items (review doc, prepare slides, confirm attendees) — can be empty array []
- Keep every item concise — under 15 words each
- Never fabricate names, numbers, or decisions not mentioned in context`;

export async function POST(req: Request) {
  if (!GROQ_KEY) return NextResponse.json({ error: "Groq not configured. Set GROQ_API_KEY in .env.local" }, { status: 500 });

  let body: {
    event: { subject: string; start: string; end: string };
    emails?: Array<{ from?: string; subject?: string; preview?: string }>;
    chats?: Array<{ sender?: string; body?: string }>;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const parts: string[] = [
    `Meeting: ${body.event.subject}`,
    `Time: ${body.event.start} — ${body.event.end}`,
    "",
  ];
  if (body.emails?.length) {
    parts.push("Related emails:");
    body.emails.slice(0, 6).forEach(e =>
      parts.push(`  - From ${e.from ?? "?"}: "${e.subject ?? ""}" — ${(e.preview ?? "").slice(0, 200)}`)
    );
    parts.push("");
  }
  if (body.chats?.length) {
    parts.push("Related Teams chats:");
    body.chats.slice(0, 6).forEach(c =>
      parts.push(`  - ${c.sender ?? "?"}: ${(c.body ?? "").slice(0, 200)}`)
    );
  }

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: parts.join("\n") },
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) { const t = await r.text().catch(() => r.statusText); return NextResponse.json({ error: `Groq ${r.status}: ${t}` }, { status: 502 }); }
    const data = await r.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
