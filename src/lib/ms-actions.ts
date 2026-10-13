"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { graph, msConfigured } from "@/lib/microsoft";
import type { MsStatus } from "@/lib/ms-types";

// Server actions for the Microsoft panel. Everything acts as the signed-in
// person against their own mailbox — there is no company-wide connection.
//
// This module exports ONLY async functions; types live in ms-types.ts.

export async function getMsStatus(): Promise<MsStatus> {
  const configured = msConfigured();
  const blank: MsStatus = {
    configured,
    connected: false,
    accountEmail: null,
    accountName: null,
    connectedAt: null,
    lastSyncAt: null,
  };
  if (!configured) return blank;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("ms_my_connection");
    if (error) {
      console.error("ms_my_connection", error.message);
      return blank;
    }
    const row = (data as unknown as {
      connected: boolean;
      account_email: string | null;
      account_name: string | null;
      connected_at: string | null;
      last_sync_at: string | null;
    }[])?.[0];
    if (!row) return blank;
    return {
      configured,
      connected: true,
      accountEmail: row.account_email,
      accountName: row.account_name,
      connectedAt: row.connected_at,
      lastSyncAt: row.last_sync_at,
    };
  } catch (e) {
    // A failed status check must never hang the Settings page.
    console.error("ms status", e instanceof Error ? e.message : e);
    return blank;
  }
}

export async function disconnectMicrosoft() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ms_disconnect");
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

/**
 * Proves the connection actually works, before anything is built on it.
 *
 * Reads the five most recent messages and the next five calendar entries, and
 * reports what came back WITHOUT storing any of it. If a permission is missing
 * this is where it shows up, in one click, rather than halfway through a sync.
 */
export async function testMicrosoft(): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  try {
    const mail = await graph<{ value: { subject: string; from?: { emailAddress?: { address?: string } } }[] }>(
      "/me/messages?$top=5&$select=subject,from"
    );
    const cal = await graph<{ value: { subject: string; start?: { dateTime?: string } }[] }>(
      "/me/events?$top=5&$select=subject,start"
    );

    const supabase = await createClient();
    await supabase.rpc("ms_mark_synced");

    const latest = mail.value?.[0];
    return {
      ok: true,
      message:
        `Read ${mail.value?.length ?? 0} recent message${mail.value?.length === 1 ? "" : "s"}` +
        (latest ? ` (most recent: "${latest.subject || "no subject"}")` : "") +
        ` and ${cal.value?.length ?? 0} calendar entr${cal.value?.length === 1 ? "y" : "ies"}. ` +
        "Nothing was saved — this only proves the connection.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reach Microsoft." };
  }
}
