import { createClient } from "@/lib/supabase/server";
import { VAT_RATE, type Campaign } from "@/lib/money";
import { spaceOrderRows, type SpaceOrder } from "@/lib/po";
// Row type lives in lib/organisations.ts (no server imports) so client
// components can use it without pulling this module into the browser bundle.
import type {
  OrganisationRow,
  OrganisationDetail,
  OrgInvoice,
} from "@/lib/organisations";

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
    supabase
      .from("campaigns")
      .select("id, fee, client_org_id, campaign_lines ( client_charge, supplier_net )"),
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
  const cost = new Map<string, number>();
  type CampRaw = {
    client_org_id: string | null;
    fee: number;
    campaign_lines: { client_charge: number; supplier_net: number }[];
  };
  for (const c of (campaignsRes.data ?? []) as unknown as CampRaw[]) {
    if (!c.client_org_id) continue;
    campaignCount.set(c.client_org_id, (campaignCount.get(c.client_org_id) ?? 0) + 1);
    const lines = c.campaign_lines ?? [];
    const value = lines.reduce((a, l) => a + Number(l.client_charge), 0) + Number(c.fee);
    const net = lines.reduce((a, l) => a + Number(l.supplier_net), 0);
    billings.set(c.client_org_id, (billings.get(c.client_org_id) ?? 0) + value);
    cost.set(c.client_org_id, (cost.get(c.client_org_id) ?? 0) + net);
  }

  const spend = new Map<string, number>();
  for (const l of (linesRes.data ?? []) as { supplier_org_id: string | null; supplier_net: number }[]) {
    if (!l.supplier_org_id) continue;
    spend.set(l.supplier_org_id, (spend.get(l.supplier_org_id) ?? 0) + Number(l.supplier_net));
  }

  return ((orgsRes.data ?? []) as unknown as OrgRaw[]).map((o) => {
    const gross = billings.get(o.id) ?? 0;
    const profit = gross - (cost.get(o.id) ?? 0);
    return {
      id: o.id,
      name: o.name,
      sector: o.sector ?? "—",
      owner: o.profiles?.full_name ?? "—",
      customer_status: o.customer_status,
      is_supplier: o.is_supplier,
      archived: o.archived,
      contacts: contactCount.get(o.id) ?? 0,
      campaigns: campaignCount.get(o.id) ?? 0,
      billings: gross,
      profit,
      margin: gross ? (profit / gross) * 100 : 0,
      supplier_spend: spend.get(o.id) ?? 0,
    };
  });
}

/** Everything about one organisation — the hub view. */
export async function getOrganisation(id: string): Promise<OrganisationDetail | null> {
  const supabase = await createClient();

  const { data: org, error } = await supabase
    .from("organisations")
    .select(
      "id, name, sector, customer_status, is_supplier, archived, companies_house_no, website, profiles ( full_name )"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !org) return null;

  const [contactsRes, oppsRes, campsRes, invRes, histRes, spendRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, first_name, last_name, job_title, email, phone, status")
      .eq("organisation_id", id)
      .order("first_name"),
    supabase
      .from("leads")
      .select("id, name, value, stage, next_action, profiles ( full_name )")
      .eq("organisation_id", id)
      .order("value", { ascending: false }),
    supabase
      .from("campaigns")
      .select("id, ref, name, status, start_date, end_date, fee, campaign_lines ( client_charge )")
      .eq("client_org_id", id)
      .order("start_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("client_invoices")
      .select("id, invoice_no, invoice_date, amount_ex_vat, outstanding, status")
      .eq("client_org_id", id)
      .order("invoice_date", { ascending: false }),
    supabase
      .from("organisation_status_history")
      .select("id, old_status, new_status, changed_at, reason, profiles ( full_name )")
      .eq("organisation_id", id)
      .order("changed_at", { ascending: false }),
    supabase.from("campaign_lines").select("supplier_net").eq("supplier_org_id", id),
  ]);

  type OrgRaw = { profiles: { full_name: string } | null } & Record<string, unknown>;
  const o = org as unknown as OrgRaw;

  return {
    id: String(o.id),
    name: String(o.name),
    sector: (o.sector as string | null) ?? null,
    owner: o.profiles?.full_name ?? "—",
    customer_status: String(o.customer_status),
    is_supplier: Boolean(o.is_supplier),
    archived: Boolean(o.archived),
    companies_house_no: (o.companies_house_no as string | null) ?? null,
    website: (o.website as string | null) ?? null,

    contacts: ((contactsRes.data ?? []) as unknown as {
      id: string; first_name: string; last_name: string | null;
      job_title: string | null; email: string | null; phone: string | null; status: string;
    }[]).map((c) => ({
      id: c.id,
      name: [c.first_name, c.last_name].filter(Boolean).join(" "),
      job_title: c.job_title,
      email: c.email,
      phone: c.phone,
      status: c.status,
    })),

    opportunities: ((oppsRes.data ?? []) as unknown as {
      id: string; name: string; value: number; stage: string;
      next_action: string | null; profiles: { full_name: string } | null;
    }[]).map((l) => ({
      id: l.id,
      name: l.name,
      value: Number(l.value),
      stage: l.stage,
      next_action: l.next_action,
      owner: l.profiles?.full_name ?? "—",
    })),

    campaigns: ((campsRes.data ?? []) as unknown as {
      id: string; ref: string; name: string; status: string;
      start_date: string | null; end_date: string | null;
      fee: number; campaign_lines: { client_charge: number }[];
    }[]).map((c) => ({
      id: c.id,
      ref: c.ref,
      name: c.name,
      status: c.status,
      start_date: c.start_date,
      end_date: c.end_date,
      value: (c.campaign_lines ?? []).reduce((a, l) => a + Number(l.client_charge), 0) + Number(c.fee),
    })),

    invoices: ((invRes.data ?? []) as unknown as OrgInvoice[]).map((i) => ({
      ...i,
      amount_ex_vat: Number(i.amount_ex_vat),
      outstanding: Number(i.outstanding),
    })),

    history: ((histRes.data ?? []) as unknown as {
      id: string; old_status: string | null; new_status: string;
      changed_at: string; reason: string | null; profiles: { full_name: string } | null;
    }[]).map((h) => ({
      id: h.id,
      old_status: h.old_status,
      new_status: h.new_status,
      changed_at: h.changed_at,
      changed_by: h.profiles?.full_name ?? "System",
      reason: h.reason,
    })),

    supplier_spend: ((spendRes.data ?? []) as { supplier_net: number }[]).reduce(
      (a, l) => a + Number(l.supplier_net),
      0
    ),
  };
}

/** Everything needed to render one Space Order. */
export async function getSpaceOrder(lineId: string): Promise<SpaceOrder | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaign_lines")
    .select(
      `id, channel, vendor, detail, selected_dates, start_date, end_date, supplier_po,
       supplier_contact, order_notes, supplier_gross, commission_pct, copy_instruction, urn,
       ooh_format, ooh_disp_type, supplier_org_id,
       campaigns ( ref, name, clients ( name ), profiles ( full_name, email ) )`
    )
    .eq("id", lineId)
    .maybeSingle();

  if (error || !data) return null;

  type Raw = {
    id: string;
    channel: string;
    vendor: string;
    detail: string | null;
    selected_dates: string | null;
    start_date: string;
    end_date: string;
    supplier_po: string | null;
    supplier_contact: string | null;
    order_notes: string | null;
    supplier_gross: number;
    commission_pct: number;
    copy_instruction: string | null;
    urn: string | null;
    ooh_format: string | null;
    ooh_disp_type: string | null;
    supplier_org_id: string | null;
    campaigns: {
      ref: string;
      name: string;
      clients: { name: string } | null;
      profiles: { full_name: string; email: string } | null;
    } | null;
  };
  const l = data as unknown as Raw;

  // Offer the people already saved against this supplier for the "To:" line.
  let contacts: { id: string; name: string }[] = [];
  if (l.supplier_org_id) {
    const { data: people } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("organisation_id", l.supplier_org_id)
      .order("first_name");
    contacts = ((people ?? []) as { id: string; first_name: string; last_name: string | null }[]).map(
      (p) => ({ id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(" ") })
    );
  }

  const detail =
    l.channel === "OOH" && l.ooh_format
      ? `${l.detail ?? ""}${l.detail ? " · " : ""}${l.ooh_format} (${l.ooh_disp_type ?? "Static"})`
      : l.detail ?? "";

  const gross = Number(l.supplier_gross);
  const commissionPct = Number(l.commission_pct);
  const net = gross * (1 - commissionPct / 100);
  const vat = net * VAT_RATE;

  const rows = spaceOrderRows(
    l.vendor,
    detail,
    l.selected_dates,
    l.start_date,
    l.end_date,
    gross,
    commissionPct
  );

  return {
    lineId: l.id,
    po: l.supplier_po ?? "—",
    supplier: l.vendor,
    supplierOrgId: l.supplier_org_id,
    supplierContact: l.supplier_contact ?? "",
    fromName: l.campaigns?.profiles?.full_name ?? "—",
    fromEmail: l.campaigns?.profiles?.email ?? "",
    date: new Date().toISOString().slice(0, 10),
    client: l.campaigns?.clients?.name ?? "—",
    summary: `${l.vendor}${rows.length > 1 ? ` x${rows.length}` : ""}${detail ? ` — ${detail}` : ""}`,
    commissionPct,
    copy: l.urn ? `${l.copy_instruction ?? "New Copy"} · URN ${l.urn}` : l.copy_instruction ?? "New Copy",
    orderNotes: l.order_notes ?? "",
    rows,
    gross,
    net,
    vat,
    total: net + vat,
    contacts,
  };
}
