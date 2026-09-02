"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ADEX } from "@/lib/po";
import { dateGB } from "@/lib/money";
import { invoiceTotals, PAYMENT_TERMS, type ClientInvoice } from "@/lib/invoice";
import { saveClientInvoice } from "@/lib/actions";
import { pushInvoiceToXero } from "@/lib/xero-actions";

// The client invoice as ADEX sends it, laid out to match the Randox invoices.
// The client sees description, net, VAT and gross — never the supplier, what we
// paid them, or the margin. That is the whole point of keeping this document
// separate from the Space Order.
function money2(n: number) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Draft = { key: string; campaignLineId: string | null; description: string; net: string };

export default function InvoiceSheet({ invoice }: { invoice: ClientInvoice }) {
  const router = useRouter();
  // Editable only while it is ours: a draft Xero has never seen.
  const draft = invoice.status === "Draft" && !invoice.xeroId;

  const [lines, setLines] = useState<Draft[]>(
    invoice.lines.map((l) => ({
      key: l.id,
      campaignLineId: l.campaignLineId,
      description: l.description,
      net: String(l.net),
    }))
  );
  const [clientPo, setClientPo] = useState(invoice.clientPo ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushed, setPushed] = useState<string | null>(null);

  // Totals follow what is on screen, so an edit shows its effect before saving.
  const totals = invoiceTotals(
    lines.map((l) => ({ net: Number(l.net.replace(/[^0-9.-]/g, "")) || 0 }))
  );

  function update(i: number, patch: Partial<Draft>) {
    setLines((prev) => prev.map((l, n) => (n === i ? { ...l, ...patch } : l)));
    setSaved(false);
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { key: `new-${prev.length}-${prev.length}`, campaignLineId: null, description: "", net: "" },
    ]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, n) => n !== i));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await saveClientInvoice(
      invoice.id,
      lines.map((l) => ({
        campaignLineId: l.campaignLineId,
        description: l.description,
        net: l.net,
      })),
      clientPo
    );
    setBusy(false);
    if (res.error) return setError(res.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  }

  async function saveThenPrint() {
    if (draft) await save();
    window.print();
  }

  // Saves first on purpose — Xero should receive what is on the screen, not
  // whatever was last written to the database.
  async function pushToXero() {
    setBusy(true);
    setError(null);
    const write = await saveClientInvoice(
      invoice.id,
      lines.map((l) => ({
        campaignLineId: l.campaignLineId,
        description: l.description,
        net: l.net,
      })),
      clientPo
    );
    if (write.error) {
      setBusy(false);
      return setError(write.error);
    }
    const res = await pushInvoiceToXero(invoice.id);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setPushed(res.message);
    router.refresh();
  }

  return (
    <>
      {/* Controls — deliberately excluded from the printed invoice. */}
      <div className="inv-controls">
        {draft ? (
          <>
            <label className="field">
              <span>Client PO number</span>
              <input
                className="input"
                value={clientPo}
                onChange={(e) => setClientPo(e.target.value)}
                placeholder="e.g. 227936"
              />
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <button className="btn" onClick={addLine} disabled={busy}>
                Add line
              </button>
              <button className="btn" onClick={save} disabled={busy}>
                {busy ? "Saving…" : saved ? "Saved" : "Save draft"}
              </button>
              <button className="btn" onClick={saveThenPrint} disabled={busy}>
                Print / Save as PDF
              </button>
              <button className="btn btn-primary" onClick={pushToXero} disabled={busy}>
                {busy ? "Working…" : "Push to Xero"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="inv-locked">
              {invoice.xeroId ? (
                <>
                  This invoice is in <b>Xero</b> now, so Xero is the record. Edit it there.
                </>
              ) : (
                <>
                  This invoice is <b>{invoice.status}</b>, so the figures are fixed. Raise a credit
                  rather than editing it.
                </>
              )}
            </p>
            <button className="btn btn-primary" onClick={saveThenPrint}>
              Print / Save as PDF
            </button>
          </>
        )}
      </div>
      {error && <p style={{ color: "var(--crit)", fontSize: 12.5 }}>{error}</p>}
      {pushed && <p style={{ color: "var(--ok)", fontSize: 12.5 }}>{pushed}</p>}

      {/* The invoice itself. */}
      <div className="inv-sheet">
        <div className="inv-top">
          <div className="inv-logo">
            <Image src="/adex-logo.jpg" alt="adex" width={140} height={99} priority />
          </div>
          <table className="inv-meta">
            <tbody>
              <tr>
                <th>Invoice Number</th>
                <td className="inv-no">{invoice.invoiceNo ?? "Draft"}</td>
              </tr>
              <tr>
                <th>Invoice Date</th>
                <td>{dateGB(invoice.invoiceDate)}</td>
              </tr>
              <tr>
                <th>Payment Due On or Before</th>
                <td>{invoice.dueDate ? dateGB(invoice.dueDate) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="inv-to">
          <div className="strong">{invoice.client}</div>
          {invoice.clientAddress.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>

        <table className="inv-lines">
          <thead>
            <tr>
              <th>Advertisement Details</th>
              <th className="r">Net Amount</th>
              <th className="r">VAT Amount</th>
              <th className="r">Gross Amount</th>
              {draft && <th className="inv-x" />}
            </tr>
          </thead>
          <tbody>
            {/* The client's own PO leads the schedule as a zero-value line,
                exactly as it does on the Randox invoices. */}
            {clientPo.trim() && (
              <tr>
                <td>PO Number {clientPo.trim()}</td>
                <td className="r">0.00</td>
                <td className="r">0.00</td>
                <td className="r">0.00</td>
                {draft && <td className="inv-x" />}
              </tr>
            )}
            {lines.map((l, i) => {
              const net = Number(l.net.replace(/[^0-9.-]/g, "")) || 0;
              const vat = Math.round(net * 20) / 100;
              return (
                <tr key={l.key}>
                  <td>
                    {draft ? (
                      <input
                        className="inv-input"
                        value={l.description}
                        onChange={(e) => update(i, { description: e.target.value })}
                        placeholder="e.g. 50 x 4 Sheets GD 07.09.26 - 20.09.26"
                      />
                    ) : (
                      l.description
                    )}
                  </td>
                  <td className="r">
                    {draft ? (
                      <input
                        className="inv-input r"
                        value={l.net}
                        onChange={(e) => update(i, { net: e.target.value })}
                        inputMode="decimal"
                      />
                    ) : (
                      money2(net)
                    )}
                  </td>
                  <td className="r">{money2(vat)}</td>
                  <td className="r">{money2(net + vat)}</td>
                  {draft && (
                    <td className="inv-x">
                      <button
                        type="button"
                        className="inv-remove"
                        onClick={() => removeLine(i)}
                        aria-label="Remove line"
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="r">Total Net Amount £</td>
              <td className="r">{money2(totals.net)}</td>
              <td />
              <td />
              {draft && <td className="inv-x" />}
            </tr>
            <tr>
              <td className="r">Total VAT Amount £</td>
              <td className="r">{money2(totals.vat)}</td>
              <td />
              <td />
              {draft && <td className="inv-x" />}
            </tr>
            <tr className="inv-total">
              <td className="r">Invoice Total £</td>
              <td className="r">{money2(totals.total)}</td>
              <td />
              <td />
              {draft && <td className="inv-x" />}
            </tr>
          </tfoot>
        </table>

        <div className="inv-terms">
          <p>All queries must be raised immediately.</p>
          <p>{PAYMENT_TERMS}</p>
        </div>

        <div className="inv-footer">
          {ADEX.name} &nbsp;|&nbsp; {ADEX.address} &nbsp;|&nbsp; {ADEX.phone} &nbsp;|&nbsp;{" "}
          {ADEX.web}
        </div>
      </div>

      <style jsx global>{`
        .inv-controls {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: flex-end;
          margin-bottom: 16px;
        }
        .inv-locked {
          margin: 0;
          font-size: 12.5px;
          color: var(--mid);
        }
        .inv-sheet {
          background: #fff;
          color: #111;
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 30px 34px 22px;
          max-width: 900px;
          font-size: 12.5px;
        }
        .inv-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
        }
        .inv-meta { border-collapse: collapse; }
        .inv-meta th {
          text-align: left;
          font-weight: 700;
          padding: 3px 14px 3px 0;
          white-space: nowrap;
          color: #111;
        }
        .inv-meta td { padding: 3px 0; color: #111; white-space: nowrap; }
        .inv-no { font-weight: 700; }
        .inv-to { margin: 14px 0 18px; line-height: 1.45; color: #111; }
        .inv-lines { width: 100%; border-collapse: collapse; }
        .inv-lines th,
        .inv-lines td {
          border: 1px solid #999;
          padding: 5px 7px;
          text-align: left;
          color: #111;
        }
        .inv-lines thead th { background: #eee; font-weight: 700; }
        .inv-lines .r { text-align: right; white-space: nowrap; }
        .inv-lines tfoot td { font-weight: 700; background: #f6f6f6; }
        .inv-lines tfoot td:empty { border: 0; background: transparent; }
        .inv-total td { border-top: 2px solid #666; }
        /* The remove button sits outside the ruled table so the printed
           invoice keeps its four columns. */
        .inv-lines .inv-x { border: 0; padding: 0 0 0 6px; width: 1%; }
        .inv-remove {
          border: 0;
          background: none;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          color: #999;
          padding: 2px 4px;
        }
        .inv-remove:hover { color: var(--crit); }
        .inv-input {
          width: 100%;
          border: 0;
          background: #fffbe8;
          font: inherit;
          color: #111;
          padding: 1px 3px;
        }
        .inv-input.r { text-align: right; }
        .inv-input:focus { outline: 2px solid var(--blue); }
        .inv-terms { margin-top: 14px; }
        .inv-terms p { margin: 2px 0; }
        .inv-footer {
          margin-top: 26px;
          padding-top: 8px;
          border-top: 1px solid #ccc;
          font-size: 10.5px;
          text-align: center;
          color: #444;
        }

        /* Printing: the invoice alone, and the editable fields print as plain
           text rather than as form boxes. */
        @media print {
          .rail,
          .inv-controls,
          .page-head,
          .menu-btn,
          .rail-reveal { display: none !important; }
          .shell { display: block !important; }
          body { background: #fff !important; }
          .inv-sheet {
            border: 0;
            border-radius: 0;
            padding: 0;
            max-width: none;
          }
          .inv-input { background: transparent; }
          .inv-lines .inv-x { display: none; }
          .page { padding: 0 !important; }
        }
      `}</style>
    </>
  );
}
