# Phase 7 — Tasks, activities and Outlook

**Status: PROPOSAL for approval. Nothing built yet.**
Written against Connor's note of 29 September 2026. Supersedes the mailbox
half of `4.2_MAILBOX_PROPOSAL.md`; the safety design there still stands.

The governing principle is Connor's and it is the right one:

> **Outlook manages communication and appointments; the CRM manages
> relationships, activity history and actions.**

---

## The thing worth noticing first

**Roughly half of this needs no Microsoft connection at all.** Task types,
multiple links, manual activity logging, the organisation timeline, the
follow-up discipline and the exception report are all CRM-side. They have been
waiting behind an IT request they never needed.

So this splits in two, and **7A can start today**.

| | Package | Blocked? |
|---|---|---|
| **7A** | Tasks, activities, the organisation timeline, follow-up discipline | No — build now |
| **7B** | Email capture, calendar entries, meetings, the 09:30 reminder | Yes — Microsoft app registration |

---

## Package 7A — the relationship layer

### Tasks
Four types, as proposed: **Chase · Prep · Admin · Meeting**. The existing
types (follow-up, creative, copy-deadline, admin) map onto them, with
creative and copy-deadline becoming Prep.

**Status** replaces the current done/not-done tick: **Open · Done · Parked**.
Parked matters — it is what lets a prospect legitimately have no next action
without showing up on the exception report for ever.

**Multiple links.** A task can relate to several organisations, contacts,
campaigns and opportunities at once, rather than one of each. That is a join
table, and it changes how "relates to" is shown — a task can name two things.

### Completing a task
Ticking a task off opens a short panel: **what happened**, and **when next**.
The outcome becomes an activity on the timeline; the follow-up becomes the
next task, with preset intervals (tomorrow · next week · two weeks · a month ·
a custom date). Neither is compulsory — a task that needs no follow-up just
closes.

This is the mechanism that makes the follow-up discipline work. Without it,
"every prospect must have a future task" is a rule nobody can keep.

### Manual activities
Calls, WhatsApp, texts, meetings and notes, logged through one light form:
type, who, when, what happened, and what it relates to. Same links as tasks.

### The organisation timeline
One view on the organisation page, newest first, merging **activities,
completed tasks, relationship history** — and later, emails and meetings.
Filters along the top to hide types you don't want.

This replaces the separate "Relationship history" card rather than sitting
beside it.

### The exception report
Extends what the dashboards already flag. Active prospects with no future
task and not parked, plus overdue tasks, by owner. A page rather than a card,
so it can be worked through.

**Migration:** 0021 — task types, status, the links table, the activities
table.

---

## Package 7B — Outlook

Needs the Microsoft app registration, and **more permission than 4.2 asked
for**. The request to IT will have to be revised:

| Permission | For | In the 4.2 request? |
|---|---|---|
| `Mail.Read` | Email capture | Yes |
| `Calendars.Read` | Meetings into the CRM | No |
| `Calendars.ReadWrite` | Timed tasks creating Outlook entries | No — and this is a **write** to a person's calendar |
| `Mail.Send` | The 09:30 reminder | No |

`Calendars.ReadWrite` is the one IT will ask about. It lets the CRM put
entries in someone's calendar — not read it, write to it. That is a
reasonable thing to want and an unreasonable thing to grant without knowing
exactly what will use it: only a task the user themselves gave a time to,
and nothing else.

### Email capture
As Connor describes, with three things to settle below. Deduplicated on
Microsoft's message id so a cc'd thread is stored once, grouped into
conversations, three months of history on first connection.

### The 09:30 reminder
One email per person per morning: due and overdue tasks, prospects with no
next action, linking back to the CRM.

**This forces a decision the project has so far avoided.** Everything in
Mission Control runs as a signed-in person — there is no key that can read or
write the database on its own, which is what makes the security model hold.
A 09:30 job has nobody signed in. It needs a scheduled task with its own
credentials, scoped to exactly this job and nothing else. That is a real
change to the security posture and should be decided deliberately, not
slipped in. (Package 7C, with its own note.)

---

## Decisions needed

**1. Full email content — confirm, with eyes open.** 4.2 proposed storing
subject and the first 250 characters. This proposal stores everything. That is
defensible and more useful, but it means the CRM holds the complete
correspondence between ADEX and its clients and suppliers. Three consequences:

- **Volume.** Six mailboxes × three months of history, then ongoing. Manageable,
  but not free.
- **Who can read it.** "Authorised account users" needs defining. Proposed:
  any full-staff user sees any organisation's correspondence — that is the
  point of shared history — and restricted users see none of it. Say if it
  should instead be limited to the account owner.
- **Retention.** Mail kept for ever becomes a liability. Proposed: keep for
  two years, then delete the body and retain subject, date and participants.

**2. Public email domains.** Domain matching cannot apply to gmail.com,
hotmail.co.uk, outlook.com and the like — one contact at Gmail would pull in
every Gmail sender. Those match on the exact address only. Confirm.

**3. What "an external participant" means.** Proposed: any sender or recipient
outside advertisingexcellence.co.uk. Internal-only mail is never captured,
which is what makes connecting a mailbox acceptable to the person connecting
it.

**4. Task types.** Chase · Prep · Admin · Meeting — does Prep cover creative
deadlines and copy deadlines, or should Creative stay its own type? The
booking form raises creative tasks automatically today.

**5. The 09:30 job and its credentials** — see 7B. Decide when we get there,
not now.

---

## Order

1. **7A now** — no blockers, and it is most of the day-to-day value.
2. **Revised IT request** — send once the permission list above is agreed, so
   IT does the work once rather than three times.
3. **7B when IT delivers.**
4. **7C the scheduled job**, with its own security note.
