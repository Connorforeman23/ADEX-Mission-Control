"use client";

import { useState } from "react";
import Segmented from "@/components/Segmented";
import { gbp, MARGIN_FLOOR } from "@/lib/money";

export type ClientRow = {
  id: string;
  name: string;
  sector: string;
  owner: string;
  status: string;
  retainer: string;
  campaigns: number;
  billings: number;
  profit: number;
  margin: number;
  channels: string[];
};

export default function ClientTable({ rows }: { rows: ClientRow[] }) {
  const [owner, setOwner] = useState("All");
  const [name, setName] = useState("All");
  const [view, setView] = useState<"cards" | "table">("cards");

  const owners = [...new Set(rows.map((r) => r.owner))].filter((o) => o !== "—").sort();
  const filtered = rows.filter(
    (r) => (owner === "All" || r.owner === owner) && (name === "All" || r.name === name)
  );

  return (
    <>
      <div className="filters">
        <label className="field">
          <span>Staff member</span>
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="All">All staff</option>
            {owners.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Client</span>
          <select className="input" value={name} onChange={(e) => setName(e.target.value)}>
            <option value="All">All clients</option>
            {rows.map((r) => (
              <option key={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <button
          className="btn"
          onClick={() => {
            setOwner("All");
            setName("All");
          }}
        >
          Clear
        </button>
        <div style={{ marginLeft: "auto" }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "cards", label: "Cards" },
              { value: "table", label: "Table" },
            ]}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <section className="card">
          <div className="card-body">
            <p className="empty-note">
              {rows.length === 0
                ? "No clients yet. They're created automatically when you book a campaign for a new client."
                : "No clients match those filters."}
            </p>
          </div>
        </section>
      ) : view === "cards" ? (
        <div className="client-grid">
          {filtered.map((r) => {
            const low = r.billings > 0 && r.margin < MARGIN_FLOOR;
            return (
              <article className="card" style={{ padding: "15px 16px" }} key={r.id}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="strong" style={{ fontSize: 14 }}>
                      {r.name}
                    </div>
                    <div className="sub-line">
                      {r.sector} · {r.retainer}
                    </div>
                  </div>
                  <span className={`st ${r.status === "live" ? "live" : r.status === "hold" ? "done" : "planning"}`}>
                    {r.status === "live" ? "Live" : r.status === "hold" ? "On hold" : "Planning"}
                  </span>
                </div>

                <div className="client-figures">
                  <div>
                    <div className="eyebrow">Billings</div>
                    <div className="num strong">{gbp(r.billings)}</div>
                  </div>
                  <div>
                    <div className="eyebrow">Profit</div>
                    <div className="num strong">{gbp(r.profit)}</div>
                  </div>
                  <div>
                    <div className="eyebrow">Margin</div>
                    <div className="num strong" style={{ color: low ? "var(--crit)" : "var(--ok)" }}>
                      {r.margin.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {r.channels.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
                    {r.channels.map((ch) => (
                      <span className="pill" key={ch}>
                        {ch}
                      </span>
                    ))}
                  </div>
                )}

                <div className="client-foot">
                  <small className="sub-line">{r.owner}</small>
                  <small className="sub-line">
                    {r.campaigns} campaign{r.campaigns === 1 ? "" : "s"}
                  </small>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Sector</th>
                    <th>Owner</th>
                    <th className="r">Campaigns</th>
                    <th className="r">Billings</th>
                    <th className="r">Profit</th>
                    <th className="r">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const low = r.billings > 0 && r.margin < MARGIN_FLOOR;
                    return (
                      <tr key={r.id}>
                        <td className="strong">{r.name}</td>
                        <td className="sub-line">{r.sector}</td>
                        <td className="sub-line">{r.owner}</td>
                        <td className="r num">{r.campaigns}</td>
                        <td className="r num">{gbp(r.billings)}</td>
                        <td className="r num" style={{ color: "var(--ok)" }}>
                          {gbp(r.profit)}
                        </td>
                        <td className="r num" style={{ color: low ? "var(--crit)" : undefined }}>
                          {r.margin.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <style jsx>{`
        .client-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(292px, 1fr));
          gap: 14px;
        }
        .client-figures {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin: 14px 0 0;
        }
        .client-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 13px;
          padding-top: 11px;
          border-top: 1px solid var(--line-soft);
        }
      `}</style>
    </>
  );
}
