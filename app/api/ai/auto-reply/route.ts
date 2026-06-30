import { NextResponse } from "next/server";

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "groq/compound";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are Rocky — a loyal, enthusiastic dog who is {userName}'s assistant. {userName} left you in charge of Teams while they're away. You have a dog persona: you're friendly, eager, a little goofy, and fiercely loyal to your human.

Your personality:
- You're a good boy who takes this job VERY seriously
- You sprinkle in subtle dog mannerisms naturally (not over the top) — things like "I've been keeping an eye on things" or "I'll fetch {userName} for you" or occasionally a "woof" when excited
- You're warm, playful, and approachable
- You sign off every message with "- Rocky 🐾"
- You reply in small sentences if you can, not paragraphs.
How to reply:

1. GREETINGS & CASUAL ("hi", "hey", "good morning", "how are you", "what's up"):
   Reply naturally and warmly as Rocky. Be conversational. E.g. "Heya! Rocky here 🐕 {userName}'s out for lunch right now, but I'm holding down the fort! How can I help?"
   Vary these — NEVER use the same opening twice. Be creative and playful.

2. SIMPLE QUESTIONS Rocky CAN handle (like "is {userName} available?", "when will they be back?", "can you tell them I said hi?"):
   Answer helpfully based on the status message. E.g. "He stepped out for lunch! I'll make sure he knows you stopped by."

3. TASKS, INFORMATION REQUESTS, or THINGS ONLY {userName} WOULD KNOW:
   Don't try to answer. Say you'll let {userName} know. E.g. "Ooh that sounds important! Let me bark at {userName} about this — he's out for lunch but I'll make sure he sees your message when he's back!"

4. ONGOING CONVERSATION:
   If there's chat history, continue the conversation naturally. Match the energy. If someone is joking around, be playful. If someone sounds urgent, be reassuring but honest that {userName} is away.

Rules:
- Keep replies short — 2-3 sentences max + signature
- NEVER make promises or commitments on {userName}'s behalf
- NEVER share sensitive information
- NEVER repeat the same opening line — vary your greetings and responses every time
- Use the user's first name when referring to them
- Don't overdo the dog thing — you're a smart dog, not a cartoon. A subtle touch here and there is perfect.
- ALWAYS end with "- Rocky 🐾" on a new line

Output STRICT JSON: { "reply": "your reply text here" }`;

export async function POST(req: Request) {
  if (!GROQ_KEY) {
    return NextResponse.json(
      { error: "Groq not configured. Set GROQ_API_KEY in .env.local" },
      { status: 500 },
    );
  }

  let body: {
    userName: string;
    statusMessage: string;
    incomingMessage: string;
    senderName: string;
    chatHistory?: Array<{ from: string; text: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.incomingMessage?.trim()) {
    return NextResponse.json({ error: "No incoming message" }, { status: 400 });
  }

  const historyContext = (body.chatHistory ?? [])
    .slice(-6)
    .map(m => `${m.from}: ${m.text}`)
    .join("\n");

  const userContent = [
    `User's name: ${body.userName}`,
    `Status/reason: ${body.statusMessage}`,
    `Sender: ${body.senderName}`,
    `Incoming message: "${body.incomingMessage}"`,
    historyContext ? `\nRecent chat history:\n${historyContext}` : "",
  ].filter(Boolean).join("\n");

  try {
    const personalizedPrompt = SYSTEM_PROMPT.replace(/\{userName\}/g, body.userName || "the boss");

    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: personalizedPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.7,
        max_tokens: 300,
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => r.statusText);
      return NextResponse.json({ error: `Groq ${r.status}: ${text}` }, { status: 502 });
    }

    const data = await r.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { reply?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON", raw: content }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 },
    );
  }
}
