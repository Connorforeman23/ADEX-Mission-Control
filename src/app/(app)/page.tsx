import Link from "next/link";
import { getCampaigns, getOpenLeads, getPoVariances } from "@/lib/queries";
import {
  CHANNELS,
  CHANNEL_COLOUR,
  channelLabel,
  clientGross,
  dealMargin,
  dealProfit,
  gbp,
  gbpK,
  MARGIN_FLOOR,
  STATUS_LABEL,
  supplierNet,
} from "@/lib/money";
import BarList, { type BarRow } from "@/components/BarList";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [campaigns, leads, variances] = await Promise.all([
    getCampaigns(),
    getOpenLeads(),
    getPoVariances(),
  ]);

  const liveCampaigns = campaigns.filter((c) => c.status === "live" || c.status === "risk");
  const openBook = campaigns.filter((c) => c.status !== "done");

  const totalGross = campaigns.reduce((a, c) => a + clientGross(c), 0);
  const totalProfit = campaigns.reduce((a, c) => a + dealProfit(c), 0);
  const bookMargin = totalGross ? (totalProfit / totalGross) * 100 : 0;
  const pipelineValue = leads.reduce((a, l) => a + Number(l.value), 0);

  // Channel mix, by what the client is charged.
  const channelRows: BarRow[] = CHANNELS.map((ch) => ({
    label: channelLabel(ch),
    colour: CHANNEL_COLOUR[ch],
    value: campaigns
      .flatMap((c) => c.campaign_lines)
      .filter((l) => l.channel === ch)
      .reduce((a, l) => a + Number(l.client_charge), 0),
  })).filter((r) => r.value > 0);

  // Billings by sales team.
  const byOwner = new Map<string, number>();
  campaigns.forEach((c) => {
    const owner = c.profiles?.full_name ?? "Unassigned";
    byOwner.set(owner, (byOwner.get(owner) ?? 0) + clientGross(c));
  });
  const salesRows: BarRow[] = [...byOwner.entries()]
    .map(([label, value]) => ({
      label,
      value,
      colour: "linear-gradient(90deg, var(--blue), var(--pink))",
    }))
    .sort((a, b) => b.value - a.value);

  const lowMargin = openBook.filter((c) => clientGross(c) > 0 && dealMargin(c) < MARGIN_FLOOR);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Mission control</div>
          <h1>Dashboard</h1>
          <p>
            {campaigns.length
              ? `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} on the book, ${liveCampaigns.length} live in market.`
              : "Nothing booked yet — add your first campaign to bring this to life."}
          </p>
        </div>
        <Link href="/campaigns" className="btn btn-primary">
          New campaign
        </Link>
      </div>

      <div className="kpis">
        <Kpi
          label="Live campaigns"
          value={String(liveCampaigns.length)}
          foot={`${campaigns.length} on the book`}
        />
        <Kpi label="Billings — ex VAT" value={gbpK(totalGross)} foot="Client gross across all campaigns" />
        <Kpi
          label="Profit"
          value={gbpK(totalProfit)}
          foot={totalGross ? `${bookMargin.toFixed(1)}% margin` : "Commission + markup + fees"}
          tone={totalGross && bookMargin < MARGIN_FLOOR ? "crit" : "ok"}
        />
        <Kpi
          label="Open pipeline"
          value={gbpK(pipelineValue)}
          foot={`${leads.length} live conversation${leads.length === 1 ? "" : "s"}`}
        />
      </div>

      <div className="cols">
        <section className="card">
          <div className="card-head">
            <h2>Billings by channel</h2>
            <span className="sub">Client charge, ex VAT</span>
          </div>
          <div className="card-body">
            <BarList rows={channelRows} empty="No booking lines yet. Channel mix appears once campaigns are booked." />
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Billings by sales team</h2>
            <span className="sub">Client gross per owner</span>
          </div>
          <div className="card-body">
            <BarList rows={salesRows} empty="No campaigns assigned yet." />
          </div>
        </section>
      </div>

      <div className="cols">
        <section className="card">
          <div className="card-head">
            <h2>Live now</h2>
            <span className="sub">In market this week</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {liveCampaigns.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ref</th>
                      <th>Campaign</th>
                      <th className="r">Client gross</th>
                      <th className="r">Profit</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveCampaigns.map((c) => (
                      <tr key={c.id}>
                        <td className="num ref">{c.ref}</td>
                        <td>
                          <div className="strong">{c.name}</div>
                          <div className="sub-line">{c.clients?.name ?? "—"}</div>
                        </td>
                        <td className="r num">{gbp(clientGross(c))}</td>
                        <td className="r num" style={{ color: "var(--ok)" }}>
                          {gbp(dealProfit(c))}
                        </td>
                        <td>
                          <span className={`st ${c.status}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-note" style={{ padding: "18px 16px" }}>
                Nothing live right now.
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Needs attention</h2>
            <span className="sub">{variances.length + lowMargin.length} open</span>
          </div>
          <div className="card-body">
            {variances.length === 0 && lowMargin.length === 0 ? (
              <p className="empty-note">Nothing flagged. Margin floor is {MARGIN_FLOOR}%.</p>
            ) : (
              <div className="rows">
                {variances.map((v) => (
                  <div className="row" key={v.line_id}>
                    <span className="flag crit">PO</span>
                    <div className="grow">
                      <p>
                        {v.vendor} invoiced {gbp(v.amount)} against {gbp(v.supplier_net)}
                      </p>
                      <small>
                        {v.campaign_ref} · invoice {v.invoice_no}
                      </small>
                    </div>
                    <span className="num" style={{ color: "var(--crit)", whiteSpace: "nowrap" }}>
                      {v.diff > 0 ? "+" : "−"}
                      {gbp(Math.abs(v.diff))}
                    </span>
                  </div>
                ))}
                {lowMargin.map((c) => (
                  <div className="row" key={c.id}>
                    <span className="flag warn">%</span>
                    <div className="grow">
                      <p>
                        {c.ref} margin {dealMargin(c).toFixed(1)}% — below the {MARGIN_FLOOR}% floor
                      </p>
                      <small>
                        {c.name} · {c.profiles?.full_name ?? "Unassigned"}
                      </small>
                    </div>
                    <span className="num" style={{ color: "var(--warn)" }}>
                      {gbp(supplierNet(c))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {campaigns.length === 0 && (
        <section className="card" style={{ marginTop: 14 }}>
          <div className="card-body">
            <h2 style={{ fontSize: 15, fontWeight: 650, margin: "0 0 6px" }}>Getting started</h2>
            <p style={{ color: "var(--mid)", fontSize: 13, margin: "0 0 10px", maxWidth: "62ch" }}>
              Your database is live but empty — no demo data, so everything you see from here is real.
              The Campaigns module lands next with the booking form: client charge and supplier cost per
              line, fixed date ranges, CPT, OOH formats and copy instructions. Booking a campaign will
              populate every figure on this page and raise its purchase orders automatically.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="pill">{CHANNELS.length} channels configured</span>
              <span className="pill">15% commission default</span>
              <span className="pill">VAT 20% on invoices</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  foot,
  tone,
}: {
  label: string;
  value: string;
  foot: string;
  tone?: "ok" | "crit";
}) {
  return (
    <div className="card kpi">
      <div className="eyebrow">{label}</div>
      <div
        className="num kpi-value"
        style={tone === "crit" ? { color: "var(--crit)" } : undefined}
      >
        {value}
      </div>
      <div className="kpi-foot">{foot}</div>
    </div>
  );
}
