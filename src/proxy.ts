import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseUrl, supabaseAnonKey } from "@/lib/env";

// Refreshes the Supabase auth session on every request and keeps
// unauthenticated visitors out of the app (they get /login instead).
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run other code between createServerClient and
  // getUser() — this call refreshes the session token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // /set-password receives its session in the URL fragment, which never reaches
  // the server — so it must stay reachable while signed out or the invite dies here.
  const isAuthPage =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/set-password") ||
    path.startsWith("/auth/");

  // Offboarding: a disabled account is locked out immediately. Checked on every
  // request, so revoking access takes effect on the user's very next click.
  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("active")
      .eq("id", user.id)
      .maybeSingle();
    if (prof?.active === false) {
      if (isAuthPage) return response;
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "Your access has been removed. Contact an administrator.");
      return NextResponse.redirect(url);
    }
  }

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  // Signed-in users get bounced off /login, but not off /set-password —
  // accepting an invite signs you in first, then you choose a password.
  if (user && (path.startsWith("/login") || path.startsWith("/signup"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, images and PWA files.
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
