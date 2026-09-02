"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClientInvoice } from "@/lib/queries";
import { fetchXeroContacts, xeroApi, xeroConfigured } from "@/lib/xero";
import type {
  LoadContactsResult,
  PushInvoiceResult,
  XeroContact,
  XeroInvoiceResult,
  XeroStatus,
} from "@/lib/xero-types";

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


/**
 * Push a client invoice to Xero as a DRAFT.
 *
 * Draft on purpose, twice over: nothing reaches a client from the CRM, and
 * someone in Xero still approves it. What we hand over is the schedule and the
 * amounts; Xero assigns the invoice number, because ADEX's numbers run one
 * sequence and only one system can own it.
 */
export async function pushInvoiceToXero(invoiceId: string): Promise<XeroInvoiceResult> {
  const supabase = await createClient();

  const invoice = await getClientInvoice(invoiceId);
  if (!invoice) return { ok: false, error: "Invoice not found." };
  if (invoice.status !== "Draft") {
    return { ok: false, error: "Only a draft invoice can be pushed to Xero." };
  }
  if (!invoice.lines.length) {
    return { ok: false, error: "This invoice has no lines." };
  }

  const { data: existing } = await supabase
    .from("client_invoices")
    .select("xero_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if ((existing as { xero_id: string | null } | null)?.xero_id) {
    return { ok: false, error: "This invoice is already in Xero." };
  }

  try {
    const contact = await findOrCreateXeroContact(invoice.client);

    const result = await xeroApi<{ Invoices?: { InvoiceID: string; InvoiceNumber?: string }[] }>(
      "/Invoices",
      {
        method: "POST",
        body: JSON.stringify({
          Invoices: [
            {
              Type: "ACCREC", // money owed to us
              Contact: { ContactID: contact.ContactID },
              Date: invoice.invoiceDate,
              DueDate: invoice.dueDate ?? invoice.invoiceDate,
              // Xero's Reference shows on the invoice — the client's own PO is
              // what they will match the payment against.
              Reference: invoice.clientPo
                ? `PO Number ${invoice.clientPo}`
                : invoice.campaignRef,
              Status: "DRAFT",
              // Our amounts are ex VAT, matching the Net Amount column.
              LineAmountTypes: "Exclusive",
              LineItems: invoice.lines.map((l) => ({
                Description: l.description,
                Quantity: 1,
                UnitAmount: l.net,
                AccountCode: "200", // Sales
                TaxType: "OUTPUT2", // UK standard rate, 20%
              })),
            },
          ],
        }),
      }
    );

    const created = result.Invoices?.[0];
    if (!created?.InvoiceID) {
      return { ok: false, error: "Xero accepted the request but returned no invoice." };
    }

    const { error } = await supabase
      .from("client_invoices")
      .update({ xero_id: created.InvoiceID, invoice_no: created.InvoiceNumber ?? null })
      .eq("id", invoiceId);
    if (error) {
      // The invoice exists in Xero either way — say so rather than let someone
      // push it a second time.
      return {
        ok: false,
        error: `Created in Xero (${created.InvoiceNumber ?? created.InvoiceID}) but could not be recorded here: ${error.message}`,
      };
    }

    await supabase.rpc("xero_mark_synced");
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/finance");

    return {
      ok: true,
      invoiceNumber: created.InvoiceNumber ?? null,
      message: `Draft invoice ${created.InvoiceNumber ?? ""} created in Xero for ${invoice.client}. Approve and send it there.`.replace(
        /\s+/g,
        " "
      ),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not write to Xero." };
  }
}

/** The client as Xero knows them, created if Xero has never seen them. */
async function findOrCreateXeroContact(name: string) {
  const where = encodeURIComponent(`Name=="${name.replace(/"/g, '\\"')}"`);
  const found = await xeroApi<{ Contacts?: XeroContact[] }>(`/Contacts?where=${where}`);
  const match = found.Contacts?.[0];
  if (match) return match;

  const created = await xeroApi<{ Contacts?: XeroContact[] }>("/Contacts", {
    method: "POST",
    body: JSON.stringify({ Contacts: [{ Name: name }] }),
  });
  const contact = created.Contacts?.[0];
  if (!contact) throw new Error(`Could not find or create "${name}" in Xero.`);
  return contact;
}
