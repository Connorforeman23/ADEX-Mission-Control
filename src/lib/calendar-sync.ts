import "server-only";

import { graph } from "@/lib/microsoft";
import { createClient } from "@/lib/supabase/server";
import { ADEX_DOMAIN } from "@/lib/mail-sync";

// Tasks and the Outlook calendar.
//
// Rick's rule, and the right one: Outlook is the master calendar. The CRM
// writes exactly one kind of entry — a task the person themselves gave a time
// to — and reads meetings back to show them against the client. It never
// invites anyone, never edits a meeting it did not create, and never touches
// anybody else's calendar.

/** A task's calendar entry runs an hour unless it says otherwise. */
const DEFAULT_MINUTES = 60;

type GraphEvent = {
  id: string;
  subject?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
  organizer?: { emailAddress?: { address?: string } };
  attendees?: { emailAddress?: { address?: string } }[];
  webLink?: string;
};

/**
 * Put a timed task into the person's own calendar, or update the entry if it
 * is already there. Returns the Outlook id so the task can remember it.
 */
export async function upsertTaskEvent(task: {
  id: string;
  title: string;
  notes: string | null;
  due_date: string;
  due_time: string;
  ms_event_id: string | null;
  about?: string | null;
}): Promise<string> {
  const start = `${task.due_date}T${task.due_time.length === 5 ? task.due_time : task.due_time.slice(0, 5)}:00`;
  const end = new Date(new Date(start).getTime() + DEFAULT_MINUTES * 60_000)
    .toISOString()
    .slice(0, 19);

  const body = {
    subject: task.title,
    body: {
      contentType: "text",
      content: [task.notes, task.about ? `About: ${task.about}` : null, "Raised in ADEX Mission Control."]
        .filter(Boolean)
        .join("\n\n"),
    },
    // Europe/London so a 10:30 task is 10:30 to the person, through the
    // clocks changing — a plain UTC time would drift by an hour in summer.
    start: { dateTime: start, timeZone: "Europe/London" },
    end: { dateTime: end, timeZone: "Europe/London" },
    // Nobody is invited. This is a note to self, not a meeting request.
    isReminderOn: true,
    reminderMinutesBeforeStart: 15,
  };

  if (task.ms_event_id) {
    await graph(`/me/events/${task.ms_event_id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return task.ms_event_id;
  }

  const created = await graph<{ id: string }>("/me/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return created.id;
}

/** Remove the entry when a task loses its time, or is done or deleted. */
export async function removeTaskEvent(eventId: string) {
  try {
    await graph(`/me/events/${eventId}`, { method: "DELETE" });
  } catch {
    // Already gone from Outlook — someone deleted it there. Nothing to do.
  }
}

export type MeetingSync = { read: number; filed: number; skipped: number };

/**
 * Read the person's meetings and file the ones with a company we know.
 *
 * Matched exactly as emails are: on a known contact's address first, then on
 * an organisation's domain. An internal meeting is never stored.
 */
export async function syncMyMeetings(daysBack = 30, daysForward = 60): Promise<MeetingSync> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in.");

  const [{ data: domainRows }, { data: contactRows }] = await Promise.all([
    supabase.from("organisation_domains").select("organisation_id, domain"),
    supabase.from("contacts").select("id, email, organisation_id").not("email", "is", null),
  ]);

  const orgByDomain = new Map<string, string>();
  for (const r of (domainRows ?? []) as { organisation_id: string; domain: string }[]) {
    if (r.domain) orgByDomain.set(r.domain.toLowerCase(), r.organisation_id);
  }
  const contactByEmail = new Map<string, { id: string; organisation_id: string | null }>();
  for (const c of (contactRows ?? []) as { id: string; email: string; organisation_id: string | null }[]) {
    if (c.email) contactByEmail.set(c.email.toLowerCase(), { id: c.id, organisation_id: c.organisation_id });
  }

  const from = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  const to = new Date(Date.now() + daysForward * 86_400_000).toISOString();
  const res = await graph<{ value: GraphEvent[] }>(
    `/me/calendarView?startDateTime=${from}&endDateTime=${to}` +
      "&$select=id,subject,start,end,location,organizer,attendees,webLink&$top=100&$orderby=start/dateTime"
  );

  const events = res.value ?? [];
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const e of events) {
    const people = [
      (e.organizer?.emailAddress?.address ?? "").toLowerCase(),
      ...(e.attendees ?? []).map((a) => (a.emailAddress?.address ?? "").toLowerCase()),
    ].filter(Boolean);

    const outsiders = people.filter((p) => (p.split("@")[1] ?? "") !== ADEX_DOMAIN);
    if (!outsiders.length) {
      skipped++;
      continue;
    }

    let organisationId: string | null = null;
    let contactId: string | null = null;
    for (const p of outsiders) {
      const c = contactByEmail.get(p);
      if (c?.organisation_id) {
        organisationId = c.organisation_id;
        contactId = c.id;
        break;
      }
    }
    if (!organisationId) {
      for (const p of outsiders) {
        const org = orgByDomain.get(p.split("@")[1] ?? "");
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

    rows.push({
      ms_event_id: e.id,
      subject: e.subject ?? null,
      starts_at: e.start?.dateTime ? new Date(e.start.dateTime + "Z").toISOString() : new Date().toISOString(),
      ends_at: e.end?.dateTime ? new Date(e.end.dateTime + "Z").toISOString() : null,
      location: e.location?.displayName ?? null,
      organiser_email: e.organizer?.emailAddress?.address ?? null,
      attendees: outsiders,
      web_link: e.webLink ?? null,
      organisation_id: organisationId,
      contact_id: contactId,
      captured_by: user.id,
    });
  }

  if (rows.length) {
    // Upserting rather than ignoring duplicates: a meeting that moves in
    // Outlook should move here too — Outlook is the master.
    const { error } = await supabase.from("meetings").upsert(rows, { onConflict: "ms_event_id" });
    if (error) throw new Error(`Could not save the meetings: ${error.message}`);
  }

  return { read: events.length, filed: rows.length, skipped };
}
