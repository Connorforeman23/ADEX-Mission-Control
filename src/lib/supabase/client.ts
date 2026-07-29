import { createBrowserClient } from "@supabase/ssr";

// Env values pasted into a hosting dashboard often arrive with a stray
// newline, BOM or non-breaking space attached, which makes the auth request
// fail with an unhelpful "non ISO-8859-1 code point" error. Strip those.
export function cleanEnv(value: string | undefined) {
  return (value ?? "").trim().replace(/[^\x20-\x7E]/g, "");
}

// Supabase client for use in Client Components ("use client").
export function createClient() {
  return createBrowserClient(
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}
