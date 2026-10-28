import "server-only";

import { createClient } from "@/lib/supabase/server";

// Microsoft 365 (Graph) — SERVER ONLY. The "server-only" import above makes
// the build fail if a client component ever imports this file, so the client
// secret can never reach a browser.
//
// Note the deliberate absence of NEXT_PUBLIC_ on these names: that prefix is
// what inlines a value into browser JavaScript. Same trap that broke the 0.3
// preview, and the same discipline as lib/xero.ts.
//
// This connection is PER PERSON. Everyone links their own mailbox; the CRM
// never has standing access to anyone's mail, and nothing runs when nobody is
// signed in.

const GRAPH = "https://graph.microsoft.com/v1.0";

function tenant() {
  return (process.env.MS_TENANT_ID ?? "").trim();
}
export function msClientId() {
  return (process.env.MS_CLIENT_ID ?? "").trim();
}
function msClientSecret() {
  return (process.env.MS_CLIENT_SECRET ?? "").trim();
}

/** Microsoft is optional — the app must run perfectly well without it. */
export function msConfigured() {
  return Boolean(msClientId() && msClientSecret() && tenant());
}

const authority = () => `https://login.microsoftonline.com/${tenant() || "common"}`;

/**
 * What we ask Microsoft for, and why — nothing wider:
 *
 *   User.Read            who signed in
 *   Mail.Read            file client and supplier emails against the company
 *   Mail.Send            the 09:30 summary, sent as them
 *   Calendars.Read       show their meetings in the CRM
 *   Calendars.ReadWrite  put a task THEY timed into their own calendar
 *   offline_access       stay connected without a daily sign-in
 *
 * Override with MS_SCOPES to test a narrower set without a code change.
 */
export const MS_SCOPES = (
  process.env.MS_SCOPES ??
  "openid profile email offline_access User.Read Mail.Read Mail.Send Calendars.Read Calendars.ReadWrite"
).trim();

/**
 * The callback address, which must match the app registration EXACTLY.
 *
 * Explicit rather than derived, for the reason Xero taught us: Vercel gives
 * every deployment its own hostname, so a derived value silently changes with
 * whichever preview URL you happen to be on and stops matching.
 */
export function msRedirectUri(origin: string) {
  const explicit = (process.env.MS_REDIRECT_URI ?? "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return `${origin.replace(/\/$/, "")}/api/microsoft/callback`;
}

export function msAuthorizeUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_id: msClientId(),
    response_type: "code",
    redirect_uri: msRedirectUri(origin),
    response_mode: "query",
    scope: MS_SCOPES,
    state,
  });
  return `${authority()}/oauth2/v2.0/authorize?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
};

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(`${authority()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: msClientId(),
      client_secret: msClientSecret(),
      ...body,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    // Microsoft's errors are genuinely helpful; pass them through rather than
    // hiding them behind "something went wrong".
    let detail = text;
    let code = "";
    try {
      const j = JSON.parse(text);
      detail = j.error_description || j.error || text;
      code = j.error ?? "";
    } catch {
      /* not JSON — use the raw text */
    }

    // A refresh token belongs to the app registration that issued it. Point
    // the CRM at a different app — as we did when the client ID turned out to
    // be wrong — and every existing connection starts failing with this,
    // which reads like a fault rather than the one-click fix it is.
    if (code === "invalid_grant" || /AADSTS70000|AADSTS700082|AADSTS54005/.test(detail)) {
      throw new Error(
        "This connection was made under the old Microsoft setup, so it has to be remade. " +
          "Press Disconnect, then connect again — it takes a few seconds and nothing is lost."
      );
    }

    throw new Error(`Microsoft sign-in failed (${res.status}): ${detail}`);
  }
  return JSON.parse(text) as TokenResponse;
}

export async function exchangeCodeForTokens(code: string, origin: string) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: msRedirectUri(origin),
    scope: MS_SCOPES,
  });
}

/**
 * A valid access token for the signed-in person, refreshing if it is close to
 * expiry. Microsoft rotates the refresh token on use, so the new pair must be
 * stored immediately or the connection dies silently next time.
 */
export async function getValidToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ms_get_tokens");
  if (error) throw new Error(error.message);

  const row = (data as unknown as {
    access_token: string;
    refresh_token: string;
    expires_at: string;
  }[])?.[0];
  if (!row) return null;

  // Refresh a minute early rather than racing the expiry.
  if (new Date(row.expires_at).getTime() - Date.now() > 60_000) return row.access_token;

  const fresh = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: row.refresh_token,
    scope: MS_SCOPES,
  });

  await supabase.rpc("ms_update_tokens", {
    p_access_token: fresh.access_token,
    p_refresh_token: fresh.refresh_token,
    p_expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
  });
  return fresh.access_token;
}

/** An authenticated call to Microsoft Graph, as the signed-in person. */
export async function graph<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getValidToken();
  if (!token) throw new Error("Your Microsoft account isn't connected. Connect it in Settings.");

  const res = await fetch(path.startsWith("http") ? path : `${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Microsoft refused ${init?.method ?? "GET"} ${path.split("?")[0]} (${res.status}). ` +
          "Either the connection has lapsed — reconnect in Settings — or this action needs a " +
          "permission that wasn't granted."
      );
    }
    throw new Error(`Microsoft ${path} failed (${res.status}): ${body}`);
  }
  return (res.status === 204 ? (undefined as T) : ((await res.json()) as T));
}

export type MsUser = {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
};

/** Who the connected account belongs to. */
export async function fetchMe(token: string): Promise<MsUser> {
  const res = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Could not read the Microsoft account (${res.status})`);
  return (await res.json()) as MsUser;
}
