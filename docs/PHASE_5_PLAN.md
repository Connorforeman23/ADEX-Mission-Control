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

## Decisions — answered (16–22 Sept)

**A. Payment terms and the due date.** ANSWERED: keep the 25th of the following
month as the default until a client's own terms are recorded. Built in 5.2 —
terms per organisation set the due date and the sentence at the foot of the
invoice; no terms recorded keeps the house default.

**B. Monthly invoicing for multi-month campaigns.** ANSWERED, and narrower than
proposed: **no splitting a line across months.** A line is invoiced whole, in
the month it runs. At the end of September ADEX invoices everything running in
October — so a line that starts and finishes inside October is invoiced then,
and nothing else is. Randox only, as a per-client setting; everyone else stays
one invoice per campaign. A line crossing a month end is taken as belonging to
the month it STARTS — confirm if it should be the month it finishes.

**C. Pipeline + campaigns revenue view.** ANSWERED: **do not merge them.**
Campaigns and pipeline stay separate on the dashboards, so committed revenue is
never blended with hoped-for revenue. No weighted forecast screen is being
built. Already true on both dashboards — nothing to do.

**D. Production suppliers.** Connor is sending the list.

**E. Role-based dashboards** — raised 22 Sept, built the same day. Admins keep
the business view with a Mine/Everyone toggle. Everyone else gets "My week":
their campaigns, follow-ups and their own money — billings, profit, and 15% of
profit as their commission, which is NOT the agency's 15% off supplier gross.
Two assumptions to confirm: commission counts on campaigns as BOOKED, not
invoiced or paid; and "recently won" means a campaign created in the last 30
days.

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
