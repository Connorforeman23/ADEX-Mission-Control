// Central environment configuration and the environment-mismatch guard.
//
// Every Supabase connection goes through supabaseUrl() / supabaseAnonKey() so
// there is exactly one place that decides which database the app talks to.
//
// There is no fallback. If the required variables are missing the app refuses
// to start with a clear message, rather than silently defaulting to production.

// Known Supabase projects. These refs are PUBLIC — they appear in the project
// URL and in the anon JWT. They are used ONLY to cross-check that the declared
// environment matches the database actually configured. They never configure
// anything; a wrong value here can only *reject* a mismatch, never cause one.
const KNOWN_PROJECTS: Record<string, string> = {
  production: "puolnlqpyupboehhahqf",
  development: "ficmtwvmmcsxxexhysbd",
};

// Trim and strip stray non-printable characters that a pasted dashboard value
// sometimes carries (newline, BOM, non-breaking space).
function clean(value: string | undefined) {
  return (value ?? "").trim().replace(/[^\x20-\x7E]/g, "");
}

function required(name: string): string {
  const value = clean(process.env[name]);
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `The application will not start without it — this is deliberate, so that a ` +
        `misconfigured deployment fails clearly instead of silently using the wrong database.`
    );
  }
  return value;
}

export const APP_ENV = required("NEXT_PUBLIC_APP_ENV"); // 'development' | 'production'
const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");

// The mismatch guard: the declared environment must match the project the URL
// actually points at. A production app pointed at dev — or a dev app pointed at
// production — refuses to start.
const actualRef = (SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase/i) ?? [])[1] ?? "";
const expectedRef = KNOWN_PROJECTS[APP_ENV];

if (!expectedRef) {
  throw new Error(
    `NEXT_PUBLIC_APP_ENV is "${APP_ENV}" but must be one of: ${Object.keys(KNOWN_PROJECTS).join(", ")}.`
  );
}

if (actualRef !== expectedRef) {
  throw new Error(
    `Environment mismatch — refusing to start.\n` +
      `  NEXT_PUBLIC_APP_ENV = "${APP_ENV}" (expects Supabase project "${expectedRef}")\n` +
      `  NEXT_PUBLIC_SUPABASE_URL points at project "${actualRef}"\n` +
      `A "${APP_ENV}" deployment must not connect to a different project's database.`
  );
}

export const IS_PRODUCTION = APP_ENV === "production";
export const IS_DEVELOPMENT = APP_ENV === "development";

export function supabaseUrl() {
  return SUPABASE_URL;
}
export function supabaseAnonKey() {
  return SUPABASE_ANON_KEY;
}
