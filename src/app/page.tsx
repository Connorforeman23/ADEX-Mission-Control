import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <div style={{ padding: 24 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingBottom: 16,
          marginBottom: 20,
          borderBottom: "1px solid var(--line)",
        }}
      >
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
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--mid)" }}>
            {profile?.full_name ?? user.email} · {profile?.role ?? "pending role"}
          </span>
          <SignOutButton />
        </div>
      </header>

      <div className="card" style={{ padding: 20, maxWidth: 640 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          Foundation module — signed in
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 680, marginBottom: 8 }}>
          Auth, shell and theme are live.
        </h1>
        <p style={{ color: "var(--mid)", fontSize: 13, lineHeight: 1.6 }}>
          You&rsquo;re authenticated against the real Supabase project, your profile
          row loaded, and the proxy is protecting every route. Next module
          replaces this page with the Dashboard from the mock — KPI tiles,
          billings by channel, billings by sales team.
        </p>
      </div>
    </div>
  );
}
