"use client";

import { useState } from "react";
import Link from "next/link";
import FollowUp from "@/components/FollowUp";
import Segmented from "@/components/Segmented";
import OrganisationEditor, { blankOrganisation } from "@/components/OrganisationEditor";
import { channelLabel, gbp, MARGIN_FLOOR } from "@/lib/money";
import { CUSTOMER_STATUS_LABEL, type OrganisationRow } from "@/lib/organisations";

// Every company in one list. A company can be a customer and a supplier at the
// same time, so the relationship filter is a lens, not a category.
type Lens = "all" | "clients" | "prospects" | "suppliers";

const LENSES: { value: Lens; label: string }[] = [
  { value: "all", label: "All" },
  { value: "clients", label: "Clients" },
  { value: "prospects", label: "Prospects" },
  { value: "suppliers", label: "Suppliers" },
];

// Short badge text — the full labels ("No customer relationship") are far too
// long for a card pill.
const STATUS_BADGE: Record<string, string> = {
  active_client: "Live",
  prospect: "Prospect",
  former_client: "Former",
  not_pursuing: "Not pursuing",
  none: "Supplier",
};

const STATUS_CLASS: Record<string, string> = {
  active_client: "live",
  prospect: "planning",
  former_client: "done",
  not_pursuing: "risk",
  none: "done",
};

const STATUS_COLOUR: Record<string, string | undefined> = {
  active_client: "var(--ok)",
  prospect: "var(--blue)",
  former_client: "var(--faint)",
  not_pursuing: "var(--faint)",
  none: undefined,
};

export default function OrganisationTable({
  rows,
  staff,
  initialLens = "all",
}: {
  rows: OrganisationRow[];
  staff: { id: string; full_name: string }[];
  /** Set by /clients, which now redirects here filtered to clients. */
  initialLens?: Lens;
}) {
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [lens, setLens] = useState<Lens>(initialLens);
  const [owner, setOwner] = useState("All");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const owners = [...new Set(rows.map((r) => r.owner))].filter((o) => o !== "—").sort();

  const filtered = rows.filter((r) => {
    if (!showArchived && r.archived) return false;
    if (owner !== "All" && r.owner !== owner) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (lens === "clients") return r.customer_status === "active_client";
    if (lens === "prospects") return r.customer_status === "prospect";
    if (lens === "suppliers") return r.is_supplier;
    return true;
  });

  return (
    <>
      <div className="filters">
        <label className="field">
          <span>Search</span>
          <input
            className="input"
            type="search"
            placeholder="Company name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Owner</span>
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="All">All staff</option>
            {owners.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <Segmented value={lens} onChange={setLens} options={LENSES} />
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "cards" as const, label: "Cards" },
              { value: "table" as const, label: "Table" },
            ]}
          />
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            New organisation
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <section className="card">
          <div className="card-body">
            <p className="empty-note">
              {rows.length === 0
                ? "No organisations yet. Add one, or they appear automatically when you book a campaign or log an opportunity."
                : "No organisations match that view."}
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
                      <Link href={`/organisations/${r.id}`} style={{ color: "inherit" }}>
                        {r.name}
                      </Link>
                    </div>
                    <div className="sub-line">
                      {r.sector}
                      {r.is_supplier && " · Supplier"}
                      {r.archived && " · Archived"}
                    </div>
                  </div>
                  <span className={`st ${STATUS_CLASS[r.customer_status] ?? "done"}`}>
                    {STATUS_BADGE[r.customer_status] ?? r.customer_status}
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
                        {channelLabel(ch)}
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
                <div style={{ marginTop: 10 }}>
                  {/* No clientId: that column points at the old clients table, and
                      an organisation id would break the link. The task still gets
                      the right title. */}
                  <FollowUp defaultTitle={`Follow up: ${r.name}`} staff={staff} />
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
                    <th>Organisation</th>
                    <th>Customer status</th>
                    <th>Supplier</th>
                    <th>Sector</th>
                    <th>Owner</th>
                    <th className="r">Contacts</th>
                    <th className="r">Campaigns</th>
                    <th className="r">Billings</th>
                    <th className="r">Profit</th>
                    <th className="r">Margin</th>
                    <th className="r">Supplier spend</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="strong">
                        <Link href={`/organisations/${r.id}`} style={{ color: "var(--blue)" }}>
                          {r.name}
                        </Link>
                        {r.archived && <span className="pill" style={{ marginLeft: 8 }}>Archived</span>}
                      </td>
                      <td className="sub-line" style={{ color: STATUS_COLOUR[r.customer_status] }}>
                        {CUSTOMER_STATUS_LABEL[r.customer_status] ?? r.customer_status}
                      </td>
                      <td className="sub-line">{r.is_supplier ? "Yes" : "—"}</td>
                      <td className="sub-line">{r.sector}</td>
                      <td className="sub-line">{r.owner}</td>
                      <td className="r num">{r.contacts || "—"}</td>
                      <td className="r num">{r.campaigns || "—"}</td>
                      <td className="r num">{r.billings ? gbp(r.billings) : "—"}</td>
                      <td className="r num" style={{ color: r.billings ? "var(--ok)" : undefined }}>
                        {r.billings ? gbp(r.profit) : "—"}
                      </td>
                      <td
                        className="r num"
                        style={{
                          color:
                            r.billings > 0 && r.margin < MARGIN_FLOOR ? "var(--crit)" : undefined,
                        }}
                      >
                        {r.billings ? `${r.margin.toFixed(1)}%` : "—"}
                      </td>
                      <td className="r num">{r.supplier_spend ? gbp(r.supplier_spend) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <OrganisationEditor
        open={creating}
        initial={blankOrganisation()}
        staff={staff}
        onClose={() => setCreating(false)}
      />
    </>
  );
}
