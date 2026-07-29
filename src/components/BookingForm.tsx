"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign, updateCampaign, type LineInput } from "@/lib/actions";
import {
  CAMPAIGN_STATUSES,
  COPY_OPTIONS,
  CPT_CHANNELS,
  OOH_FORMATS,
  REGIONS,
  SUPPLIERS_BY_CHANNEL,
} from "@/lib/reference";
import { CHANNELS, CHANNEL_COLOUR, channelLabel, gbp, rangeGB, VAT_RATE } from "@/lib/money";

const blankLine = (): LineInput => ({
  channel: "Digital",
  vendor: SUPPLIERS_BY_CHANNEL.Digital[0],
  detail: "",
  start_date: "",
  end_date: "",
  selected_dates: "",
  cpt: "",
  ooh_format: "6 Sheet",
  ooh_disp_type: "Static",
  copy_instruction: "New Copy",
  urn: "",
  supplier_gross: "",
  client_charge: "",
});

const num = (v: string) => {
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// Supplier net is gross less 15%, except Creative which is billed at cost.
const netOf = (l: LineInput) =>
  l.channel === "Creative" ? num(l.supplier_gross) : Math.round(num(l.supplier_gross) * 0.85);

export type EditingCampaign = {
  id: string;
  name: string;
  clientName: string;
  ownerId: string;
  status: string;
  region: string;
  fee: string;
  note: string;
  lines: LineInput[];
};

export default function BookingForm({
  clients,
  staff,
  editing,
  onDone,
}: {
  clients: { id: string; name: string }[];
  staff: { id: string; full_name: string }[];
  editing?: EditingCampaign;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(editing?.name ?? "");
  const [clientName, setClientName] = useState(editing?.clientName ?? "");
  const [newClient, setNewClient] = useState("");
  const [ownerId, setOwnerId] = useState(editing?.ownerId || staff[0]?.id || "");
  const [status, setStatus] = useState(editing?.status ?? "planning");
  const [region, setRegion] = useState(editing?.region ?? "Meridian");
  const [fee, setFee] = useState(editing?.fee ?? "0");
  const [note, setNote] = useState(editing?.note ?? "");
  const [lines, setLines] = useState<LineInput[]>(editing?.lines?.length ? editing.lines : [blankLine()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => {
    const charge = lines.reduce((a, l) => a + (num(l.client_charge) || num(l.supplier_gross)), 0) + num(fee);
    const gross = lines.reduce((a, l) => a + num(l.supplier_gross), 0);
    const net = lines.reduce((a, l) => a + netOf(l), 0);
    return {
      charge,
      gross,
      net,
      profit: charge - net,
      commission: gross - net,
      markup: charge - num(fee) - gross,
      vat: Math.round(charge * VAT_RATE),
      margin: charge ? ((charge - net) / charge) * 100 : 0,
    };
  }, [lines, fee]);

  function updateLine(i: number, patch: Partial<LineInput>) {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, ...patch };
        // Switching channel resets the supplier to that channel's roster.
        if (patch.channel && !SUPPLIERS_BY_CHANNEL[patch.channel]?.includes(next.vendor)) {
          next.vendor = SUPPLIERS_BY_CHANNEL[patch.channel]?.[0] ?? "";
        }
        return next;
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload = {
      name,
      clientName: clientName === "__new" ? newClient : clientName,
      ownerId,
      status,
      region,
      fee,
      note,
      lines,
    };
    const result = editing
      ? await updateCampaign(editing.id, payload)
      : await createCampaign(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (onDone) onDone();
    else router.push("/campaigns");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 1 — campaign details */}
      <section className="card">
        <div className="card-head">
          <h2>1 · Campaign details</h2>
        </div>
        <div className="card-body form-grid">
          <label className="field wide">
            <span>Campaign name</span>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Autumn Sale Burst" />
          </label>
          <label className="field">
            <span>Client</span>
            <select className="input" required value={clientName} onChange={(e) => setClientName(e.target.value)}>
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
              <option value="__new">+ New client…</option>
            </select>
          </label>
          {clientName === "__new" && (
            <label className="field">
              <span>New client name</span>
              <input className="input" required value={newClient} onChange={(e) => setNewClient(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Sales owner</span>
            <select className="input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Region / coverage</span>
            <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="field wide">
            <span>Notes</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the team should know" />
          </label>
        </div>
      </section>

      {/* 2 — booking lines */}
      <section className="card">
        <div className="card-head">
          <h2>2 · Booking lines</h2>
          <span className="sub">Client charge is invoiced; supplier gross drives the PO at −15%</span>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lines.map((l, i) => (
            <div key={i} className="line-card">
              <div className="form-grid">
                <label className="field">
                  <span>Channel</span>
                  <select className="input" value={l.channel} onChange={(e) => updateLine(i, { channel: e.target.value })}>
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {channelLabel(c)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Supplier</span>
                  <select className="input" value={l.vendor} onChange={(e) => updateLine(i, { vendor: e.target.value })}>
                    {(SUPPLIERS_BY_CHANNEL[l.channel] ?? []).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="field wide">
                  <span>Detail</span>
                  <input className="input" value={l.detail} onChange={(e) => updateLine(i, { detail: e.target.value })} placeholder="e.g. Breakfast + drive, 24 spots p/w" />
                </label>
                <label className="field">
                  <span>Start date</span>
                  <input className="input num" type="date" required value={l.start_date} onChange={(e) => updateLine(i, { start_date: e.target.value })} />
                </label>
                <label className="field">
                  <span>End date</span>
                  <input className="input num" type="date" required value={l.end_date} onChange={(e) => updateLine(i, { end_date: e.target.value })} />
                </label>
                <label className="field wide">
                  <span>Selected dates (optional)</span>
                  <input className="input" value={l.selected_dates} onChange={(e) => updateLine(i, { selected_dates: e.target.value })} placeholder="e.g. 13 Jul, 20 Jul, 27 Jul only" />
                </label>

                {l.channel === "OOH" && (
                  <>
                    <label className="field">
                      <span>Format</span>
                      <select className="input" value={l.ooh_format} onChange={(e) => updateLine(i, { ooh_format: e.target.value })}>
                        {OOH_FORMATS.map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Digital / static</span>
                      <select className="input" value={l.ooh_disp_type} onChange={(e) => updateLine(i, { ooh_disp_type: e.target.value })}>
                        <option>Static</option>
                        <option>Digital</option>
                      </select>
                    </label>
                  </>
                )}

                <label className="field">
                  <span>Client charge (£ ex VAT)</span>
                  <input className="input num" inputMode="decimal" value={l.client_charge} onChange={(e) => updateLine(i, { client_charge: e.target.value })} placeholder="invoice side" />
                </label>
                <label className="field">
                  <span>Supplier gross (£)</span>
                  <input className="input num" inputMode="decimal" value={l.supplier_gross} onChange={(e) => updateLine(i, { supplier_gross: e.target.value })} placeholder="PO side" />
                </label>
                <label className="field">
                  <span>Supplier net (−15%)</span>
                  <input className="input num" value={gbp(netOf(l))} disabled style={{ opacity: 0.75 }} />
                </label>
                {CPT_CHANNELS.includes(l.channel) && (
                  <label className="field">
                    <span>CPT (£)</span>
                    <input className="input num" inputMode="decimal" value={l.cpt} onChange={(e) => updateLine(i, { cpt: e.target.value })} placeholder="cost per thousand" />
                  </label>
                )}

                <label className="field">
                  <span>Copy instructions</span>
                  <select className="input" value={l.copy_instruction} onChange={(e) => updateLine(i, { copy_instruction: e.target.value })}>
                    {COPY_OPTIONS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                {l.copy_instruction === "URN" && (
                  <label className="field">
                    <span>URN</span>
                    <input className="input" value={l.urn} onChange={(e) => updateLine(i, { urn: e.target.value })} placeholder="e.g. ADEX/2026/0451" />
                  </label>
                )}
              </div>

              <div className="line-foot">
                <span className="chan">
                  <i style={{ background: CHANNEL_COLOUR[l.channel] }} />
                  {channelLabel(l.channel)} · net {gbp(netOf(l))}
                  {l.start_date && l.end_date ? ` · ${rangeGB(l.start_date, l.end_date)}` : ""}
                </span>
                {lines.length > 1 && (
                  <button type="button" className="btn" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}>
                    Remove line
                  </button>
                )}
              </div>
            </div>
          ))}

          <div>
            <button type="button" className="btn" onClick={() => setLines((p) => [...p, blankLine()])}>
              + Add booking line
            </button>
          </div>
        </div>
      </section>

      {/* 3 — fees */}
      <section className="card">
        <div className="card-head">
          <h2>3 · Fees</h2>
        </div>
        <div className="card-body">
          <label className="field" style={{ maxWidth: 220 }}>
            <span>Planning fee (£)</span>
            <input className="input num" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
          </label>
        </div>
      </section>

      {/* 4 — commercials */}
      <section className="card">
        <div className="card-head">
          <h2>4 · Commercials</h2>
          <span className="sub">Updates as you type</span>
        </div>
        <div className="card-body">
          <div className="totals">
            <div>
              <div className="eyebrow">Invoice — gross ex VAT</div>
              <div className="num total-value">{gbp(totals.charge)}</div>
            </div>
            <div>
              <div className="eyebrow">POs — supplier net</div>
              <div className="num total-value" style={{ color: "var(--mid)" }}>
                {gbp(totals.net)}
              </div>
            </div>
            <div>
              <div className="eyebrow">Profit</div>
              <div className="num total-value" style={{ color: totals.profit >= 0 ? "var(--ok)" : "var(--crit)" }}>
                {gbp(totals.profit)}{" "}
                <small style={{ fontSize: 11, color: "var(--faint)" }}>{totals.margin.toFixed(1)}%</small>
              </div>
            </div>
          </div>
          <div className="split-line">
            <small className="sub-line">Split:</small>
            <small className="num">Commission <b>{gbp(totals.commission)}</b></small>
            <small className="num">Markup <b style={{ color: totals.markup > 0 ? "var(--pink)" : undefined }}>{gbp(totals.markup)}</b></small>
            <small className="num">Fees <b>{gbp(num(fee))}</b></small>
          </div>
          <div className="split-line">
            <small className="sub-line">Client invoice:</small>
            <small className="num">Gross ex VAT <b>{gbp(totals.charge)}</b></small>
            <small className="num">+ VAT 20% <b>{gbp(totals.vat)}</b></small>
            <small className="num">Total <b style={{ color: "var(--blue)" }}>{gbp(totals.charge + totals.vat)}</b></small>
          </div>
          {totals.markup < 0 && (
            <p style={{ color: "var(--crit)", fontSize: 12.5, margin: "10px 0 0" }}>
              You&rsquo;re charging below supplier gross — check the line values.
            </p>
          )}
          {totals.charge > 0 && totals.margin < 15 && (
            <p style={{ color: "var(--warn)", fontSize: 12.5, margin: "10px 0 0" }}>
              Margin is below the 15% floor.
            </p>
          )}
        </div>
      </section>

      {error && (
        <p style={{ color: "var(--crit)", fontSize: 13, margin: 0 }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Book campaign"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => (onDone ? onDone() : router.push("/campaigns"))}
        >
          Cancel
        </button>
      </div>

      <style jsx>{`
        .line-card {
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 12px;
          background: var(--surface-2);
        }
        .line-foot {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--line-soft);
        }
        .line-foot :global(.btn) {
          margin-left: auto;
        }
        .chan {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          color: var(--mid);
        }
        .chan i {
          width: 8px;
          height: 8px;
          border-radius: 2px;
          display: block;
        }
        .totals {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          padding: 12px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--surface-2);
        }
        .total-value {
          font-size: 18px;
          font-weight: 700;
          margin-top: 4px;
        }
        .split-line {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 10px;
          color: var(--mid);
        }
      `}</style>
    </form>
  );
}
