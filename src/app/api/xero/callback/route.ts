import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, fetchTenants } from "@/lib/xero";

// Where Xero sends the user back after they approve. Verifies the state cookie,
// swaps the code for tokens, and stores them via the admin-only definer
// function. Tokens never touch the browser — they go straight to the database.
function back(request: NextRequest, message: string) {
  const url = new URL("/settings", request.url);
  url.searchParams.set("xero", message);
  const res = NextResponse.redirect(url);
  res.cookies.delete("xero_oauth_state");
  return res;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const error = params.get("error");
  if (error) return back(request, `Xero refused the connection: ${error}`);

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get("xero_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return back(request, "That Xero link was invalid or had expired. Try connecting again.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  try {
    // The token exchange must present the SAME redirect_uri that started the
    // flow, so this goes through the identical helper.
    const tokens = await exchangeCodeForTokens(code, request.nextUrl.origin);
    const tenants = await fetchTenants(tokens.access_token);
    const tenant = tenants[0];
    if (!tenant) {
      return back(request, "No Xero organisation was shared with this connection.");
    }

    const { error: saveError } = await supabase.rpc("xero_save_connection", {
      p_tenant_id: tenant.tenantId,
      p_tenant_name: tenant.tenantName,
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token,
      p_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    });
    if (saveError) return back(request, `Could not save the connection: ${saveError.message}`);

    return back(request, `Connected to ${tenant.tenantName}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    // Deliberately not echoing the raw error to the URL — it can contain tokens.
    console.error("xero callback", message);
    return back(request, "Connecting to Xero failed. Check the app credentials and try again.");
  }
}
