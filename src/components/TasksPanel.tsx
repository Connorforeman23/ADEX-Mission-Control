"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer from "@/components/Drawer";
import Segmented from "@/components/Segmented";
import { dateGB } from "@/lib/money";
import { deleteTask, saveTask, toggleTask, type TaskInput } from "@/lib/actions";
import type { TaskRow } from "@/lib/queries";

const blank = (assigneeId: string, organisationId?: string): TaskInput => ({
  title: "",
  notes: "",
  dueDate: "",
  assigneeId,
  organisationId: organisationId || undefined,
});

export default function TasksPanel({
  tasks,
  staff,
  organisations,
  prefillOrg = "",
  campaigns,
  leads,
  meId,
  today,
  openNew,
}: {
  tasks: TaskRow[];
  staff: { id: string; full_name: string }[];
  organisations: { id: string; name: string; owner_id: string | null; is_supplier: boolean; customer_status: string }[];
  /** Organisation name carried through from an organisation page. */
  prefillOrg?: string;
  campaigns: { id: string; ref: string; name: string }[];
  leads: { id: string; name: string; stage: string }[];
  /** Signed-in user — new tasks default to them. */
  meId: string;
  today: string;
  openNew?: boolean;
}) {
  const router = useRouter();
  const [who, setWho] = useState("All");
  const [show, setShow] = useState<"open" | "due" | "done">("open");
  const defaultAssignee = staff.some((s) => s.id === meId) ? meId : staff[0]?.id ?? "";
  const prefillOrgId = organisations.find((o) => o.name === prefillOrg)?.id;
  const [editing, setEditing] = useState<TaskInput | null>(
    openNew ? blank(defaultAssignee, prefillOrgId) : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Due" is the working list: everything due today or already late.
  const rows = tasks.filter((t) => {
    if (who !== "All" && t.assignee !== who) return false;
    if (show === "done") return t.done;
    if (show === "due") return !t.done && !!t.due_date && t.due_date <= today;
    return !t.done;
  });
  const dueCount = tasks.filter((t) => !t.done && !!t.due_date && t.due_date <= today).length;

  async function save() {
    if (!editing) return;
    setBusy(true);
    const res = await saveTask(editing);
    setBusy(false);
    if (res.error) return setError(res.error);
    setEditing(null);
    router.refresh();
  }

  function openEdit(t: TaskRow) {
    setError(null);
    setEditing({
      id: t.id,
      title: t.title,
      notes: t.notes ?? "",
      dueDate: t.due_date ?? "",
      assigneeId: t.assignee_id ?? "",
      campaignId: t.campaign_id ?? undefined,
      clientId: t.client_id ?? undefined,
      organisationId: t.organisation_id ?? undefined,
      leadId: t.lead_id ?? undefined,
    });
  }

  async function tick(t: TaskRow) {
    await toggleTask(t.id, !t.done);
    router.refresh();
  }

  return (
    <>
      <div className="filters">
        <label className="field">
          <span>Assignee</span>
          <select className="input" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="All">Everyone</option>
            {staff.map((s) => (
              <option key={s.id}>{s.full_name}</option>
            ))}
          </select>
        </label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Segmented
            value={show}
            onChange={setShow}
            options={[
              { value: "open", label: "Open" },
              { value: "due", label: dueCount ? `Due (${dueCount})` : "Due" },
              { value: "done", label: "Done" },
            ]}
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              setError(null);
              setEditing(blank(defaultAssignee));
            }}
          >
            New task
          </button>
        </div>
      </div>

      <section className="card">
        <div className="card-body" style={{ padding: rows.length ? 0 : undefined }}>
          {rows.length === 0 ? (
            <p className="empty-note">
              {show === "open"
                ? "Nothing outstanding. Tasks raised from campaigns, pipeline and clients land here."
                : show === "due"
                  ? "Nothing due today and nothing overdue."
                  : "Nothing completed yet."}
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    <th>Task</th>
                    <th>Relates to</th>
                    <th>Assignee</th>
                    <th>Due</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const overdue = !t.done && t.due_date && t.due_date < today;
                    return (
                      <tr key={t.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={t.done}
                            onChange={() => tick(t)}
                            aria-label={`Mark ${t.title} ${t.done ? "open" : "done"}`}
                            style={{ width: 16, height: 16, accentColor: "var(--blue)" }}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="link-btn strong"
                            style={t.done ? { textDecoration: "line-through", color: "var(--faint)" } : undefined}
                            onClick={() => openEdit(t)}
                          >
                            {t.title}
                          </button>
                          {t.notes && <div className="sub-line">{t.notes}</div>}
                        </td>
                        <td className="sub-line">{t.about || "—"}</td>
                        <td className="sub-line">{t.assignee}</td>
                        <td className="num" style={{ color: overdue ? "var(--crit)" : undefined, whiteSpace: "nowrap" }}>
                          {t.due_date ? dateGB(t.due_date) : "—"}
                          {overdue ? " ⚠" : ""}
                        </td>
                        <td>
                          <button className="row-edit" aria-label={`Edit ${t.title}`} onClick={() => openEdit(t)}>
                            <svg viewBox="0 0 24 24">
                              <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Drawer
        open={!!editing}
        eyebrow={editing?.id ? "Edit task" : "New task"}
        title={editing?.title || "New task"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-grid">
              <label className="field wide">
                <span>Task</span>
                <input
                  className="input"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="e.g. Chase Bluewater consent copy"
                />
              </label>
              <label className="field">
                <span>Follow-up date</span>
                <input
                  className="input num"
                  type="date"
                  value={editing.dueDate}
                  onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Assignee</span>
                <select
                  className="input"
                  value={editing.assigneeId}
                  onChange={(e) => setEditing({ ...editing, assigneeId: e.target.value })}
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                      {s.id === meId ? " (you)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Organisation (optional)</span>
                <select
                  className="input"
                  value={editing.organisationId ?? ""}
                  onChange={(e) => {
                    const organisationId = e.target.value || undefined;
                    // Choosing a company hands the task to that company's owner.
                    // They can still reassign it — this is a default, not a rule.
                    const owner = organisations.find((o) => o.id === organisationId)?.owner_id;
                    const ownerOnStaff = owner && staff.some((s) => s.id === owner);
                    setEditing({
                      ...editing,
                      organisationId,
                      assigneeId: ownerOnStaff ? owner : editing.assigneeId,
                    });
                  }}
                >
                  <option value="">—</option>
                  {organisations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                      {o.is_supplier && o.customer_status === "none" ? " (supplier)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Campaign (optional)</span>
                <select
                  className="input"
                  value={editing.campaignId ?? ""}
                  onChange={(e) => setEditing({ ...editing, campaignId: e.target.value || undefined })}
                >
                  <option value="">—</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.ref} · {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Opportunity (optional)</span>
                <select
                  className="input"
                  value={editing.leadId ?? ""}
                  onChange={(e) => setEditing({ ...editing, leadId: e.target.value || undefined })}
                >
                  <option value="">—</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} · {l.stage}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field wide">
                <span>Notes</span>
                <input
                  className="input"
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Anything the assignee needs to know"
                />
              </label>
            </div>

            {error && <p style={{ color: "var(--crit)", fontSize: 12.5, margin: 0 }}>{error}</p>}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save task"}
              </button>
              {editing.id && (
                <button
                  className="btn"
                  style={{ marginLeft: "auto", color: "var(--crit)" }}
                  disabled={busy}
                  onClick={async () => {
                    await deleteTask(editing.id!);
                    setEditing(null);
                    router.refresh();
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
