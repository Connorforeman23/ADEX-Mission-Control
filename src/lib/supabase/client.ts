import { createBrowserClient } from "@supabase/ssr";

// Env values pasted into a hosting dashboard often arrive with a stray
// newline, BOM or non-breaking space attached, which makes the auth request
// fail with an unhelpful "non ISO-8859-1 code point" error. Strip those.
export function cleanEnv(value: string | undefined) {
  return (value ?? "").trim().replace(/[^\x20-\x7E]/g, "");
}

// The project URL and anon key are public by design — they ship inside every
// browser bundle, and access is controlled by row-level security, not by
// keeping them secret. Committing them as fallbacks means a missing or
// mis-scoped hosting variable can't silently break sign-in.
// The service_role key is a different matter and must never be committed.
const FALLBACK_URL = "https://puolnlqpyupboehhahqf.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1b2xubHFweXVwYm9laGhhaHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTIxMzcsImV4cCI6MjEwMDg4ODEzN30.U9D-4D7zdZxPbZ4xlzPdd8qCCukPqLQj1MQlcrEJmZE";

export function supabaseUrl() {
  return cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || FALLBACK_URL;
}

export function supabaseAnonKey() {
  return cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || FALLBACK_ANON_KEY;
}

// Supabase client for use in Client Components ("use client").
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
