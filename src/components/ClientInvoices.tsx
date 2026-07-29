"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dateGB, gbp } from "@/lib/money";
import { generateClientInvoice, setInvoiceStatus } from "@/lib/actions";

export type InvoiceRow = {
  id: string;
  invoice_no: string | null;
  invoice_date: string;
  amount_ex_vat: number;
  vat: number;
  status: string;
  campaignRef: string;
  campaignName: string;
  client: string;
  clientPo: string | null;
};

export type InvoiceableCampaign = {
  id: string;
  ref: string;
  name: string;
  client: string;
  amount: number;
  invoiced: boolean;
};

export default function ClientInvoices({
  invoices,
  campaigns,
}: {
  invoices: InvoiceRow[];
  campaigns: InvoiceableCampaign[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uninvoiced = campaigns.filter((c) => !c.invoiced && c.amount > 0);

  async function generate(campaignId: string) {
    setBusy(campaignId);
    setError(null);
    const res = await generateClientInvoice(campaignId);
    setBusy(null);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function advance(inv: InvoiceRow) {
    const next = inv.status === "Draft" ? "Sent" : "Paid";
    setBusy(inv.id);
    await setInvoiceStatus(inv.id, next);
    setBusy(null);
    router.refresh();
  }

  return (
    <section className="card" style={{ marginTop: 14 }}>
      <div className="card-head">
        <h2>Client invoices</h2>
        <span className="sub">Client gross + VAT — supplier costs never appear here</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            className="btn"
            onClick={() =>
              setError(
                "Xero isn't connected yet. Once it is, this pushes every invoice below to Xero " +
                  "with its number and campaign bookings cross-referenced automatically."
              )
            }
          >
            ⚡ Sync with Xero
          </button>
        </span>
      </div>
      <div className="card-body" style={{ paddingTop: 8 }}>
        {error && (
          <p style={{ color: "var(--warn)", fontSize: 12.5, margin: "0 0 10px" }}>{error}</p>
        )}

        {uninvoiced.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Ready to invoice
            </div>
            <div className="rows">
              {uninvoiced.map((c) => (
                <div className="row" key={c.id}>
                  <div className="grow">
                    <p>
                      {c.ref} · {c.name}
                    </p>
                    <small>{c.client}</small>
                  </div>
                  <span className="num strong">{gbp(c.amount)}</span>
                  <span className="num sub-line">+{gbp(Math.round(c.amount * 0.2))} VAT</span>
                  <button
                    className="btn btn-primary"
                    disabled={busy === c.id}
                    onClick={() => generate(c.id)}
                  >
                    {busy === c.id ? "Generating…" : "Generate invoice"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {invoices.length === 0 ? (
          <p className="empty-note">
            No invoices raised yet. Generate one from a campaign above — the number follows the INV
            sequence and links back to the campaign&rsquo;s bookings.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice no</th>
                  <th>Campaign</th>
                  <th>Client PO</th>
                  <th>Date</th>
                  <th className="r">Gross ex VAT</th>
                  <th className="r">VAT</th>
                  <th className="r">Total</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="num ref">{inv.invoice_no ?? "—"}</td>
                    <td>
                      <div className="strong">{inv.campaignName}</div>
                      <div className="sub-line">
                        {inv.campaignRef} · {inv.client}
                      </div>
                    </td>
                    <td className="num sub-line">{inv.clientPo ?? "—"}</td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {dateGB(inv.invoice_date)}
                    </td>
                    <td className="r num">{gbp(Number(inv.amount_ex_vat))}</td>
                    <td className="r num" style={{ color: "var(--mid)" }}>
                      {gbp(Number(inv.vat))}
                    </td>
                    <td className="r num strong">
                      {gbp(Number(inv.amount_ex_vat) + Number(inv.vat))}
                    </td>
                    <td>
                      <span
                        className={`st ${inv.status === "Paid" ? "live" : inv.status === "Sent" ? "booked" : "planning"}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      {inv.status !== "Paid" && (
                        <button className="btn" disabled={busy === inv.id} onClick={() => advance(inv)}>
                          Mark {inv.status === "Draft" ? "sent" : "paid"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
