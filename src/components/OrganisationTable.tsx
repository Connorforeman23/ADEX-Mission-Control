"use client";

import { useState } from "react";
import Segmented from "@/components/Segmented";
import { gbp } from "@/lib/money";
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

const STATUS_COLOUR: Record<string, string | undefined> = {
  active_client: "var(--ok)",
  prospect: "var(--blue)",
  former_client: "var(--faint)",
  not_pursuing: "var(--faint)",
  none: undefined,
};

export default function OrganisationTable({ rows }: { rows: OrganisationRow[] }) {
  const [lens, setLens] = useState<Lens>("all");
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
        </div>
      </div>

      <section className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <p className="empty-note" style={{ padding: 18 }}>
              No organisations match that view.
            </p>
          ) : (
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
                    <th className="r">Supplier spend</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="strong">
                        {r.name}
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
                      <td className="r num">{r.supplier_spend ? gbp(r.supplier_spend) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
