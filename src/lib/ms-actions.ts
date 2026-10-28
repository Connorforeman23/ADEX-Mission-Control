"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { graph, msClientId, msConfigured, msTenant } from "@/lib/microsoft";
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
    clientId: msClientId() || null,
    tenant: msTenant() || null,
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
      clientId: msClientId() || null,
      tenant: msTenant() || null,
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

    // Deliberately does NOT mark the connection as synced: this reads five
    // messages and keeps none, so recording it as a sync would make the next
    // real sync think it had already caught up and skip three months of mail.
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

/**
 * Pull this person's recent mail and file what belongs to a client or supplier.
 *
 * User-triggered, deliberately: it runs as them, with their token, under their
 * session. Nothing reads anyone's mailbox when they are not signed in, which is
 * what keeps the CRM's "no god-mode key" property intact.
 */
export async function syncMail(sinceDays?: number): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  try {
    const { syncMyMail } = await import("@/lib/mail-sync");
    const r = await syncMyMail(sinceDays);
    revalidatePath("/settings");
    return {
      ok: true,
      message:
        `Read ${r.read} message${r.read === 1 ? "" : "s"} since ${new Date(r.since).toLocaleDateString("en-GB")}. ` +
        `Filed ${r.filed} against a company; ignored ${r.skipped} as internal or unrecognised.` +
        (r.filed === 0 && r.read > 0
          ? " Nothing matched — that usually means the companies aren't in the CRM yet, or their contacts have no email addresses."
          : ""),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read your mailbox." };
  }
}

/**
 * Put a timed task into the person's own Outlook calendar — or take it out
 * when the time is removed, or the task is done.
 *
 * Called after a task is saved, and deliberately forgiving: a calendar that
 * didn't update must never stop a task being saved. It reports what happened
 * so the UI can say so, and says nothing when there was nothing to do.
 */
export async function syncTaskToCalendar(taskId: string): Promise<{ message: string | null }> {
  if (!msConfigured()) return { message: null };
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tasks")
      .select("id, title, notes, due_date, due_time, status, ms_event_id")
      .eq("id", taskId)
      .maybeSingle();
    if (!data) return { message: null };

    const t = data as {
      id: string;
      title: string;
      notes: string | null;
      due_date: string | null;
      due_time: string | null;
      status: string;
      ms_event_id: string | null;
    };

    const { upsertTaskEvent, removeTaskEvent } = await import("@/lib/calendar-sync");

    // No time, or finished with it — the calendar entry has no reason to exist.
    const wanted = t.status === "Open" && !!t.due_date && !!t.due_time;
    if (!wanted) {
      if (t.ms_event_id) {
        await removeTaskEvent(t.ms_event_id);
        await supabase.from("tasks").update({ ms_event_id: null }).eq("id", t.id);
        return { message: "Removed from your Outlook calendar." };
      }
      return { message: null };
    }

    const eventId = await upsertTaskEvent({
      id: t.id,
      title: t.title,
      notes: t.notes,
      due_date: t.due_date!,
      due_time: t.due_time!,
      ms_event_id: t.ms_event_id,
    });
    if (eventId !== t.ms_event_id) {
      await supabase.from("tasks").update({ ms_event_id: eventId }).eq("id", t.id);
    }
    return { message: t.ms_event_id ? "Updated in your Outlook calendar." : "Added to your Outlook calendar." };
  } catch (e) {
    // Never let a calendar problem lose someone's task.
    console.error("syncTaskToCalendar", e instanceof Error ? e.message : e);
    return { message: null };
  }
}

/** Read meetings back from Outlook and file the ones with a known company. */
export async function syncMeetings(): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  try {
    const { syncMyMeetings } = await import("@/lib/calendar-sync");
    const r = await syncMyMeetings();
    revalidatePath("/settings");
    return {
      ok: true,
      message:
        `Read ${r.read} calendar entr${r.read === 1 ? "y" : "ies"}. ` +
        `Filed ${r.filed} against a company; ignored ${r.skipped} as internal or unrecognised.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read your calendar." };
  }
}
