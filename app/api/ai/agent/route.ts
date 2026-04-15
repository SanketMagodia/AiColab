import { NextResponse } from "next/server";

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

type Ctx = {
  emails?: Array<{ from?: string; subject?: string; preview?: string; received?: string }>;
  chats?: Array<{
    chatId?: string; topic?: string; sender?: string; body?: string; at?: string;
    transcript?: Array<{ from?: string; text?: string; at?: string }>;
  }>;
  events?: Array<{ subject?: string; start?: string; end?: string }>;
  tasks?: Array<{ title?: string; due?: string; list?: string }>;
  now?: string;
  tz?: string;
  userName?: string;
};

const SYSTEM_PROMPT = `You are "AI Colab Agent", a helpful assistant embedded in a Microsoft 365 productivity dashboard. You can:
1. Answer questions about the user's latest Outlook emails and Teams chats (use ONLY the provided context; if info isn't present, say so).
2. Create calendar events or todo tasks on behalf of the user by emitting a structured action.
3. Send a Teams message in an EXISTING chat by picking a chatId from the provided "Recent Teams chats" list.

Output STRICT JSON in one of these shapes:

A) Plain answer:
{ "type": "answer", "text": "..." }

B) Create a todo task:
{ "type": "action", "action": { "kind": "task", "title": "...", "due": "YYYY-MM-DDTHH:mm:ss" | null, "notes": "..." | null }, "text": "short confirmation to show user" }

C) Create a calendar event:
{ "type": "action", "action": { "kind": "event", "subject": "...", "start": "YYYY-MM-DDTHH:mm:ss", "end": "YYYY-MM-DDTHH:mm:ss", "notes": "..." | null }, "text": "short confirmation to show user" }

D) Send a Teams chat message (existing chat only):
{ "type": "action", "action": { "kind": "teams_message", "chatId": "<exact chatId from context>", "recipient": "<sender or topic name from that chat>", "text": "<message to send>" }, "text": "short confirmation to show user" }

Rules:
- Use the provided "now" timestamp as the reference. Interpret "tomorrow", "next Monday", "in 30 min" etc. relative to it.
- Dates must be ISO 8601 local time (no Z suffix, no timezone offset). They'll be interpreted in the user's timezone.
- If the user requests an event without an end time, default duration to 30 minutes.
- If the user requests a task without a due date, set "due": null.
- Keep "text" confirmations concise (under 120 chars).
- When answering about emails/chats, quote senders & subjects accurately from context.
- If the request is ambiguous (missing title, unclear time, unclear recipient), respond with type "answer" asking a short clarifying question.
- Never invent emails, chats, events, or tasks that aren't in the provided context.
- For teams_message: the chatId MUST be copied verbatim from a chat in the context. If no chat in context matches the requested recipient (by sender name or topic), do NOT guess — reply with an "answer" saying you can only message people already in their recent Teams chats.
- When matching recipients, be tolerant of case and partial names (e.g. "priya" matches "Priya Sharma").
- Transcripts show the full recent back-and-forth. Messages labeled "me" are from the user — treat them as already sent. When composing a reply, respond to the OTHER person's most recent unanswered message, and do NOT repeat, paraphrase, or re-send anything "me" has already sent.
- If the other person hasn't said anything new since the user's last reply, ask the user for clarification rather than inventing a message.
- Stay consistent with the tone and content of the existing conversation.
- User may say reply "person" , so check the last message from that person and reply the most suitable message from the context`;

export async function POST(req: Request) {
  if (!GROQ_KEY) {
    return NextResponse.json(
      { error: "Groq not configured. Set GROQ_API_KEY in .env.local" },
      { status: 500 },
    );
  }

  let body: {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    context?: Ctx;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const ctx = body.context ?? {};
  const ctxParts: string[] = [];
  ctxParts.push(`Now: ${ctx.now ?? new Date().toISOString()}`);
  if (ctx.tz) ctxParts.push(`User timezone: ${ctx.tz}`);
  if (ctx.userName) ctxParts.push(`User: ${ctx.userName}`);

  if (ctx.emails?.length) {
    ctxParts.push("Recent Outlook emails:");
    ctx.emails.slice(0, 10).forEach((e, i) =>
      ctxParts.push(`  ${i + 1}. [${e.received ?? "?"}] ${e.from ?? "?"} — "${e.subject ?? "(no subject)"}": ${(e.preview ?? "").slice(0, 200)}`),
    );
  }
  if (ctx.chats?.length) {
    ctxParts.push("Recent Teams chats (chatId is REQUIRED when emitting teams_message). Transcripts are newest-last. Messages from the user are labeled \"me\".");
    ctx.chats.slice(0, 10).forEach((c, i) => {
      ctxParts.push(`  Chat ${i + 1}: chatId="${c.chatId ?? ""}" · with ${c.sender ?? "?"} (${c.topic ?? "DM"})`);
      if (c.transcript?.length) {
        c.transcript.slice(-8).forEach(m =>
          ctxParts.push(`    - [${m.at ?? ""}] ${m.from}: ${(m.text ?? "").slice(0, 300)}`),
        );
      } else if (c.body) {
        ctxParts.push(`    - [${c.at ?? ""}] ${c.sender}: ${c.body.slice(0, 200)}`);
      }
    });
  }
  if (ctx.events?.length) {
    ctxParts.push("Upcoming events:");
    ctx.events.slice(0, 10).forEach((e, i) =>
      ctxParts.push(`  ${i + 1}. ${e.subject ?? "(untitled)"} ${e.start ?? ""} — ${e.end ?? ""}`),
    );
  }
  if (ctx.tasks?.length) {
    ctxParts.push("Open tasks:");
    ctx.tasks.slice(0, 15).forEach((t, i) =>
      ctxParts.push(`  ${i + 1}. ${t.title ?? ""}${t.due ? ` (due ${t.due})` : ""}${t.list ? ` [${t.list}]` : ""}`),
    );
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: ctxParts.join("\n") },
  ];
  for (const h of (body.history ?? []).slice(-6)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: "user", content: body.message });

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => r.statusText);
      return NextResponse.json({ error: `Groq ${r.status}: ${text}` }, { status: 502 });
    }

    const data = await r.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ type: "answer", text: content });
    }
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 },
    );
  }
}
