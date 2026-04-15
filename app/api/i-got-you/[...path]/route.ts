import { NextRequest, NextResponse } from "next/server";

/**
 * 🪤 Honeypot-flavored proxy for Microsoft Graph.
 *
 * If you're reading this because you opened the Network tab and got curious:
 * hi 👋 there's nothing juicy here — just a relay. The actual upstream URL
 * lives server-side. Try building something cool instead.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM = "https://graph.microsoft.com/v1.0";

const PLAYFUL_HEADERS = {
  "x-knock-knock": "who-is-there",
  "x-caught-ya": "nice-try-friend",
  "x-note": "this-is-a-proxy-not-a-backdoor",
};

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length",
]);

// Strip from responses: Next/undici already decompressed the body, so passing
// these through would make the browser try to decompress plain bytes.
const STRIP_RESPONSE_HEADERS = new Set([
  "content-encoding", "content-length", "transfer-encoding",
]);

// Strip from request we forward to Graph: we don't want to advertise
// encodings Next's fetch will then auto-decompress transparently.
const STRIP_REQUEST_HEADERS = new Set([
  "accept-encoding", "content-length", "host", "connection",
]);

function pickHeaders(src: Headers, strip: Set<string>): Headers {
  const out = new Headers();
  src.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (HOP_BY_HOP.has(lk)) return;
    if (strip.has(lk)) return;
    out.set(k, v);
  });
  return out;
}

const PREFIX = "/api/i-got-you";

async function relay(req: NextRequest, _ctx: { params: { path: string[] } }) {
  const pathname = req.nextUrl.pathname;
  const subpath = pathname.startsWith(PREFIX) ? pathname.slice(PREFIX.length) : pathname;
  const search = req.nextUrl.search || "";
  const target = `${UPSTREAM}${subpath}${search}`;

  const auth = req.headers.get("authorization");
  if (!auth) {
    return NextResponse.json(
      { message: "I got you 👀 — no token, no cookies, no fun. Move along." },
      { status: 401, headers: PLAYFUL_HEADERS },
    );
  }

  const fwdHeaders = pickHeaders(req.headers, STRIP_REQUEST_HEADERS);
  fwdHeaders.delete("cookie");

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: fwdHeaders,
      body: body && body.byteLength ? body : undefined,
      // follow Graph redirects server-side (e.g. photo $value → CDN)
      // so the client never sees graph.microsoft.com
      redirect: "follow",
      cache: "no-store",
    });
  } catch (e) {
    return NextResponse.json(
      { message: "upstream unreachable", error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502, headers: PLAYFUL_HEADERS },
    );
  }

  const respHeaders = pickHeaders(upstream.headers, STRIP_RESPONSE_HEADERS);
  Object.entries(PLAYFUL_HEADERS).forEach(([k, v]) => respHeaders.set(k, v));

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export const GET = relay;
export const POST = relay;
export const PUT = relay;
export const PATCH = relay;
export const DELETE = relay;
export const OPTIONS = relay;
