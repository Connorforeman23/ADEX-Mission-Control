import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { XeroContact } from "@/lib/xero-types";

// Xero OAuth 2.0 + API access. SERVER ONLY — the "server-only" import above
// makes the build fail if a client component ever imports this file, so the
// client secret can never reach the browser.
//
// Note the deliberate absence of NEXT_PUBLIC_ on these names: that prefix is
// what inlines a value into browser JavaScript, and it is exactly the mistake
// that broke the 0.3 preview. These stay server-side.

const AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const TOKEN_URL = "https://identity.xero.com/connect/token";
const CONNECTIONS_URL = "https://api.xero.com/connections";
const API_BASE = "https://api.xero.com/api.xro/2.0";

/**
 * Read contacts and manage invoices/bills, plus a refresh token. Nothing more.
 * Ordered as Xero's own documentation lists them.
 */
export const XERO_SCOPES = [
  "openid",
  "profile",
  "email",
  "accounting.transactions",
  "accounting.contacts.read",
  "offline_access",
].join(" ");

export function xeroClientId() {
  return (process.env.XERO_CLIENT_ID ?? "").trim();
}
function xeroClientSecret() {
  return (process.env.XERO_CLIENT_SECRET ?? "").trim();
}

/** Xero is optional — the app must run perfectly well without it configured. */
export function xeroConfigured() {
  return Boolean(xeroClientId() && xeroClientSecret());
}

/**
 * The callback address, which must match what's registered in the Xero app
 * EXACTLY or Xero returns "Invalid redirect_uri".
 *
 * Prefer an explicit XERO_REDIRECT_URI. Deriving it from the incoming request
 * seems tidier but is fragile: Vercel gives every deployment its own hostname,
 * so the value silently changes depending on which preview URL you happen to be
 * browsing, and stops matching Xero. Setting it explicitly makes it deterministic.
 *
 * Falls back to deriving from the origin when unset, so local work still runs.
 */
export function xeroRedirectUri(origin: string) {
  const explicit = (process.env.XERO_REDIRECT_URI ?? "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return `${origin.replace(/\/$/, "")}/api/xero/callback`;
}

export function xeroAuthorizeUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: xeroClientId(),
    redirect_uri: xeroRedirectUri(origin),
    scope: XERO_SCOPES,
    state,
  });
  // URLSearchParams encodes spaces as "+", but Xero expects "%20" in the scope
  // list and rejects the request with "invalid_scope" otherwise. None of the
  // other values can contain a literal "+", so replacing globally is safe.
  return `${AUTHORIZE_URL}?${params.toString().replace(/\+/g, "%20")}`;
}

function basicAuthHeader() {
  return "Basic " + Buffer.from(`${xeroClientId()}:${xeroClientSecret()}`).toString("base64");
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

/** Swap the one-time code from the callback for a token pair. */
export async function exchangeCodeForTokens(code: string, origin: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: xeroRedirectUri(origin),
    }),
  });
  if (!res.ok) {
    throw new Error(`Xero token exchange failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Which Xero organisation(s) this connection can reach. */
export async function fetchTenants(accessToken: string) {
  const res = await fetch(CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Xero connections failed (${res.status})`);
  return (await res.json()) as { tenantId: string; tenantName: string }[];
}

/**
 * A valid access token, refreshing if it's close to expiry.
 *
 * IMPORTANT: Xero rotates the refresh token every time it is used. The new pair
 * must be stored immediately or the connection dies silently the next time.
 */
export async function getValidAccessToken(): Promise<{ token: string; tenantId: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("xero_get_connection");
  if (error) throw new Error(error.message);

  const row = (data as unknown as {
    tenant_id: string;
    access_token: string;
    refresh_token: string;
    expires_at: string;
  }[])?.[0];
  if (!row) return null;

  // Refresh a minute early rather than racing the expiry.
  const expiresAt = new Date(row.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) {
    return { token: row.access_token, tenantId: row.tenant_id };
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }),
  });
  if (!res.ok) {
    throw new Error(
      "The Xero connection has expired and could not be refreshed. Reconnect Xero in Settings."
    );
  }
  const fresh = (await res.json()) as TokenResponse;

  await supabase.rpc("xero_update_tokens", {
    p_access_token: fresh.access_token,
    p_refresh_token: fresh.refresh_token,
    p_expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
  });

  return { token: fresh.access_token, tenantId: row.tenant_id };
}

/** Authenticated call against the Xero accounting API. */
export async function xeroApi<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = await getValidAccessToken();
  if (!auth) throw new Error("Xero is not connected.");

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Xero-Tenant-Id": auth.tenantId,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Xero API ${path} failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function fetchXeroContacts(): Promise<XeroContact[]> {
  const data = await xeroApi<{ Contacts?: XeroContact[] }>("/Contacts?order=Name");
  return data.Contacts ?? [];
}
