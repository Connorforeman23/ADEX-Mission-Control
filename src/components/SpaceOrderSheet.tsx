"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ADEX, type SpaceOrder } from "@/lib/po";
import { dateGB } from "@/lib/money";
import { saveSpaceOrderDetails } from "@/lib/actions";

// The Space Order as ADEX actually sends it, laid out to match the Word
// document suppliers already recognise.
//
// IMPORTANT: nothing here shows the client charge. The supplier sees the rate
// card (gross), what we pay them (net) and VAT — never our margin.
function money2(n: number) {
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SpaceOrderSheet({ order }: { order: SpaceOrder }) {
  const router = useRouter();
  const [contact, setContact] = useState(order.supplierContact);
  const [notes, setNotes] = useState(order.orderNotes);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await saveSpaceOrderDetails(order.lineId, contact, notes);
    setBusy(false);
    if (res.error) return setError(res.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  }

  async function saveThenPrint() {
    await save();
    window.print();
  }

  return (
    <>
      {/* Controls — deliberately excluded from the printed sheet. */}
      <div className="so-controls">
        <label className="field">
          <span>To — supplier contact</span>
          <input
            className="input"
            list="supplier-contacts"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={
              order.contacts.length
                ? "Pick a saved contact, or type a name"
                : "No contacts saved for this supplier yet — type a name"
            }
          />
          <datalist id="supplier-contacts">
            {order.contacts.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </label>

        <label className="field" style={{ flex: "1 1 320px" }}>
          <span>Order notes</span>
          <textarea
            className="input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Continuation of campaign. Please confirm receipt of this booking by email."
          />
        </label>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <button className="btn" onClick={save} disabled={busy}>
            {busy ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
          <button className="btn btn-primary" onClick={saveThenPrint} disabled={busy}>
            Print / Save as PDF
          </button>
        </div>
      </div>
      {error && <p style={{ color: "var(--crit)", fontSize: 12.5 }}>{error}</p>}

      {/* The sheet itself. */}
      <div className="so-sheet">
        <div className="so-logo">
          <Image src="/adex-logo.jpg" alt="adex" width={140} height={99} priority />
        </div>

        <h1 className="so-title">Space Order</h1>

        <table className="so-meta">
          <tbody>
            <tr>
              <th>Company:</th>
              <td>{order.supplier}</td>
              <th>Client</th>
              <td>{order.client}</td>
            </tr>
            <tr>
              <th>To:</th>
              <td>{contact || "—"}</td>
              <th>Order Number</th>
              <td className="so-po">{order.po}</td>
            </tr>
            <tr>
              <th>From:</th>
              <td>{order.fromName}</td>
              <th>Details</th>
              <td>{order.summary}</td>
            </tr>
            <tr>
              <th>Date:</th>
              <td>{dateGB(order.date)}</td>
              <th>Agency Commission</th>
              <td>{order.commissionPct}%</td>
            </tr>
            <tr>
              <th>Email:</th>
              <td>{order.fromEmail}</td>
              <th>Copy Details / URN</th>
              <td>{order.copy}</td>
            </tr>
          </tbody>
        </table>

        <table className="so-lines">
          <thead>
            <tr>
              <th>Media</th>
              <th>Dates</th>
              <th>Details</th>
              <th className="r">Gross Cost</th>
              <th className="r">Net Cost</th>
              <th className="r">Cost inc VAT</th>
            </tr>
          </thead>
          <tbody>
            {order.rows.map((r, i) => (
              <tr key={i}>
                <td>{r.media}</td>
                <td>{r.date}</td>
                <td>{r.detail}</td>
                <td className="r">{money2(r.gross)}</td>
                <td className="r">{money2(r.net)}</td>
                <td className="r">{money2(r.total)}</td>
              </tr>
            ))}
          </tbody>
          {order.rows.length > 1 && (
            <tfoot>
              <tr>
                <td colSpan={3}>Total</td>
                <td className="r">{money2(order.gross)}</td>
                <td className="r">{money2(order.net)}</td>
                <td className="r">{money2(order.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        {notes.trim() && (
          <div className="so-notes">
            <b>Order Notes:</b>
            {notes.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        <div className="so-invoiceto">
          Please send invoices to {ADEX.invoicesTo.join(" and ")}.
        </div>

        <div className="so-footer">
          {ADEX.name} &nbsp;|&nbsp; {ADEX.address} &nbsp;|&nbsp; {ADEX.phone} &nbsp;|&nbsp; {ADEX.web}
        </div>
      </div>

      <style jsx global>{`
        .so-controls {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: flex-end;
          margin-bottom: 16px;
        }
        .so-sheet {
          background: #fff;
          color: #111;
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 30px 34px 22px;
          max-width: 900px;
          font-size: 12.5px;
        }
        .so-logo { margin-bottom: 6px; }
        .so-title {
          margin: 0 0 14px;
          font-size: 20px;
          font-weight: 700;
          color: #111;
        }
        .so-meta { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .so-meta th {
          text-align: left;
          font-weight: 700;
          padding: 3px 10px 3px 0;
          white-space: nowrap;
          vertical-align: top;
          width: 1%;
          color: #111;
        }
        .so-meta td { padding: 3px 22px 3px 0; vertical-align: top; color: #111; }
        .so-po { font-weight: 700; }
        .so-lines { width: 100%; border-collapse: collapse; }
        .so-lines th,
        .so-lines td {
          border: 1px solid #999;
          padding: 5px 7px;
          text-align: left;
          color: #111;
        }
        .so-lines thead th { background: #eee; font-weight: 700; }
        .so-lines .r { text-align: right; white-space: nowrap; }
        .so-lines tfoot td { font-weight: 700; background: #f6f6f6; }
        .so-notes { margin-top: 14px; }
        .so-notes p { margin: 2px 0; }
        .so-invoiceto { margin-top: 12px; }
        .so-footer {
          margin-top: 26px;
          padding-top: 8px;
          border-top: 1px solid #ccc;
          font-size: 10.5px;
          text-align: center;
          color: #444;
        }

        /* Printing: the sheet alone, nothing else on the page. */
        @media print {
          .rail,
          .so-controls,
          .page-head,
          .menu-btn,
          .rail-reveal { display: none !important; }
          .shell { display: block !important; }
          body { background: #fff !important; }
          .so-sheet {
            border: 0;
            border-radius: 0;
            padding: 0;
            max-width: none;
          }
          .page { padding: 0 !important; }
        }
      `}</style>
    </>
  );
}
