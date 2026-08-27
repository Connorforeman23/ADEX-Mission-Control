import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xeroAuthorizeUrl, xeroConfigured, xeroRedirectUri } from "@/lib/xero";

// Starts the Xero connection. Admin-only, and sets a one-time `state` cookie
// that the callback checks — that's what stops someone tricking an admin into
// connecting an attacker's Xero organisation (CSRF).
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    return NextResponse.redirect(
      new URL("/settings?xero=Only+an+administrator+can+connect+Xero", request.url)
    );
  }

  if (!xeroConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?xero=Xero+is+not+configured+on+this+environment", request.url)
    );
  }

  const state = crypto.randomUUID();
  const origin = request.nextUrl.origin;

  // Logged so the exact value can be compared against what's registered in Xero
  // when it complains about the redirect URI. It's a public URL, not a secret.
  console.log("[xero] browsing origin:", origin);
  console.log("[xero] sending redirect_uri:", xeroRedirectUri(origin));

  const authorizeUrl = xeroAuthorizeUrl(origin, state);
  // Full URL logged (minus nothing sensitive — the client id is public) so a
  // rejection from Xero can be diagnosed from the exact request we made.
  console.log("[xero] authorize url:", authorizeUrl);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("xero_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // ten minutes is ample to complete a consent screen
  });
  return response;
}
