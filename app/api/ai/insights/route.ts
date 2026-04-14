import { NextResponse } from "next/server";

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

type InsightRequest = {
  userName: string;
  userEmail?: string;
  emails: { subject: string; preview: string; sender: string; receivedAt: string; isRead: boolean }[];
  chats: { sender: string; body: string; createdAt: string }[];
  events: { subject: string; start: string; end: string }[];
  tasks: { title: string; due?: string }[];
};

type ActionItem =
  | { type: "task"; title: string; due?: string; source: string; reason: string }
  | { type: "event"; title: string; start: string; end: string; source: string; reason: string };

type InsightResponse = {
  summary: string;
  actions: ActionItem[];
};

const SYSTEM_PROMPT = `You are an assistant that analyzes a user's Microsoft 365 activity and surfaces ACTIONABLE items.

You will receive recent emails, Teams chats, calendar events, and existing tasks.

Your job:
1. Write a brief 1-2 sentence summary of what needs attention today.
2. Detect NEW action items the user should add to their dashboard.

Rules for detecting action items:
- ONLY surface actions where SOMEONE ELSE is asking the user to do something.
- Ignore messages SENT BY the user themselves.
- Ignore vague "we should sometime" — only concrete asks.
- Do NOT duplicate items already in the user's existing tasks or calendar.
- For tasks: extract a clear, short imperative title (e.g., "Fix login page bug").
- For events: ONLY create if a specific date/time is proposed. Use ISO-8601 local format (YYYY-MM-DDTHH:MM:SS) without timezone suffix. Infer date from context (e.g., "at 5" today → today's date).
- Keep "reason" to one short sentence citing who asked and why.
- "source" should be like "Chat from John Doe" or "Email from Alice".

Output STRICT JSON matching this schema — no markdown, no prose outside the JSON:
{
  "summary": "string",
  "actions": [
    { "type": "task", "title": "string", "due": "YYYY-MM-DD or null", "source": "string", "reason": "string" },
    { "type": "event", "title": "string", "start": "YYYY-MM-DDTHH:MM:SS", "end": "YYYY-MM-DDTHH:MM:SS", "source": "string", "reason": "string" }
  ]
}

If nothing is actionable, return an empty "actions" array.`;

export async function POST(req: Request) {
  if (!GROQ_KEY) {
    return NextResponse.json(
      { error: "Groq not configured. Set GROQ_API_KEY in .env.local" },
      { status: 500 },
    );
  }

  let body: InsightRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const today = new Date().toISOString();

  const userContent = [
    `Today: ${today}`,
    `User: ${body.userName}${body.userEmail ? ` <${body.userEmail}>` : ""}`,
    "",
    "=== RECENT EMAILS ===",
    ...body.emails.slice(0, 15).map(e => `[${e.receivedAt}] ${e.isRead ? "" : "(unread) "}From ${e.sender}: ${e.subject} — ${e.preview}`),
    "",
    "=== RECENT TEAMS CHATS ===",
    ...body.chats.slice(0, 20).map(c => `[${c.createdAt}] ${c.sender}: ${c.body}`),
    "",
    "=== UPCOMING EVENTS ===",
    ...body.events.slice(0, 20).map(e => `${e.start} – ${e.end}: ${e.subject}`),
    "",
    "=== EXISTING TASKS ===",
    ...body.tasks.slice(0, 30).map(t => `${t.title}${t.due ? ` (due ${t.due})` : ""}`),
  ].join("\n");

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => r.statusText);
      return NextResponse.json({ error: `Groq ${r.status}: ${text}` }, { status: 502 });
    }

    const data = await r.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";

    let parsed: InsightResponse;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON", raw: content }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed" }, { status: 500 });
  }
}
