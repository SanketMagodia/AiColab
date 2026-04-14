"use client";

import {
  PublicClientApplication,
  type AccountInfo,
  type Configuration,
} from "@azure/msal-browser";

const CLIENT_ID = process.env.NEXT_PUBLIC_MS_CLIENT_ID ?? "";
const TENANT_ID = process.env.NEXT_PUBLIC_MS_TENANT_ID ?? "";

export const MS_SCOPES = [
  "Mail.Read",
  "Calendars.Read",
  "Calendars.ReadWrite",
  "Chat.Read",
  "Chat.ReadBasic",
  "Chat.ReadWrite",
  "Tasks.ReadWrite",
  "User.Read",
  "ChannelMessage.ReadWrite",
];

export const GRAPH = "https://graph.microsoft.com/v1.0";

let app: PublicClientApplication | null = null;
let boot: Promise<PublicClientApplication> | null = null;
let redirectResult: Awaited<ReturnType<PublicClientApplication["handleRedirectPromise"]>> = null;

export function getMsal(): Promise<PublicClientApplication> {
  if (app) return Promise.resolve(app);
  if (boot) return boot;
  if (!CLIENT_ID || !TENANT_ID)
    return Promise.reject(new Error("Set NEXT_PUBLIC_MS_CLIENT_ID and NEXT_PUBLIC_MS_TENANT_ID in .env.local"));

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const cfg: Configuration = {
    auth: {
      clientId: CLIENT_ID,
      authority: `https://login.microsoftonline.com/${TENANT_ID}`,
      redirectUri: `${origin}/auth-callback`,
    },
    cache: { cacheLocation: "localStorage" },
  };

  const pca = new PublicClientApplication(cfg);
  boot = pca.initialize().then(async () => {
    redirectResult = await pca.handleRedirectPromise().catch(() => null);
    app = pca;
    return pca;
  });
  return boot;
}

export function getRedirectResult() {
  return redirectResult;
}

export async function getToken(account: AccountInfo): Promise<string> {
  const pca = await getMsal();
  try {
    const r = await pca.acquireTokenSilent({ scopes: MS_SCOPES, account });
    return r.accessToken;
  } catch {
    await pca.acquireTokenRedirect({ scopes: MS_SCOPES, account });
    return "";
  }
}

export async function graphFetch<T = unknown>(
  account: AccountInfo,
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getToken(account);
  const r = await fetch(`${GRAPH}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> ?? {}),
    },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => r.statusText);
    throw new Error(`Graph ${r.status}: ${t}`);
  }
  if (r.status === 204) return null as T;
  return r.json();
}

export async function graphBlob(account: AccountInfo, endpoint: string): Promise<Blob | null> {
  const token = await getToken(account);
  const r = await fetch(`${GRAPH}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return r.blob();
}
