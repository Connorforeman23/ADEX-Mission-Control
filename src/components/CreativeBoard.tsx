"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer from "@/components/Drawer";
import { dateGB } from "@/lib/money";
import {
  deleteCreativeItem,
  moveCreativeStage,
  saveCreativeItem,
  type CreativeInput,
} from "@/lib/actions";

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
};

const blank = (ownerId: string): CreativeInput => ({
  item: "",
  clientId: "",
  format: "",
  spec: "",
  dueDate: "",
  stage: "Briefed",
  ownerId,
});

export default function CreativeBoard({
  items,
  clients,
  staff,
}: {
  items: CreativeRow[];
  clients: { id: string; name: string }[];
  staff: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CreativeInput | null>(null);
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

  async function remove(id: string) {
    setBusy(true);
    await deleteCreativeItem(id);
    setBusy(false);
    setEditing(null);
    router.refresh();
  }

  const today = new Date().toISOString().slice(0, 10);

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
            <div className="col" key={stage}>
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
                  return (
                    <button
                      className="tile"
                      key={i.id}
                      onClick={() => {
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
                        });
                      }}
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
                    </button>
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
                <input
                  className="input"
                  value={editing.format}
                  onChange={(e) => setEditing({ ...editing, format: e.target.value })}
                  placeholder="Audio, Video, Press, OOH…"
                />
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

      <style jsx>{`
        .board {
          display: grid;
          gap: 12px;
          grid-auto-flow: column;
          grid-auto-columns: minmax(248px, 1fr);
          overflow-x: auto;
          padding-bottom: 8px;
        }
        .col {
          background: var(--surface-2);
          border: 1px solid var(--line-soft);
          border-radius: 16px;
          padding: 11px;
          min-height: 200px;
        }
        .col-head {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          padding: 0 3px;
        }
        .col-head h3 {
          margin: 0;
          font-size: 12.5px;
          font-weight: 620;
        }
        .col-head span:last-child {
          margin-left: auto;
        }
        .stripe {
          width: 20px;
          height: 3px;
          border-radius: 99px;
        }
        .tile {
          display: block;
          width: 100%;
          text-align: left;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 11px 12px;
          margin-bottom: 9px;
          box-shadow: var(--shadow-card);
          transition: transform 0.12s, border-color 0.12s;
        }
        .tile:hover {
          transform: translateY(-2px);
          border-color: var(--blue);
        }
        .tile-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 9px;
        }
      `}</style>
    </>
  );
}
