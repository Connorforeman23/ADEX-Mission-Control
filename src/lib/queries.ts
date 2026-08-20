import { createClient } from "@/lib/supabase/server";
import type { Campaign } from "@/lib/money";

// Campaigns with their client, owner and booking lines in one round trip.
// First nudges statuses along: booked campaigns whose start date has arrived
// go live, and finished ones complete — so the boards stay right on their own.
export async function getCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient();
  await supabase.rpc("sync_campaign_statuses");

  const { data, error } = await supabase
    .from("campaigns")
    .select(
      `id, ref, name, status, region, start_date, end_date, fee, billed, leads, cpl, client_po,
       clients ( name ),
       profiles ( full_name ),
       campaign_lines ( id, channel, vendor, detail, line_type, start_date, end_date, selected_dates,
                        cpt, ooh_format, ooh_disp_type, copy_instruction, urn, supplier_po,
                        supplier_gross, supplier_net, client_charge )`
    )
    .order("start_date", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("getCampaigns", error.message);
    return [];
  }
  return (data ?? []) as unknown as Campaign[];
}

/**
 * Server-side gate for commercial pages. RLS already hides the data from
 * restricted users; this stops the pages rendering at all.
 */
export async function requireFullAccess() {
  const profile = await getMyProfile();
  if (profile?.role === "restricted") {
    const { redirect } = await import("next/navigation");
    redirect("/");
  }
}

/** The signed-in user's profile — role drives what the shell shows. */
export async function getMyProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_sales")
    .eq("id", user.id)
    .maybeSingle();
  return data as { id: string; full_name: string; role: string; is_sales: boolean } | null;
}

export type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  done: boolean;
  kind: string;
  assignee: string;
  assignee_id: string | null;
  about: string;
  campaign_id: string | null;
  client_id: string | null;
  lead_id: string | null;
};

export async function getTasks(): Promise<TaskRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `id, title, notes, due_date, done, kind, assignee_id, campaign_id, client_id, lead_id,
       assignee:profiles!tasks_assignee_id_fkey ( full_name ),
       campaigns ( ref, name ),
       clients ( name ),
       leads ( name )`
    )
    .order("done")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("getTasks", error.message);
    return [];
  }

  type Raw = {
    id: string;
    title: string;
    notes: string | null;
    due_date: string | null;
    done: boolean;
    kind: string;
    assignee_id: string | null;
    campaign_id: string | null;
    client_id: string | null;
    lead_id: string | null;
    assignee: { full_name: string } | null;
    campaigns: { ref: string; name: string } | null;
    clients: { name: string } | null;
    leads: { name: string } | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((t) => ({
    id: t.id,
    title: t.title,
    notes: t.notes,
    due_date: t.due_date,
    done: t.done,
    kind: t.kind,
    assignee: t.assignee?.full_name ?? "Unassigned",
    assignee_id: t.assignee_id,
    about:
      (t.campaigns && `${t.campaigns.ref} · ${t.campaigns.name}`) ||
      t.clients?.name ||
      (t.leads && `Lead: ${t.leads.name}`) ||
      "",
    campaign_id: t.campaign_id,
    client_id: t.client_id,
    lead_id: t.lead_id,
  }));
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

// --- organisations (Phase 3) ---------------------------------------------

export type OrganisationRow = {
  id: string;
  name: string;
  sector: string;
  owner: string;
  customer_status: string;
  is_supplier: boolean;
  archived: boolean;
  contacts: number;
  campaigns: number;
  billings: number;
  supplier_spend: number;
};

/** Human labels for the customer lifecycle. */
export const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  prospect: "Prospect",
  active_client: "Active client",
  former_client: "Former client",
  not_pursuing: "Not pursuing",
  none: "No customer relationship",
};

/**
 * Every company in one place: customer lifecycle, supplier flag, their people,
 * and what they're worth on each side of the relationship.
 */
export async function getOrganisations(): Promise<OrganisationRow[]> {
  const supabase = await createClient();
  const [orgsRes, contactsRes, campaignsRes, linesRes] = await Promise.all([
    supabase
      .from("organisations")
      .select("id, name, sector, customer_status, is_supplier, archived, profiles ( full_name )")
      .order("name"),
    supabase.from("contacts").select("organisation_id"),
    supabase.from("campaigns").select("id, fee, client_org_id, campaign_lines ( client_charge )"),
    supabase.from("campaign_lines").select("supplier_org_id, supplier_net"),
  ]);

  if (orgsRes.error) {
    console.error("getOrganisations", orgsRes.error.message);
    return [];
  }

  type OrgRaw = {
    id: string;
    name: string;
    sector: string | null;
    customer_status: string;
    is_supplier: boolean;
    archived: boolean;
    profiles: { full_name: string } | null;
  };

  const contactCount = new Map<string, number>();
  for (const c of (contactsRes.data ?? []) as { organisation_id: string | null }[]) {
    if (c.organisation_id) contactCount.set(c.organisation_id, (contactCount.get(c.organisation_id) ?? 0) + 1);
  }

  const campaignCount = new Map<string, number>();
  const billings = new Map<string, number>();
  type CampRaw = { client_org_id: string | null; fee: number; campaign_lines: { client_charge: number }[] };
  for (const c of (campaignsRes.data ?? []) as unknown as CampRaw[]) {
    if (!c.client_org_id) continue;
    campaignCount.set(c.client_org_id, (campaignCount.get(c.client_org_id) ?? 0) + 1);
    const value = (c.campaign_lines ?? []).reduce((a, l) => a + Number(l.client_charge), 0) + Number(c.fee);
    billings.set(c.client_org_id, (billings.get(c.client_org_id) ?? 0) + value);
  }

  const spend = new Map<string, number>();
  for (const l of (linesRes.data ?? []) as { supplier_org_id: string | null; supplier_net: number }[]) {
    if (!l.supplier_org_id) continue;
    spend.set(l.supplier_org_id, (spend.get(l.supplier_org_id) ?? 0) + Number(l.supplier_net));
  }

  return ((orgsRes.data ?? []) as unknown as OrgRaw[]).map((o) => ({
    id: o.id,
    name: o.name,
    sector: o.sector ?? "—",
    owner: o.profiles?.full_name ?? "—",
    customer_status: o.customer_status,
    is_supplier: o.is_supplier,
    archived: o.archived,
    contacts: contactCount.get(o.id) ?? 0,
    campaigns: campaignCount.get(o.id) ?? 0,
    billings: billings.get(o.id) ?? 0,
    supplier_spend: spend.get(o.id) ?? 0,
  }));
}
