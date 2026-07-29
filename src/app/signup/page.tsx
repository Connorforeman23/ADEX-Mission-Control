"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Self-service account creation for the ADEX team. Anyone can reach this page,
// but only addresses on the staff list can complete it — checked here for a
// readable message, and enforced by a trigger in the database.
export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    setLoading(true);

    const { data: allowed, error: checkError } = await supabase.rpc("is_staff_email", {
      p_email: email.trim(),
    });

    // Fail closed: if the staff check is unavailable, refuse rather than let
    // an unchecked address through.
    if (checkError) {
      setLoading(false);
      setError("Sign-up isn't available yet — the staff list hasn't been set up. Ask Connor.");
      return;
    }
    if (allowed !== true) {
      setLoading(false);
      setError(
        "That address isn't on the ADEX staff list. Check the spelling, or ask Connor or Steve to add you."
      );
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signUpError) {
      setError(
        /Database error|staff list/i.test(signUpError.message)
          ? "That address isn't on the ADEX staff list. Ask Connor or Steve to add you."
          : signUpError.message
      );
      return;
    }

    // With email confirmation switched off, sign-up returns a session and we
    // can go straight in. With it on, they need to click the email first.
    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }
    setNotice("Account created. Check your email to confirm it, then sign in.");
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

        <h1 style={{ fontSize: 17, fontWeight: 680, marginBottom: 6 }}>Create your account</h1>
        <p style={{ fontSize: 12.5, color: "var(--mid)", marginBottom: 18 }}>
          Use your Advertising Excellence email and choose your own password.
        </p>

        <label style={{ display: "block", marginBottom: 12 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 5 }}>
            Work email
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

        <label style={{ display: "block", marginBottom: 12 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 5 }}>
            Password
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
        {notice && <p style={{ color: "var(--ok)", fontSize: 12.5, marginBottom: 14 }}>{notice}</p>}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
          disabled={loading}
        >
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p style={{ marginTop: 16, fontSize: 12, color: "var(--faint)", textAlign: "center" }}>
          Already have an account? <Link href="/login" style={{ color: "var(--blue)" }}>Sign in</Link>
        </p>
      </form>
    </div>
  );
}
