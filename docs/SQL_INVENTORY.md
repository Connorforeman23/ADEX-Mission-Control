# SQL file inventory — Package 0.1

Every SQL file in `supabase/`, classified. This is the assessment step: it tells
us what the repository actually contains before anything is reorganised.

Produced: 29 July 2026. No files changed by this step.

---

## Classification

| File | Type | Run against prod? | Keep as… |
|---|---|---|---|
| `01_schema.sql` | **Schema** — tables, RLS, functions, triggers | Yes | Migration (baseline) |
| `02_staff.sql` | **Seed** — the 7 staff rows | Yes | Seed (prod) / dev seed |
| `03_backfill.sql` | **Fix** — patched profiles + re-defined a function | Yes | Archive (superseded) |
| `05_signup_allowlist.sql` | **Schema** — signup guard functions | Yes | Migration |
| `06_security_check.sql` | **Diagnostic** — read-only report | Ad hoc | Archive (tool, not migration) |
| `07_tasks_po_access.sql` | **Schema** — tasks, PO access, restricted-role RLS | Yes | Migration |
| `09_merge_randox.sql` | **Data fix** — merged duplicate Randox clients | Once | Archive |
| `10_contacts.sql` | **Schema** — contacts table + RLS | Yes | Migration |
| `11_randox_full_import.sql` | **Mixed** — schema changes + Randox data | Yes | **Split**: schema→migration, data→archive |
| `12_randox_client_charges.sql` | **Data** — set Randox client charges | Yes | Archive |
| `DEDUPE.sql` | **Data fix** — removed duplicate import rows | Once | Archive |
| `FIX_RAN0085.sql` | **Data fix** — restored one production line | Once | Archive |
| `PART1–6_of_6.sql` | **Duplicate** — split copy of `11` | — | **Delete** (redundant) |
| `SECURITY_PATCH_1.1.sql` | **Schema** — the 1.1 role guard | Yes (applied) | Migration |

Support scripts (not SQL, kept with the import): `gen.js`, `parse.js`, `charges.js`.

---

## Key findings

**1. Gaps in the numbering.** `04` and `08` don't exist — `08` was deleted when
superseded. "Run them all in order" is not currently a safe instruction because
a reader can't tell a deliberate gap from a missing file.

**2. Schema hidden inside a data import.** `11_randox_full_import.sql` adds three
columns (`commission_pct`, `supplier_contact`, `line_type`) and rebuilds the
`supplier_net` generated column, in among 157 rows of client data. Those
structural changes must become a migration; the data must not run against dev.

**3. One function defined three times.** `handle_new_user()` appears in `01`,
is patched in `03`, and replaced again in `05`. Only the final form matters. A
clean baseline should define it once.

**4. RLS drift — the repository has never matched production.** `staff_roles`
has RLS enabled on the live database (Supabase added it), but `01_schema.sql`
never enabled it. So building a fresh database from the files would produce a
`staff_roles` table with RLS **off** — a real difference from production.

**5. The 1.1 patch is applied to production but not yet in the baseline.** It
must join the migration set so a rebuilt database includes it.

**6. `PART1–6` are redundant.** An identical split of `11`, created only to work
around a paste-size limit. Safe to delete once `11` is archived.

---

## Proposed clean structure (for approval — not yet built)

```
supabase/
  migrations/
    0001_schema.sql          <- from 01, with staff_roles RLS added
    0002_signup_allowlist.sql
    0003_tasks_po_access.sql
    0004_contacts.sql
    0005_randox_schema.sql   <- ONLY the column additions from 11
    0006_role_guard.sql      <- the applied 1.1 patch
  seed/
    dev_seed.sql             <- fictional data (built in 0.4)
  archive/
    randox-import/           <- 09, 11 data, 12, DEDUPE, FIX_RAN0085, PARTs, *.js
    one-off-fixes/           <- 03, 06
    staff-prod.sql           <- 02, real staff (prod only, never dev)
```

**The rule this enforces:** `migrations/` run in order rebuilds an empty database
to match production's *structure*, with no client data. Everything in `archive/`
is kept for the record and never run again.

---

## Blocking dependency

This structure is proposed from **inference** — reading the files and probing
which columns exist. It cannot be *confirmed* correct without a real export of
production's live schema, which requires the Supabase CLI and the database
password (Connor's action). Package 0.2 proves the baseline by building dev from
it and comparing. Until then, treat the structure above as a strong proposal,
not verified truth.
