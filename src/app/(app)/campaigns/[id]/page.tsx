import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  channelLabel,
  CHANNEL_COLOUR,
  clientGross,
  commissionOf,
  dealMargin,
  dealProfit,
  gbp,
  markupOf,
  MARGIN_FLOOR,
  STATUS_LABEL,
  supplierGross,
  supplierNet,
  vatOn,
  type Campaign,
} from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("campaigns")
    .select(
      `id, ref, name, status, region, start_date, end_date, fee, billed, leads, cpl, note,
       clients ( name ),
       profiles ( full_name ),
       campaign_lines ( id, channel, vendor, detail, start_date, end_date, selected_dates,
                        cpt, ooh_format, ooh_disp_type, copy_instruction, urn,
                        supplier_gross, supplier_net, client_charge )`
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const c = data as unknown as Campaign & { note: string | null };

  const gross = clientGross(c);
  const net = supplierNet(c);
  const profit = dealProfit(c);
  const margin = dealMargin(c);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Link href="/campaigns">Campaigns</Link> · {c.ref}
          </div>
          <h1>{c.name}</h1>
          <p>
            {c.clients?.name ?? "—"} · {c.region} · owned by {c.profiles?.full_name ?? "unassigned"}
          </p>
        </div>
        <span className={`st ${c.status}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
      </div>

      {margin < MARGIN_FLOOR && gross > 0 && (
        <div
          style={{
            padding: "10px 12px",
            border: "1px solid var(--crit)",
            borderRadius: 11,
            background: "var(--crit-bg)",
            color: "var(--crit)",
            fontSize: 12.5,
            marginBottom: 14,
          }}
        >
          Margin {margin.toFixed(1)}% is below the {MARGIN_FLOOR}% floor — review the charges.
        </div>
      )}

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">Invoice — client gross</div>
          <div className="num kpi-value">{gbp(gross)}</div>
          <div className="kpi-foot">+ {gbp(vatOn(gross))} VAT = {gbp(gross + vatOn(gross))}</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">POs — supplier net</div>
          <div className="num kpi-value" style={{ color: "var(--mid)" }}>
            {gbp(net)}
          </div>
          <div className="kpi-foot">from {gbp(supplierGross(c))} gross</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Profit</div>
          <div className="num kpi-value" style={{ color: margin < MARGIN_FLOOR ? "var(--crit)" : "var(--ok)" }}>
            {gbp(profit)}
          </div>
          <div className="kpi-foot">{margin.toFixed(1)}% margin</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Profit split</div>
          <div className="num" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.7 }}>
            Commission {gbp(commissionOf(c))}
            <br />
            Markup {gbp(markupOf(c))}
            <br />
            Fees {gbp(Number(c.fee))}
          </div>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Booking lines</h2>
          <span className="sub">Charge is invoiced · gross → net drives the PO</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Supplier</th>
                  <th>Dates</th>
                  <th>Copy</th>
                  <th className="r">Charge</th>
                  <th className="r">Gross</th>
                  <th className="r">Net</th>
                </tr>
              </thead>
              <tbody>
                {c.campaign_lines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <i
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: CHANNEL_COLOUR[l.channel],
                            display: "block",
                          }}
                        />
                        {channelLabel(l.channel)}
                      </span>
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
                    </td>
                    <td className="num" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                      {l.start_date}
                      <br />
                      <span style={{ color: "var(--faint)" }}>{l.end_date}</span>
                      {l.selected_dates && <div className="sub-line">{l.selected_dates}</div>}
                    </td>
                    <td className="sub-line">
                      {l.copy_instruction}
                      {l.urn ? ` · ${l.urn}` : ""}
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
                {Number(c.fee) > 0 && (
                  <tr>
                    <td className="sub-line">Fee</td>
                    <td className="strong">Planning fee</td>
                    <td />
                    <td />
                    <td className="r num strong">{gbp(Number(c.fee))}</td>
                    <td />
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {c.note && (
        <section className="card" style={{ marginTop: 14 }}>
          <div className="card-head">
            <h2>Notes</h2>
          </div>
          <div className="card-body">
            <p style={{ margin: 0, color: "var(--mid)", fontSize: 13 }}>{c.note}</p>
          </div>
        </section>
      )}
    </div>
  );
}
