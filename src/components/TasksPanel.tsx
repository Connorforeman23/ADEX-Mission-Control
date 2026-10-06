"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Drawer from "@/components/Drawer";
import Segmented from "@/components/Segmented";
import { dateGB } from "@/lib/money";
import {
  completeTask,
  deleteTask,
  saveTask,
  setTaskStatus,
  type ActivityInput,
  type TaskInput,
} from "@/lib/actions";
import type { TaskRow } from "@/lib/queries";

const TASK_TYPES = ["Chase", "Prep", "Admin", "Meeting"] as const;
const OUTCOME_KINDS = ["Call", "WhatsApp", "Text", "Meeting", "Note"] as const;

/** How soon the next one — the usual answers, plus a date of your own. */
const INTERVALS: { label: string; days: number }[] = [
  { label: "Tomorrow", days: 1 },
  { label: "Next week", days: 7 },
  { label: "Two weeks", days: 14 },
  { label: "A month", days: 30 },
];

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const blank = (assigneeId: string, organisationId?: string): TaskInput => ({
  title: "",
  notes: "",
  dueDate: "",
  dueTime: "",
  taskType: "Chase",
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
  const [show, setShow] = useState<"open" | "due" | "done" | "parked">("open");
  const [type, setType] = useState("All");
  const defaultAssignee = staff.some((s) => s.id === meId) ? meId : staff[0]?.id ?? "";
  const prefillOrgId = organisations.find((o) => o.name === prefillOrg)?.id;
  const [editing, setEditing] = useState<TaskInput | null>(
    openNew ? blank(defaultAssignee, prefillOrgId) : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Due" is the working list: everything due today or already late.
  // "Parked" is deliberately set aside — not chasing, and not counted as
  // missing a next action.
  const rows = tasks.filter((t) => {
    if (who !== "All" && t.assignee !== who) return false;
    if (type !== "All" && t.task_type !== type) return false;
    if (show === "done") return t.status === "Done";
    if (show === "parked") return t.status === "Parked";
    if (show === "due") return t.status === "Open" && !!t.due_date && t.due_date <= today;
    return t.status === "Open";
  });
  const dueCount = tasks.filter(
    (t) => t.status === "Open" && !!t.due_date && t.due_date <= today
  ).length;
  const parkedCount = tasks.filter((t) => t.status === "Parked").length;

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
      dueTime: t.due_time ?? "",
      taskType: t.task_type ?? "Chase",
      status: t.status,
      contactId: t.contact_id ?? undefined,
      assigneeId: t.assignee_id ?? "",
      campaignId: t.campaign_id ?? undefined,
      clientId: t.client_id ?? undefined,
      organisationId: t.organisation_id ?? undefined,
      leadId: t.lead_id ?? undefined,
    });
  }

  // Finishing a task is where the next one gets created — that is the whole
  // follow-up discipline, and it only works if it is the natural next step.
  const [finishing, setFinishing] = useState<TaskRow | null>(null);
  const [outcomeKind, setOutcomeKind] = useState<ActivityInput["kind"]>("Call");
  const [outcome, setOutcome] = useState("");
  const [nextTitle, setNextTitle] = useState("");
  const [nextDate, setNextDate] = useState("");

  function startFinishing(t: TaskRow) {
    setFinishing(t);
    setOutcomeKind(t.task_type === "Meeting" ? "Meeting" : "Call");
    setOutcome("");
    setNextTitle(`Follow up: ${t.title}`);
    setNextDate("");
    setError(null);
  }

  async function finish() {
    if (!finishing) return;
    setBusy(true);
    const res = await completeTask({
      taskId: finishing.id,
      outcome: outcome.trim()
        ? { kind: outcomeKind, summary: outcome, detail: "" }
        : undefined,
      followUp: nextDate ? { title: nextTitle, dueDate: nextDate, dueTime: "" } : undefined,
    });
    setBusy(false);
    if (res.error) return setError(res.error);
    setFinishing(null);
    router.refresh();
  }

  async function reopen(t: TaskRow) {
    await setTaskStatus(t.id, "Open");
    router.refresh();
  }

  async function park(t: TaskRow) {
    await setTaskStatus(t.id, "Parked");
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
        <label className="field">
          <span>Type</span>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="All">All types</option>
            {TASK_TYPES.map((k) => (
              <option key={k}>{k}</option>
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
              ...(parkedCount ? [{ value: "parked" as const, label: `Parked (${parkedCount})` }] : []),
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
                    <th>Type</th>
                    <th>Relates to</th>
                    <th>Assignee</th>
                    <th>Due</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const overdue = t.status === "Open" && t.due_date && t.due_date < today;
                    return (
                      <tr key={t.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={t.status === "Done"}
                            onChange={() => (t.status === "Done" ? reopen(t) : startFinishing(t))}
                            aria-label={`Mark ${t.title} ${t.status === "Done" ? "open" : "done"}`}
                            style={{ width: 16, height: 16, accentColor: "var(--blue)" }}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="link-btn strong"
                            style={
                              t.status === "Done"
                                ? { textDecoration: "line-through", color: "var(--faint)" }
                                : undefined
                            }
                            onClick={() => openEdit(t)}
                          >
                            {t.title}
                          </button>
                          {t.notes && <div className="sub-line">{t.notes}</div>}
                        </td>
                        <td className="sub-line">{t.task_type}</td>
                        <td className="sub-line">
                          {t.about ? (
                            t.aboutHref ? (
                              <Link href={t.aboutHref} style={{ color: "var(--blue)" }}>
                                {t.about}
                              </Link>
                            ) : (
                              t.about
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="sub-line">{t.assignee}</td>
                        <td className="num" style={{ color: overdue ? "var(--crit)" : undefined, whiteSpace: "nowrap" }}>
                          {t.due_date ? dateGB(t.due_date) : "—"}
                          {t.due_time ? ` ${t.due_time}` : ""}
                          {overdue ? " ⚠" : ""}
                        </td>
                        <td>
                          <span style={{ display: "inline-flex", gap: 4 }}>
                            <button className="row-edit" aria-label={`Edit ${t.title}`} onClick={() => openEdit(t)}>
                              <svg viewBox="0 0 24 24">
                                <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                            </button>
                            {t.status === "Open" && (
                              <button
                                className="btn"
                                style={{ padding: "4px 8px", fontSize: 11.5 }}
                                onClick={() => park(t)}
                                title="Set aside — stops it counting as a missing next action"
                              >
                                Park
                              </button>
                            )}
                            {t.status === "Parked" && (
                              <button
                                className="btn"
                                style={{ padding: "4px 8px", fontSize: 11.5 }}
                                onClick={() => reopen(t)}
                              >
                                Unpark
                              </button>
                            )}
                          </span>
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
        open={!!finishing}
        eyebrow="Completing"
        title={finishing?.title ?? ""}
        onClose={() => setFinishing(null)}
      >
        {finishing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                What happened? (optional)
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Kind</span>
                  <select
                    className="input"
                    value={outcomeKind}
                    onChange={(e) => setOutcomeKind(e.target.value as ActivityInput["kind"])}
                  >
                    {OUTCOME_KINDS.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label className="field wide">
                  <span>Outcome</span>
                  <input
                    className="input"
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    placeholder="e.g. Spoke to Jane — wants a proposal for November"
                  />
                </label>
              </div>
              <small className="sub-line">
                {finishing.organisation_id
                  ? "This goes on the organisation's timeline."
                  : "This task isn't linked to an organisation, so an outcome has nowhere to go."}
              </small>
            </div>

            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                When next? (optional)
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {INTERVALS.map((i) => (
                  <button
                    key={i.label}
                    type="button"
                    className={`btn${nextDate === addDays(i.days) ? " btn-primary" : ""}`}
                    onClick={() => setNextDate(addDays(i.days))}
                  >
                    {i.label}
                  </button>
                ))}
                {nextDate && (
                  <button type="button" className="btn" onClick={() => setNextDate("")}>
                    No follow-up
                  </button>
                )}
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Date</span>
                  <input
                    className="input num"
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                  />
                </label>
                <label className="field wide">
                  <span>The next task</span>
                  <input
                    className="input"
                    value={nextTitle}
                    onChange={(e) => setNextTitle(e.target.value)}
                    disabled={!nextDate}
                  />
                </label>
              </div>
              <small className="sub-line">
                It inherits this task&rsquo;s links and owner. Leave the date blank to close this
                one without raising another.
              </small>
            </div>

            {error && <p style={{ color: "var(--crit)", fontSize: 12.5, margin: 0 }}>{error}</p>}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={finish} disabled={busy}>
                {busy ? "Saving…" : "Done"}
              </button>
              <button className="btn" onClick={() => setFinishing(null)} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </Drawer>

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
                <span>Type</span>
                <select
                  className="input"
                  value={editing.taskType}
                  onChange={(e) => setEditing({ ...editing, taskType: e.target.value })}
                >
                  {TASK_TYPES.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
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
                <span>Time (optional)</span>
                <input
                  className="input num"
                  type="time"
                  value={editing.dueTime}
                  onChange={(e) => setEditing({ ...editing, dueTime: e.target.value })}
                  disabled={!editing.dueDate}
                />
                <small className="sub-line" style={{ marginTop: 4 }}>
                  Leave blank for a whole-day task. A time is what puts it in a calendar.
                </small>
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
