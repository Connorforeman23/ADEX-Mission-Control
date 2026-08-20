import { getOrganisations } from "@/lib/queries";
import { gbpK } from "@/lib/money";
import OrganisationTable from "@/components/OrganisationTable";

export const dynamic = "force-dynamic";

// Phase 3: the company-level view. One row per real company, showing both sides
// of the relationship — an organisation can be a client and a supplier at once.
export default async function OrganisationsPage() {
  const rows = await getOrganisations();
  const live = rows.filter((r) => !r.archived);

  const clients = live.filter((r) => r.customer_status === "active_client").length;
  const prospects = live.filter((r) => r.customer_status === "prospect").length;
  const suppliers = live.filter((r) => r.is_supplier).length;
  const both = live.filter((r) => r.is_supplier && r.customer_status === "active_client").length;
  const billings = live.reduce((a, r) => a + r.billings, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Companies</div>
          <h1>Organisations</h1>
          <p>
            Every company AdEx deals with, in one place. A company can be a client and a supplier at
            the same time — the customer relationship is a lifecycle, the supplier relationship a
            simple yes or no.
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">Organisations</div>
          <div className="num kpi-value">{live.length}</div>
          <div className="kpi-foot">
            {rows.length - live.length ? `${rows.length - live.length} archived` : "None archived"}
          </div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Active clients</div>
          <div className="num kpi-value" style={{ color: "var(--ok)" }}>
            {clients}
          </div>
          <div className="kpi-foot">{prospects} prospects in play</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Suppliers</div>
          <div className="num kpi-value">{suppliers}</div>
          <div className="kpi-foot">{both ? `${both} also a client` : "None also a client"}</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Billings — ex VAT</div>
          <div className="num kpi-value">{gbpK(billings)}</div>
          <div className="kpi-foot">Across every client organisation</div>
        </div>
      </div>

      <OrganisationTable rows={rows} />
    </div>
  );
}
