"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [loading, setLoading] = useState(false);

  // An invite/recovery link carries its tokens in the URL fragment, which
  // survives the redirect here. Forward it to /set-password rather than
  // stranding someone whose link pointed at the wrong port or path.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token") || hash.includes("error_description")) {
      router.replace(`/set-password${hash}`);
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(900px 520px at 6% -6%, var(--blue-wash), transparent 62%), radial-gradient(760px 460px at 96% 4%, var(--pink-wash), transparent 60%), var(--bg)",
      }}
    >
      <form onSubmit={handleSubmit} className="card" style={{ width: 360, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(140deg, var(--blue) 0%, var(--pink) 100%)",
              boxShadow: "var(--glow-blue)",
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15, color: "#fff" }}>
              AE
            </span>
          </div>
          <div>
            <b style={{ display: "block", fontSize: 14, fontWeight: 700 }}>ADEX CRM</b>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.16em",
                background: "linear-gradient(92deg, var(--blue), var(--pink))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              MISSION CONTROL
            </span>
          </div>
        </div>

        <label style={{ display: "block", marginBottom: 12 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 5 }}>
            Email
          </span>
          <input
            className="input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label style={{ display: "block", marginBottom: 18 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 5 }}>
            Password
          </span>
          <input
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p style={{ color: "var(--crit)", fontSize: 12.5, marginBottom: 14 }}>{error}</p>
        )}

        <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p style={{ marginTop: 16, fontSize: 12, color: "var(--faint)", textAlign: "center" }}>
          First time here?{" "}
          <Link href="/signup" style={{ color: "var(--blue)" }}>
            Create your account
          </Link>
        </p>
      </form>
    </div>
  );
}
