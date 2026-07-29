"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CHANNELS,
  channelLabel,
  clientGross,
  dateGB,
  dealMargin,
  dealProfit,
  gbp,
  MARGIN_FLOOR,
  STATUS_LABEL,
  supplierNet,
  type Campaign,
} from "@/lib/money";
import { CAMPAIGN_STATUSES } from "@/lib/reference";
import Drawer from "@/components/Drawer";
import BookingForm, { type EditingCampaign } from "@/components/BookingForm";

export default function CampaignTable({
  campaigns,
  clients,
  staffList,
}: {
  campaigns: Campaign[];
  clients: { id: string; name: string }[];
  staffList: { id: string; full_name: string }[];
}) {
  const [staff, setStaff] = useState("All");
  const [client, setClient] = useState("All");
  const [status, setStatus] = useState("All");
  const [channel, setChannel] = useState("All");
  const [drawer, setDrawer] = useState<{ open: boolean; editing?: EditingCampaign }>({ open: false });

  const staffIdByName = useMemo(
    () => new Map(staffList.map((s) => [s.full_name, s.id])),
    [staffList]
  );

  function openEdit(c: Campaign) {
    setDrawer({
      open: true,
      editing: {
        id: c.id,
        name: c.name,
        clientName: c.clients?.name ?? "",
        ownerId: staffIdByName.get(c.profiles?.full_name ?? "") ?? "",
        status: c.status,
        region: c.region,
        fee: String(c.fee ?? 0),
        note: "",
        lines: c.campaign_lines.map((l) => ({
          id: l.id,
          channel: l.channel,
          vendor: l.vendor,
          detail: l.detail ?? "",
          start_date: l.start_date,
          end_date: l.end_date,
          selected_dates: l.selected_dates ?? "",
          cpt: l.cpt != null ? String(l.cpt) : "",
          ooh_format: l.ooh_format ?? "6 Sheet",
          ooh_disp_type: l.ooh_disp_type ?? "Static",
          copy_instruction: l.copy_instruction ?? "New Copy",
          urn: l.urn ?? "",
          supplier_gross: String(l.supplier_gross ?? ""),
          client_charge: String(l.client_charge ?? ""),
        })),
      },
    });
  }

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
        <button
          className="btn btn-primary"
          style={{ marginLeft: "auto" }}
          onClick={() => setDrawer({ open: true })}
        >
          New campaign
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
                    <th />
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
                          {dateGB(c.start_date)}
                          <br />
                          <span style={{ color: "var(--faint)" }}>{dateGB(c.end_date)}</span>
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
                        <td>
                          <button
                            className="row-edit"
                            title={`Edit ${c.name}`}
                            aria-label={`Edit ${c.name}`}
                            onClick={() => openEdit(c)}
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                          </button>
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

      <Drawer
        open={drawer.open}
        eyebrow={drawer.editing ? "Edit campaign" : "New campaign"}
        title={drawer.editing ? drawer.editing.name : "Book a campaign"}
        onClose={() => setDrawer({ open: false })}
      >
        <BookingForm
          clients={clients}
          staff={staffList}
          editing={drawer.editing}
          onDone={() => setDrawer({ open: false })}
        />
      </Drawer>
    </>
  );
}
