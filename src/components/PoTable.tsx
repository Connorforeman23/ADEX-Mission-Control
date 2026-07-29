"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer from "@/components/Drawer";
import { channelLabel, dateGB, gbp, rangeGB } from "@/lib/money";
import {
  reconcile,
  type PurchaseOrder,
  type Recon,
  type SupplierInvoice,
  INVOICE_TOLERANCE,
} from "@/lib/po";
import { approveVariance, recordSupplierInvoice } from "@/lib/actions";

function ReconChip({ recon }: { recon: Recon }) {
  if (recon.state === "awaiting") return <span className="st done">Awaiting invoice</span>;
  if (recon.state === "matched")
    return <span className="st live">Matched{recon.invoice.approved ? " · approved" : ""}</span>;
  return (
    <span className="st risk">
      Variance {recon.diff > 0 ? "+" : "−"}
      {gbp(Math.abs(recon.diff))}
    </span>
  );
}

export default function PoTable({
  orders,
  invoices,
  today,
}: {
  orders: PurchaseOrder[];
  invoices: SupplierInvoice[];
  /** Order date, passed from the server so both renders agree. */
  today: string;
}) {
  const router = useRouter();
  const invoiceMap = new Map(invoices.map((i) => [i.campaign_line_id, i]));
  const [open, setOpen] = useState<PurchaseOrder | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openPo(po: PurchaseOrder) {
    const existing = invoiceMap.get(po.lineId);
    setInvoiceNo(existing?.invoice_no ?? "");
    setAmount(existing ? String(existing.amount) : "");
    setError(null);
    setOpen(po);
  }

  async function saveInvoice() {
    if (!open) return;
    setBusy(true);
    const res = await recordSupplierInvoice(open.lineId, invoiceNo, amount);
    setBusy(false);
    if (res.error) return setError(res.error);
    setOpen(null);
    router.refresh();
  }

  async function approve() {
    if (!open) return;
    setBusy(true);
    const res = await approveVariance(open.lineId);
    setBusy(false);
    if (res.error) return setError(res.error);
    setOpen(null);
    router.refresh();
  }

  const recon = open ? reconcile(open, invoiceMap) : null;

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>Purchase orders</h2>
          <span className="sub">
            One per booking line · net is gross less 15% · VAT 20% on the net
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {orders.length === 0 ? (
            <p className="empty-note" style={{ padding: "20px 16px" }}>
              No purchase orders yet. They&rsquo;re raised automatically once a campaign moves to
              Booked or Live.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order no</th>
                    <th>Supplier</th>
                    <th>Campaign</th>
                    <th>Dates</th>
                    <th className="r">Gross</th>
                    <th className="r">Net</th>
                    <th className="r">VAT</th>
                    <th className="r">Total inc VAT</th>
                    <th>Reconciliation</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((po) => (
                    <tr key={po.lineId} onClick={() => openPo(po)} style={{ cursor: "pointer" }}>
                      <td className="num ref">{po.po}</td>
                      <td>
                        <div className="strong">{po.vendor}</div>
                        <div className="sub-line">{channelLabel(po.channel)}</div>
                      </td>
                      <td>
                        <div className="strong">{po.campaignName}</div>
                        <div className="sub-line">
                          {po.campaignRef} · {po.client}
                        </div>
                      </td>
                      <td className="num" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                        {rangeGB(po.startDate, po.endDate)}
                      </td>
                      <td className="r num">{gbp(po.gross)}</td>
                      <td className="r num">{gbp(po.net)}</td>
                      <td className="r num" style={{ color: "var(--mid)" }}>
                        {gbp(po.vat)}
                      </td>
                      <td className="r num strong">{gbp(po.total)}</td>
                      <td>
                        <ReconChip recon={reconcile(po, invoiceMap)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Drawer
        open={!!open}
        eyebrow={open ? `Space order · ${open.po}` : ""}
        title={open?.vendor ?? ""}
        onClose={() => setOpen(null)}
      >
        {open && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <dl className="dl">
              <dt>Company</dt>
              <dd>{open.vendor}</dd>
              <dt>From</dt>
              <dd>{open.owner}</dd>
              <dt>Date</dt>
              <dd className="num">{dateGB(today)}</dd>
              <dt>Client</dt>
              <dd>{open.client}</dd>
              <dt>Order number</dt>
              <dd className="num">{open.po}</dd>
              <dt>Details</dt>
              <dd>
                {open.campaignName} <span className="ref">({open.campaignRef})</span>
              </dd>
              <dt>Agency commission</dt>
              <dd className="num">15%</dd>
              <dt>Copy details / URN</dt>
              <dd>{open.copy}</dd>
            </dl>

            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Order line
              </div>
              <div className="po-grid">
                <div className="eyebrow">Media / dates</div>
                <div className="eyebrow">Gross cost</div>
                <div className="eyebrow">Net cost</div>
                <div className="eyebrow">Cost inc VAT</div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 560 }}>{open.detail || open.vendor}</div>
                  <div className="sub-line num">{rangeGB(open.startDate, open.endDate)}</div>
                </div>
                <div className="num">{gbp(open.gross)}</div>
                <div className="num">{gbp(open.net)}</div>
                <div className="num strong">{gbp(open.total)}</div>
              </div>
              <p className="sub-line" style={{ marginTop: 8 }}>
                VAT {gbp(open.vat)} charged at 20% on the net cost.
              </p>
            </div>

            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                {recon?.state === "awaiting"
                  ? "Supplier invoice — not yet received"
                  : recon?.state === "matched"
                    ? "Supplier invoice — matched"
                    : "Supplier invoice — variance"}
              </div>

              {recon?.state === "variance" && (
                <div className="variance-box">
                  <div className="num">
                    <b>{recon.invoice.invoice_no}</b> · {dateGB(recon.invoice.invoice_date)}
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }} className="num">
                    <span>
                      PO net <b>{gbp(open.net)}</b>
                    </span>
                    <span>
                      Invoiced <b>{gbp(Number(recon.invoice.amount))}</b>
                    </span>
                    <span style={{ color: "var(--crit)" }}>
                      Variance <b>{recon.diff > 0 ? "+" : "−"}{gbp(Math.abs(recon.diff))}</b>
                    </span>
                  </div>
                  <button className="btn" style={{ marginTop: 10 }} onClick={approve} disabled={busy}>
                    Approve variance
                  </button>
                </div>
              )}

              {recon?.state === "matched" && (
                <div className="matched-box num">
                  <b>{recon.invoice.invoice_no}</b> · {dateGB(recon.invoice.invoice_date)} ·{" "}
                  {gbp(Number(recon.invoice.amount))} net
                  <div className="sub-line" style={{ color: "var(--ok)" }}>
                    {recon.invoice.approved
                      ? `Variance of ${recon.diff > 0 ? "+" : "−"}${gbp(Math.abs(recon.diff))} approved.`
                      : recon.diff
                        ? `Within tolerance (${recon.diff > 0 ? "+" : "−"}${gbp(Math.abs(recon.diff))}).`
                        : "Exact match to PO net."}
                  </div>
                </div>
              )}

              <div className="form-grid" style={{ marginTop: 12 }}>
                <label className="field">
                  <span>Invoice no</span>
                  <input
                    className="input"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder="e.g. ITV-88540"
                  />
                </label>
                <label className="field">
                  <span>Invoiced net (£ ex VAT)</span>
                  <input
                    className="input num"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={saveInvoice} disabled={busy}>
                {busy ? "Saving…" : recon?.state === "awaiting" ? "Record invoice & match" : "Update invoice"}
              </button>
              <p className="sub-line" style={{ marginTop: 8 }}>
                Matches automatically within ±{gbp(INVOICE_TOLERANCE)} of the PO net ({gbp(open.net)}).
              </p>
              {error && <p style={{ color: "var(--crit)", fontSize: 12.5 }}>{error}</p>}
            </div>

            <p className="sub-line">
              Advertising Excellence Ltd · G4 Ash House Business Centre, Ash Road, New Ash Green, DA3
              8JD · 01474 365 155
            </p>
          </div>
        )}
      </Drawer>

      <style jsx>{`
        .po-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr;
          gap: 8px 10px;
          align-items: center;
          border: 1px solid var(--line);
          border-radius: 11px;
          padding: 10px 12px;
        }
        .variance-box {
          padding: 11px 12px;
          border: 1px solid var(--crit);
          border-radius: 11px;
          background: var(--crit-bg);
          font-size: 12.5px;
        }
        .matched-box {
          padding: 10px 12px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--ok-bg);
          font-size: 12.5px;
        }
      `}</style>
    </>
  );
}
