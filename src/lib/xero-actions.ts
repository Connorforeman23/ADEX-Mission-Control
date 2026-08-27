"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchXeroContacts, xeroApi, xeroConfigured } from "@/lib/xero";
import type { LoadContactsResult, PushInvoiceResult, XeroStatus } from "@/lib/xero-types";

// Server actions for the Xero panel. Every one goes through the admin-only
// definer functions, so a non-admin calling these directly gets refused by the
// database rather than relying on the UI hiding a button.
//
// This module exports ONLY async functions. Types live in xero-types.ts —
// exporting a type from a "use server" file makes it throw on load.

export async function getXeroStatus(): Promise<XeroStatus> {
  const configured = xeroConfigured();
  const blank = {
    configured,
    connected: false,
    tenantName: null,
    connectedAt: null,
    lastSyncAt: null,
  };

  // Nothing to query if Xero was never configured on this environment — and
  // asking anyway is a needless failure path.
  if (!configured) return blank;

  let data: unknown;
  try {
    const res = await createClient().then((c) => c.rpc("xero_status"));
    if (res.error) {
      console.error("xero_status", res.error.message);
      return blank;
    }
    data = res.data;
  } catch (e) {
    // Never let this throw — a failed status check must not hang the panel.
    console.error("xero_status", e instanceof Error ? e.message : e);
    return blank;
  }
  const row = (data as unknown as {
    connected: boolean;
    tenant_name: string | null;
    connected_at: string | null;
    last_sync_at: string | null;
  }[])?.[0];
  return {
    configured,
    connected: Boolean(row?.connected),
    tenantName: row?.tenant_name ?? null,
    connectedAt: row?.connected_at ?? null,
    lastSyncAt: row?.last_sync_at ?? null,
  };
}

export async function disconnectXero() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("xero_disconnect");
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

/** Proves the read path, and shows how Xero's contacts line up with organisations. */
export async function loadXeroContacts(): Promise<LoadContactsResult> {
  try {
    const contacts = await fetchXeroContacts();
    const supabase = await createClient();
    const { data: orgs } = await supabase.from("organisations").select("id, name");

    const byName = new Map(
      ((orgs ?? []) as { id: string; name: string }[]).map((o) => [o.name.trim().toLowerCase(), o])
    );

    const rows = contacts.slice(0, 100).map((c) => {
      const match = byName.get(c.Name.trim().toLowerCase());
      return {
        xeroId: c.ContactID,
        name: c.Name,
        email: c.EmailAddress ?? null,
        matchedOrg: match?.name ?? null,
      };
    });

    await supabase.rpc("xero_mark_synced");
    return { ok: true, rows, total: contacts.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read from Xero." };
  }
}

/**
 * Proves the write path. Creates a DRAFT invoice only — a human still approves
 * and sends it inside Xero, so nothing can reach a client from the CRM.
 */
export async function pushTestDraftInvoice(
  xeroContactId: string,
  contactName: string
): Promise<PushInvoiceResult> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await xeroApi<{ Invoices?: { InvoiceID: string; InvoiceNumber?: string }[] }>(
      "/Invoices",
      {
        method: "POST",
        body: JSON.stringify({
          Invoices: [
            {
              Type: "ACCREC", // money owed to us
              Contact: { ContactID: xeroContactId },
              Date: today,
              DueDate: today,
              Status: "DRAFT",
              LineItems: [
                {
                  Description: "ADEX Mission Control — connection test (safe to delete)",
                  Quantity: 1,
                  UnitAmount: 1.0,
                  AccountCode: "200",
                },
              ],
            },
          ],
        }),
      }
    );

    const invoice = result.Invoices?.[0];
    return {
      ok: true,
      message: `Draft invoice created in Xero for ${contactName}${
        invoice?.InvoiceNumber ? ` (${invoice.InvoiceNumber})` : ""
      }. It is a DRAFT — delete it in Xero when you're done.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not write to Xero." };
  }
}

