import { getCampaigns, getMyProfile } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import CampaignTable, { type CampaignDocuments } from "@/components/CampaignTable";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; open?: string; client?: string }>;
}) {
  const supabase = await createClient();
  const [campaigns, { data: clients }, { data: staff }, params, profile, { data: orders }, { data: invoices }] = await Promise.all([
    getCampaigns(),
    // Organisations, not the old clients table: Rick couldn't find Sarah Raven
    // in the dropdown because she exists as an organisation (created via the
    // pipeline) but was never written to `clients`. Organisations are the
    // master company record now.
    //
    // But only the ones we sell to. A company that is purely a supplier has
    // customer_status "none" and has no business in a client dropdown — Rick
    // found ITV and JCDecaux offered as clients.
    supabase
      .from("organisations")
      .select("id, name")
      .eq("archived", false)
      .neq("customer_status", "none")
      .order("name"),
    supabase.from("profiles").select("id, full_name").eq("is_sales", true).order("full_name"),
    searchParams,
    getMyProfile(),
    supabase.from("space_orders").select("id, campaign_id, order_number, supplier_name"),
    supabase.from("client_invoices").select("id, campaign_id, invoice_no, status"),
  ]);

  // Space Orders and invoices, grouped by campaign, for the drawer's Documents row.
  const documents: Record<string, CampaignDocuments> = {};
  const docsFor = (id: string) => (documents[id] ??= { orders: [], invoices: [] });
  for (const o of (orders ?? []) as { id: string; campaign_id: string; order_number: string | null; supplier_name: string }[]) {
    docsFor(o.campaign_id).orders.push({ id: o.id, number: o.order_number ?? "—", supplier: o.supplier_name });
  }
  for (const i of (invoices ?? []) as { id: string; campaign_id: string | null; invoice_no: string | null; status: string }[]) {
    if (i.campaign_id) docsFor(i.campaign_id).invoices.push({ id: i.id, number: i.invoice_no, status: i.status });
  }
  const canBook = profile?.role !== "restricted";

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
        canBook={canBook}
        prefillClient={params.client ?? ""}
        documents={documents}
      />
    </div>
  );
}
