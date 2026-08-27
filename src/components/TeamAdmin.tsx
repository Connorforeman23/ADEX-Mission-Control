"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CollapsibleCard from "@/components/CollapsibleCard";
import { initials } from "@/lib/money";

// Admin-only team management. Backed entirely by the admin_* security-definer
// functions (see migration 0003) — the browser never touches staff_roles
// directly, and every function re-checks the caller is an admin.
type StaffRow = {
  email: string;
  full_name: string;
  role: "admin" | "standard" | "restricted";
  is_sales: boolean;
  signed_up: boolean;
  active: boolean;
};

const ROLES = ["admin", "standard", "restricted"] as const;

export default function TeamAdmin() {
  const supabase = createClient();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // add form
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<StaffRow["role"]>("standard");
  const [isSales, setIsSales] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_staff");
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setRows((data ?? []) as StaffRow[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(ok: string) {
    setNotice(ok);
    setError(null);
    setTimeout(() => setNotice(null), 3000);
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("add");
    const { error } = await supabase.rpc("admin_add_staff", {
      p_email: email,
      p_full_name: fullName,
      p_role: role,
      p_is_sales: isSales,
    });
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    setEmail("");
    setFullName("");
    setRole("standard");
    setIsSales(false);
    flash(`${fullName.trim()} added to the staff list.`);
    load();
  }

  async function changeRole(target: StaffRow, next: string) {
    if (next === target.role) return;
    setError(null);
    setBusy(target.email);
    const { error } = await supabase.rpc("admin_set_role", {
      p_email: target.email,
      p_role: next,
    });
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    flash(`${target.full_name} is now ${next}.`);
    load();
  }

  async function setActive(target: StaffRow, next: boolean) {
    if (!next) {
      const ok = window.confirm(
        `Disable ${target.full_name}?\n\n` +
          "They'll be locked out on their next click. Their record and history are kept. " +
          "For permanent removal, also delete their login in Supabase afterwards."
      );
      if (!ok) return;
    }
    setError(null);
    setBusy(target.email);
    const { error } = await supabase.rpc("admin_set_active", {
      p_email: target.email,
      p_active: next,
    });
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    flash(next ? `${target.full_name} re-enabled.` : `${target.full_name} disabled — access revoked.`);
    load();
  }

  async function remove(target: StaffRow) {
    const ok = window.confirm(
      `Remove ${target.full_name} from the staff list?\n\n` +
        (target.signed_up
          ? "Note: they have already signed up, so this only blocks future sign-ups — it does NOT log them out or disable their existing login. Fully revoking access comes later (offboarding)."
          : "They have not signed up yet, so this stops them being able to.")
    );
    if (!ok) return;
    setError(null);
    setBusy(target.email);
    const { error } = await supabase.rpc("admin_remove_staff", { p_email: target.email });
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    flash(`${target.full_name} removed from the staff list.`);
    load();
  }

  return (
    <CollapsibleCard id="manage-team" title="Manage team" sub={`${rows.length} on the staff list`}>
      <div className="card-body">
        {error && <p style={{ color: "var(--crit)", fontSize: 12.5, marginBottom: 12 }}>{error}</p>}
        {notice && <p style={{ color: "var(--ok)", fontSize: 12.5, marginBottom: 12 }}>{notice}</p>}

        {loading ? (
          <p className="empty-note">Loading the staff list…</p>
        ) : rows.length === 0 ? (
          <p className="empty-note">Nobody is on the staff list yet.</p>
        ) : (
          <div className="rows">
            {rows.map((m) => (
              <div className="row" key={m.email}>
                <span className="avatar-sm">{initials(m.full_name)}</span>
                <div className="grow">
                  <p>{m.full_name}</p>
                  <small>{m.email}</small>
                </div>
                {m.is_sales && <span className="pill">Sales</span>}
                {m.signed_up && !m.active ? (
                  <span className="pill" style={{ color: "var(--crit)" }}>Disabled</span>
                ) : (
                  <span className="pill">{m.signed_up ? "Signed up" : "Invited"}</span>
                )}
                <select
                  className="input"
                  style={{ width: 130, padding: "6px 8px" }}
                  value={m.role}
                  disabled={busy === m.email || (m.signed_up && !m.active)}
                  onChange={(e) => changeRole(m, e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r === "admin" ? "Admin" : r === "restricted" ? "Restricted" : "Standard"}
                    </option>
                  ))}
                </select>
                {m.signed_up && (
                  <button
                    type="button"
                    className="btn"
                    disabled={busy === m.email}
                    onClick={() => setActive(m, !m.active)}
                  >
                    {m.active ? "Disable" : "Enable"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  disabled={busy === m.email}
                  onClick={() => remove(m)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addStaff} style={{ marginTop: 18, display: "grid", gap: 10 }}>
          <div className="eyebrow">Add someone to the staff list</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              type="email"
              placeholder="Work email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ flex: "1 1 200px" }}
            />
            <input
              className="input"
              type="text"
              placeholder="Full name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ flex: "1 1 160px" }}
            />
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRow["role"])}
              style={{ width: 130 }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r === "admin" ? "Admin" : r === "restricted" ? "Restricted" : "Standard"}
                </option>
              ))}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
              <input type="checkbox" checked={isSales} onChange={(e) => setIsSales(e.target.checked)} />
              Sales
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy === "add"}>
              {busy === "add" ? "Adding…" : "Add"}
            </button>
          </div>
          <p className="sub-line">
            Adding an email lets that person create their own account at /signup. Roles: <b>Admin</b> manages
            the team; <b>Standard</b> is full access; <b>Restricted</b> sees only their own accounts.
          </p>
        </form>
      </div>
    </CollapsibleCard>
  );
}
