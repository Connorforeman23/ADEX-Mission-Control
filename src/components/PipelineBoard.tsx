"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer from "@/components/Drawer";
import FollowUp from "@/components/FollowUp";
import Segmented from "@/components/Segmented";
import { useBoardDrag } from "@/components/useBoardDrag";
import { gbp, gbpK } from "@/lib/money";
import { deleteLead, moveLeadStage, saveLead, type LeadInput } from "@/lib/actions";

export type LeadRow = {
  id: string;
  name: string;
  contact: string | null;
  sector: string | null;
  value: number;
  stage: string;
  next_action: string | null;
  owner: string;
  ownerId: string;
};

// Closed Lost is recorded but never counted toward any projection.
export const STAGES = ["Engaged", "Proposal", "Closed Won", "Closed Lost"];
const OPEN_STAGES = ["Engaged", "Proposal"];
const WEIGHTS: Record<string, number> = { Engaged: 0.4, Proposal: 0.7 };

const STAGE_TINT: Record<string, string> = {
  Engaged: "var(--blue)",
  Proposal: "var(--pink)",
  "Closed Won": "var(--ok)",
  "Closed Lost": "var(--crit)",
};

const STAGE_CLASS: Record<string, string> = {
  Engaged: "booked",
  Proposal: "planning",
  "Closed Won": "live",
  "Closed Lost": "risk",
};

const blank = (ownerId: string): LeadInput => ({
  name: "",
  contact: "",
  sector: "",
  value: "",
  stage: "Engaged",
  ownerId,
  nextAction: "",
});

export default function PipelineBoard({
  leads,
  staff,
  openNew,
  prefillOrg = "",
}: {
  leads: LeadRow[];
  staff: { id: string; full_name: string }[];
  openNew?: boolean;
  /** Company carried through from an organisation page. */
  prefillOrg?: string;
}) {
  const router = useRouter();
  const [owner, setOwner] = useState("All");
  const [view, setView] = useState<"board" | "list" | "forecast">("board");
  const [editing, setEditing] = useState<LeadInput | null>(
    openNew ? { ...blank(staff[0]?.id ?? ""), name: prefillOrg } : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = leads.filter((l) => owner === "All" || l.owner === owner);

  async function save() {
    if (!editing) return;
    setBusy(true);
    const res = await saveLead(editing);
    setBusy(false);
    if (res.error) return setError(res.error);
    setEditing(null);
    router.refresh();
  }

  async function move(id: string, stage: string) {
    await moveLeadStage(id, stage);
    router.refresh();
  }

  // Dragging a card to another column moves the opportunity to that stage —
  // including into Closed Won, which promotes the organisation to a client.
  const { dragging, over, cardProps, columnProps } = useBoardDrag(move);

  async function remove(id: string) {
    setBusy(true);
    await deleteLead(id);
    setBusy(false);
    setEditing(null);
    router.refresh();
  }

  function openEdit(l: LeadRow) {
    setError(null);
    setEditing({
      id: l.id,
      name: l.name,
      contact: l.contact ?? "",
      sector: l.sector ?? "",
      value: String(l.value ?? ""),
      stage: l.stage,
      ownerId: l.ownerId,
      nextAction: l.next_action ?? "",
    });
  }

  return (
    <>
      <div className="filters">
        <label className="field">
          <span>Sales owner</span>
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="All">All staff</option>
            {staff.map((s) => (
              <option key={s.id}>{s.full_name}</option>
            ))}
          </select>
        </label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "board", label: "Board" },
              { value: "list", label: "List" },
              { value: "forecast", label: "Forecast" },
            ]}
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              setError(null);
              setEditing(blank(staff[0]?.id ?? ""));
            }}
          >
            Add opportunity
          </button>
        </div>
      </div>

      {view === "board" && (
        <div className="board">
          {STAGES.map((stage) => {
            const set = rows.filter((l) => l.stage === stage);
            const total = set.reduce((a, l) => a + Number(l.value), 0);
            return (
              <div
                className={over === stage ? "col drop-target" : "col"}
                key={stage}
                {...columnProps(stage)}
              >
                <div className="col-head">
                  <span className="stripe" style={{ background: STAGE_TINT[stage] }} />
                  <h3>{stage}</h3>
                  <span className="count">
                    {set.length} · {gbpK(total)}
                  </span>
                </div>
                {set.length === 0 ? (
                  <p className="empty-note" style={{ padding: "12px 4px" }}>
                    Empty
                  </p>
                ) : (
                  set.map((l) => (
                    <div
                      className="tile"
                      key={l.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openEdit(l)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openEdit(l);
                        }
                      }}
                      {...cardProps(l.id)}
                      style={{
                        opacity: dragging === l.id ? 0.4 : l.stage === "Closed Lost" ? 0.62 : 1,
                        cursor: "grab",
                      }}
                    >
                      <div className="strong">{l.name}</div>
                      <div className="sub-line">
                        {l.contact ?? "—"}
                        {l.sector ? ` · ${l.sector}` : ""}
                      </div>
                      <div className="tile-foot">
                        <span className="num strong">{gbp(Number(l.value))}</span>
                        <span className="sub-line">{l.owner}</span>
                      </div>
                      {l.next_action && <div className="sub-line">{l.next_action}</div>}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === "list" && (
        <section className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {rows.length === 0 ? (
              <p className="empty-note" style={{ padding: "18px 16px" }}>
                No opportunities yet.
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Contact</th>
                      <th>Sector</th>
                      <th>Stage</th>
                      <th className="r">Value</th>
                      <th>Owner</th>
                      <th>Next action</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows]
                      .sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage))
                      .map((l) => (
                        <tr key={l.id}>
                          <td className="strong">{l.name}</td>
                          <td className="sub-line">{l.contact ?? "—"}</td>
                          <td className="sub-line">{l.sector ?? "—"}</td>
                          <td>
                            <span className={`st ${STAGE_CLASS[l.stage]}`}>{l.stage}</span>
                          </td>
                          <td className="r num">{gbp(Number(l.value))}</td>
                          <td className="sub-line">{l.owner}</td>
                          <td className="sub-line">{l.next_action ?? "—"}</td>
                          <td>
                            <button className="row-edit" onClick={() => openEdit(l)} aria-label={`Edit ${l.name}`}>
                              <svg viewBox="0 0 24 24">
                                <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {view === "forecast" && (
        <section className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sales owner</th>
                    <th className="r">Open opps</th>
                    <th className="r">Pipeline value</th>
                    <th className="r">Weighted forecast</th>
                    <th className="r">Won</th>
                    <th className="r">Lost (excluded)</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => {
                    const mine = rows.filter((l) => l.owner === s.full_name);
                    const open = mine.filter((l) => OPEN_STAGES.includes(l.stage));
                    const weighted = open.reduce(
                      (a, l) => a + Number(l.value) * (WEIGHTS[l.stage] ?? 0),
                      0
                    );
                    const won = mine.filter((l) => l.stage === "Closed Won").reduce((a, l) => a + Number(l.value), 0);
                    const lost = mine.filter((l) => l.stage === "Closed Lost").reduce((a, l) => a + Number(l.value), 0);
                    return (
                      <tr key={s.id}>
                        <td className="strong">{s.full_name}</td>
                        <td className="r num">{open.length}</td>
                        <td className="r num">{gbp(open.reduce((a, l) => a + Number(l.value), 0))}</td>
                        <td className="r num strong">{gbp(Math.round(weighted))}</td>
                        <td className="r num" style={{ color: "var(--ok)" }}>
                          {won ? gbp(won) : "—"}
                        </td>
                        <td className="r num" style={{ color: "var(--faint)" }}>
                          {lost ? gbp(lost) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-body">
            <p className="sub-line" style={{ margin: 0 }}>
              Weighted at 40% for Engaged and 70% for Proposal. Closed Lost never feeds the forecast.
            </p>
          </div>
        </section>
      )}

      <Drawer
        open={!!editing}
        eyebrow={editing?.id ? "Edit opportunity" : "New opportunity"}
        title={editing?.name || "Add opportunity"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-grid">
              <label className="field wide">
                <span>Company</span>
                <input
                  className="input"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Contact</span>
                <input
                  className="input"
                  value={editing.contact}
                  onChange={(e) => setEditing({ ...editing, contact: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Sector</span>
                <input
                  className="input"
                  value={editing.sector}
                  onChange={(e) => setEditing({ ...editing, sector: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Opportunity value (£)</span>
                <input
                  className="input num"
                  inputMode="decimal"
                  value={editing.value}
                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Stage</span>
                <select
                  className="input"
                  value={editing.stage}
                  onChange={(e) => setEditing({ ...editing, stage: e.target.value })}
                >
                  {STAGES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Sales owner</span>
                <select
                  className="input"
                  value={editing.ownerId}
                  onChange={(e) => setEditing({ ...editing, ownerId: e.target.value })}
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field wide">
                <span>Next action</span>
                <input
                  className="input"
                  value={editing.nextAction}
                  onChange={(e) => setEditing({ ...editing, nextAction: e.target.value })}
                  placeholder="e.g. Send radio costs, 6 Aug"
                />
              </label>
            </div>

            {editing.id && (
              <FollowUp
                leadId={editing.id}
                defaultTitle={`Follow up: ${editing.name}`}
                staff={staff}
                defaultAssigneeId={editing.ownerId}
              />
            )}

            {editing.stage === "Closed Won" && (
              <p className="sub-line" style={{ margin: 0 }}>
                Won deals sit here for the record. Book the work as a campaign to raise its purchase
                orders and pull it into billings.
              </p>
            )}

            {error && <p style={{ color: "var(--crit)", fontSize: 12.5, margin: 0 }}>{error}</p>}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
              {editing.id && editing.stage !== "Closed Won" && (
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => move(editing.id!, editing.stage === "Engaged" ? "Proposal" : "Closed Won")}
                >
                  Move to {editing.stage === "Engaged" ? "Proposal" : "Closed Won"}
                </button>
              )}
              {editing.id && (
                <button className="btn" style={{ marginLeft: "auto", color: "var(--crit)" }} disabled={busy} onClick={() => remove(editing.id!)}>
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
