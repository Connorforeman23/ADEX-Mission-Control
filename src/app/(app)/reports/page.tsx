import { getCampaigns, requireFullAccess } from "@/lib/queries";
import {
  CHANNELS,
  CHANNEL_COLOUR,
  channelLabel,
  clientGross,
  dealMargin,
  dealProfit,
  gbp,
  gbpK,
  rangeGB,
  STATUS_LABEL,
} from "@/lib/money";
import BarList, { type BarRow } from "@/components/BarList";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireFullAccess();
  const campaigns = await getCampaigns();
  const withResponse = campaigns.filter((c) => Number(c.leads) > 0);

  const totalLeads = campaigns.reduce((a, c) => a + Number(c.leads), 0);
  const totalSpend = campaigns.reduce((a, c) => a + clientGross(c), 0);
  const blendedCpl = totalLeads ? totalSpend / totalLeads : 0;

  // Spend by channel; leads attributed to each channel by its share of spend.
  const channelSpend = new Map<string, number>();
  const channelLeads = new Map<string, number>();
  campaigns.forEach((c) => {
    const leads = Number(c.leads);
    const lineTotal = c.campaign_lines.reduce((a, l) => a + Number(l.client_charge), 0) || 1;
    c.campaign_lines.forEach((l) => {
      const share = Number(l.client_charge) / lineTotal;
      channelSpend.set(l.channel, (channelSpend.get(l.channel) ?? 0) + Number(l.client_charge));
      channelLeads.set(l.channel, (channelLeads.get(l.channel) ?? 0) + leads * share);
    });
  });

  const spendRows: BarRow[] = CHANNELS.map((ch) => ({
    label: channelLabel(ch),
    colour: CHANNEL_COLOUR[ch],
    value: channelSpend.get(ch) ?? 0,
  })).filter((r) => r.value > 0);

  const best = [...withResponse].sort((a, b) => Number(a.cpl) - Number(b.cpl)).slice(0, 8);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Effectiveness</div>
          <h1>Reports</h1>
          <p>
            Response and cost per lead by channel and campaign. Lead figures come from each
            campaign&rsquo;s record, so this fills in as response data is added.
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">Leads delivered</div>
          <div className="num kpi-value">{totalLeads.toLocaleString("en-GB")}</div>
          <div className="kpi-foot">Across {withResponse.length} reporting campaigns</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Blended cost per lead</div>
          <div className="num kpi-value">{totalLeads ? gbp(blendedCpl) : "—"}</div>
          <div className="kpi-foot">Client spend ÷ leads</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Campaigns reporting</div>
          <div className="num kpi-value">
            {withResponse.length}
            <small style={{ fontSize: 14, color: "var(--faint)" }}> / {campaigns.length}</small>
          </div>
          <div className="kpi-foot">With lead data recorded</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Total client spend</div>
          <div className="num kpi-value">{gbpK(totalSpend)}</div>
          <div className="kpi-foot">Ex VAT</div>
        </div>
      </div>

      <div className="cols">
        <section className="card">
          <div className="card-head">
            <h2>Spend by channel</h2>
            <span className="sub">Client charge, ex VAT</span>
          </div>
          <div className="card-body">
            <BarList rows={spendRows} empty="No booking lines yet." />
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Channel performance</h2>
            <span className="sub">Leads attributed by share of spend</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {spendRows.length === 0 || totalLeads === 0 ? (
              <p className="empty-note" style={{ padding: "18px 16px" }}>
                No lead data recorded yet. Add leads to a campaign to populate this.
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th className="r">Spend</th>
                      <th className="r">Leads</th>
                      <th className="r">Cost per lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CHANNELS.filter((ch) => (channelSpend.get(ch) ?? 0) > 0).map((ch) => {
                      const spend = channelSpend.get(ch) ?? 0;
                      const leads = Math.round(channelLeads.get(ch) ?? 0);
                      return (
                        <tr key={ch}>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <i
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 2,
                                  background: CHANNEL_COLOUR[ch],
                                  display: "block",
                                }}
                              />
                              {channelLabel(ch)}
                            </span>
                          </td>
                          <td className="r num">{gbp(spend)}</td>
                          <td className="r num">{leads || "—"}</td>
                          <td className="r num">{leads ? gbp(spend / leads) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Campaign performance</h2>
          <span className="sub">Best cost per lead first</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {best.length === 0 ? (
            <p className="empty-note" style={{ padding: "18px 16px" }}>
              No campaigns have lead data yet.
              {campaigns.length > 0 &&
                ` Profit across all ${campaigns.length} campaigns is ${gbp(
                  campaigns.reduce((a, c) => a + dealProfit(c), 0)
                )}.`}
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Campaign</th>
                    <th>Flight</th>
                    <th className="r">Spend</th>
                    <th className="r">Leads</th>
                    <th className="r">CPL</th>
                    <th className="r">Margin</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {best.map((c) => (
                    <tr key={c.id}>
                      <td className="num ref">{c.ref}</td>
                      <td>
                        <div className="strong">{c.name}</div>
                        <div className="sub-line">{c.clients?.name ?? "—"}</div>
                      </td>
                      <td className="num" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                        {rangeGB(c.start_date, c.end_date)}
                      </td>
                      <td className="r num">{gbp(clientGross(c))}</td>
                      <td className="r num">{Number(c.leads)}</td>
                      <td className="r num strong">{Number(c.cpl) ? gbp(Number(c.cpl)) : "—"}</td>
                      <td className="r num" style={{ color: "var(--ok)" }}>
                        {dealMargin(c).toFixed(1)}%
                      </td>
                      <td>
                        <span className={`st ${c.status}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
