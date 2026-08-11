# Decision log

Material decisions about how ADEX Mission Control is built and run. Each entry
records what was decided, why, and what it rules out — so a future developer
(or a future us) doesn't have to reconstruct the reasoning.

---

### D1 — Two environments, not three
**Date:** 29 July 2026 · **Decided by:** Connor

Development/test and production only. Development covers local work, Vercel
previews, functional testing, release acceptance and migration testing.

**Why:** one agency, one small team, one product. A third environment adds a
promotion step and another set of credentials without adding meaningful safety
at this size.

---

### D2 — Daily backups are sufficient; no point-in-time recovery
**Date:** 29 July 2026 · **Decided by:** Connor

Supabase Pro's daily backups with 7-day retention are accepted as the recovery
position. PITR (~$100/month) is not taken at this stage.

**What this means in practice:** a bad Wednesday afternoon could cost up to 24
hours of work. That is accepted knowingly, not by omission.

**Revisit when:** transaction volume grows, or a real incident shows the cost of
a day's loss is higher than assumed.

---

### D3 — No staging environment
**Date:** 29 July 2026 · **Decided by:** Connor

Rejected because acceptance testing happens on Vercel preview deployments
against the development database, which gives Rick a real URL to test without a
third database to keep in step.

---

### D4 — The privilege-escalation fix runs before Phase 0
**Date:** 29 July 2026 · **Decided by:** Connor, on Claude's recommendation

Work package 1.1 is promoted ahead of the Phase 0 environment work.

**Why:** the `self update profile` policy lets any signed-in user set their own
`role` to `admin` from the browser. Every access restriction in the app rests on
that column. The fix is one policy plus one trigger on a single table, with no
data migration and a one-line rollback. Waiting for four Phase 0 packages would
leave it open for weeks.

**Accepted risk:** this is a production change made before the safe-migration
tooling exists, so it is applied manually by Connor via the Supabase SQL editor
and recorded here.

**Applied:** 29 July 2026. Verification query returned policy_present=1,
trigger_present=1. Vulnerability closed on production.

---

### D8 — 0.3 production cut-over follows the release process (Rick signs off)
**Date:** 3 August 2026 · **Decided by:** Connor

The production cut-over for 0.3 will follow the agreed release process rather
than being rushed. Rick's role for this package is a **post-deploy smoke test**
(0.3 is infrastructure, with nothing for him to acceptance-test beforehand):
after the cut-over he logs into the live site and confirms he can sign in, sees
the real data, and there is no dev banner. Safe preparation (setting the
production variables) can happen before that; the merge/deploy waits for Rick.

---

### D5 — Role-based access, not organisation-based
**Date:** 29 July 2026 · **Status:** recorded, not yet formally decided

The database has no organisation or tenancy concept. Access is binary: restricted
users see records they own; everyone else sees everything.

**Correct for a single agency.** But if ADEX ever hosts a second agency,
white-labels the product, or gives clients logins, **every RLS policy would need
rewriting** — this is not a setting to flip. Recorded now because retrofitting
tenancy is far more expensive than designing it in.

---

### D6 — Supabase URL and anon key were committed to source
**Date:** 29 July 2026 · **Status:** to be reversed in 0.3

Committed as fallbacks in `src/lib/supabase/client.ts` when a mis-scoped Vercel
variable produced an empty key and broke sign-in.

**Reasoning at the time:** the anon key is public by design — it ships in every
browser bundle and access is governed by RLS, not secrecy.

**Why it is still being reversed:** it prevents key rotation without a code
change, and it defeats environment separation — dev and production would both
reach production regardless of their variables.

---

### D7 — One Vercel project with a runtime environment guard
**Date:** 29 July 2026 · **Superseded the earlier two-project proposal**

One Vercel project with per-environment variables (Production scope → prod
values; Preview + Development scope → dev values), backed by a runtime guard
(`src/lib/env.ts`) that refuses to start on any environment/project mismatch.

**Why the change from two projects:** the mismatch guard is the real protection —
it blocks a production app from touching dev and a dev app from touching
production, regardless of how Vercel is configured. Given that, one project is
materially less dashboard configuration for Connor to get wrong, and the anon
key is public anyway so the "credential leak into preview" argument for two
projects is weak. Verified 29 July: the guard refuses a mismatched build and a
build with missing variables.

**Revisit if** the product is ever white-labelled or a second agency is hosted,
where separate projects would give cleaner isolation.
