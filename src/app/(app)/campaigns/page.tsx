import { getCampaigns } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import CampaignTable from "@/components/CampaignTable";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; open?: string }>;
}) {
  const supabase = await createClient();
  const [campaigns, { data: clients }, { data: staff }, params] = await Promise.all([
    getCampaigns(),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name").eq("is_sales", true).order("full_name"),
    searchParams,
  ]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Delivery</div>
          <h1>Campaigns</h1>
          <p>
            Every brief from planning through to reconciliation. Book or edit in the side panel; click a
            row for the full breakdown.
          </p>
        </div>
      </div>

      <CampaignTable
        campaigns={campaigns}
        clients={clients ?? []}
        staffList={staff ?? []}
        openNew={params.new === "1"}
        openId={params.open}
      />
    </div>
  );
}
