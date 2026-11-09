"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProposal } from "@/lib/actions";
import type { Column, DeckSpec, Figure, IconRow, SlideSpec } from "@/lib/proposal-theme";
import type { EmailOffer, ProposalContent } from "@/lib/proposals";

/**
 * Write the proposal.
 *
 * The editor edits the specification, not a document: the slide says what it
 * has to claim, and the template decides how that looks. That is the whole
 * point of having a template — nobody can accidentally produce a deck that
 * isn't an ADEX deck, and improving the template improves every proposal.
 *
 * Nothing saves until Save is pressed, so a half-written slide never becomes
 * the version of record.
 */

const LAYOUTS: { key: SlideSpec["layout"]; label: string }[] = [
  { key: "cover", label: "Cover" },
  { key: "split", label: "Two columns" },
  { key: "full", label: "Full width" },
  { key: "steps", label: "Numbered steps" },
  { key: "stopContinueStart", label: "Stop / continue / start" },
  { key: "closing", label: "Closing" },
];

const COLUMN_KINDS: { key: Column["kind"]; label: string }[] = [
  { key: "prose", label: "Paragraph" },
  { key: "bullets", label: "Bullets" },
  { key: "iconRows", label: "Numbered rows" },
  { key: "figures", label: "Big figures" },
  { key: "table", label: "Table" },
  { key: "image", label: "Picture" },
];

const box: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: 12,
  marginBottom: 10,
  background: "var(--surface)",
};

/** A small labelled group, used above every repeatable list. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function RowTools({
  onRemove,
  onUp,
  onDown,
}: {
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4, flex: "none" }}>
      {onUp && (
        <button className="btn" onClick={onUp} title="Move up" aria-label="Move up">
          &uarr;
        </button>
      )}
      {onDown && (
        <button className="btn" onClick={onDown} title="Move down" aria-label="Move down">
          &darr;
        </button>
      )}
      <button className="btn" onClick={onRemove} title="Remove" aria-label="Remove">
        &times;
      </button>
    </div>
  );
}

/** Move an item within a list, returning a new list. */
function moved<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function FiguresEditor({
  figures,
  onChange,
}: {
  figures: Figure[];
  onChange: (f: Figure[]) => void;
}) {
  return (
    <>
      {figures.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 6 }}>
          <label className="field" style={{ width: 130 }}>
            <span>Figure</span>
            <input
              className="input"
              value={f.value}
              placeholder="1.4m"
              onChange={(e) =>
                onChange(figures.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
              }
            />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>Label beneath it</span>
            <input
              className="input"
              value={f.label}
              placeholder="Adults reached"
              onChange={(e) =>
                onChange(figures.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
              }
            />
          </label>
          <RowTools
            onRemove={() => onChange(figures.filter((_, j) => j !== i))}
            onUp={i > 0 ? () => onChange(moved(figures, i, i - 1)) : undefined}
            onDown={i < figures.length - 1 ? () => onChange(moved(figures, i, i + 1)) : undefined}
          />
        </div>
      ))}
      <button className="btn" onClick={() => onChange([...figures, { value: "", label: "" }])}>
        Add figure
      </button>
    </>
  );
}

function IconRowsEditor({ rows, onChange }: { rows: IconRow[]; onChange: (r: IconRow[]) => void }) {
  return (
    <>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 6 }}>
          <label className="field" style={{ width: 170 }}>
            <span>Label</span>
            <input
              className="input"
              value={r.label}
              onChange={(e) =>
                onChange(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
              }
            />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>Detail</span>
            <input
              className="input"
              value={r.detail}
              onChange={(e) =>
                onChange(rows.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))
              }
            />
          </label>
          <RowTools
            onRemove={() => onChange(rows.filter((_, j) => j !== i))}
            onUp={i > 0 ? () => onChange(moved(rows, i, i - 1)) : undefined}
            onDown={i < rows.length - 1 ? () => onChange(moved(rows, i, i + 1)) : undefined}
          />
        </div>
      ))}
      <button className="btn" onClick={() => onChange([...rows, { label: "", detail: "" }])}>
        Add row
      </button>
    </>
  );
}

/** Bullets and other plain lists: one line each, kept as an array. */
function ItemsEditor({ items, onChange }: { items: string[]; onChange: (i: string[]) => void }) {
  return (
    <>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            value={it}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <RowTools
            onRemove={() => onChange(items.filter((_, j) => j !== i))}
            onUp={i > 0 ? () => onChange(moved(items, i, i - 1)) : undefined}
            onDown={i < items.length - 1 ? () => onChange(moved(items, i, i + 1)) : undefined}
          />
        </div>
      ))}
      <button className="btn" onClick={() => onChange([...items, ""])}>
        Add line
      </button>
    </>
  );
}

/**
 * A table. The first row is the header, which is how the template reads it —
 * so the editor says so rather than leaving it to be discovered.
 */
function TableEditor({ rows, onChange }: { rows: string[][]; onChange: (r: string[][]) => void }) {
  const width = Math.max(2, ...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(Math.max(0, width - r.length)).fill("")];
  return (
    <>
      <small className="sub-line" style={{ display: "block", marginBottom: 6 }}>
        The first row is the heading.
      </small>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5 }}>
          {pad(r).map((cell, c) => (
            <input
              key={c}
              className="input"
              style={{ flex: 1, fontWeight: i === 0 ? 600 : 400 }}
              value={cell}
              onChange={(e) =>
                onChange(
                  rows.map((row, j) =>
                    j === i ? pad(row).map((x, k) => (k === c ? e.target.value : x)) : row
                  )
                )
              }
            />
          ))}
          <RowTools
            onRemove={() => onChange(rows.filter((_, j) => j !== i))}
            onUp={i > 0 ? () => onChange(moved(rows, i, i - 1)) : undefined}
            onDown={i < rows.length - 1 ? () => onChange(moved(rows, i, i + 1)) : undefined}
          />
        </div>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" onClick={() => onChange([...rows, Array(width).fill("")])}>
          Add row
        </button>
        <button className="btn" onClick={() => onChange(rows.map((r) => [...pad(r), ""]))}>
          Add column
        </button>
        {width > 2 && (
          <button className="btn" onClick={() => onChange(rows.map((r) => pad(r).slice(0, -1)))}>
            Remove column
          </button>
        )}
      </div>
    </>
  );
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function ImageColumn({
  col,
  onChange,
}: {
  col: Extract<Column, { kind: "image" }>;
  onChange: (c: Column) => void;
}) {
  const [tooBig, setTooBig] = useState(false);
  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <label className="btn" style={{ cursor: "pointer" }}>
          {col.dataUri ? "Replace picture" : "Choose picture"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > MAX_IMAGE_BYTES) return setTooBig(true);
              setTooBig(false);
              const reader = new FileReader();
              reader.onload = () => onChange({ ...col, dataUri: String(reader.result) });
              reader.readAsDataURL(file);
            }}
          />
        </label>
        {col.dataUri && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={col.dataUri}
              alt=""
              style={{
                height: 68,
                borderRadius: 6,
                border: "1px solid var(--line)",
                objectFit: "cover",
              }}
            />
            <button className="btn" onClick={() => onChange({ ...col, dataUri: undefined })}>
              Remove
            </button>
          </>
        )}
      </div>
      {tooBig && (
        <small style={{ color: "var(--crit)" }}>
          That picture is over 4MB &mdash; the deck would be slow to open. Please use a smaller one.
        </small>
      )}
      <label className="field" style={{ marginTop: 8 }}>
        <span>Caption (optional)</span>
        <input
          className="input"
          value={col.caption ?? ""}
          onChange={(e) => onChange({ ...col, caption: e.target.value })}
        />
      </label>
    </>
  );
}

function ColumnEditor({ col, onChange }: { col: Column; onChange: (c: Column) => void }) {
  function retype(kind: Column["kind"]) {
    // Keep the heading when there is one to keep, so changing a bullet list
    // into a paragraph does not lose the thing it was called.
    const heading = "heading" in col ? col.heading : undefined;
    switch (kind) {
      case "prose":
        return onChange({ kind, heading, text: "" });
      case "bullets":
        return onChange({ kind, heading, items: [""] });
      case "iconRows":
        return onChange({ kind, heading, rows: [{ label: "", detail: "" }] });
      case "figures":
        return onChange({ kind, figures: [{ value: "", label: "" }] });
      case "table":
        return onChange({
          kind,
          rows: [
            ["", ""],
            ["", ""],
          ],
        });
      case "image":
        return onChange({ kind, caption: "" });
    }
  }

  return (
    <div style={box}>
      <label className="field" style={{ maxWidth: 220 }}>
        <span>This column is</span>
        <select
          className="input"
          value={col.kind}
          onChange={(e) => retype(e.target.value as Column["kind"])}
        >
          {COLUMN_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </select>
      </label>

      {"heading" in col && (
        <label className="field" style={{ marginTop: 8 }}>
          <span>Heading (optional, shown in pink)</span>
          <input
            className="input"
            value={col.heading ?? ""}
            onChange={(e) => onChange({ ...col, heading: e.target.value })}
          />
        </label>
      )}

      {col.kind === "prose" && (
        <label className="field" style={{ marginTop: 8 }}>
          <span>Text</span>
          <textarea
            className="input"
            rows={4}
            value={col.text}
            onChange={(e) => onChange({ ...col, text: e.target.value })}
          />
        </label>
      )}

      {col.kind === "bullets" && (
        <Group title="Bullets">
          <ItemsEditor items={col.items} onChange={(items) => onChange({ ...col, items })} />
        </Group>
      )}

      {col.kind === "iconRows" && (
        <Group title="Numbered rows">
          <IconRowsEditor rows={col.rows} onChange={(rows) => onChange({ ...col, rows })} />
        </Group>
      )}

      {col.kind === "figures" && (
        <Group title="Figures">
          <FiguresEditor
            figures={col.figures}
            onChange={(figures) => onChange({ ...col, figures })}
          />
        </Group>
      )}

      {col.kind === "table" && (
        <Group title="Table">
          <TableEditor rows={col.rows} onChange={(rows) => onChange({ ...col, rows })} />
        </Group>
      )}

      {col.kind === "image" && (
        <Group title="Picture">
          <ImageColumn col={col} onChange={onChange} />
        </Group>
      )}
    </div>
  );
}

function StepsEditor({
  slide,
  onChange,
}: {
  slide: SlideSpec;
  onChange: (s: SlideSpec) => void;
}) {
  const steps = slide.steps ?? [];
  const set = (next: NonNullable<SlideSpec["steps"]>) => onChange({ ...slide, steps: next });
  return (
    <Group title="Steps">
      {steps.map((st, i) => (
        <div key={i} style={box}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <label className="field" style={{ width: 80 }}>
              <span>No.</span>
              <input
                className="input"
                value={st.label}
                onChange={(e) =>
                  set(steps.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                }
              />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>Title</span>
              <input
                className="input"
                value={st.title}
                onChange={(e) =>
                  set(steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                }
              />
            </label>
            <RowTools
              onRemove={() => set(steps.filter((_, j) => j !== i))}
              onUp={i > 0 ? () => set(moved(steps, i, i - 1)) : undefined}
              onDown={i < steps.length - 1 ? () => set(moved(steps, i, i + 1)) : undefined}
            />
          </div>
          <label className="field" style={{ marginTop: 8 }}>
            <span>Detail</span>
            <textarea
              className="input"
              rows={2}
              value={st.detail ?? ""}
              onChange={(e) =>
                set(steps.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))
              }
            />
          </label>
        </div>
      ))}
      <button
        className="btn"
        onClick={() =>
          set([
            ...steps,
            { label: String(steps.length + 1).padStart(2, "0"), title: "", detail: "" },
          ])
        }
      >
        Add step
      </button>
    </Group>
  );
}

function ListsEditor({
  slide,
  onChange,
}: {
  slide: SlideSpec;
  onChange: (s: SlideSpec) => void;
}) {
  const lists = slide.lists ?? [];
  const set = (next: NonNullable<SlideSpec["lists"]>) => onChange({ ...slide, lists: next });
  return (
    <Group title="Three lists">
      {lists.map((list, i) => (
        <div key={i} style={box}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <label className="field" style={{ flex: 1 }}>
              <span>Column title</span>
              <input
                className="input"
                value={list.title}
                onChange={(e) =>
                  set(lists.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                }
              />
            </label>
            <RowTools
              onRemove={() => set(lists.filter((_, j) => j !== i))}
              onUp={i > 0 ? () => set(moved(lists, i, i - 1)) : undefined}
              onDown={i < lists.length - 1 ? () => set(moved(lists, i, i + 1)) : undefined}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <ItemsEditor
              items={list.items}
              onChange={(items) => set(lists.map((x, j) => (j === i ? { ...x, items } : x)))}
            />
          </div>
        </div>
      ))}
      {lists.length < 3 && (
        <button className="btn" onClick={() => set([...lists, { title: "", items: [""] }])}>
          Add column
        </button>
      )}
    </Group>
  );
}

function SlideEditor({
  slide,
  index,
  total,
  logoCount,
  onChange,
  onMove,
  onRemove,
  onDuplicate,
}: {
  slide: SlideSpec;
  index: number;
  total: number;
  logoCount: number;
  onChange: (s: SlideSpec) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const [open, setOpen] = useState(index === 0);
  const layout = LAYOUTS.find((l) => l.key === slide.layout);
  const columns = slide.columns ?? [];
  const maxColumns = slide.layout === "split" ? 2 : 1;
  const structured = slide.layout === "steps" || slide.layout === "stopContinueStart";

  return (
    <section className="card" style={{ marginBottom: 12 }}>
      <div
        className="card-body"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingBottom: open ? 0 : undefined,
        }}
      >
        <button
          className="btn"
          onClick={() => setOpen(!open)}
          style={{ flex: "none" }}
          aria-expanded={open}
        >
          {open ? "−" : "+"}
        </button>
        <div className="grow" style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 560 }}>
            {index + 1}. {slide.headline || <span className="sub-line">Untitled slide</span>}
          </p>
          <small className="sub-line">{layout?.label ?? slide.layout}</small>
        </div>
        <button className="btn" onClick={onDuplicate} style={{ flex: "none" }}>
          Duplicate
        </button>
        <RowTools
          onRemove={onRemove}
          onUp={index > 0 ? () => onMove(index - 1) : undefined}
          onDown={index < total - 1 ? () => onMove(index + 1) : undefined}
        />
      </div>

      {open && (
        <div className="card-body">
          <div className="form-grid">
            <label className="field">
              <span>Layout</span>
              <select
                className="input"
                value={slide.layout}
                onChange={(e) =>
                  onChange({ ...slide, layout: e.target.value as SlideSpec["layout"] })
                }
              >
                {LAYOUTS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Eyebrow &mdash; the section, in pink caps</span>
              <input
                className="input"
                value={slide.eyebrow ?? ""}
                placeholder="Idea 01 &middot; Zero-waste geography"
                onChange={(e) => onChange({ ...slide, eyebrow: e.target.value })}
              />
            </label>
            <label className="field wide">
              <span>Headline &mdash; a claim, not a label</span>
              <input
                className="input"
                value={slide.headline}
                placeholder="Pay only to reach people on the client's own patch"
                onChange={(e) => onChange({ ...slide, headline: e.target.value })}
              />
            </label>
            <label className="field wide">
              <span>Standfirst (optional)</span>
              <textarea
                className="input"
                rows={2}
                value={slide.standfirst ?? ""}
                onChange={(e) => onChange({ ...slide, standfirst: e.target.value })}
              />
            </label>
          </div>

          {slide.layout === "steps" && <StepsEditor slide={slide} onChange={onChange} />}
          {slide.layout === "stopContinueStart" && (
            <ListsEditor slide={slide} onChange={onChange} />
          )}

          <Group title="Figures across the slide (optional)">
            <FiguresEditor
              figures={slide.figures ?? []}
              onChange={(figures) => onChange({ ...slide, figures })}
            />
          </Group>

          {!structured && (
            <Group title={maxColumns === 2 ? "Columns" : "Content"}>
              {columns.map((col, i) => (
                <ColumnEditor
                  key={i}
                  col={col}
                  onChange={(c) =>
                    onChange({ ...slide, columns: columns.map((x, j) => (j === i ? c : x)) })
                  }
                />
              ))}
              <div style={{ display: "flex", gap: 8 }}>
                {columns.length < maxColumns && (
                  <button
                    className="btn"
                    onClick={() =>
                      onChange({
                        ...slide,
                        columns: [...columns, { kind: "prose", text: "" }],
                      })
                    }
                  >
                    Add {columns.length ? "second column" : "content"}
                  </button>
                )}
                {columns.length > 0 && (
                  <button
                    className="btn"
                    onClick={() => onChange({ ...slide, columns: columns.slice(0, -1) })}
                  >
                    Remove last
                  </button>
                )}
              </div>
            </Group>
          )}

          <div className="form-grid" style={{ marginTop: 12 }}>
            <label className="field wide">
              <span>Navy strip &mdash; the one point this slide exists to make</span>
              <input
                className="input"
                value={slide.strip ?? ""}
                onChange={(e) => onChange({ ...slide, strip: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Footnote &mdash; anything not yet confirmed</span>
              <input
                className="input"
                value={slide.footnote ?? ""}
                placeholder="Rates requested"
                onChange={(e) => onChange({ ...slide, footnote: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Media owner logos along the foot</span>
              <input
                className="input"
                value={(slide.logos ?? []).join(", ")}
                placeholder="Free Radio, Global, JCDecaux"
                list="adex-logo-names"
                onChange={(e) =>
                  onChange({
                    ...slide,
                    logos: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
          </div>
          <small className="sub-line">
            Logos come from the organisation records, so nobody hunts for an image. A supplier with
            no logo saved shows as its name instead.{" "}
            {logoCount
              ? `${logoCount} ${logoCount === 1 ? "company has" : "companies have"} one saved.`
              : "No company has one saved yet."}
          </small>
        </div>
      )}
    </section>
  );
}

/**
 * The save strip. It sticks to the foot of the window because the deck editor
 * is long, and a Save button you have to scroll to find is a Save button
 * people forget to press.
 */
function SaveBar({
  dirty,
  busy,
  error,
  onSave,
}: {
  dirty: boolean;
  busy: boolean;
  error: string | null;
  onSave: () => void;
}) {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        marginTop: 14,
        padding: "10px 0",
        background: "var(--bg)",
        borderTop: "1px solid var(--line-soft)",
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <button className="btn btn-primary" onClick={onSave} disabled={busy || !dirty}>
        {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
      </button>
      {dirty && !busy && <small className="sub-line">Unsaved changes.</small>}
      {error && <small style={{ color: "var(--crit)" }}>{error}</small>}
    </div>
  );
}

export default function ProposalEditor({
  id,
  kind,
  content,
  logoNames,
  readOnly = false,
}: {
  id: string;
  kind: string;
  content: ProposalContent;
  logoNames: string[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProposalContent>(content);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function edit(next: ProposalContent) {
    setDraft(next);
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await saveProposal(id, { content: draft });
    setBusy(false);
    if (res.error) return setError(res.error);
    setDirty(false);
    router.refresh();
  }

  if (kind === "email") {
    const offer = draft as Partial<EmailOffer>;
    return (
      <section className="card">
        <div className="card-body">
          <label className="field">
            <span>Subject</span>
            <input
              className="input"
              value={offer.subject ?? ""}
              disabled={readOnly}
              onChange={(e) => edit({ ...draft, subject: e.target.value })}
            />
          </label>
          <label className="field" style={{ marginTop: 10 }}>
            <span>The offer</span>
            <textarea
              className="input"
              rows={16}
              value={offer.body ?? ""}
              disabled={readOnly}
              onChange={(e) => edit({ ...draft, body: e.target.value })}
            />
          </label>
          <small className="sub-line" style={{ display: "block", marginTop: 8 }}>
            Write it here, then send it from your own mailbox &mdash; that way the reply lands in
            the thread, and the CRM files the email against the company on the next sync.
          </small>
          {!readOnly && <SaveBar dirty={dirty} busy={busy} error={error} onSave={save} />}
        </div>
      </section>
    );
  }

  const deck = draft as Partial<DeckSpec>;
  const slides = deck.slides ?? [];
  const setSlides = (next: SlideSpec[]) => edit({ ...draft, slides: next });

  return (
    <>
      <datalist id="adex-logo-names">
        {logoNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <section className="card" style={{ marginBottom: 14 }}>
        <div className="card-body">
          <div className="form-grid">
            <label className="field">
              <span>Deck title &mdash; appears on the cover</span>
              <input
                className="input"
                value={deck.title ?? ""}
                disabled={readOnly}
                onChange={(e) => edit({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Client name, as they write it</span>
              <input
                className="input"
                value={deck.client ?? ""}
                disabled={readOnly}
                onChange={(e) => edit({ ...draft, client: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Subtitle (optional)</span>
              <input
                className="input"
                value={deck.subtitle ?? ""}
                disabled={readOnly}
                onChange={(e) => edit({ ...draft, subtitle: e.target.value })}
              />
            </label>
          </div>
          <small className="sub-line" style={{ display: "block", marginTop: 8 }}>
            The ADEX logo, the brand colours and the fonts come from the template, so they are on
            every deck without anyone having to remember. The client&rsquo;s own logo comes from
            their organisation record.
          </small>
        </div>
      </section>

      {slides.map((s, i) => (
        <SlideEditor
          key={i}
          slide={s}
          index={i}
          total={slides.length}
          logoCount={logoNames.length}
          onChange={(next) => setSlides(slides.map((x, j) => (j === i ? next : x)))}
          onMove={(to) => setSlides(moved(slides, i, to))}
          onRemove={() => setSlides(slides.filter((_, j) => j !== i))}
          onDuplicate={() =>
            setSlides([...slides.slice(0, i + 1), structuredClone(s), ...slides.slice(i + 1)])
          }
        />
      ))}

      {!readOnly && (
        <>
          <button
            className="btn"
            onClick={() =>
              setSlides([
                ...slides,
                { layout: "split", headline: "", columns: [{ kind: "prose", text: "" }] },
              ])
            }
          >
            Add slide
          </button>
          <SaveBar dirty={dirty} busy={busy} error={error} onSave={save} />
        </>
      )}
    </>
  );
}
