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
    })
    .select("id, ref")
    .single();

  if (campaignError) return { error: `Couldn't save the campaign: ${campaignError.message}` };

  const { error: linesError } = await supabase.from("campaign_lines").insert(
    lines.map((l) => ({
      campaign_id: campaign.id,
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
      client_charge: money(l.client_charge) || money(l.supplier_gross),
    }))
  );

  if (linesError) {
    // Don't leave a campaign with no lines behind.
    await supabase.from("campaigns").delete().eq("id", campaign.id);
    return { error: `Couldn't save the booking lines: ${linesError.message}` };
  }

  revalidatePath("/campaigns");
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

export async function updateCampaignStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/campaigns");
  revalidatePath("/");
  return {};
}
