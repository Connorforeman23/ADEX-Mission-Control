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
