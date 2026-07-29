"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Where invited users land. Supabase's default invite email drops the session
// into the URL fragment, which the browser client picks up automatically, so
// this page just waits for that session then takes a new password.
export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        setEmail(session.user.email ?? null);
        setReady(true);
      }
    }

    // The client parses the URL fragment asynchronously on load, so listen for
    // the resulting auth event as well as checking the current session.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setEmail(session.user.email ?? null);
        setReady(true);
      }
    });

    check();
    const timer = setTimeout(() => {
      if (!cancelled) setReady((r) => r || false);
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
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
      <form onSubmit={handleSubmit} className="card" style={{ width: 380, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 20 }}>
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

        <h1 style={{ fontSize: 17, fontWeight: 680, marginBottom: 6 }}>Set your password</h1>
        <p style={{ fontSize: 12.5, color: "var(--mid)", marginBottom: 18 }}>
          {email
            ? `Welcome, ${email}. Choose a password and you're in.`
            : "Open this page from your invite email link to continue."}
        </p>

        <label style={{ display: "block", marginBottom: 12 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 5 }}>
            New password
          </span>
          <input
            className="input"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <label style={{ display: "block", marginBottom: 18 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 5 }}>
            Confirm password
          </span>
          <input
            className="input"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>

        {error && <p style={{ color: "var(--crit)", fontSize: 12.5, marginBottom: 14 }}>{error}</p>}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
          disabled={saving || !ready}
        >
          {saving ? "Saving…" : ready ? "Save password and sign in" : "Waiting for invite link…"}
        </button>

        {!ready && (
          <p style={{ marginTop: 14, fontSize: 12, color: "var(--faint)", textAlign: "center" }}>
            No invite detected. Click the link in your invite email again, or ask an admin to resend it.
          </p>
        )}
      </form>
    </div>
  );
}
