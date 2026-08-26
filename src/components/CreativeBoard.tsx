"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer from "@/components/Drawer";
import { useBoardDrag } from "@/components/useBoardDrag";
import { dateGB } from "@/lib/money";
import {
  deleteCreativeItem,
  moveCreativeStage,
  saveCreativeItem,
  type CreativeInput,
} from "@/lib/actions";
import { CREATIVE_FORMATS } from "@/lib/reference";

export const STAGES = ["Briefed", "In design", "Client approval", "Amends", "Approved"];

const STAGE_TINT: Record<string, string> = {
  Briefed: "var(--idle)",
  "In design": "var(--c-print)",
  "Client approval": "var(--warn)",
  Amends: "var(--c-tv)",
  Approved: "var(--ok)",
};

export type CreativeRow = {
  id: string;
  item: string;
  client: string;
  clientId: string;
  format: string | null;
  spec: string | null;
  due_date: string | null;
  stage: string;
  owner: string;
  ownerId: string;
  designSource: "inhouse" | "client";
};

const blank = (ownerId: string): CreativeInput => ({
  item: "",
  clientId: "",
  format: "",
  spec: "",
  dueDate: "",
  stage: "Briefed",
  ownerId,
  designSource: "inhouse",
});

export default function CreativeBoard({
  items,
  clients,
  staff,
  today,
  openNew,
}: {
  items: CreativeRow[];
  clients: { id: string; name: string }[];
  staff: { id: string; full_name: string }[];
  /** Passed from the server so overdue flagging renders identically on both. */
  today: string;
  openNew?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CreativeInput | null>(
    openNew ? blank(staff[0]?.id ?? "") : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!editing) return;
    setBusy(true);
    const res = await saveCreativeItem(editing);
    setBusy(false);
    if (res.error) return setError(res.error);
    setEditing(null);
    router.refresh();
  }

  async function advance(id: string, stage: string) {
    const next = STAGES[Math.min(STAGES.indexOf(stage) + 1, STAGES.length - 1)];
    await moveCreativeStage(id, next);
    setEditing(null);
    router.refresh();
  }

  // Dragging moves an item to whichever column it's dropped on, in either
  // direction — unlike the "advance" button, which only steps forward.
  async function moveTo(id: string, stage: string) {
    await moveCreativeStage(id, stage);
    router.refresh();
  }

  const { dragging, over, cardProps, columnProps } = useBoardDrag(moveTo);

  async function remove(id: string) {
    setBusy(true);
    await deleteCreativeItem(id);
    setBusy(false);
    setEditing(null);
    router.refresh();
  }

  return (
    <>
      <div className="filters">
        <button
          className="btn btn-primary"
          style={{ marginLeft: "auto" }}
          onClick={() => {
            setError(null);
            setEditing(blank(staff[0]?.id ?? ""));
          }}
        >
          New brief
        </button>
      </div>

      <div className="board">
        {STAGES.map((stage) => {
          const set = items.filter((i) => i.stage === stage);
          return (
            <div
              className={over === stage ? "col drop-target" : "col"}
              key={stage}
              {...columnProps(stage)}
            >
              <div className="col-head">
                <span className="stripe" style={{ background: STAGE_TINT[stage] }} />
                <h3>{stage}</h3>
                <span className="num sub-line">{set.length}</span>
              </div>
              {set.length === 0 ? (
                <p className="empty-note" style={{ padding: "12px 4px" }}>
                  Clear
                </p>
              ) : (
                set.map((i) => {
                  const overdue = i.due_date && i.due_date < today && i.stage !== "Approved";
                  const openThis = () => {
                    setError(null);
                    setEditing({
                      id: i.id,
                      item: i.item,
                      clientId: i.clientId,
                      format: i.format ?? "",
                      spec: i.spec ?? "",
                      dueDate: i.due_date ?? "",
                      stage: i.stage,
                      ownerId: i.ownerId,
                      designSource: i.designSource,
                    });
                  };
                  return (
                    <div
                      className="tile"
                      key={i.id}
                      role="button"
                      tabIndex={0}
                      onClick={openThis}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openThis();
                        }
                      }}
                      {...cardProps(i.id)}
                      style={{ opacity: dragging === i.id ? 0.4 : 1, cursor: "grab" }}
                    >
                      <div className="strong">{i.item}</div>
                      <div className="sub-line">{i.client}</div>
                      {(i.format || i.spec) && (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                          {i.format && <span className="pill">{i.format}</span>}
                          {i.spec && <span className="pill">{i.spec}</span>}
                        </div>
                      )}
                      <div className="tile-foot">
                        <span className="sub-line">{i.owner}</span>
                        <span
                          className="num sub-line"
                          style={{ color: overdue ? "var(--crit)" : undefined }}
                        >
                          {i.due_date ? `Due ${dateGB(i.due_date)}` : "No date"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      <Drawer
        open={!!editing}
        eyebrow={editing?.id ? "Edit item" : "New brief"}
        title={editing?.item || "New brief"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-grid">
              <label className="field wide">
                <span>Item</span>
                <input
                  className="input"
                  value={editing.item}
                  onChange={(e) => setEditing({ ...editing, item: e.target.value })}
                  placeholder="e.g. Radio script — 30s offer read"
                />
              </label>
              <label className="field">
                <span>Client</span>
                <select
                  className="input"
                  value={editing.clientId}
                  onChange={(e) => setEditing({ ...editing, clientId: e.target.value })}
                >
                  <option value="">—</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Format</span>
                <select
                  className="input"
                  value={editing.format}
                  onChange={(e) => setEditing({ ...editing, format: e.target.value })}
                >
                  <option value="">Choose format…</option>
                  {CREATIVE_FORMATS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                  {editing.format && !CREATIVE_FORMATS.includes(editing.format) && (
                    <option>{editing.format}</option>
                  )}
                </select>
              </label>
              <label className="field">
                <span>Design</span>
                <select
                  className="input"
                  value={editing.designSource}
                  onChange={(e) =>
                    setEditing({ ...editing, designSource: e.target.value as "inhouse" | "client" })
                  }
                >
                  <option value="inhouse">In-house (James Beach)</option>
                  <option value="client">Client supplied</option>
                </select>
              </label>
              <label className="field">
                <span>Specification</span>
                <input
                  className="input"
                  value={editing.spec}
                  onChange={(e) => setEditing({ ...editing, spec: e.target.value })}
                  placeholder="e.g. 30s · KMFM"
                />
              </label>
              <label className="field">
                <span>Due date</span>
                <input
                  className="input num"
                  type="date"
                  value={editing.dueDate}
                  onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })}
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
                <span>Owner</span>
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
            </div>

            {error && <p style={{ color: "var(--crit)", fontSize: 12.5, margin: 0 }}>{error}</p>}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
              {editing.id && editing.stage !== "Approved" && (
                <button className="btn" disabled={busy} onClick={() => advance(editing.id!, editing.stage)}>
                  Advance stage
                </button>
              )}
              {editing.id && (
                <button
                  className="btn"
                  style={{ marginLeft: "auto", color: "var(--crit)" }}
                  disabled={busy}
                  onClick={() => remove(editing.id!)}
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
