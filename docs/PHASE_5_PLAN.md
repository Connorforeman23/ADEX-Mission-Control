# Phase 5 — plan for Rick's second list (16 Sept 2026)

**Every package follows the same route:** branch → dev preview → Rick and
Connor test → PR → any migrations on production first → merge → smoke test.
Nothing on this list touches production until it has run on dev.

## Where things stand right now

Production is on **Phase 4** (PR #12, 15 Sept) with the database at 0016.
Two branches are on dev and **not yet live**:

| Branch | What | State |
|---|---|---|
| `reports-sales-by-owner` | Spend by client / assigned user / channel, one set of controls | Built, ready to test — **covers Rick's "Sales by Account/Owner" item** |
| `phase-4.2-mailbox` | Mailbox connection — proposal and IT request only | Waiting on IT for the Microsoft app registration |

---

## Package 5.1 — Quick fixes (one branch, one release)

Small, independent, no design questions. Rick's list, plus the four items still
open from his first review.

| # | Change | Where |
|---|---|---|
| 1 | Client PO number as a header field next to the invoice number, not a zero-value line | Invoice sheet |
| 2 | Accounts email (`Accounts@advertisingexcellence.co.uk`) on the invoice | Invoice sheet |
| 3 | Opportunity owner defaults to the signed-in user | Pipeline |
| 4 | Opportunity company is a dropdown of existing organisations (+ New organisation) | Pipeline |
| 5 | "Production (no commission)" → "Production" | Booking form |
| 6 | More production suppliers — **need the list from Rick** | Reference data |
| 7 | Per-line **commission override** — default stays 15%, a line can say otherwise (the GW example) | Booking form, Space Order, Finance |
| 8 | **Selected dates** validated and normalised: accepts `20 Oct`, `20.10.26`, `20/10/2026`; rejects nonsense; must fall inside the line's start–end | Booking form |
| 9 | Website unique on organisations — a second company with the same site is a duplicate | Organisations, migration |
| 10 | Links from a campaign to its Space Orders and invoices | Campaign drawer |
| 11 | Tasks link to a campaign, opportunity or organisation (all three, not just client) | Tasks |

**Migrations:** 0017 (commission override on lines, unique website).

---

## Package 5.2 — Organisations: what the client and supplier pages know

| # | Change | Notes |
|---|---|---|
| 1 | **POs and invoices as a view on the organisation** — every Space Order bought from a supplier, every invoice sent to a client | Query only |
| 2 | **Supplier default "mail to"** addresses for Space Orders, with Lynsey and Steve cc'd on all | Stored on the organisation; used by 4.4 (send from CRM) — until then, shown on the order so whoever emails it knows where |
| 3 | **Payment terms** dropdown on suppliers and clients: 30 / 45 / 60 days from date of publication, or from end of month | Drives the invoice **due date** instead of the fixed "25th of next month" — see decision A |

**Migrations:** 0018 (mail-to addresses, payment terms).

---

## Package 5.3 — Campaign operations

The three that change how campaigns behave. Each needs one decision before build.

| # | Change | Decision needed |
|---|---|---|
| 1 | **Copy a campaign into a new month** — same client, lines and prices, dates shifted, new reference and new Space Orders | Shift all dates by a month, or ask for the new start date? (Proposed: ask.) |
| 2 | **Multi-month bookings invoiced monthly** — Randox: one campaign, one invoice per month | **Decision B** — this changes the "one invoice per campaign" rule |
| 3 | **Pipeline + campaigns as one revenue view** — weighted pipeline value plus booked campaigns, by month | **Decision C** — what the view is for, and the weightings |

**Migrations:** 0019 (invoice periods).

---

## Package 5.4 — The account manager's view

The Dashboard is Steve's view of the business. Account managers need theirs:
**my** tasks due, **my** campaigns live and starting, **my** opportunities gone
quiet, **my** invoices outstanding, **my** Space Orders awaiting a supplier
invoice. Same page, a "Mine / Everyone" toggle, remembered per person.

No migration. Builds on the tasks links from 5.1.

---

## Packages 4.2 → 4.4 — Email, calendar and the activity timeline

Already proposed (`docs/4.2_MAILBOX_PROPOSAL.md`). Rick's items that land here:

| Item | Package |
|---|---|
| Email links on contacts and organisations | 4.2 |
| **Activity view on the organisation page** — tasks & reminders, emails, meeting notes and relationship history in one timeline, with type filters to hide what you don't want | 4.2 (emails) + 5.1 (tasks) merged into one view |
| **Steve emails a colleague → a task is created** | 4.2 mailbox + a rule: mail to a dedicated address (e.g. `tasks@`) or with a tag in the subject becomes a task for the recipient. Needs the mailbox connection first |
| Calendar link (meetings on the timeline) | 4.3 — one more Microsoft permission (`Calendars.Read`), same connection |
| Space Orders emailed from the CRM to the supplier's mail-to addresses, cc Lynsey and Steve | 4.4 |

**Blocked on:** IT returning the Microsoft app registration.

---

## Decisions needed before the packages that depend on them

**A. Payment terms and the due date (5.2).** Today every invoice is dated month
end and due the 25th of the next month — taken from the Randox invoices. With
terms per client (30/45/60 from publication or from month end), the due date
becomes a calculation. Proposed: the client's terms set the due date; the "25th"
rule becomes the default for clients with no terms recorded. Confirm.

**B. Monthly invoicing for multi-month campaigns (5.3).** The current rule —
one invoice per campaign — came from the Randox invoices and it holds for
most. Randox's own multi-month bookings break it. Proposed: a campaign can be
split into **invoice periods** (months); each period is its own invoice
carrying the lines that fall in it, with a multi-month line's charge split by
days in each month. Preview shows the split before anything is saved. The
"Invoiced" toggle on Reports then means "every period invoiced". Confirm the
split rule, or say if it's always an equal split by month.

**C. Pipeline + campaigns revenue view (5.3).** What question is it answering?
"What will we bill in November?" needs booked campaigns by start month plus
open opportunities weighted by stage (Engaged 40%, Proposal 70% today). If it's
instead "what's the total potential", weightings don't matter. Say which, and
whether the weightings are right.

**D. Production suppliers (5.1).** The list, from Rick.

---

## Order

| When | Package | Why this order |
|---|---|---|
| Now | Test and merge `reports-sales-by-owner` | Done, no migration, covers a month-end need |
| Next | **5.1 Quick fixes** | Biggest visible improvement for least risk; clears Rick's first list too |
| Then | **5.2 Organisations** | Needs decision A only; unblocks supplier mail-to for 4.4 |
| Then | **5.4 Account manager view** | No migration, no decisions, big win for the team |
| Then | **5.3 Campaign operations** | Needs decisions B and C; the most design in the list |
| When IT delivers | **4.2 Mailbox** → 4.3 → 4.4 | Independent of the above; slots in whenever the keys arrive |
| Alongside | **Historic import** | Sage exports + PO folder; the reports are only as good as what's loaded |

Each is a week or less of build once its decision is made; the constraint is
testing time, not building time.
