import { NextResponse } from "next/server";

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are a professional email assistant. The user will describe what they want to write and you generate a complete, well-formatted email reply or new email.

Rules:
- Write in a professional but natural tone matching the context
- If replying, keep context from the original email and address it appropriately
- ALWAYS generate a clear, specific subject line — never leave it empty or generic
- For replies, prefix subject with "Re: " (keep the original topic)
- For new emails, write a concise subject that captures the email's purpose
- Output STRICT JSON: { "subject": "string", "body": "string" }
- The body should be plain text with proper paragraph breaks (use \\n\\n between paragraphs)
- Include an appropriate greeting and professional sign-off
- Keep it concise but thorough`;

export async function POST(req: Request) {
  if (!GROQ_KEY) {
    return NextResponse.json(
      { error: "Groq not configured. Set GROQ_API_KEY in .env.local" },
      { status: 500 },
    );
  }

  let body: {
    prompt: string;
    originalSubject?: string;
    originalBody?: string;
    originalSender?: string;
    replyType?: string;
    userName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parts = [`User wants to write: ${body.prompt}`];
  if (body.userName) parts.push(`The user's name: ${body.userName}`);
  if (body.replyType) parts.push(`This is a ${body.replyType} to the email below.`);
  if (body.originalSubject) parts.push(`Original subject: ${body.originalSubject}`);
  if (body.originalSender) parts.push(`Original sender: ${body.originalSender}`);
  if (body.originalBody)
    parts.push(`Original email body (truncated):\n${body.originalBody.slice(0, 2000)}`);

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: parts.join("\n\n") },
        ],
        temperature: 0.4,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => r.statusText);
      return NextResponse.json({ error: `Groq ${r.status}: ${text}` }, { status: 502 });
    }

    const data = await r.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";

    let parsed: { subject?: string; body?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON", raw: content },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 },
    );
  }
}
