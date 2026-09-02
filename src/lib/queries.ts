import { createClient } from "@/lib/supabase/server";
import { VAT_RATE, type Campaign } from "@/lib/money";
import { spaceOrderRows, type SpaceOrder } from "@/lib/po";
import { invoiceTotals, type ClientInvoice, type InvoiceLine } from "@/lib/invoice";
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
       campaign_lines ( id, channel, vendor, publication, detail, line_type, start_date, end_date, selected_dates,
                        cpt, ooh_format, ooh_disp_type, copy_instruction, urn, supplier_po,
                        supplier_gross, supplier_net, client_charge, space_order_id )`
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
      .select("id, fee, client_org_id, campaign_lines ( client_charge, supplier_net, channel )"),
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

  const channels = new Map<string, Set<string>>();
  const campaignCount = new Map<string, number>();
  const billings = new Map<string, number>();
  const cost = new Map<string, number>();
  type CampRaw = {
    client_org_id: string | null;
    fee: number;
    campaign_lines: { client_charge: number; supplier_net: number; channel: string }[];
  };
  for (const c of (campaignsRes.data ?? []) as unknown as CampRaw[]) {
    if (!c.client_org_id) continue;
    campaignCount.set(c.client_org_id, (campaignCount.get(c.client_org_id) ?? 0) + 1);
    const lines = c.campaign_lines ?? [];
    const value = lines.reduce((a, l) => a + Number(l.client_charge), 0) + Number(c.fee);
    const net = lines.reduce((a, l) => a + Number(l.supplier_net), 0);
    billings.set(c.client_org_id, (billings.get(c.client_org_id) ?? 0) + value);
    cost.set(c.client_org_id, (cost.get(c.client_org_id) ?? 0) + net);
    const set = channels.get(c.client_org_id) ?? new Set<string>();
    lines.forEach((l) => l.channel && set.add(l.channel));
    channels.set(c.client_org_id, set);
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
      channels: [...(channels.get(o.id) ?? [])],
    };
  });
}

/** Everything about one organisation — the hub view. */
export async function getOrganisation(id: string): Promise<OrganisationDetail | null> {
  const supabase = await createClient();

  const { data: org, error } = await supabase
    .from("organisations")
    .select(
      "id, name, sector, customer_status, is_supplier, archived, companies_house_no, website, owner_id, address_line1, address_line2, city, postcode, country, phone, notes, profiles ( full_name )"
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
    ownerId: (o.owner_id as string | null) ?? null,
    addressLine1: (o.address_line1 as string | null) ?? null,
    addressLine2: (o.address_line2 as string | null) ?? null,
    city: (o.city as string | null) ?? null,
    postcode: (o.postcode as string | null) ?? null,
    country: (o.country as string | null) ?? null,
    phone: (o.phone as string | null) ?? null,
    notes: (o.notes as string | null) ?? null,

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


/**
 * One Space Order — every booking line for a single supplier on a campaign.
 *
 * Per Rick: the order is per SUPPLIER, not per line. ITV1 and ITVQuiz are
 * separate lines at different rates but go on one order to ITV.
 */
export async function getSpaceOrder(orderId: string): Promise<SpaceOrder | null> {
  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("space_orders")
    .select(
      `id, campaign_id, supplier_org_id, supplier_name, order_number, supplier_contact, order_notes,
       campaigns ( ref, name, clients ( name ), profiles ( full_name, email ) )`
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("getSpaceOrder", error.message);
    return null;
  }
  if (!order) return null;

  type OrderRaw = {
    id: string;
    campaign_id: string;
    supplier_org_id: string | null;
    supplier_name: string;
    order_number: string | null;
    supplier_contact: string | null;
    order_notes: string | null;
    campaigns: {
      ref: string;
      name: string;
      clients: { name: string } | null;
      profiles: { full_name: string; email: string } | null;
    } | null;
  };
  const o = order as unknown as OrderRaw;

  const { data: lineData } = await supabase
    .from("campaign_lines")
    .select(
      `id, channel, vendor, publication, line_type, detail, selected_dates, start_date, end_date,
       supplier_gross, commission_pct, copy_instruction, urn, ooh_format, ooh_disp_type`
    )
    .eq("space_order_id", orderId)
    .order("start_date");

  type LineRaw = {
    id: string;
    channel: string;
    vendor: string;
    publication: string | null;
    line_type: string | null;
    detail: string | null;
    selected_dates: string | null;
    start_date: string;
    end_date: string;
    supplier_gross: number;
    commission_pct: number;
    copy_instruction: string | null;
    urn: string | null;
    ooh_format: string | null;
    ooh_disp_type: string | null;
  };
  const lines = (lineData ?? []) as unknown as LineRaw[];

  // Every line on the order becomes its own set of dated rows.
  const rows = lines.flatMap((l) => {
    const detail =
      l.channel === "OOH" && l.ooh_format
        ? `${l.detail ?? ""}${l.detail ? " · " : ""}${l.ooh_format} (${l.ooh_disp_type ?? "Static"})`
        : l.detail ?? "";
    // The Media column carries the publication or site, not the media owner —
    // FTWM rather than FT, M4 Tower rather than JCDecaux.
    return spaceOrderRows(
      (l.publication ?? "").trim() || l.vendor,
      detail,
      l.selected_dates,
      l.start_date,
      l.end_date,
      Number(l.supplier_gross),
      Number(l.commission_pct),
      l.line_type === "production"
    );
  });

  // Production rows print no gross, so they must not be counted in the gross
  // total either — otherwise the column doesn't add up to the figure below it.
  const gross = lines
    .filter((l) => l.line_type !== "production")
    .reduce((a, l) => a + Number(l.supplier_gross), 0);
  const net = lines.reduce(
    (a, l) => a + Number(l.supplier_gross) * (1 - Number(l.commission_pct) / 100),
    0
  );
  const vat = net * VAT_RATE;

  // Commission is per line; show a single figure when they agree, a range when
  // they don't, rather than quietly implying one rate applies to everything.
  const rates = [...new Set(lines.map((l) => Number(l.commission_pct)))];
  const commissionPct = rates.length === 1 ? rates[0] : Math.max(...rates);

  const copies = [...new Set(lines.map((l) =>
    l.urn ? `${l.copy_instruction ?? "New Copy"} · URN ${l.urn}` : l.copy_instruction ?? "New Copy"
  ))];

  let contacts: { id: string; name: string }[] = [];
  if (o.supplier_org_id) {
    const { data: people } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("organisation_id", o.supplier_org_id)
      .order("first_name");
    contacts = ((people ?? []) as { id: string; first_name: string; last_name: string | null }[]).map(
      (p) => ({ id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(" ") })
    );
  }

  return {
    lineId: o.id,
    po: o.order_number ?? "—",
    supplier: o.supplier_name,
    supplierOrgId: o.supplier_org_id,
    supplierContact: o.supplier_contact ?? "",
    fromName: o.campaigns?.profiles?.full_name ?? "—",
    fromEmail: o.campaigns?.profiles?.email ?? "",
    date: new Date().toISOString().slice(0, 10),
    client: o.campaigns?.clients?.name ?? "—",
    summary: `${o.supplier_name}${rows.length > 1 ? ` x${rows.length}` : ""}${
      lines.length > 1 ? ` · ${lines.length} lines` : ""
    }`,
    commissionPct,
    copy: copies.join(" / "),
    orderNotes: o.order_notes ?? "",
    rows,
    gross,
    net,
    vat,
    total: net + vat,
    contacts,
  };
}

// --- client invoice ------------------------------------------------------

/**
 * One client invoice with its lines, ready to print or push to Xero.
 *
 * The client's address comes from the organisation record rather than the
 * older clients table, which never held one. They are matched by name — the
 * same way 0006 built organisations out of clients in the first place.
 */
export async function getClientInvoice(invoiceId: string): Promise<ClientInvoice | null> {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("client_invoices")
    .select(
      `id, campaign_id, invoice_no, invoice_date, due_date, status, client_po, xero_id,
       campaigns ( ref, name, client_po, clients ( name ) )`
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) {
    console.error("getClientInvoice", error.message);
    return null;
  }
  if (!invoice) return null;

  type InvoiceRaw = {
    id: string;
    campaign_id: string | null;
    invoice_no: string | null;
    invoice_date: string;
    due_date: string | null;
    status: string;
    client_po: string | null;
    xero_id: string | null;
    campaigns: {
      ref: string;
      name: string;
      client_po: string | null;
      clients: { name: string } | null;
    } | null;
  };
  const inv = invoice as unknown as InvoiceRaw;
  const client = inv.campaigns?.clients?.name ?? "—";

  const [{ data: lineData }, { data: org }] = await Promise.all([
    supabase
      .from("client_invoice_lines")
      .select("id, campaign_line_id, description, net")
      .eq("invoice_id", invoiceId)
      .order("sort_order"),
    supabase
      .from("organisations")
      .select("address_line1, address_line2, city, postcode, country")
      .ilike("name", client)
      .maybeSingle(),
  ]);

  type LineRaw = {
    id: string;
    campaign_line_id: string | null;
    description: string;
    net: number;
  };
  const lines: InvoiceLine[] = ((lineData ?? []) as LineRaw[]).map((l) => ({
    id: l.id,
    campaignLineId: l.campaign_line_id,
    description: l.description,
    net: Number(l.net),
  }));

  type OrgRaw = {
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    postcode: string | null;
    country: string | null;
  };
  const a = (org ?? null) as OrgRaw | null;
  const clientAddress = [a?.address_line1, a?.address_line2, a?.city, a?.country, a?.postcode]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);

  const { net, vat, total } = invoiceTotals(lines);

  return {
    id: inv.id,
    invoiceNo: inv.invoice_no,
    invoiceDate: inv.invoice_date,
    dueDate: inv.due_date,
    status: inv.status,
    xeroId: inv.xero_id,
    clientPo: inv.client_po ?? inv.campaigns?.client_po ?? null,
    client,
    clientAddress,
    campaignId: inv.campaign_id,
    campaignRef: inv.campaigns?.ref ?? "—",
    campaignName: inv.campaigns?.name ?? "(deleted campaign)",
    lines,
    net,
    vat,
    total,
  };
}
