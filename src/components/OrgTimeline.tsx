"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveActivity, type ActivityInput } from "@/lib/actions";
import { TIMELINE_KINDS, type TimelineEntry } from "@/lib/organisations";

/**
 * Everything that has happened with this company, in one list.
 *
 * Replaces the separate "Relationship history" card rather than sitting beside
 * it: a status change is one more thing that happened, and reading the
 * relationship means reading all of it together.
 *
 * Emails and meetings appear here automatically once Outlook is connected —
 * they arrive as activities, so this list needs no change when they do.
 */
const KIND_COLOUR: Record<string, string> = {
  Call: "var(--c-radio)",
  WhatsApp: "var(--ok)",
  Text: "var(--c-digital)",
  Meeting: "var(--c-tv)",
  Note: "var(--faint)",
  Email: "var(--blue)",
  Task: "var(--c-ooh)",
  Status: "var(--c-print)",
};

const LOGGABLE = ["Call", "WhatsApp", "Text", "Meeting", "Note"] as const;

function whenGB(at: string) {
  if (!at) return "—";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at.slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function OrgTimeline({
  organisationId,
  entries,
  contacts,
  campaigns,
}: {
  organisationId: string;
  entries: TimelineEntry[];
  contacts: { id: string; name: string }[];
  campaigns: { id: string; ref: string; name: string }[];
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>([]);
  const [logging, setLogging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ActivityInput>({
    kind: "Call",
    happenedAt: new Date().toISOString().slice(0, 16),
    summary: "",
    detail: "",
    organisationId,
  });
  const set = <K extends keyof ActivityInput>(k: K, v: ActivityInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const shown = useMemo(() => entries.filter((e) => !hidden.includes(e.kind)), [entries, hidden]);
  // Only offer a filter for something actually on this timeline.
  const present = useMemo(
    () => TIMELINE_KINDS.filter((k) => entries.some((e) => e.kind === k)),
    [entries]
  );

  function toggle(kind: string) {
    setHidden((h) => (h.includes(kind) ? h.filter((k) => k !== kind) : [...h, kind]));
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await saveActivity({
      ...form,
      happenedAt: form.happenedAt ? new Date(form.happenedAt).toISOString() : "",
    });
    setBusy(false);
    if (res.error) return setError(res.error);
    setLogging(false);
    setForm({
      kind: "Call",
      happenedAt: new Date().toISOString().slice(0, 16),
      summary: "",
      detail: "",
      organisationId,
    });
    router.refresh();
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Activity</h2>
        <span className="sub">
          {entries.length} entr{entries.length === 1 ? "y" : "ies"}
          {hidden.length ? ` · ${shown.length} shown` : ""}
        </span>
        <button
          className="btn btn-primary"
          style={{ marginLeft: "auto" }}
          onClick={() => setLogging((o) => !o)}
        >
          {logging ? "Cancel" : "Log activity"}
        </button>
      </div>

      <div className="card-body">
        {logging && (
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <label className="field">
              <span>What was it</span>
              <select
                className="input"
                value={form.kind}
                onChange={(e) => set("kind", e.target.value as ActivityInput["kind"])}
              >
                {LOGGABLE.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>When</span>
              <input
                className="input num"
                type="datetime-local"
                value={form.happenedAt}
                onChange={(e) => set("happenedAt", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Who (optional)</span>
              <select
                className="input"
                value={form.contactId ?? ""}
                onChange={(e) => set("contactId", e.target.value || undefined)}
              >
                <option value="">—</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Campaign (optional)</span>
              <select
                className="input"
                value={form.campaignId ?? ""}
                onChange={(e) => set("campaignId", e.target.value || undefined)}
              >
                <option value="">—</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.ref} · {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field wide">
              <span>What happened</span>
              <input
                className="input"
                value={form.summary}
                onChange={(e) => set("summary", e.target.value)}
                placeholder="e.g. Called Jane about the October insertion — happy to proceed"
              />
            </label>
            <label className="field wide">
              <span>Detail (optional)</span>
              <textarea
                className="input"
                rows={2}
                value={form.detail}
                onChange={(e) => set("detail", e.target.value)}
              />
            </label>
            <div className="wide" style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Log it"}
              </button>
              {error && <span style={{ color: "var(--crit)", fontSize: 12.5 }}>{error}</span>}
            </div>
          </div>
        )}

        {present.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {present.map((k) => {
              const off = hidden.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  className="pill"
                  onClick={() => toggle(k)}
                  style={{
                    cursor: "pointer",
                    opacity: off ? 0.4 : 1,
                    borderLeft: `3px solid ${KIND_COLOUR[k] ?? "var(--line)"}`,
                    textDecoration: off ? "line-through" : undefined,
                  }}
                >
                  {k}
                </button>
              );
            })}
          </div>
        )}

        {shown.length === 0 ? (
          <p className="empty-note">
            {entries.length === 0
              ? "Nothing logged yet. Record a call or a note above — emails join this list once Outlook is connected."
              : "Everything is hidden by the filters above."}
          </p>
        ) : (
          <div className="rows">
            {shown.map((e) => (
              <div className="row" key={e.id}>
                <span
                  className="pill"
                  style={{ borderLeft: `3px solid ${KIND_COLOUR[e.kind] ?? "var(--line)"}`, flex: "none" }}
                >
                  {e.kind}
                </span>
                <div className="grow">
                  <p>
                    {e.href ? (
                      <Link href={e.href} style={{ color: "var(--blue)" }}>
                        {e.summary}
                      </Link>
                    ) : (
                      e.summary
                    )}
                  </p>
                  <small>
                    {e.who}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </small>
                </div>
                <span className="num sub-line" style={{ whiteSpace: "nowrap" }}>
                  {whenGB(e.at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
