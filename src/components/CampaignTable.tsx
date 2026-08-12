"use client";

import { useMemo, useState } from "react";
import {
  CHANNELS,
  CHANNEL_COLOUR,
  channelLabel,
  clientGross,
  commissionOf,
  dateGB,
  dealMargin,
  dealProfit,
  gbp,
  gbpK,
  markupOf,
  MARGIN_FLOOR,
  rangeGB,
  STATUS_LABEL,
  supplierGross,
  supplierNet,
  vatOn,
  type Campaign,
} from "@/lib/money";
import { CAMPAIGN_STATUSES } from "@/lib/reference";
import { useRouter } from "next/navigation";
import Drawer from "@/components/Drawer";
import FollowUp from "@/components/FollowUp";
import Segmented from "@/components/Segmented";
import BookingForm, { type EditingCampaign } from "@/components/BookingForm";
import { updateCampaignStatus } from "@/lib/actions";

const BOARD_COLUMNS: { key: string; label: string; stripe: string }[] = [
  { key: "planning", label: "Planning", stripe: "var(--warn)" },
  { key: "booked", label: "Booked", stripe: "var(--blue)" },
  { key: "live", label: "Live", stripe: "var(--ok)" },
  { key: "done", label: "Complete", stripe: "var(--idle)" },
];

export default function CampaignTable({
  campaigns,
  clients,
  staffList,
  openNew,
  openId,
  canBook = true,
}: {
  campaigns: Campaign[];
  clients: { id: string; name: string }[];
  staffList: { id: string; full_name: string }[];
  openNew?: boolean;
  /** Campaign id to open in the detail panel on arrival (dashboard click-through). */
  openId?: string;
  /** Restricted users can't book — hides the New campaign entry points. */
  canBook?: boolean;
}) {
  const [staff, setStaff] = useState("All");
  const [client, setClient] = useState("All");
  const [status, setStatus] = useState("All");
  const [channel, setChannel] = useState("All");
  const [view, setView] = useState<"list" | "board">("list");
  const [editor, setEditor] = useState<{ open: boolean; editing?: EditingCampaign }>({ open: !!openNew && canBook });
  const [detail, setDetail] = useState<Campaign | null>(
    openId ? campaigns.find((c) => c.id === openId) ?? null : null
  );
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<string | null>(null);

  async function moveTo(campaignId: string, status: string) {
    setDragId(null);
    setDropCol(null);
    await updateCampaignStatus(campaignId, status);
    router.refresh();
  }

  const staffIdByName = useMemo(
    () => new Map(staffList.map((s) => [s.full_name, s.id])),
    [staffList]
  );

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

  function toEditing(c: Campaign): EditingCampaign {
    return {
      id: c.id,
      name: c.name,
      clientName: c.clients?.name ?? "",
      ownerId: staffIdByName.get(c.profiles?.full_name ?? "") ?? "",
      status: c.status,
      region: c.region,
      fee: String(c.fee ?? 0),
      note: "",
      clientPo: c.client_po ?? "",
      lines: c.campaign_lines.map((l) => ({
        id: l.id,
        line_type: l.line_type ?? "media",
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
    };
  }

  const openEdit = (c: Campaign) => setEditor({ open: true, editing: toEditing(c) });

  const channelChips = (c: Campaign) => {
    const set = [...new Set(c.campaign_lines.map((l) => l.channel))];
    return (
      <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
        {set.map((ch) => (
          <span className="chan" key={ch}>
            <i style={{ background: CHANNEL_COLOUR[ch] }} />
            {channelLabel(ch)}
          </span>
        ))}
      </span>
    );
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
        <button
          className="btn"
          onClick={() => {
            setStaff("All");
            setClient("All");
            setStatus("All");
            setChannel("All");
          }}
        >
          Clear
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "List" },
              { value: "board", label: "Board" },
            ]}
          />
          {canBook && (
            <button className="btn btn-primary" onClick={() => setEditor({ open: true })}>
              New campaign
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <section className="card">
          <div className="card-body">
            <p className="empty-note">
              {campaigns.length === 0
                ? "No campaigns booked yet. Use “New campaign” to book the first one."
                : "No campaigns match those filters."}
            </p>
          </div>
        </section>
      ) : view === "list" ? (
        <section className="card">
          <div className="card-body" style={{ padding: 0 }}>
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
                    return (
                      <tr key={c.id} onClick={() => setDetail(c)} style={{ cursor: "pointer" }}>
                        <td className="num ref">{c.ref}</td>
                        <td>
                          <div className="strong">{c.name}</div>
                          <div className="sub-line">{c.clients?.name ?? "—"}</div>
                        </td>
                        <td>{channelChips(c)}</td>
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
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(c);
                            }}
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
          </div>
        </section>
      ) : (
        <div className="board">
          {BOARD_COLUMNS.map((col, colIdx) => {
            const set = rows.filter((c) =>
              col.key === "live" ? c.status === "live" || c.status === "risk" : c.status === col.key
            );
            const value = set.reduce((a, c) => a + clientGross(c), 0);
            return (
              <div
                className="col"
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropCol(col.key);
                }}
                onDragLeave={() => setDropCol((d) => (d === col.key ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) moveTo(dragId, col.key);
                }}
                style={
                  dropCol === col.key && dragId
                    ? { outline: "2px dashed var(--blue)", outlineOffset: -2 }
                    : undefined
                }
              >
                <div className="col-head">
                  <span className="stripe" style={{ background: col.stripe }} />
                  <h3>{col.label}</h3>
                  <span className="count">
                    {set.length} · {gbpK(value)}
                  </span>
                </div>
                {set.length === 0 ? (
                  <p className="empty-note" style={{ padding: "12px 4px" }}>
                    {dragId ? "Drop here" : "Nothing here"}
                  </p>
                ) : (
                  set.map((c) => (
                    <div
                      className="tile"
                      key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropCol(null);
                      }}
                      onClick={() => setDetail(c)}
                      style={{ cursor: "grab", opacity: dragId === c.id ? 0.5 : 1 }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <div className="strong" style={{ flex: 1, minWidth: 0 }}>
                          {c.name}
                        </div>
                        <button
                          className="row-edit"
                          aria-label={`Edit ${c.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(c);
                          }}
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                        </button>
                      </div>
                      <div className="sub-line">{c.clients?.name ?? "—"}</div>
                      <div style={{ marginTop: 8 }}>{channelChips(c)}</div>
                      <div className="tile-foot">
                        <span className="num strong">{gbp(clientGross(c))}</span>
                        <span className="num" style={{ color: "var(--ok)", fontSize: 11.5 }}>
                          +{gbpK(dealProfit(c))}
                        </span>
                        <span className="ref num" style={{ marginLeft: "auto" }}>
                          {c.status === "risk" ? (
                            <span className="st risk">At risk</span>
                          ) : (
                            c.ref
                          )}
                        </span>
                      </div>
                      <div className="tile-move">
                        {colIdx > 0 && (
                          <button
                            className="btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTo(c.id, BOARD_COLUMNS[colIdx - 1].key);
                            }}
                          >
                            ← {BOARD_COLUMNS[colIdx - 1].label}
                          </button>
                        )}
                        {colIdx < BOARD_COLUMNS.length - 1 && (
                          <button
                            className="btn"
                            style={{ marginLeft: "auto" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTo(c.id, BOARD_COLUMNS[colIdx + 1].key);
                            }}
                          >
                            {BOARD_COLUMNS[colIdx + 1].label} →
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <p className="sub-line" style={{ margin: "10px 2px" }}>
          Showing {rows.length} of {campaigns.length} campaigns · profit = client gross − supplier net
          (gross less 15%).
        </p>
      )}

      {/* Campaign detail */}
      <Drawer
        open={!!detail}
        eyebrow={detail ? `${detail.ref} · ${detail.clients?.name ?? "—"}` : ""}
        title={detail?.name ?? ""}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <CampaignDetail
            c={detail}
            staff={staffList}
            onEdit={() => {
              const d = detail;
              setDetail(null);
              openEdit(d);
            }}
          />
        )}
      </Drawer>

      {/* Book / edit */}
      <Drawer
        open={editor.open}
        eyebrow={editor.editing ? "Edit campaign" : "New campaign"}
        title={editor.editing ? editor.editing.name : "Book a campaign"}
        onClose={() => setEditor({ open: false })}
      >
        <BookingForm
          clients={clients}
          staff={staffList}
          editing={editor.editing}
          onDone={() => setEditor({ open: false })}
        />
      </Drawer>
    </>
  );
}

function CampaignDetail({
  c,
  staff,
  onEdit,
}: {
  c: Campaign;
  staff: { id: string; full_name: string }[];
  onEdit: () => void;
}) {
  const gross = clientGross(c);
  const net = supplierNet(c);
  const margin = dealMargin(c);
  const billedPct = gross ? Math.round((Number(c.billed) / gross) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className={`st ${c.status}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
        {[...new Set(c.campaign_lines.map((l) => l.channel))].map((ch) => (
          <span className="chan" key={ch}>
            <i style={{ background: CHANNEL_COLOUR[ch] }} />
            {channelLabel(ch)}
          </span>
        ))}
      </div>

      <div className="totals-box">
        <div className="totals-grid">
          <div>
            <div className="eyebrow">Invoice — client gross</div>
            <div className="num total-value">{gbp(gross)}</div>
          </div>
          <div>
            <div className="eyebrow">POs — supplier net</div>
            <div className="num total-value" style={{ color: "var(--mid)" }}>
              {gbp(net)}
            </div>
          </div>
          <div>
            <div className="eyebrow">Profit</div>
            <div
              className="num total-value"
              style={{ color: margin < MARGIN_FLOOR ? "var(--crit)" : "var(--ok)" }}
            >
              {gbp(dealProfit(c))} <small style={{ fontSize: 11, color: "var(--faint)" }}>{margin.toFixed(1)}%</small>
            </div>
          </div>
        </div>
        <div className="totals-split">
          <small className="sub-line">Profit split:</small>
          <small className="num">Commission <b>{gbp(commissionOf(c))}</b></small>
          <small className="num">Markup <b style={{ color: markupOf(c) > 0 ? "var(--pink)" : undefined }}>{gbp(markupOf(c))}</b></small>
          {Number(c.fee) > 0 && <small className="num">Fee <b>{gbp(Number(c.fee))}</b></small>}
        </div>
        <div className="totals-split">
          <small className="sub-line">Client invoice:</small>
          <small className="num">Gross ex VAT <b>{gbp(gross)}</b></small>
          <small className="num">+ VAT 20% <b>{gbp(vatOn(gross))}</b></small>
          <small className="num">Total <b style={{ color: "var(--blue)" }}>{gbp(gross + vatOn(gross))}</b></small>
        </div>
      </div>

      {margin < MARGIN_FLOOR && gross > 0 && (
        <div className="warn-box">
          Margin {margin.toFixed(1)}% is below the {MARGIN_FLOOR}% floor — review the charges.
        </div>
      )}

      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Billed to client
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, billedPct)}%`,
                height: "100%",
                background: "linear-gradient(90deg, var(--blue), var(--pink))",
              }}
            />
          </div>
          <span className="num strong">{billedPct}%</span>
        </div>
      </div>

      <dl className="dl">
        <dt>Flight</dt>
        <dd className="num">{rangeGB(c.start_date, c.end_date)}</dd>
        <dt>Region</dt>
        <dd>{c.region}</dd>
        <dt>Sales owner</dt>
        <dd>{c.profiles?.full_name ?? "—"}</dd>
        <dt>Client PO</dt>
        <dd className="num">{c.client_po ?? "—"}</dd>
        <dt>Leads to date</dt>
        <dd className="num">{Number(c.leads) || "—"}</dd>
        <dt>Cost per lead</dt>
        <dd className="num">{Number(c.cpl) ? gbp(Number(c.cpl)) : "—"}</dd>
      </dl>

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Booking lines · charge vs cost
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Supplier</th>
                <th>Dates</th>
                <th className="r">Charge</th>
                <th className="r">Gross</th>
                <th className="r">Net</th>
              </tr>
            </thead>
            <tbody>
              {c.campaign_lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className="chan">
                      <i style={{ background: CHANNEL_COLOUR[l.channel] }} />
                      {channelLabel(l.channel)}
                    </span>
                    {l.line_type === "production" && (
                      <div className="sub-line">Production — no commission</div>
                    )}
                    {l.ooh_format && (
                      <div className="sub-line">
                        {l.ooh_format} · {l.ooh_disp_type}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="strong">{l.vendor}</div>
                    <div className="sub-line">
                      {l.detail}
                      {l.cpt ? ` · CPT £${Number(l.cpt).toFixed(2)}` : ""}
                    </div>
                    <div className="sub-line">
                      {l.copy_instruction ?? "New Copy"}
                      {l.urn ? ` · ${l.urn}` : ""}
                      {l.supplier_po ? ` · PO ${l.supplier_po}` : ""}
                    </div>
                  </td>
                  <td className="num" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                    {rangeGB(l.start_date, l.end_date)}
                    {l.selected_dates && <div className="sub-line">{l.selected_dates}</div>}
                  </td>
                  <td className="r num strong">{gbp(Number(l.client_charge))}</td>
                  <td className="r num" style={{ color: "var(--faint)" }}>
                    {gbp(Number(l.supplier_gross))}
                  </td>
                  <td className="r num" style={{ color: "var(--mid)" }}>
                    {gbp(Number(l.supplier_net))}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="strong">
                  Totals
                </td>
                <td className="r num strong">{gbp(gross)}</td>
                <td className="r num" style={{ color: "var(--faint)" }}>
                  {gbp(supplierGross(c))}
                </td>
                <td className="r num strong">{gbp(net)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={onEdit}>
          Edit campaign
        </button>
        <FollowUp
          campaignId={c.id}
          defaultTitle={`Follow up: ${c.name} (${c.ref})`}
          staff={staff}
        />
      </div>

      <style jsx>{`
        .totals-box {
          padding: 12px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--surface-2);
        }
        .totals-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }
        .total-value {
          font-size: 17px;
          font-weight: 700;
          margin-top: 4px;
        }
        .totals-split {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--line-soft);
          color: var(--mid);
        }
        .warn-box {
          padding: 10px 12px;
          border: 1px solid var(--crit);
          border-radius: 11px;
          background: var(--crit-bg);
          color: var(--crit);
          font-size: 12.5px;
        }
      `}</style>
    </div>
  );
}
