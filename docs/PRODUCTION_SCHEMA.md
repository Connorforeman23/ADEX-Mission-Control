# Production schema — verified 29 July 2026

Captured from the live database (`puolnlqpyupboehhahqf`) via a read-only query,
not inferred from files. This is the reference of record for Package 0.1.

## Tables (12) — all RLS ON

campaign_lines · campaigns · client_invoices · clients · contacts ·
creative_items · leads · po_counters · profiles · staff_roles ·
supplier_invoices · tasks

**staff_roles RLS is ON in production.** (The repository's `01_schema.sql` never
enabled it — confirmed drift, see below.)

## Functions (7, all SECURITY DEFINER)

can_see_client · guard_profile_fields · handle_new_user · is_restricted ·
is_staff_email · next_po_number · sync_campaign_statuses

## Triggers

profiles → `guard_profile_fields_trg`  (the 1.1 patch — confirmed live)
*(plus the auth.users → handle_new_user trigger, which lives in the auth schema
and isn't listed by the public-schema query)*

## RLS policies — as they actually are

| Table | Cmd | Rule |
|---|---|---|
| campaigns | ALL | not restricted OR own OR own client |
| campaign_lines | ALL | follows its campaign's rule |
| clients | ALL | not restricted OR owner |
| contacts | ALL | not restricted OR owner |
| creative_items | ALL | not restricted OR owner OR own client |
| leads | ALL | not restricted OR owner |
| tasks | ALL | not restricted OR assignee |
| client_invoices | ALL | not restricted |
| supplier_invoices | ALL | not restricted |
| po_counters | ALL | not restricted |
| profiles | SELECT | any authenticated user (H2 — everyone reads all profiles) |
| profiles | UPDATE | own row only, now field-guarded by 1.1 trigger |

---

## Repository vs production — the drift

| # | Difference | In repo? | In prod? | Severity |
|---|---|---|---|---|
| D-1 | `staff_roles` RLS | **OFF** (never enabled in 01) | **ON** | Must fix in baseline — a rebuild would be less secure than prod |
| D-2 | 1.1 role guard (policy + `guard_profile_fields` + trigger) | Only in `SECURITY_PATCH_1.1.sql` | **Live** | Must join the baseline |
| D-3 | `sync_campaign_statuses` function | In `07` | Live | Match — OK |
| D-4 | `client_invoices` columns `client_id`, `outstanding`, `vat`, `xero_id` | Added by `11` (the Randox import) | Live | Schema hidden in a data file — must become a migration |
| D-5 | `campaign_lines` columns `commission_pct`, `supplier_contact`, `line_type` + `supplier_net` regenerated | Added by `11`/`12` | Live | Same — extract to migration |
| D-6 | `clients` columns `review_date`, `client_since`, `retainer` | Present in prod | Uncertain in repo | Verify when baseline built |

## Columns worth noting for later packages (not fixed now)

- **`supplier_net` is nullable** in production. It's meant to be a generated column
  (gross − commission). If some rows are null, margin maths could silently skip
  them. Flag for Package 1.4 (financial integrity) — not 0.1.
- **No `updated_at` anywhere, no audit columns.** Confirmed. This is Package 1.5's
  territory (auditability), recorded here so it isn't rediscovered.
- **No `CHECK (amount >= 0)` on any money column.** Negative values are possible.
  Package 1.4.
- **No `deleted_at` / archive column on campaigns.** Package 1.4.

None of the above is in scope for 0.1. They're logged so the truth is captured once.

---

## What this confirms for 0.1

1. The 12 tables and their names **match** the repository — no surprise tables.
2. The **only structural drift that matters for a clean rebuild** is D-1 (staff_roles
   RLS) and D-2 (the 1.1 guard) — both must be folded into the baseline migrations,
   plus the column additions D-4/D-5 that are currently buried in the Randox import.
3. Nothing in production is *missing* from the repo's knowledge — it's all
   accounted for. The repo is behind, not wrong.

**0.1 assessment is complete.** The proposed clean baseline in SQL_INVENTORY.md
holds, with these corrections folded in. Building it (Package 0.2) will prove it.
