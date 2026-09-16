"use client";

import { useMemo, useState } from "react";
import { gbp } from "@/lib/money";

// Sales per client per member of the sales team, for a chosen period.
//
// "Sales" here is the client charge ex VAT — what we invoice — attributed to
// the month the campaign starts. That is the month the work is sold into, and
// it is the same basis the Dashboard and Finance use, so the numbers agree.
// (Invoice-date attribution comes with the Sage history, once it's loaded.)

export type SalesLine = {
  client: string;
  owner: string;
  /** Campaign start, YYYY-MM-DD. */
  start: string;
  /** Client charge ex VAT for the whole campaign. */
  amount: number;
};

type Period = "month" | "last-month" | "quarter" | "year" | "last-year" | "all";

const PERIODS: { value: Period; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
  { value: "last-year", label: "Last year" },
  { value: "all", label: "All time" },
];

function range(period: Period, today: Date): [string, string] {
  const y = today.getFullYear();
  const m = today.getMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  switch (period) {
    case "month":
      return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
    case "last-month":
      return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    case "quarter": {
      const q = Math.floor(m / 3) * 3;
      return [iso(new Date(y, q, 1)), iso(new Date(y, q + 3, 0))];
    }
    case "year":
      return [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))];
    case "last-year":
      return [iso(new Date(y - 1, 0, 1)), iso(new Date(y - 1, 11, 31))];
    default:
      return ["0000-01-01", "9999-12-31"];
  }
}

export default function SalesByOwner({ lines, today }: { lines: SalesLine[]; today: string }) {
  const [period, setPeriod] = useState<Period>("year");

  const { owners, rows, ownerTotals, grand } = useMemo(() => {
    const [from, to] = range(period, new Date(today + "T00:00:00"));
    const inPeriod = lines.filter((l) => l.start >= from && l.start <= to && l.amount > 0);

    // Owners across the top, in the order of what they've sold; clients down
    // the side the same way — the biggest relationships first.
    const ownerTotals = new Map<string, number>();
    const byClient = new Map<string, Map<string, number>>();
    for (const l of inPeriod) {
      ownerTotals.set(l.owner, (ownerTotals.get(l.owner) ?? 0) + l.amount);
      const row = byClient.get(l.client) ?? new Map<string, number>();
      row.set(l.owner, (row.get(l.owner) ?? 0) + l.amount);
      byClient.set(l.client, row);
    }
    const owners = [...ownerTotals.entries()].sort((a, b) => b[1] - a[1]).map(([o]) => o);
    const rows = [...byClient.entries()]
      .map(([client, cells]) => ({
        client,
        cells,
        total: [...cells.values()].reduce((a, v) => a + v, 0),
      }))
      .sort((a, b) => b.total - a.total);
    const grand = rows.reduce((a, r) => a + r.total, 0);
    return { owners, rows, ownerTotals, grand };
  }, [lines, period, today]);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Sales by client and owner</h2>
        <span className="sub">Client charge ex VAT · by campaign start month</span>
        <select
          className="input"
          style={{ marginLeft: "auto", width: "auto" }}
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <p className="empty-note" style={{ padding: "18px 16px" }}>
            Nothing sold in this period.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  {owners.map((o) => (
                    <th key={o} className="r">
                      {o}
                    </th>
                  ))}
                  <th className="r">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.client}>
                    <td className="strong">{r.client}</td>
                    {owners.map((o) => {
                      const v = r.cells.get(o) ?? 0;
                      return (
                        <td key={o} className="r num" style={{ color: v ? undefined : "var(--faint)" }}>
                          {v ? gbp(v) : "—"}
                        </td>
                      );
                    })}
                    <td className="r num strong">{gbp(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="strong">Total</td>
                  {owners.map((o) => (
                    <td key={o} className="r num strong">
                      {gbp(ownerTotals.get(o) ?? 0)}
                    </td>
                  ))}
                  <td className="r num strong">{gbp(grand)}</td>
                </tr>
                <tr>
                  <td className="sub-line">Share</td>
                  {owners.map((o) => (
                    <td key={o} className="r num sub-line">
                      {grand ? Math.round(((ownerTotals.get(o) ?? 0) / grand) * 100) : 0}%
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
