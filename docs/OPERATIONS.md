# ADEX Mission Control — Operations & Release Runbook

Package 0.4. How the app is run, released, reset and recovered — in plain steps.

---

## 1. The two environments

| | Production | Development |
|---|---|---|
| Who sees it | The team, real work | Connor/Rick, testing only |
| URL | https://adex-mission-control.vercel.app | Vercel **preview** URLs (per branch) |
| Database | Supabase `puolnlqp…` | Supabase `ficmtwvmmcsxxexhysbd` |
| Data | Real client data | Fictional seed data only |
| Orange DEV banner | Hidden | Shown on every page |
| Git branch | `main` | any feature branch |

The app **refuses to start** if the environment label and the database don't match
(the guard in `src/lib/env.ts`). This makes it structurally impossible for a preview
to point at the live database, or vice versa.

---

## 2. What development CANNOT do to the outside world

Confirmed 3 Aug 2026 — dev has no path to live systems:

- **No emails.** No SMTP/email code exists. Supabase Auth's own emails (invites,
  resets) are per-project; the dev project has no SMTP configured, and we keep
  email confirmation **off** in dev instead of sending anything.
- **No Xero / POs / finance push.** The "Sync with Xero" button is a placeholder
  ("Xero isn't connected yet"). Nothing leaves the app.
- **No webhooks or third-party calls.** None exist in the codebase.

When these integrations are built (a later package), each must be gated so it only
fires in production — that gate is part of building them, and is noted here so it
isn't forgotten.

---

## 3. Releasing a change to production

1. Work happens on a **feature branch** → deploys to a **preview** on the dev database.
2. Check the preview: it loads, shows the orange banner, and the change works.
3. Open a Pull Request into `main`. **Rick approves** (branch protection requires it).
4. Merge → production redeploys automatically.
5. **Smoke test production** (2 minutes): sign in, real data loads, no orange banner,
   one page you changed behaves correctly.
6. If anything is wrong → **roll back** (section 5), don't debug live.

Rule: **production changes need Rick's approval; dev work does not.**

---

## 4. Resetting and re-seeding the development database

Dev is disposable. To wipe it back to a clean fictional dataset:

1. Open the **development** Supabase project → SQL Editor.
2. Paste and run `supabase/seed/dev_seed.sql`.
3. It refuses to run if it detects production data (a Randox client), so it can
   never hit the live database by accident.
4. It prints a summary row (clients / campaigns / lines / leads / tasks) when done.

The seed includes: 4 clients, 5 campaigns (all statuses), media + production lines,
a matched and a variance supplier invoice, paid + unpaid client invoices, pipeline
leads in every stage, creative items, contacts and tasks — enough to exercise
every screen.

To let the team log into dev: in the dev Supabase project, turn **email confirmation
off** (Auth → Providers → Email), then sign up at the dev preview `/signup` with a
real work email (the seed pre-authorises Connor and Rick in `staff_roles`).

---

## 5. Rolling back production

Two independent routes, either is one action, neither touches data:

- **Vercel instant rollback** — Vercel → Deployments → the previous good deployment
  → "Promote to Production". Fastest; use this first.
- **Git revert** — `git revert <bad commit>` on `main`, push; production rebuilds
  on the reverted code.

Rollback restores the previous **code**, not data. Data recovery is section 6.

---

## 6. Backups and recovery

Supabase Pro takes **daily backups** automatically (retained 7 days on Pro).

**Verify backups exist** (do this once now, then it's assured):
- Production Supabase → Database → Backups → confirm a recent daily backup is listed.

**Restore test** — prove a backup can actually be recovered, without touching prod.
Use Supabase's built-in **Restore to new project** (Database → Backups → that tab):
1. Pick the latest daily backup → **Restore to new project**.
2. Name it `adex-restore-test`, same region (eu-west-2), let it provision (a few mins).
3. Open the new project → Table Editor → confirm real data is present and sane
   (e.g. `clients` shows Randox; `client_invoices` has sensible figures).
4. **Delete the temporary project** (Settings → General → Delete project). This stops
   its cost and removes the copy of live data.

Cost: a temporary project uses paid compute only while it exists — negligible if
deleted straight after. Record the date in `docs/0.4_EVIDENCE.md`. Repeat if the
schema changes materially.

> Backups cover the **database** only, not files in Supabase Storage. No file
> uploads are in use yet; if they're added later, arrange separate Storage backup.

> Point-in-time recovery is deliberately **out of scope** (DECISIONS.md D2).
> Daily backups + tested restore is the agreed recovery posture.

---

## 7. Quick reference

| I want to… | Do this |
|---|---|
| Test a change safely | Push a branch → open its preview |
| Reset dev to clean data | Run `supabase/seed/dev_seed.sql` on the dev project |
| Release to production | PR → Rick approves → merge → smoke test |
| Undo a bad release | Vercel → promote previous deployment |
| Prove backups work | Restore latest backup into a temp project, then delete it |
