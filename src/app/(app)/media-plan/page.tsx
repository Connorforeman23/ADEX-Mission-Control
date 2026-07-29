import { getCampaigns } from "@/lib/queries";
import { gbpK } from "@/lib/money";
import { SOLD_STATUSES } from "@/lib/po";
import MediaSchedule, { type PlanLine } from "@/components/MediaSchedule";

export const dynamic = "force-dynamic";

export default async function MediaPlanPage() {
  const campaigns = await getCampaigns();

  const lines: PlanLine[] = campaigns.flatMap((c) =>
    c.campaign_lines.map((l) => ({
      id: l.id,
      campaignId: c.id,
      campaignRef: c.ref,
      client: c.clients?.name ?? "Unassigned",
      owner: c.profiles?.full_name ?? "—",
      vendor: l.vendor,
      channel: l.channel,
      detail: l.detail ?? "",
      start: l.start_date,
      end: l.end_date,
      gross: Number(l.supplier_gross),
      net: Number(l.supplier_net),
    }))
  );

  const committed = campaigns
    .filter((c) => SOLD_STATUSES.includes(c.status))
    .flatMap((c) => c.campaign_lines)
    .reduce((a, l) => a + Number(l.supplier_net), 0);
  const vendors = new Set(lines.map((l) => l.vendor)).size;
  const today = new Date().toISOString().slice(0, 10);
  const inMarket = lines.filter((l) => l.start <= today && l.end >= today).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Buying</div>
          <h1>Media plan</h1>
          <p>Every booked and held line across the quarter, by client and sales owner.</p>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">Committed — supplier net</div>
          <div className="num kpi-value">{gbpK(committed)}</div>
          <div className="kpi-foot">Booked and live campaigns</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Booking lines</div>
          <div className="num kpi-value">{lines.length}</div>
          <div className="kpi-foot">Across {campaigns.length} campaigns</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Media owners</div>
          <div className="num kpi-value">{vendors}</div>
          <div className="kpi-foot">Distinct suppliers</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">In market now</div>
          <div className="num kpi-value">{inMarket}</div>
          <div className="kpi-foot">Lines running today</div>
        </div>
      </div>

      <MediaSchedule lines={lines} today={today} />
    </div>
  );
}
