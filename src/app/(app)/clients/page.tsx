import { getCampaigns } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { channelLabel, clientGross, dealProfit, gbpK, MARGIN_FLOOR } from "@/lib/money";
import ClientTable, { type ClientRow } from "@/components/ClientTable";

export const dynamic = "force-dynamic";

type ClientRecord = {
  id: string;
  name: string;
  sector: string | null;
  status: string;
  retainer: string | null;
  profiles: { full_name: string } | null;
};

export default async function ClientsPage() {
  const supabase = await createClient();
  const [campaigns, { data: clients }] = await Promise.all([
    getCampaigns(),
    supabase
      .from("clients")
      .select("id, name, sector, status, retainer, profiles ( full_name )")
      .order("name"),
  ]);

  const rows: ClientRow[] = ((clients ?? []) as unknown as ClientRecord[]).map((cl) => {
    const theirs = campaigns.filter((c) => c.clients?.name === cl.name);
    const billings = theirs.reduce((a, c) => a + clientGross(c), 0);
    const profit = theirs.reduce((a, c) => a + dealProfit(c), 0);
    const channels = [...new Set(theirs.flatMap((c) => c.campaign_lines.map((l) => l.channel)))];
    return {
      id: cl.id,
      name: cl.name,
      sector: cl.sector ?? "—",
      owner: cl.profiles?.full_name ?? theirs[0]?.profiles?.full_name ?? "—",
      status: cl.status,
      retainer: cl.retainer ?? "—",
      campaigns: theirs.length,
      billings,
      profit,
      margin: billings ? (profit / billings) * 100 : 0,
      channels: channels.map(channelLabel),
    };
  });

  const totalBillings = rows.reduce((a, r) => a + r.billings, 0);
  const totalProfit = rows.reduce((a, r) => a + r.profit, 0);
  const belowFloor = rows.filter((r) => r.billings > 0 && r.margin < MARGIN_FLOOR).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Accounts</div>
          <h1>Clients</h1>
          <p>Billings, profit and margin per account, built from their booked campaigns.</p>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">Clients</div>
          <div className="num kpi-value">{rows.length}</div>
          <div className="kpi-foot">{rows.filter((r) => r.campaigns > 0).length} with bookings</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Billings — ex VAT</div>
          <div className="num kpi-value">{gbpK(totalBillings)}</div>
          <div className="kpi-foot">Across all accounts</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Profit</div>
          <div className="num kpi-value" style={{ color: "var(--ok)" }}>
            {gbpK(totalProfit)}
          </div>
          <div className="kpi-foot">
            {totalBillings ? ((totalProfit / totalBillings) * 100).toFixed(1) : "0.0"}% blended margin
          </div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Below margin floor</div>
          <div className="num kpi-value" style={{ color: belowFloor ? "var(--crit)" : "var(--ok)" }}>
            {belowFloor}
          </div>
          <div className="kpi-foot">Accounts under {MARGIN_FLOOR}%</div>
        </div>
      </div>

      <ClientTable rows={rows} />
    </div>
  );
}
