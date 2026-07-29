import { createClient } from "@/lib/supabase/server";
import type { Campaign } from "@/lib/money";

// Campaigns with their client, owner and booking lines in one round trip.
export async function getCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      `id, ref, name, status, region, start_date, end_date, fee, billed, leads, cpl,
       clients ( name ),
       profiles ( full_name ),
       campaign_lines ( id, channel, vendor, detail, start_date, end_date,
                        supplier_gross, supplier_net, client_charge )`
    )
    .order("start_date", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("getCampaigns", error.message);
    return [];
  }
  return (data ?? []) as unknown as Campaign[];
}

export type StaffMember = {
  id: string;
  full_name: string;
  role: string;
  is_sales: boolean;
};

export async function getSalesTeam(): Promise<StaffMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_sales")
    .eq("is_sales", true)
    .order("full_name");
  return (data ?? []) as StaffMember[];
}

export type Lead = {
  id: string;
  name: string;
  value: number;
  stage: string;
  next_action: string | null;
  profiles: { full_name: string } | null;
};

export async function getOpenLeads(): Promise<Lead[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, name, value, stage, next_action, profiles ( full_name )")
    .in("stage", ["Engaged", "Proposal"]);
  return (data ?? []) as unknown as Lead[];
}

export type PoVariance = {
  line_id: string;
  vendor: string;
  invoice_no: string;
  amount: number;
  supplier_net: number;
  diff: number;
  campaign_ref: string;
};

// Supplier invoices sitting outside tolerance of the PO net they were raised
// against. Tolerance matches the reconciliation rule in the mock: ±£25.
export async function getPoVariances(tolerance = 25): Promise<PoVariance[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("supplier_invoices")
    .select(
      `invoice_no, amount, approved,
       campaign_lines ( id, vendor, supplier_net, campaigns ( ref ) )`
    )
    .eq("approved", false);

  type Row = {
    invoice_no: string;
    amount: number;
    campaign_lines: {
      id: string;
      vendor: string;
      supplier_net: number;
      campaigns: { ref: string } | null;
    } | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.campaign_lines)
    .map((r) => ({
      line_id: r.campaign_lines!.id,
      vendor: r.campaign_lines!.vendor,
      invoice_no: r.invoice_no,
      amount: Number(r.amount),
      supplier_net: Number(r.campaign_lines!.supplier_net),
      diff: Number(r.amount) - Number(r.campaign_lines!.supplier_net),
      campaign_ref: r.campaign_lines!.campaigns?.ref ?? "—",
    }))
    .filter((r) => Math.abs(r.diff) > tolerance);
}
