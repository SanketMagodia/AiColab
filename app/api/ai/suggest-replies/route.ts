import { NextResponse } from "next/server";

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You generate exactly 3 short reply suggestions for a Teams chat message. Keep each reply concise (1-2 sentences max). Make them contextually appropriate and varied:
- One positive/agreeing response
- One that asks for more info or offers to help
- One brief acknowledgment or direct answer

Output STRICT JSON: { "suggestions": ["string", "string", "string"] }
Keep suggestions natural and conversational — not robotic.`;

export async function POST(req: Request) {
  if (!GROQ_KEY) {
    return NextResponse.json(
      { error: "Groq not configured. Set GROQ_API_KEY in .env.local" },
      { status: 500 },
    );
  }

  let body: { message: string; sender: string; context?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userContent = [
    `Message from ${body.sender}: "${body.message}"`,
    body.context ? `Additional context: ${body.context}` : "",
  ]
    .filter(Boolean)
    .join("\n");

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
          { role: "user", content: userContent },
        ],
        temperature: 0.6,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => r.statusText);
      return NextResponse.json({ error: `Groq ${r.status}: ${text}` }, { status: 502 });
    }

    const data = await r.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";

    let parsed: { suggestions?: string[] };
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
