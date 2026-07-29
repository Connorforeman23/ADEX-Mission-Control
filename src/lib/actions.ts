"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LineInput = {
  id?: string;
  channel: string;
  vendor: string;
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

/** Next reference in the AE-#### series. */
async function nextRef(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("campaigns")
    .select("ref")
    .order("ref", { ascending: false })
    .limit(1);
  const last = data?.[0]?.ref as string | undefined;
  const n = last ? parseInt(last.replace(/\D/g, ""), 10) : 2600;
  return `AE-${(Number.isFinite(n) ? n : 2600) + 1}`;
}

export async function createCampaign(input: CampaignInput) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

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

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      ref: await nextRef(supabase),
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
      commission_pct: l.channel === "Creative" ? 0 : 15,
      client_charge: money(l.client_charge) || money(l.supplier_gross),
    });
    if (error) {
      // Don't leave a half-saved campaign behind.
      await supabase.from("campaigns").delete().eq("id", campaign.id);
      return { error: `Couldn't save the ${l.vendor} line: ${error.message}` };
    }
    inserted.push({ vendor: l.vendor, po: supplierPo });
  }

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
    commission_pct: l.channel === "Creative" ? 0 : 15,
    client_charge: money(l.client_charge) || money(l.supplier_gross),
  };
}

export async function updateCampaign(campaignId: string, input: CampaignInput) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

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

/** Raise the client invoice for a campaign at its gross ex VAT. */
export async function generateClientInvoice(campaignId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, ref, fee, campaign_lines ( client_charge )")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return { error: "Campaign not found." };

  type Row = { fee: number; campaign_lines: { client_charge: number }[] };
  const c = campaign as unknown as Row & { ref: string };
  const amount =
    c.campaign_lines.reduce((a, l) => a + Number(l.client_charge), 0) + Number(c.fee);
  if (!amount) return { error: "Nothing to invoice — the campaign has no client charges." };

  const { data: invoiceNo } = await supabase.rpc("next_po_number", { p_prefix: "INV" });

  const { error } = await supabase.from("client_invoices").insert({
    campaign_id: campaignId,
    invoice_no: typeof invoiceNo === "string" ? invoiceNo : null,
    amount_ex_vat: amount,
  });
  if (error) return { error: error.message };
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
};

export async function saveLead(input: LeadInput) {
  const supabase = await createClient();
  const name = input.name.trim();
  if (!name) return { error: "Give the opportunity a name." };

  const row = {
    name,
    contact: input.contact.trim() || null,
    sector: input.sector.trim() || null,
    value: money(input.value),
    stage: input.stage,
    owner_id: input.ownerId || null,
    next_action: input.nextAction.trim() || null,
  };

  const { error } = input.id
    ? await supabase.from("leads").update(row).eq("id", input.id)
    : await supabase.from("leads").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/pipeline");
  revalidatePath("/");
  return {};
}

export async function moveLeadStage(id: string, stage: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ stage }).eq("id", id);
  if (error) return { error: error.message };
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
  if (!input.item.trim()) return { error: "Give the item a name." };

  const row = {
    item: input.item.trim(),
    client_id: input.clientId || null,
    format: input.format.trim() || null,
    spec: input.spec.trim() || null,
    due_date: input.dueDate || null,
    stage: input.stage,
    owner_id: input.ownerId || null,
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
