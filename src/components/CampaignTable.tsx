"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CHANNELS,
  channelLabel,
  clientGross,
  dealMargin,
  dealProfit,
  gbp,
  MARGIN_FLOOR,
  STATUS_LABEL,
  supplierNet,
  type Campaign,
} from "@/lib/money";
import { CAMPAIGN_STATUSES } from "@/lib/reference";

export default function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  const [staff, setStaff] = useState("All");
  const [client, setClient] = useState("All");
  const [status, setStatus] = useState("All");
  const [channel, setChannel] = useState("All");

  const staffOptions = useMemo(
    () => [...new Set(campaigns.map((c) => c.profiles?.full_name).filter(Boolean))].sort() as string[],
    [campaigns]
  );
  const clientOptions = useMemo(
    () => [...new Set(campaigns.map((c) => c.clients?.name).filter(Boolean))].sort() as string[],
    [campaigns]
  );

  const rows = campaigns.filter(
    (c) =>
      (staff === "All" || c.profiles?.full_name === staff) &&
      (client === "All" || c.clients?.name === client) &&
      (status === "All" || c.status === status) &&
      (channel === "All" || c.campaign_lines.some((l) => l.channel === channel))
  );

  const clearAll = () => {
    setStaff("All");
    setClient("All");
    setStatus("All");
    setChannel("All");
  };

  return (
    <>
      <div className="filters">
        <label className="field">
          <span>Staff member</span>
          <select className="input" value={staff} onChange={(e) => setStaff(e.target.value)}>
            <option value="All">All staff</option>
            {staffOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Client</span>
          <select className="input" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="All">All clients</option>
            {clientOptions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="All">All statuses</option>
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Channel</span>
          <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="All">All channels</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {channelLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={clearAll}>
          Clear
        </button>
      </div>

      <section className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 ? (
            <p className="empty-note" style={{ padding: "20px 16px" }}>
              {campaigns.length === 0
                ? "No campaigns booked yet. Use “New campaign” to book the first one."
                : "No campaigns match those filters."}
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Campaign</th>
                    <th>Channels</th>
                    <th>Flight</th>
                    <th className="r">Client gross</th>
                    <th className="r">Supplier net</th>
                    <th className="r">Profit</th>
                    <th>Owner</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const margin = dealMargin(c);
                    const low = clientGross(c) > 0 && margin < MARGIN_FLOOR;
                    const channels = [...new Set(c.campaign_lines.map((l) => l.channel))];
                    return (
                      <tr key={c.id}>
                        <td className="num ref">
                          <Link href={`/campaigns/${c.id}`}>{c.ref}</Link>
                        </td>
                        <td>
                          <Link href={`/campaigns/${c.id}`}>
                            <div className="strong">{c.name}</div>
                            <div className="sub-line">{c.clients?.name ?? "—"}</div>
                          </Link>
                        </td>
                        <td className="sub-line">{channels.map(channelLabel).join(", ")}</td>
                        <td className="num" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                          {c.start_date ?? "—"}
                          <br />
                          <span style={{ color: "var(--faint)" }}>{c.end_date ?? ""}</span>
                        </td>
                        <td className="r num">{gbp(clientGross(c))}</td>
                        <td className="r num" style={{ color: "var(--mid)" }}>
                          {gbp(supplierNet(c))}
                        </td>
                        <td className="r num" style={{ color: low ? "var(--crit)" : "var(--ok)" }}>
                          {gbp(dealProfit(c))}
                          <br />
                          <span style={{ fontSize: 10.5, color: low ? "var(--crit)" : "var(--faint)" }}>
                            {margin.toFixed(1)}%{low ? " ⚠" : ""}
                          </span>
                        </td>
                        <td className="sub-line">{c.profiles?.full_name ?? "—"}</td>
                        <td>
                          <span className={`st ${c.status}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {rows.length > 0 && (
        <p className="sub-line" style={{ margin: "10px 2px" }}>
          Showing {rows.length} of {campaigns.length} campaigns · profit = client gross − supplier net
          (gross less 15%).
        </p>
      )}
    </>
  );
}
