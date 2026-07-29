import Link from "next/link";
import { getCampaigns } from "@/lib/queries";
import CampaignTable from "@/components/CampaignTable";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Delivery</div>
          <h1>Campaigns</h1>
          <p>Every brief from planning through to reconciliation. Click a row for the full breakdown.</p>
        </div>
        <Link href="/campaigns/new" className="btn btn-primary">
          New campaign
        </Link>
      </div>

      <CampaignTable campaigns={campaigns} />
    </div>
  );
}
