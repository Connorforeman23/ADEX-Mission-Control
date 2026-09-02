"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { draftInvoiceLines, dueAfter, monthEnd } from "@/lib/invoice";
import type { Campaign } from "@/lib/money";

export type LineInput = {
  id?: string;
  line_type: "media" | "production";
  channel: string;
  vendor: string;
  /** The publication or site booked — FTWM, M4 Tower. Shown on the Space Order. */
  publication: string;
  detail: string;
  start_date: string;
  end_date: string;
  selected_dates: string;
  cpt: string;
  ooh_format: string;
  ooh_disp_type: string;
  copy_instruction: string;
  urn: string;
  supplier_gross: string;
  client_charge: string;
};

export type CampaignInput = {
  name: string;
  clientName: string;
  ownerId: string;
  status: string;
  region: string;
  fee: string;
  note: string;
  clientPo: string;
  /** Compulsory when any line is New Copy; ignored otherwise. */
  creativeDeadline: string;
  designSource: "inhouse" | "client";
  lines: LineInput[];
};

const money = (v: string) => {
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** The signed-in user with their role, for access decisions in write actions. */
async function meWithRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null as string | null };
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { user, role: (data?.role ?? null) as string | null };
}

// A restricted user can only ever own what they create — forcing the owner to
// themselves means the "see only your own" model can never trap them with a
// record they created but then cannot see.
function ownerFor(role: string | null, userId: string, chosen: string) {
  return role === "restricted" ? userId : chosen || null;
}

const RESTRICTED_NO_BOOKING =
  "Booking media is handled by the wider team. As a restricted user you can manage your own " +
  "clients and prospects, but not raise campaigns or purchase orders — ask an admin to book for you.";

/**
 * Next reference in the AE-#### series, from an atomic counter.
 *
 * This used to read the highest existing ref and add one, sorted as text —
 * which meant the seeded TST-0005 campaigns always won ("T" > "A"), so every
 * booking was offered AE-6 and the second one collided. Text sorting also
 * breaks at 999→1000, and two simultaneous bookings could read the same value.
 */
async function nextRef(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.rpc("next_campaign_ref");
  if (error || typeof data !== "string") {
    throw new Error(
      `Couldn't allocate a campaign reference: ${error?.message ?? "unexpected response"}`
    );
  }
  return data;
}

export async function createCampaign(input: CampaignInput) {
  const supabase = await createClient();

  const { user, role } = await meWithRole(supabase);
  if (!user) return { error: "You need to be signed in." };
  if (role === "restricted") return { error: RESTRICTED_NO_BOOKING };

  const name = input.name.trim();
  const clientName = input.clientName.trim();
  if (!name) return { error: "Give the campaign a name." };
  if (!clientName) return { error: "Choose a client." };

  const lines = input.lines.filter((l) => l.vendor.trim() && (money(l.supplier_gross) > 0 || money(l.client_charge) > 0));
  if (!lines.length) return { error: "Add at least one booking line with a supplier and a value." };

  for (const l of lines) {
    if (!l.start_date || !l.end_date) return { error: `Add dates to the ${l.vendor} line.` };
    if (l.end_date < l.start_date) return { error: `The ${l.vendor} line ends before it starts.` };
  }

  // New copy needs a creative deadline so the studio follow-up can be raised.
  const needsCreative = lines.some((l) => l.copy_instruction === "New Copy");
  if (needsCreative && !input.creativeDeadline) {
    return { error: "New copy is booked — set the creative deadline so the follow-up task can be raised." };
  }

  // Find or create the client.
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", clientName)
    .maybeSingle();

  let clientId = existing?.id as string | undefined;
  if (!clientId) {
    const { data: created, error: clientError } = await supabase
      .from("clients")
      .insert({ name: clientName, owner_id: input.ownerId || null })
      .select("id")
      .single();
    if (clientError) return { error: `Couldn't create the client: ${clientError.message}` };
    clientId = created.id;
  }

  const starts = lines.map((l) => l.start_date).sort();
  const ends = lines.map((l) => l.end_date).sort();

  // The client organisation is the master record; booking work for them makes
  // them an active client.
  const { data: clientOrgId } = await supabase.rpc("find_or_create_organisation", {
    p_name: clientName,
    p_sector: null,
    p_owner: input.ownerId || null,
  });
  if (clientOrgId) {
    await supabase.rpc("set_organisation_status", {
      p_org: clientOrgId,
      p_status: "active_client",
      p_reason: `Campaign booked: ${name}`,
    });
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      ref: await nextRef(supabase),
      name,
      client_id: clientId,
      client_org_id: (clientOrgId as string | null) ?? null,
      status: input.status,
      owner_id: input.ownerId || null,
      region: input.region,
      start_date: starts[0],
      end_date: ends[ends.length - 1],
      fee: money(input.fee),
      note: input.note.trim() || null,
      client_po: input.clientPo.trim() || null,
    })
    .select("id, ref")
    .single();

  if (campaignError) return { error: `Couldn't save the campaign: ${campaignError.message}` };

  // Supplier PO numbers continue the per-client sequence (Randox → RAN0097 style).
  const prefix = (clientName.replace(/[^A-Za-z]/g, "").slice(0, 3) || "ADX").toUpperCase();
  const inserted: { vendor: string; po: string | null }[] = [];

  for (const l of lines) {
    let supplierPo: string | null = null;
    const { data: poNo } = await supabase.rpc("next_po_number", { p_prefix: prefix });
    if (typeof poNo === "string") supplierPo = poNo;

    const { error } = await supabase.from("campaign_lines").insert({
      campaign_id: campaign.id,
      supplier_po: supplierPo,
      channel: l.channel,
      line_type: l.line_type,
      vendor: l.vendor.trim(),
      detail: l.detail.trim() || null,
      start_date: l.start_date,
      end_date: l.end_date,
      selected_dates: l.selected_dates.trim() || null,
      cpt: l.cpt ? money(l.cpt) : null,
      ooh_format: l.channel === "OOH" ? l.ooh_format : null,
      ooh_disp_type: l.channel === "OOH" ? l.ooh_disp_type : null,
      copy_instruction: l.copy_instruction,
      urn: l.copy_instruction === "URN" ? l.urn.trim() || null : null,
      supplier_gross: money(l.supplier_gross),
      commission_pct: l.line_type === "production" ? 0 : 15,
      client_charge: money(l.client_charge) || money(l.supplier_gross),
    });
    if (error) {
      // Don't leave a half-saved campaign behind.
      await supabase.from("campaigns").delete().eq("id", campaign.id);
      return { error: `Couldn't save the ${l.vendor} line: ${error.message}` };
    }
    inserted.push({ vendor: l.vendor, po: supplierPo });
  }

  // One Space Order per supplier, so the booking can actually be sent out.
  await syncSpaceOrders(supabase, campaign.id);

  // New copy → creative brief plus a follow-up task for whoever handles design:
  // in-house goes to James Beach; client-supplied goes back to the sales owner.
  if (needsCreative) {
    let assignee = input.ownerId || null;
    if (input.designSource === "inhouse") {
      const { data: james } = await supabase
        .from("profiles")
        .select("id")
        .ilike("full_name", "%james beach%")
        .maybeSingle();
      if (james) assignee = james.id;
    }

    const { data: creative } = await supabase
      .from("creative_items")
      .insert({
        client_id: clientId,
        campaign_id: campaign.id,
        item: `${name} — new copy`,
        format: [...new Set(lines.filter((l) => l.copy_instruction === "New Copy").map((l) => l.channel))].join(", "),
        due_date: input.creativeDeadline,
        stage: "Briefed",
        owner_id: assignee,
        design_source: input.designSource,
      })
      .select("id")
      .single();

    await supabase.from("tasks").insert({
      title:
        input.designSource === "inhouse"
          ? `Creative: ${name} (${campaign.ref})`
          : `Chase client artwork: ${name} (${campaign.ref})`,
      notes: `New copy deadline for ${clientName}. Design: ${input.designSource === "inhouse" ? "in-house studio" : "client supplied"}.`,
      due_date: input.creativeDeadline,
      kind: "creative",
      assignee_id: assignee,
      campaign_id: campaign.id,
      client_id: clientId,
      creative_id: creative?.id ?? null,
      created_by: user.id,
    });
  }

  revalidatePath("/campaigns");
  revalidatePath("/tasks");
  revalidatePath("/creative");
  revalidatePath("/");
  return { ref: campaign.ref, id: campaign.id };
}

/** Shared shape for a booking line row, minus the campaign it belongs to. */
function lineRow(l: LineInput) {
  return {
    channel: l.channel,
    line_type: l.line_type,
    vendor: l.vendor.trim(),
    publication: l.publication.trim() || null,
    detail: l.detail.trim() || null,
    start_date: l.start_date,
    end_date: l.end_date,
    selected_dates: l.selected_dates.trim() || null,
    cpt: l.cpt ? money(l.cpt) : null,
    ooh_format: l.channel === "OOH" ? l.ooh_format : null,
    ooh_disp_type: l.channel === "OOH" ? l.ooh_disp_type : null,
    copy_instruction: l.copy_instruction,
    urn: l.copy_instruction === "URN" ? l.urn.trim() || null : null,
    supplier_gross: money(l.supplier_gross),
    commission_pct: l.line_type === "production" ? 0 : 15,
    client_charge: money(l.client_charge) || money(l.supplier_gross),
  };
}

export async function updateCampaign(campaignId: string, input: CampaignInput) {
  const supabase = await createClient();

  const { user, role } = await meWithRole(supabase);
  if (!user) return { error: "You need to be signed in." };
  if (role === "restricted") return { error: RESTRICTED_NO_BOOKING };

  const name = input.name.trim();
  const clientName = input.clientName.trim();
  if (!name) return { error: "Give the campaign a name." };
  if (!clientName) return { error: "Choose a client." };

  const lines = input.lines.filter(
    (l) => l.vendor.trim() && (money(l.supplier_gross) > 0 || money(l.client_charge) > 0)
  );
  if (!lines.length) return { error: "Keep at least one booking line." };

  for (const l of lines) {
    if (!l.start_date || !l.end_date) return { error: `Add dates to the ${l.vendor} line.` };
    if (l.end_date < l.start_date) return { error: `The ${l.vendor} line ends before it starts.` };
  }

  const { data: existingClient } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", clientName)
    .maybeSingle();

  let clientId = existingClient?.id as string | undefined;
  if (!clientId) {
    const { data: created, error: clientError } = await supabase
      .from("clients")
      .insert({ name: clientName, owner_id: input.ownerId || null })
      .select("id")
      .single();
    if (clientError) return { error: `Couldn't create the client: ${clientError.message}` };
    clientId = created.id;
  }

  const starts = lines.map((l) => l.start_date).sort();
  const ends = lines.map((l) => l.end_date).sort();

  const { error: campaignError } = await supabase
    .from("campaigns")
    .update({
      name,
      client_id: clientId,
      status: input.status,
      owner_id: input.ownerId || null,
      region: input.region,
      start_date: starts[0],
      end_date: ends[ends.length - 1],
      fee: money(input.fee),
      note: input.note.trim() || null,
      client_po: input.clientPo.trim() || null,
    })
    .eq("id", campaignId);

  if (campaignError) return { error: `Couldn't save the campaign: ${campaignError.message}` };

  // Update lines in place where they already exist, so any matched supplier
  // invoice stays attached to its line rather than cascading away.
  const keptIds = lines.map((l) => l.id).filter(Boolean) as string[];
  const { data: current } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("campaign_id", campaignId);

  const toDelete = (current ?? []).map((r) => r.id as string).filter((id) => !keptIds.includes(id));
  if (toDelete.length) {
    await supabase.from("campaign_lines").delete().in("id", toDelete);
  }

  for (const l of lines) {
    if (l.id) {
      const { error } = await supabase.from("campaign_lines").update(lineRow(l)).eq("id", l.id);
      if (error) return { error: `Couldn't update the ${l.vendor} line: ${error.message}` };
    } else {
      const { error } = await supabase
        .from("campaign_lines")
        .insert({ campaign_id: campaignId, ...lineRow(l) });
      if (error) return { error: `Couldn't add the ${l.vendor} line: ${error.message}` };
    }
  }

  revalidatePath("/campaigns");
  // Editing can add a supplier or remove one, so re-sync the orders.
  await syncSpaceOrders(supabase, campaignId);

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/");
  return { id: campaignId };
}

/** Record the supplier's invoice against a booking line's purchase order. */
export async function recordSupplierInvoice(
  campaignLineId: string,
  invoiceNo: string,
  amount: string
) {
  const supabase = await createClient();
  const value = money(amount);
  if (!value) return { error: "Enter the invoiced net amount." };

  const { error } = await supabase.from("supplier_invoices").upsert(
    {
      campaign_line_id: campaignLineId,
      invoice_no: invoiceNo.trim() || "—",
      amount: value,
      approved: false,
    },
    { onConflict: "campaign_line_id" }
  );

  if (error) return { error: error.message };
  revalidatePath("/finance");
  revalidatePath("/");
  return {};
}

/** Accept a variance so the line stops being flagged. */
export async function approveVariance(campaignLineId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("supplier_invoices")
    .update({ approved: true })
    .eq("campaign_line_id", campaignLineId);
  if (error) return { error: error.message };
  revalidatePath("/finance");
  revalidatePath("/");
  return {};
}

// --- tasks & reminders --------------------------------------------------

export type TaskInput = {
  id?: string;
  title: string;
  notes: string;
  dueDate: string;
  assigneeId: string;
  campaignId?: string;
  clientId?: string;
  leadId?: string;
};

export async function saveTask(input: TaskInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };
  if (!input.title.trim()) return { error: "Give the task a title." };

  const row = {
    title: input.title.trim(),
    notes: input.notes.trim() || null,
    due_date: input.dueDate || null,
    assignee_id: input.assigneeId || null,
    campaign_id: input.campaignId || null,
    client_id: input.clientId || null,
    lead_id: input.leadId || null,
    created_by: user.id,
  };

  const { error } = input.id
    ? await supabase.from("tasks").update(row).eq("id", input.id)
    : await supabase.from("tasks").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  revalidatePath("/");
  return {};
}

export async function toggleTask(id: string, done: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ done }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  revalidatePath("/");
  return {};
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return {};
}

// --- client invoices ----------------------------------------------------

/**
 * Draft the client invoice for a campaign — one line per booking line, at the
 * client charge ex VAT. It is raised as a Draft on purpose: nothing leaves the
 * building until someone has read it, edited the wording and pushed it to Xero.
 */
export async function generateClientInvoice(campaignId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const { data: campaign } = await supabase
    .from("campaigns")
    .select(
      `id, ref, name, fee, client_id, client_po,
       campaign_lines ( id, channel, vendor, publication, detail, line_type,
                        start_date, end_date, client_charge, supplier_gross, supplier_net )`
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return { error: "Campaign not found." };

  const c = campaign as unknown as Campaign & { client_id: string | null; client_po: string | null };
  const lines = draftInvoiceLines(c);
  const amount = lines.reduce((a, l) => a + l.net, 0);
  if (!amount) return { error: "Nothing to invoice — the campaign has no client charges." };

  const today = new Date().toISOString().slice(0, 10);
  const invoiceDate = monthEnd(today);

  // No number is minted here. ADEX's invoices run one sequence — 18824, 18825,
  // 18826 — owned by Xero, so the number is whatever Xero returns when the
  // draft is pushed. Two systems both handing out numbers would collide.
  const { data: created, error } = await supabase
    .from("client_invoices")
    .insert({
      campaign_id: campaignId,
      client_id: c.client_id,
      amount_ex_vat: amount,
      outstanding: amount,
      client_po: c.client_po,
      invoice_date: invoiceDate,
      due_date: dueAfter(invoiceDate),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const invoiceId = (created as { id: string }).id;
  const { error: lineError } = await supabase.from("client_invoice_lines").insert(
    lines.map((l, i) => ({
      invoice_id: invoiceId,
      campaign_line_id: l.campaignLineId,
      description: l.description,
      net: l.net,
      sort_order: i,
    }))
  );
  // A header with no lines would print as a blank invoice, which is worse than
  // no invoice at all — so take it back out rather than leave it half-made.
  if (lineError) {
    await supabase.from("client_invoices").delete().eq("id", invoiceId);
    return { error: lineError.message };
  }

  revalidatePath("/finance");
  return { invoiceId };
}

/**
 * Save the edited invoice. Lines are replaced wholesale rather than diffed —
 * the account handler reorders, merges and rewrites them, so matching up the
 * old rows would be guesswork.
 */
export async function saveClientInvoice(
  invoiceId: string,
  lines: { campaignLineId: string | null; description: string; net: string }[],
  clientPo: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const { data: invoice } = await supabase
    .from("client_invoices")
    .select("id, status, xero_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return { error: "Invoice not found." };
  const head = invoice as { status: string; xero_id: string | null };
  // Once it has gone to the client the figures are a matter of record.
  if (head.status !== "Draft") {
    return { error: "Only a draft invoice can be edited. Credit it instead." };
  }
  // And once Xero holds it, Xero is the record. Editing here would leave the
  // two disagreeing with no way to tell which is right.
  if (head.xero_id) {
    return { error: "This invoice is in Xero now. Edit it there." };
  }

  const clean = lines
    .map((l) => ({
      campaign_line_id: l.campaignLineId,
      description: l.description.trim(),
      net: Number(String(l.net).replace(/[^0-9.-]/g, "")) || 0,
    }))
    .filter((l) => l.description || l.net);
  if (!clean.length) return { error: "An invoice needs at least one line." };

  const amount = clean.reduce((a, l) => a + l.net, 0);

  await supabase.from("client_invoice_lines").delete().eq("invoice_id", invoiceId);
  const { error } = await supabase.from("client_invoice_lines").insert(
    clean.map((l, i) => ({ ...l, invoice_id: invoiceId, sort_order: i }))
  );
  if (error) return { error: error.message };

  const { error: headError } = await supabase
    .from("client_invoices")
    .update({
      amount_ex_vat: amount,
      outstanding: amount,
      client_po: clientPo.trim() || null,
    })
    .eq("id", invoiceId);
  if (headError) return { error: headError.message };

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/finance");
  return {};
}

export async function setInvoiceStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("client_invoices").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/finance");
  return {};
}

// --- contacts -----------------------------------------------------------

export type ContactInput = {
  id?: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  organisation: string;
  email: string;
  phone: string;
  mobile: string;
  linkedin: string;
  notes: string;
  status: string;
  ownerId: string;
  leadId?: string;
};

export async function saveContact(input: ContactInput) {
  const supabase = await createClient();
  const { user, role } = await meWithRole(supabase);
  if (!user) return { error: "You need to be signed in." };
  if (!input.firstName.trim()) return { error: "Give the contact a first name." };
  if (!input.organisation.trim()) return { error: "Every contact needs an organisation." };

  const ownerId = ownerFor(role, user.id, input.ownerId);

  // A contact belongs to an organisation. Matching the typed company name to an
  // existing organisation (or creating one) is what stops the free-text company
  // problem coming back.
  const { data: orgId } = await supabase.rpc("find_or_create_organisation", {
    p_name: input.organisation.trim(),
    p_sector: null,
    p_owner: ownerId,
  });

  const row = {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim() || null,
    job_title: input.jobTitle.trim() || null,
    organisation: input.organisation.trim(),
    organisation_id: (orgId as string | null) ?? null,
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    mobile: input.mobile.trim() || null,
    linkedin: input.linkedin.trim() || null,
    notes: input.notes.trim() || null,
    status: input.status,
    owner_id: ownerId,
    lead_id: input.leadId || null,
  };

  const { error } = input.id
    ? await supabase.from("contacts").update(row).eq("id", input.id)
    : await supabase.from("contacts").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/contacts");
  return {};
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contacts");
  return {};
}

/**
 * The compulsory Closed Won step: the organisation becomes a client, an
 * empty campaign opens ready to book, a task chases the booking, and the
 * organisation's contacts flip to Client status.
 */
async function promoteWonLead(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string
): Promise<{ error?: string; campaignRef?: string }> {
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, value, owner_id, sector, organisation_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { error: "That opportunity could not be found." };

  // Winning the work makes the company an active client. Recorded as a tracked
  // status change with its reason, not a silent overwrite.
  const orgId =
    (lead.organisation_id as string | null) ??
    ((
      await supabase.rpc("find_or_create_organisation", {
        p_name: lead.name,
        p_sector: lead.sector,
        p_owner: lead.owner_id,
      })
    ).data as string | null);

  if (orgId) {
    await supabase.rpc("set_organisation_status", {
      p_org: orgId,
      p_status: "active_client",
      p_reason: `Won opportunity: ${lead.name}`,
    });
  }

  // 1. Client record (find or create by name).
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", lead.name)
    .maybeSingle();

  let clientId = existing?.id as string | undefined;
  if (!clientId) {
    const { data: created, error: clientError } = await supabase
      .from("clients")
      .insert({
        name: lead.name,
        sector: lead.sector,
        owner_id: lead.owner_id,
        status: "live",
      })
      .select("id")
      .single();
    if (clientError) {
      return { error: `Couldn't create the client record: ${clientError.message}` };
    }
    clientId = created?.id;
  }
  if (!clientId) return { error: "Couldn't create the client record." };

  // 2. An open campaign shell, ready for booking lines. Uses the same counter
  //    as the booking form — this had its own copy of the broken text-sort
  //    logic, so a won deal could collide with a booked campaign.
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      ref: await nextRef(supabase),
      name: `${lead.name} — first campaign`,
      client_id: clientId,
      client_org_id: orgId,
      status: "planning",
      owner_id: lead.owner_id,
      note: `Auto-created when the ${lead.name} deal closed won (£${Number(lead.value).toLocaleString("en-GB")}). Add booking lines.`,
    })
    .select("id, ref")
    .single();

  // This is where the promotion used to fail invisibly: a duplicate reference
  // made the insert fail, the error was discarded, and Closed Won appeared to
  // do nothing at all.
  if (campaignError) {
    return {
      error: `The client was created, but the campaign was not: ${campaignError.message}`,
    };
  }

  // 3. The booking task that makes the step compulsory.
  await supabase.from("tasks").insert({
    title: `Book campaign for ${lead.name}`,
    notes: `Deal closed won at £${Number(lead.value).toLocaleString("en-GB")}. ${campaign ? `Campaign ${campaign.ref} is open — add the booking lines.` : "Open the campaign and add booking lines."}`,
    due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    kind: "follow-up",
    assignee_id: lead.owner_id,
    campaign_id: campaign?.id ?? null,
    client_id: clientId,
    lead_id: lead.id,
  });

  // 4. Contacts at that organisation become client contacts.
  await supabase
    .from("contacts")
    .update({ status: "Client", client_id: clientId })
    .eq("lead_id", lead.id);
  await supabase
    .from("contacts")
    .update({ status: "Client", client_id: clientId })
    .ilike("organisation", lead.name)
    .is("client_id", null);

  revalidatePath("/organisations");
  revalidatePath("/campaigns");
  revalidatePath("/tasks");
  revalidatePath("/contacts");
  return { campaignRef: campaign?.ref as string | undefined };
}

// --- pipeline -----------------------------------------------------------

export type LeadInput = {
  id?: string;
  name: string;
  contact: string;
  sector: string;
  value: string;
  stage: string;
  ownerId: string;
  nextAction: string;
  /** Which channels are on the table — enough to tell one offer from another. */
  channels: string[];
  /** What's being proposed, in plain words. */
  proposalNote: string;
};

export async function saveLead(input: LeadInput) {
  const supabase = await createClient();
  const { user, role } = await meWithRole(supabase);
  if (!user) return { error: "You need to be signed in." };
  const name = input.name.trim();
  if (!name) return { error: "Give the opportunity a name." };

  const ownerId = ownerFor(role, user.id, input.ownerId);

  // Organisations are the master company record, so an opportunity always has
  // one — found by name, or created as a prospect if this company is new.
  const { data: orgId } = await supabase.rpc("find_or_create_organisation", {
    p_name: name,
    p_sector: input.sector.trim() || null,
    p_owner: ownerId,
  });

  const row = {
    name,
    contact: input.contact.trim() || null,
    sector: input.sector.trim() || null,
    value: money(input.value),
    stage: input.stage,
    owner_id: ownerId,
    next_action: input.nextAction.trim() || null,
    organisation_id: (orgId as string | null) ?? null,
    channels: input.channels.length ? input.channels : null,
    proposal_note: input.proposalNote.trim() || null,
  };

  let becameWon = false;
  if (input.id) {
    const { data: before } = await supabase
      .from("leads")
      .select("stage")
      .eq("id", input.id)
      .maybeSingle();
    becameWon = before?.stage !== "Closed Won" && input.stage === "Closed Won";
    const { error } = await supabase.from("leads").update(row).eq("id", input.id);
    if (error) return { error: error.message };
    if (becameWon) {
      const promo = await promoteWonLead(supabase, input.id);
      if (promo.error) return { error: promo.error };
    }
  } else {
    const { data: created, error } = await supabase
      .from("leads")
      .insert(row)
      .select("id")
      .single();
    if (error) return { error: error.message };
    if (input.stage === "Closed Won" && created) {
      const promo = await promoteWonLead(supabase, created.id);
      if (promo.error) return { error: promo.error };
    }
  }

  revalidatePath("/pipeline");
  revalidatePath("/");
  return { promoted: becameWon || input.stage === "Closed Won" };
}

export async function moveLeadStage(id: string, stage: string) {
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("leads")
    .select("stage")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("leads").update({ stage }).eq("id", id);
  if (error) return { error: error.message };
  if (before?.stage !== "Closed Won" && stage === "Closed Won") {
    // Dragging a card to Closed Won is the most common way this runs, so a
    // failure here must reach the user rather than disappearing.
    const promo = await promoteWonLead(supabase, id);
    if (promo.error) return { error: promo.error };
  }
  revalidatePath("/pipeline");
  revalidatePath("/");
  return {};
}

export async function deleteLead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/pipeline");
  return {};
}

// --- creative -----------------------------------------------------------

export type CreativeInput = {
  id?: string;
  item: string;
  clientId: string;
  format: string;
  spec: string;
  dueDate: string;
  stage: string;
  ownerId: string;
  designSource: "inhouse" | "client";
};

export async function saveCreativeItem(input: CreativeInput) {
  const supabase = await createClient();
  const { user, role } = await meWithRole(supabase);
  if (!user) return { error: "You need to be signed in." };
  if (!input.item.trim()) return { error: "Give the item a name." };

  const row = {
    item: input.item.trim(),
    client_id: input.clientId || null,
    format: input.format.trim() || null,
    spec: input.spec.trim() || null,
    due_date: input.dueDate || null,
    stage: input.stage,
    owner_id: ownerFor(role, user.id, input.ownerId),
    design_source: input.designSource,
  };

  const { error } = input.id
    ? await supabase.from("creative_items").update(row).eq("id", input.id)
    : await supabase.from("creative_items").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/creative");
  return {};
}

export async function moveCreativeStage(id: string, stage: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("creative_items").update({ stage }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/creative");
  return {};
}

export async function deleteCreativeItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("creative_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/creative");
  return {};
}

/** Remove a campaign and its booking lines. Its purchase orders go with it. */
export async function deleteCampaign(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/campaigns");
  revalidatePath("/finance");
  revalidatePath("/media-plan");
  revalidatePath("/");
  return {};
}

export async function updateCampaignStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/campaigns");
  revalidatePath("/");
  return {};
}

// --- space orders --------------------------------------------------------

/**
 * Save the "To:" contact and order notes on a booking line, so reprinting a
 * Space Order gives the same document rather than a blank one.
 */
export async function saveSpaceOrderDetails(
  orderId: string,
  supplierContact: string,
  orderNotes: string
) {
  const supabase = await createClient();
  const { user, role } = await meWithRole(supabase);
  if (!user) return { error: "You need to be signed in." };
  if (role === "restricted") return { error: RESTRICTED_NO_BOOKING };

  // These live on the order, not the line — one order can cover several lines.
  const { error } = await supabase
    .from("space_orders")
    .update({
      supplier_contact: supplierContact.trim() || null,
      order_notes: orderNotes.trim() || null,
    })
    .eq("id", orderId);

  if (error) return { error: error.message };
  revalidatePath(`/space-orders/${orderId}`);
  revalidatePath("/finance");
  return {};
}

// --- organisations -------------------------------------------------------

export type OrganisationInput = {
  id?: string;
  name: string;
  sector: string;
  ownerId: string;
  isSupplier: boolean;
  customerStatus: string;
  /** Reason for a status change — recorded in the organisation's history. */
  statusReason: string;
  companiesHouseNo: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  phone: string;
  notes: string;
  archived: boolean;
  /**
   * Optional first contact, so a new company and the person you deal with can
   * be added in one go. Entirely optional — leave the name blank and no contact
   * is created, because you often log a company before you have a name.
   */
  contactFirstName?: string;
  contactLastName?: string;
  contactJobTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
};

/** Create or update an organisation, recording any status change with its reason. */
export async function saveOrganisation(input: OrganisationInput) {
  const supabase = await createClient();
  const { user, role } = await meWithRole(supabase);
  if (!user) return { error: "You need to be signed in." };

  const name = input.name.trim();
  if (!name) return { error: "Give the organisation a name." };

  const row = {
    name,
    sector: input.sector.trim() || null,
    owner_id: ownerFor(role, user.id, input.ownerId),
    is_supplier: input.isSupplier,
    companies_house_no: input.companiesHouseNo.trim() || null,
    website: input.website.trim() || null,
    address_line1: input.addressLine1.trim() || null,
    address_line2: input.addressLine2.trim() || null,
    city: input.city.trim() || null,
    postcode: input.postcode.trim() || null,
    country: input.country.trim() || null,
    phone: input.phone.trim() || null,
    notes: input.notes.trim() || null,
    archived: input.archived,
  };

  let id = input.id;

  if (id) {
    const { error } = await supabase.from("organisations").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("organisations")
      .insert({ ...row, customer_status: input.customerStatus })
      .select("id")
      .single();
    if (error) {
      return {
        error: /duplicate|unique/i.test(error.message)
          ? `An organisation called "${name}" already exists.`
          : error.message,
      };
    }
    id = data.id as string;
  }

  // Status goes through the dedicated function so the change is recorded with
  // its reason, rather than silently overwriting the previous value.
  if (input.id) {
    const { error } = await supabase.rpc("set_organisation_status", {
      p_org: id,
      p_status: input.customerStatus,
      p_reason: input.statusReason.trim() || null,
    });
    if (error) return { error: error.message };
  }

  // Optional first contact. Only created when a first name is given, and only
  // for a brand-new organisation — editing an existing one uses "Add contact".
  const contactName = (input.contactFirstName ?? "").trim();
  if (!input.id && contactName && id) {
    const { error: contactError } = await supabase.from("contacts").insert({
      first_name: contactName,
      last_name: (input.contactLastName ?? "").trim() || null,
      job_title: (input.contactJobTitle ?? "").trim() || null,
      organisation: name,
      organisation_id: id,
      email: (input.contactEmail ?? "").trim() || null,
      phone: (input.contactPhone ?? "").trim() || null,
      status: "Prospect",
      owner_id: ownerFor(role, user.id, input.ownerId),
    });
    // The organisation saved fine — say the contact didn't rather than
    // pretending the whole thing failed.
    if (contactError) {
      revalidatePath("/organisations");
      return {
        id,
        error: `${name} was created, but the contact was not: ${contactError.message}`,
      };
    }
    revalidatePath("/contacts");
  }

  revalidatePath("/organisations");
  revalidatePath(`/organisations/${id}`);
  return { id };
}

/**
 * Make sure every supplier on a campaign has exactly one Space Order, and that
 * their lines point at it.
 *
 * Migration 0010 grouped the campaigns that existed at the time, but nothing
 * created orders for campaigns booked afterwards — so newly booked work had no
 * Space Order to generate. Called after booking and after editing, and safe to
 * run repeatedly: it only fills in what is missing.
 *
 * Rick's rule: one order per supplier, never several. ITV1 and ITVQuiz are
 * separate lines at different rates but go on one order to ITV.
 */
async function syncSpaceOrders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string
) {
  const { data: lineRows } = await supabase
    .from("campaign_lines")
    .select("id, vendor, supplier_po, space_order_id")
    .eq("campaign_id", campaignId);

  const lines = (lineRows ?? []) as {
    id: string;
    vendor: string | null;
    supplier_po: string | null;
    space_order_id: string | null;
  }[];

  // Group by supplier, case- and whitespace-insensitively, to match the unique
  // index on space_orders.
  const groups = new Map<string, { vendor: string; po: string | null; lineIds: string[] }>();
  for (const l of lines) {
    const vendor = (l.vendor ?? "").trim();
    if (!vendor) continue;
    const key = vendor.toLowerCase();
    const g = groups.get(key) ?? { vendor, po: null, lineIds: [] };
    g.lineIds.push(l.id);
    // The order carries the earliest number its lines hold, as the backfill did.
    if (l.supplier_po && (!g.po || l.supplier_po < g.po)) g.po = l.supplier_po;
    groups.set(key, g);
  }

  const { data: existing } = await supabase
    .from("space_orders")
    .select("id, supplier_name")
    .eq("campaign_id", campaignId);

  const bySupplier = new Map(
    ((existing ?? []) as { id: string; supplier_name: string }[]).map((o) => [
      o.supplier_name.trim().toLowerCase(),
      o.id,
    ])
  );

  for (const [key, g] of groups) {
    let orderId = bySupplier.get(key);

    // Suppliers become organisations too, so they gain contacts and an address
    // rather than staying as loose text on a booking line.
    const { data: supplierOrgId } = await supabase.rpc("find_or_create_organisation", {
      p_name: g.vendor,
      p_sector: null,
      p_owner: null,
    });
    if (supplierOrgId) {
      await supabase
        .from("organisations")
        .update({ is_supplier: true })
        .eq("id", supplierOrgId as string);
    }

    if (!orderId) {
      const { data: created } = await supabase
        .from("space_orders")
        .insert({
          campaign_id: campaignId,
          supplier_org_id: (supplierOrgId as string | null) ?? null,
          supplier_name: g.vendor,
          order_number: g.po,
        })
        .select("id")
        .single();
      orderId = created?.id as string | undefined;
    }

    if (orderId) {
      await supabase
        .from("campaign_lines")
        .update({
          space_order_id: orderId,
          supplier_org_id: (supplierOrgId as string | null) ?? null,
        })
        .in("id", g.lineIds);
    }
  }
}
