import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseAnonKey } from "@/lib/env";

// Configuration comes entirely from env.ts, which validates it and refuses to
// start on a missing variable or an environment/project mismatch. No fallback.
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
