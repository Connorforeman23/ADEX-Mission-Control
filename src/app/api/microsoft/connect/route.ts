import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { msAuthorizeUrl, msConfigured, msRedirectUri } from "@/lib/microsoft";

// Starts a person's own Microsoft connection.
//
// NOT admin-only, unlike Xero: everyone links their own mailbox, by their own
// choice. The one-time `state` cookie is what stops someone being tricked into
// connecting an account they did not intend to (CSRF).
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  if (!msConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?ms=Microsoft+365+is+not+configured+on+this+environment", request.url)
    );
  }

  const origin = request.nextUrl.origin;

  // The whole flow must happen on ONE hostname. We set a state cookie here and
  // read it back in the callback, but Microsoft always returns to the fixed
  // MS_REDIRECT_URI host — and a cookie set on a different Vercel hostname
  // simply isn't there to read, so the check fails and the connection looks
  // expired. This cost us a day on Xero; start on the canonical host instead.
  const canonicalOrigin = new URL(msRedirectUri(origin)).origin;
  if (canonicalOrigin !== origin) {
    return NextResponse.redirect(new URL("/api/microsoft/connect", canonicalOrigin));
  }

  const state = crypto.randomUUID();
  // The redirect URI is a public URL, not a secret — logging it is what makes
  // "the reply URL does not match" diagnosable in one look.
  console.log("[ms] sending redirect_uri:", msRedirectUri(origin));

  const response = NextResponse.redirect(msAuthorizeUrl(origin, state));
  response.cookies.set("ms_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // ten minutes is ample to complete a consent screen
  });
  return response;
}
