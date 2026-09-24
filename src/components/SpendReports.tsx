"use client";

import { useMemo, useState } from "react";
import Segmented from "@/components/Segmented";
import BarList, { type BarRow } from "@/components/BarList";
import { CHANNEL_COLOUR, channelLabel, gbp, gbpK } from "@/lib/money";

// The spend reports — by client, by assigned user, by channel, and the
// client-by-user matrix — all driven by ONE set of controls, so the four
// views always describe the same set of campaigns:
//
//   Period   Month / Quarter / Year, stepped back and forward
//   Include  All · Invoiced · Booked, not yet invoiced (future)
//
// "Spend" is the client charge ex VAT, attributed to the month the campaign
// starts — the same basis as the Dashboard and Finance, so the numbers agree.

export type SpendCampaign = {
  id: string;
  client: string;
  owner: string;
  /** Campaign start, YYYY-MM-DD. */
  start: string;
  status: string;
  /** A client invoice exists for this campaign. */
  invoiced: boolean;
  lines: { channel: string; amount: number }[];
};

type Unit = "month" | "quarter" | "year";
type Include = "all" | "invoiced" | "future";

const PALETTE = [
  "var(--blue)",
  "var(--pink)",
  "var(--ok)",
  "var(--warn)",
  "#7c3aed",
  "#0891b2",
  "#b45309",
  "#4b5563",
];

/** Start and end (inclusive) of the period `offset` units from the current one. */
function periodRange(unit: Unit, offset: number, today: Date): { from: string; to: string; label: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const y = today.getFullYear();
  const m = today.getMonth();
  if (unit === "month") {
    const from = new Date(y, m + offset, 1);
    const to = new Date(y, m + offset + 1, 0);
    return { from: iso(from), to: iso(to), label: from.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) };
  }
  if (unit === "quarter") {
    const q = Math.floor(m / 3) + offset;
    const from = new Date(y, q * 3, 1);
    const to = new Date(y, q * 3 + 3, 0);
    const qn = ((from.getMonth() / 3) | 0) + 1;
    return { from: iso(from), to: iso(to), label: `Q${qn} ${from.getFullYear()}` };
  }
  const from = new Date(y + offset, 0, 1);
  const to = new Date(y + offset, 11, 31);
  return { from: iso(from), to: iso(to), label: String(y + offset) };
}

export default function SpendReports({ campaigns, today }: { campaigns: SpendCampaign[]; today: string }) {
  const [unit, setUnit] = useState<Unit>("year");
  const [offset, setOffset] = useState(0);
  const [include, setInclude] = useState<Include>("all");

  const view = useMemo(() => {
    const { from, to, label } = periodRange(unit, offset, new Date(today + "T00:00:00"));

    const selected = campaigns.filter((c) => {
      if (!c.start || c.start < from || c.start > to) return false;
      if (c.status === "planning") return false;
      if (include === "invoiced") return c.invoiced;
      // Booked and still ahead of us, with no invoice raised yet — the order book.
      if (include === "future") return !c.invoiced && c.start > today;
      return true;
    });

    const sum = (key: (c: SpendCampaign) => string) => {
      const map = new Map<string, number>();
      for (const c of selected) {
        const total = c.lines.reduce((a, l) => a + l.amount, 0);
        map.set(key(c), (map.get(key(c)) ?? 0) + total);
      }
      return [...map.entries()].sort((a, b) => b[1] - a[1]);
    };

    const toBars = (entries: [string, number][]): BarRow[] =>
      entries
        .filter(([, v]) => v > 0)
        .map(([label, value], i) => ({ label, value, colour: PALETTE[i % PALETTE.length] }));

    const byClient = toBars(sum((c) => c.client));
    const byOwner = toBars(sum((c) => c.owner));

    const channelMap = new Map<string, number>();
    for (const c of selected) {
      for (const l of c.lines) channelMap.set(l.channel, (channelMap.get(l.channel) ?? 0) + l.amount);
    }
    const byChannel: BarRow[] = [...channelMap.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([ch, value]) => ({ label: channelLabel(ch), value, colour: CHANNEL_COLOUR[ch] ?? "var(--mid)" }));

    // Client × owner matrix.
    const ownerTotals = new Map<string, number>();
    const rowsMap = new Map<string, Map<string, number>>();
    for (const c of selected) {
      const total = c.lines.reduce((a, l) => a + l.amount, 0);
      ownerTotals.set(c.owner, (ownerTotals.get(c.owner) ?? 0) + total);
      const row = rowsMap.get(c.client) ?? new Map<string, number>();
      row.set(c.owner, (row.get(c.owner) ?? 0) + total);
      rowsMap.set(c.client, row);
    }
    const owners = [...ownerTotals.entries()].sort((a, b) => b[1] - a[1]).map(([o]) => o);
    const matrix = [...rowsMap.entries()]
      .map(([client, cells]) => ({ client, cells, total: [...cells.values()].reduce((a, v) => a + v, 0) }))
      .sort((a, b) => b.total - a.total);
    const grand = matrix.reduce((a, r) => a + r.total, 0);

    return { label, count: selected.length, byClient, byOwner, byChannel, owners, ownerTotals, matrix, grand };
  }, [campaigns, unit, offset, include, today]);

  const includeLabel =
    include === "invoiced" ? "invoiced campaigns" : include === "future" ? "booked, not yet invoiced" : "all campaigns";

  return (
    <>
      {/* One set of controls for every spend view below. */}
      <div className="filters" style={{ alignItems: "center" }}>
        <Segmented<Unit>
          label="Period"
          value={unit}
          onChange={(u) => {
            setUnit(u);
            setOffset(0);
          }}
          options={[
            { value: "month", label: "Month" },
            { value: "quarter", label: "Quarter" },
            { value: "year", label: "Year" },
          ]}
        />
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <button className="btn" onClick={() => setOffset((o) => o - 1)} aria-label="Previous period">
            ‹
          </button>
          <span className="strong" style={{ minWidth: 130, textAlign: "center" }}>
            {view.label}
          </span>
          <button className="btn" onClick={() => setOffset((o) => o + 1)} aria-label="Next period">
            ›
          </button>
          {offset !== 0 && (
            <button className="btn" onClick={() => setOffset(0)}>
              Today
            </button>
          )}
        </div>
        <Segmented<Include>
          label="Include"
          value={include}
          onChange={setInclude}
          options={[
            { value: "all", label: "All" },
            { value: "invoiced", label: "Invoiced" },
            { value: "future", label: "Booked, not invoiced" },
          ]}
        />
        <span className="sub-line" style={{ marginLeft: "auto" }}>
          {view.count} campaign{view.count === 1 ? "" : "s"} · {gbp(view.grand)} ex VAT · {includeLabel}
        </span>
      </div>

      <div className="cols">
        <section className="card">
          <div className="card-head">
            <h2>Spend by client</h2>
            <span className="sub">{view.label}</span>
          </div>
          <div className="card-body">
            <BarList rows={view.byClient} empty="Nothing in this period." />
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Spend by assigned user</h2>
            <span className="sub">{view.label}</span>
          </div>
          <div className="card-body">
            <BarList rows={view.byOwner} empty="Nothing in this period." />
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Spend by channel</h2>
            <span className="sub">{view.label}</span>
          </div>
          <div className="card-body">
            <BarList rows={view.byChannel} empty="Nothing in this period." />
          </div>
        </section>
      </div>

      {/* One column per team member, so this one needs the full width. */}
      <div style={{ marginBottom: 14 }}>
        <section className="card">
          <div className="card-head">
            <h2>Client by assigned user</h2>
            <span className="sub">{gbpK(view.grand)} · {view.label}</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {view.matrix.length === 0 ? (
              <p className="empty-note" style={{ padding: "18px 16px" }}>
                Nothing in this period.
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Client</th>
                      {view.owners.map((o) => (
                        <th key={o} className="r">
                          {o}
                        </th>
                      ))}
                      <th className="r">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.matrix.map((r) => (
                      <tr key={r.client}>
                        <td className="strong">{r.client}</td>
                        {view.owners.map((o) => {
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
                      {view.owners.map((o) => (
                        <td key={o} className="r num strong">
                          {gbp(view.ownerTotals.get(o) ?? 0)}
                        </td>
                      ))}
                      <td className="r num strong">{gbp(view.grand)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
