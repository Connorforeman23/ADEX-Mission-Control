"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveTask } from "@/lib/actions";

/** Compact follow-up creator embedded in pipeline, campaign and client panels. */
export default function FollowUp({
  campaignId,
  clientId,
  leadId,
  defaultTitle,
  staff,
  defaultAssigneeId,
}: {
  campaignId?: string;
  clientId?: string;
  leadId?: string;
  defaultTitle: string;
  staff: { id: string; full_name: string }[];
  defaultAssigneeId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [assignee, setAssignee] = useState(defaultAssigneeId || staff[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await saveTask({
      title: defaultTitle,
      notes,
      dueDate: date,
      assigneeId: assignee,
      campaignId,
      clientId,
      leadId,
    });
    setBusy(false);
    if (res.error) return setError(res.error);
    setSaved(true);
    setOpen(false);
    router.refresh();
  }

  if (saved) {
    return (
      <p className="sub-line" style={{ margin: 0, color: "var(--ok)" }}>
        Follow-up saved — it&rsquo;s on the Tasks board.
      </p>
    );
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        + Follow-up
      </button>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: 12,
        background: "var(--surface-2)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>Follow-up date</span>
          <input className="input num" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Assignee</span>
          <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="field wide">
          <span>Notes</span>
          <input
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What needs doing when it comes round"
          />
        </label>
      </div>
      {error && <p style={{ color: "var(--crit)", fontSize: 12.5, margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save follow-up"}
        </button>
        <button className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
