"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CollapsibleCard from "@/components/CollapsibleCard";

// Admin-only view of the audit trail. Reads audit_log directly — RLS allows
// only admins to select it, so this renders empty (or errors) for anyone else,
// and it's already gated to admins on the Settings page.
type Entry = {
  id: string;
  at: string;
  actor_email: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  entity: string;
  primary_label: string | null;
  changed: Record<string, unknown> | null;
};

const ENTITY_LABEL: Record<string, string> = {
  campaigns: "Campaign",
  campaign_lines: "Booking line",
  clients: "Client",
  leads: "Opportunity",
  client_invoices: "Client invoice",
  supplier_invoices: "Supplier invoice",
  profiles: "Team member",
};

const ACTION_LABEL: Record<Entry["action"], string> = {
  INSERT: "created",
  UPDATE: "updated",
  DELETE: "deleted",
};

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityLog() {
  const supabase = createClient();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_log")
      .select("id, at, actor_email, action, entity, primary_label, changed")
      .order("at", { ascending: false })
      .limit(50);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEntries((data ?? []) as Entry[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <CollapsibleCard id="activity-log" title="Activity log" sub="Last 50 changes">
      <div className="card-body">
        {error && <p style={{ color: "var(--crit)", fontSize: 12.5, marginBottom: 12 }}>{error}</p>}
        {loading ? (
          <p className="empty-note">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="empty-note">No changes recorded yet.</p>
        ) : (
          <div className="rows">
            {entries.map((e) => {
              const entity = ENTITY_LABEL[e.entity] ?? e.entity;
              const fields =
                e.action === "UPDATE" && e.changed
                  ? Object.keys(e.changed).filter((k) => k !== "id")
                  : [];
              return (
                <div className="row" key={e.id}>
                  <div className="grow">
                    <p>
                      <b>{e.actor_email ?? "System"}</b> {ACTION_LABEL[e.action]} {entity.toLowerCase()}
                      {e.primary_label ? ` (${e.primary_label})` : ""}
                    </p>
                    <small>
                      {when(e.at)}
                      {fields.length ? ` · changed: ${fields.join(", ")}` : ""}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}
