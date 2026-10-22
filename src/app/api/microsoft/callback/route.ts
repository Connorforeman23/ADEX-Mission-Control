import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, fetchMe } from "@/lib/microsoft";

// Where Microsoft sends the person back after they approve. Verifies the state
// cookie, swaps the code for tokens, and stores them through the definer
// function — the tokens never touch the browser.
function back(request: NextRequest, message: string) {
  const url = new URL("/settings", request.url);
  url.searchParams.set("ms", message);
  const res = NextResponse.redirect(url);
  res.cookies.delete("ms_oauth_state");
  return res;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // "access_denied" on its own says nothing about why; error_description does.
  const error = params.get("error");
  if (error) {
    const detail = params.get("error_description");
    console.error("[ms] callback error:", error, detail);
    return back(request, `Microsoft refused the connection: ${error}${detail ? ` — ${detail}` : ""}`);
  }

  // An administrator approving the app for their whole organisation comes
  // back here too, but with `admin_consent` and no `code` — there is no
  // mailbox to connect, because they were consenting on everyone's behalf.
  //
  // Answered with a page rather than the usual redirect to Settings: the
  // person doing this is a Microsoft admin, who may well have no CRM login,
  // and bouncing them to a sign-in screen looks exactly like a failure.
  if (params.get("admin_consent")) {
    const tenantId = params.get("tenant") ?? "your organisation";
    console.log("[ms] admin consent granted for tenant:", tenantId);
    return new NextResponse(
      `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>Consent granted</title>` +
        `<style>body{font-family:system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1.5rem;line-height:1.6;color:#0d1b2a}` +
        `code{background:#f1f4f8;padding:.1rem .35rem;border-radius:4px;font-size:.9em}</style></head><body>` +
        `<h1>Consent granted</h1>` +
        `<p>ADEX Mission Control is now approved for directory <code>${tenantId.replace(/[^a-zA-Z0-9-]/g, "")}</code>.</p>` +
        `<p>Nothing further is needed from you. Staff can now link their own mailbox from the CRM&rsquo;s Settings page, and each of them still approves that individually.</p>` +
        `</body></html>`,
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get("ms_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return back(request, "That Microsoft link was invalid or had expired. Try connecting again.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const tokens = await exchangeCodeForTokens(code, request.nextUrl.origin);
    const me = await fetchMe(tokens.access_token);

    const { error: saveError } = await supabase.rpc("ms_save_connection", {
      p_account_email: me.mail ?? me.userPrincipalName,
      p_account_name: me.displayName,
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token,
      p_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      p_scopes: tokens.scope ?? "",
    });
    if (saveError) return back(request, `Connected, but could not be saved: ${saveError.message}`);

    return back(request, `Connected as ${me.mail ?? me.userPrincipalName}`);
  } catch (e) {
    return back(request, e instanceof Error ? e.message : "Could not connect to Microsoft.");
  }
}
