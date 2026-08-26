import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganisation } from "@/lib/queries";
import { CUSTOMER_STATUS_LABEL } from "@/lib/organisations";
import { dateGB, gbp, rangeGB, STATUS_LABEL } from "@/lib/money";

export const dynamic = "force-dynamic";

// The organisation hub: one company, everything about it — its people, the deals
// in flight, the work won, the money, and how the relationship has changed.
export default async function OrganisationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getOrganisation(id);
  if (!org) notFound();

  const billings = org.campaigns.reduce((a, c) => a + c.value, 0);
  const outstanding = org.invoices.reduce((a, i) => a + i.outstanding, 0);
  const openOpps = org.opportunities.filter(
    (o) => o.stage !== "Closed Won" && o.stage !== "Closed Lost"
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Link href="/organisations" style={{ color: "var(--blue)" }}>
              Organisations
            </Link>
          </div>
          <h1>{org.name}</h1>
          <p>
            {CUSTOMER_STATUS_LABEL[org.customer_status] ?? org.customer_status}
            {org.is_supplier && " · Supplier"}
            {org.sector && ` · ${org.sector}`}
            {` · Owner: ${org.owner}`}
            {org.archived && " · Archived"}
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">Billings — ex VAT</div>
          <div className="num kpi-value">{gbp(billings)}</div>
          <div className="kpi-foot">{org.campaigns.length} campaigns</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Outstanding</div>
          <div className="num kpi-value" style={{ color: outstanding ? "var(--crit)" : "var(--ok)" }}>
            {gbp(outstanding)}
          </div>
          <div className="kpi-foot">{org.invoices.length} invoices raised</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Open opportunities</div>
          <div className="num kpi-value">{openOpps.length}</div>
          <div className="kpi-foot">
            {openOpps.length ? gbp(openOpps.reduce((a, o) => a + o.value, 0)) + " in play" : "None in play"}
          </div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">{org.is_supplier ? "Supplier spend" : "Contacts"}</div>
          <div className="num kpi-value">
            {org.is_supplier ? gbp(org.supplier_spend) : org.contacts.length}
          </div>
          <div className="kpi-foot">
            {org.is_supplier ? "Net, across all bookings" : "People at this company"}
          </div>
        </div>
      </div>

      <div className="cols">
        <section className="card">
          <div className="card-head">
            <h2>Contacts</h2>
            <span className="sub">{org.contacts.length}</span>
          </div>
          <div className="card-body">
            {org.contacts.length === 0 ? (
              <p className="empty-note">No contacts recorded for this organisation yet.</p>
            ) : (
              <div className="rows">
                {org.contacts.map((c) => (
                  <div className="row" key={c.id}>
                    <div className="grow">
                      <p>{c.name}</p>
                      <small>
                        {[c.job_title, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                      </small>
                    </div>
                    <span className="pill">{c.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Opportunities</h2>
            <span className="sub">{org.opportunities.length}</span>
          </div>
          <div className="card-body">
            {org.opportunities.length === 0 ? (
              <p className="empty-note">No opportunities logged against this organisation.</p>
            ) : (
              <div className="rows">
                {org.opportunities.map((o) => (
                  <div className="row" key={o.id}>
                    <div className="grow">
                      <p>{o.name}</p>
                      <small>{o.next_action ?? "No next action"} · {o.owner}</small>
                    </div>
                    <span className="pill">{o.stage}</span>
                    <span className="num strong">{gbp(o.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Campaigns</h2>
          <span className="sub">{org.campaigns.length}</span>
        </div>
        <div className="card-body" style={{ padding: org.campaigns.length ? 0 : undefined }}>
          {org.campaigns.length === 0 ? (
            <p className="empty-note">No campaigns booked for this organisation.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Campaign</th>
                    <th>Status</th>
                    <th>Dates</th>
                    <th className="r">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {org.campaigns.map((c) => (
                    <tr key={c.id}>
                      <td className="strong">
                        <Link href={`/campaigns?open=${c.id}`} style={{ color: "var(--blue)" }}>
                          {c.ref}
                        </Link>
                      </td>
                      <td>{c.name}</td>
                      <td className="sub-line">{STATUS_LABEL[c.status] ?? c.status}</td>
                      <td className="sub-line">{rangeGB(c.start_date, c.end_date)}</td>
                      <td className="r num">{gbp(c.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <div className="cols">
        <section className="card">
          <div className="card-head">
            <h2>Invoices</h2>
            <span className="sub">{org.invoices.length}</span>
          </div>
          <div className="card-body">
            {org.invoices.length === 0 ? (
              <p className="empty-note">No client invoices raised.</p>
            ) : (
              <div className="rows">
                {org.invoices.map((i) => (
                  <div className="row" key={i.id}>
                    <div className="grow">
                      <p>{i.invoice_no ?? "—"}</p>
                      <small>{dateGB(i.invoice_date)}</small>
                    </div>
                    <span className="pill">{i.status}</span>
                    <span className="num strong">{gbp(i.amount_ex_vat)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Relationship history</h2>
            <span className="sub">Customer status changes</span>
          </div>
          <div className="card-body">
            {org.history.length === 0 ? (
              <p className="empty-note">No status changes recorded.</p>
            ) : (
              <div className="rows">
                {org.history.map((h) => (
                  <div className="row" key={h.id}>
                    <div className="grow">
                      <p>
                        {h.old_status
                          ? `${CUSTOMER_STATUS_LABEL[h.old_status] ?? h.old_status} → ${
                              CUSTOMER_STATUS_LABEL[h.new_status] ?? h.new_status
                            }`
                          : `Created as ${CUSTOMER_STATUS_LABEL[h.new_status] ?? h.new_status}`}
                      </p>
                      <small>
                        {dateGB(h.changed_at.slice(0, 10))} · {h.changed_by}
                        {h.reason ? ` · ${h.reason}` : ""}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
