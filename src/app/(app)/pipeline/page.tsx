import { createClient } from "@/lib/supabase/server";
import { gbpK } from "@/lib/money";
import PipelineBoard, { type LeadRow } from "@/components/PipelineBoard";

export const dynamic = "force-dynamic";

type LeadRecord = {
  id: string;
  name: string;
  contact: string | null;
  sector: string | null;
  value: number;
  stage: string;
  next_action: string | null;
  owner_id: string | null;
  profiles: { full_name: string } | null;
};

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const supabase = await createClient();
  const [{ data: leadRows }, { data: staff }, params] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, contact, sector, value, stage, next_action, owner_id, profiles ( full_name )")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").eq("is_sales", true).order("full_name"),
    searchParams,
  ]);

  const leads: LeadRow[] = ((leadRows ?? []) as unknown as LeadRecord[]).map((l) => ({
    id: l.id,
    name: l.name,
    contact: l.contact,
    sector: l.sector,
    value: Number(l.value),
    stage: l.stage,
    next_action: l.next_action,
    owner: l.profiles?.full_name ?? "—",
    ownerId: l.owner_id ?? "",
  }));

  const open = leads.filter((l) => l.stage === "Engaged" || l.stage === "Proposal");
  const openValue = open.reduce((a, l) => a + l.value, 0);
  const weighted = open.reduce((a, l) => a + l.value * (l.stage === "Proposal" ? 0.7 : 0.4), 0);
  const won = leads.filter((l) => l.stage === "Closed Won").reduce((a, l) => a + l.value, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">New business</div>
          <h1>Pipeline</h1>
          <p>
            Engaged and Proposal are live conversations. Closed Won stays for the record; Closed Lost
            is kept but never counted toward any projection.
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">Open opportunities</div>
          <div className="num kpi-value">{open.length}</div>
          <div className="kpi-foot">Engaged and Proposal</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Pipeline value</div>
          <div className="num kpi-value">{gbpK(openValue)}</div>
          <div className="kpi-foot">Unweighted</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Weighted forecast</div>
          <div className="num kpi-value">{gbpK(weighted)}</div>
          <div className="kpi-foot">Engaged 40% · Proposal 70%</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Won</div>
          <div className="num kpi-value" style={{ color: "var(--ok)" }}>
            {gbpK(won)}
          </div>
          <div className="kpi-foot">{leads.filter((l) => l.stage === "Closed Won").length} deals</div>
        </div>
      </div>

      <PipelineBoard leads={leads} staff={staff ?? []} openNew={params.new === "1"} />
    </div>
  );
}
