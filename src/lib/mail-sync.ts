import "server-only";

import { graph } from "@/lib/microsoft";
import { createClient } from "@/lib/supabase/server";

// Reading a person's mailbox and filing what belongs to a client or supplier.
//
// The rule that makes connecting a mailbox acceptable: a message is kept ONLY
// when someone outside ADEX matches a company already in the CRM. Internal
// mail, personal mail and strangers are read and discarded in the same moment.

export const ADEX_DOMAIN = (process.env.ADEX_EMAIL_DOMAIN ?? "advertisingexcellence.co.uk")
  .trim()
  .toLowerCase();

/** How far back the first sync reaches. Rick's proposal: about three months. */
export const FIRST_SYNC_DAYS = 90;

type GraphAddress = { emailAddress?: { name?: string; address?: string } };
type GraphMessage = {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  from?: GraphAddress;
  sender?: GraphAddress;
  toRecipients?: GraphAddress[];
  ccRecipients?: GraphAddress[];
  receivedDateTime?: string;
  sentDateTime?: string;
  webLink?: string;
};

const addr = (a?: GraphAddress) => (a?.emailAddress?.address ?? "").toLowerCase();
const domainOf = (email: string) => email.split("@")[1] ?? "";

/** Strip HTML to something readable, for a message that has no plain text. */
function plain(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|tr|br)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type SyncResult = {
  read: number;
  filed: number;
  skipped: number;
  since: string;
};

/**
 * Pull the signed-in person's recent mail and file what matches.
 *
 * Runs as them, with their token, under their session — so this needs nobody
 * signed in at 3am and the CRM keeps its "no god-mode key" property.
 */
export async function syncMyMail(sinceDays?: number): Promise<SyncResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in.");

  // Which domains and addresses belong to which company.
  const [{ data: domainRows }, { data: contactRows }] = await Promise.all([
    supabase.from("organisation_domains").select("organisation_id, domain"),
    supabase.from("contacts").select("id, email, organisation_id").not("email", "is", null),
  ]);

  const orgByDomain = new Map<string, string>();
  for (const r of (domainRows ?? []) as { organisation_id: string; domain: string }[]) {
    if (r.domain) orgByDomain.set(r.domain.toLowerCase(), r.organisation_id);
  }
  const contactByEmail = new Map<string, { id: string; organisation_id: string | null }>();
  for (const c of (contactRows ?? []) as {
    id: string;
    email: string;
    organisation_id: string | null;
  }[]) {
    if (c.email) contactByEmail.set(c.email.toLowerCase(), { id: c.id, organisation_id: c.organisation_id });
  }

  // Where to start: the last sync, or three months on the first run.
  const { data: conn } = await supabase.rpc("ms_my_connection");
  const lastSync = (conn as unknown as { last_sync_at: string | null }[])?.[0]?.last_sync_at;
  const days = sinceDays ?? (lastSync ? 0 : FIRST_SYNC_DAYS);
  const since = days
    ? new Date(Date.now() - days * 86_400_000).toISOString()
    : new Date(new Date(lastSync!).getTime() - 86_400_000).toISOString(); // a day's overlap

  const select =
    "id,conversationId,subject,bodyPreview,body,from,sender,toRecipients,ccRecipients,receivedDateTime,sentDateTime,webLink";

  let url =
    `/me/messages?$select=${select}` +
    `&$filter=receivedDateTime ge ${since}` +
    `&$orderby=receivedDateTime desc&$top=50`;

  let read = 0;
  let filed = 0;
  let skipped = 0;
  const rows: Record<string, unknown>[] = [];

  // Follow Microsoft's paging, but stop at a sane ceiling: a first sync of a
  // busy mailbox is thousands of messages and this runs in a web request.
  for (let page = 0; page < 20 && url; page++) {
    const res = await graph<{ value: GraphMessage[]; "@odata.nextLink"?: string }>(url);
    const batch = res.value ?? [];
    read += batch.length;

    for (const m of batch) {
      const from = addr(m.from) || addr(m.sender);
      const to = (m.toRecipients ?? []).map(addr).filter(Boolean);
      const cc = (m.ccRecipients ?? []).map(addr).filter(Boolean);
      const everyone = [from, ...to, ...cc].filter(Boolean);

      // Anyone outside ADEX. Internal-only mail never enters the CRM — that is
      // what makes connecting a mailbox acceptable to the person doing it.
      const outsiders = everyone.filter((e) => domainOf(e) !== ADEX_DOMAIN);
      if (!outsiders.length) {
        skipped++;
        continue;
      }

      // Match on a known contact's exact address first — that is the only way
      // a @gmail.com contact can ever match — then on a company domain.
      let organisationId: string | null = null;
      let contactId: string | null = null;
      for (const e of outsiders) {
        const c = contactByEmail.get(e);
        if (c?.organisation_id) {
          organisationId = c.organisation_id;
          contactId = c.id;
          break;
        }
      }
      if (!organisationId) {
        for (const e of outsiders) {
          const org = orgByDomain.get(domainOf(e));
          if (org) {
            organisationId = org;
            break;
          }
        }
      }
      if (!organisationId) {
        skipped++;
        continue;
      }

      const bodyRaw = m.body?.content ?? "";
      const body = m.body?.contentType === "html" ? plain(bodyRaw) : bodyRaw.trim();

      rows.push({
        ms_message_id: m.id,
        conversation_id: m.conversationId ?? null,
        subject: m.subject ?? null,
        preview: (m.bodyPreview ?? "").slice(0, 400) || null,
        body: body || null,
        from_name: m.from?.emailAddress?.name ?? m.sender?.emailAddress?.name ?? null,
        from_email: from || null,
        to_emails: to,
        cc_emails: cc,
        sent_at: m.sentDateTime ?? m.receivedDateTime ?? new Date().toISOString(),
        direction: domainOf(from) === ADEX_DOMAIN ? "out" : "in",
        web_link: m.webLink ?? null,
        organisation_id: organisationId,
        contact_id: contactId,
        captured_by: user.id,
      });
      filed++;
    }

    url = res["@odata.nextLink"] ?? "";
  }

  // One upsert on Microsoft's message id, so a thread sitting in four
  // colleagues' mailboxes is stored once rather than four times.
  if (rows.length) {
    const { error } = await supabase
      .from("emails")
      .upsert(rows, { onConflict: "ms_message_id", ignoreDuplicates: true });
    if (error) throw new Error(`Could not save the messages: ${error.message}`);
  }

  await supabase.rpc("ms_mark_synced");
  return { read, filed, skipped, since };
}
