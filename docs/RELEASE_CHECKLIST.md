# Release checklist — ADEX Mission Control

The standing process for shipping any change to production safely. Born out of
the programme (packages 0.1–1.6). Keep it short enough to actually follow.

---

## Before you start
- [ ] Work on a **feature branch**, never directly on `main`.
- [ ] Decide up front: does this change touch the **database** (schema, policies,
      functions, triggers) as well as the **app code**? If so, read "Order of
      operations" below — it matters.

## Build & test on dev
- [ ] Make the change on the branch.
- [ ] If there's SQL, apply it to the **dev** database first and test there.
- [ ] Open the branch's **preview** (orange DEV banner) and verify the change works.
- [ ] For anything security-related, run `supabase/SECURITY_SELFCHECK.sql` on dev —
      every row must read **PASS**.

## Order of operations (READ THIS for schema + app changes)
When a change has **both** a database part and an app part, the database goes to
**production first**, then the app:

1. Apply the SQL to **production** (validate first if it adds constraints —
   see `VALIDATE_INTEGRITY.sql`).
2. After adding any new table, run `notify pgrst, 'reload schema';` so the API
   sees it immediately.
3. **Then** merge the app PR to `main`.

> Why: if the app merges first, it will call tables/columns that don't exist yet
> on production and throw errors for users. (This happened once, in 1.5 — the app
> merged ahead of its migration and the live Settings panel showed schema-cache
> errors until the SQL was applied. No data was lost, but avoid it.)

For **app-only** changes (no SQL), just merge the PR — order doesn't apply.

## Release
- [ ] Open a Pull Request into `main`. Branch protection requires the PR.
- [ ] **Rick** smoke-tests / signs off (or the agreed approver).
- [ ] Merge → production redeploys.

## Verify on production (smoke test)
- [ ] Sign in; real data loads; **no** orange DEV banner.
- [ ] The specific change behaves as expected.
- [ ] For security changes, run `SECURITY_SELFCHECK.sql` on **production** —
      all **PASS**.

## If something's wrong
- [ ] **Roll back** rather than debug live: Vercel → promote the previous
      deployment (instant), or `git revert` on `main`.
- [ ] Data recovery (rare): restore from the daily Supabase backup.

## Offboarding a leaver (from 1.5)
1. Settings → Manage team → **Disable** them (instant lockout).
2. Supabase → Authentication → Users → **delete** their login (permanent).

## Periodic
- [ ] Confirm daily backups are listed (Supabase → Database → Backups).
- [ ] Run `SECURITY_SELFCHECK.sql` on production after any DB change, and
      occasionally as a spot-check — all rows PASS.
