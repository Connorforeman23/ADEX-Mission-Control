# ADEX Mission Control — Implementation Plan

Ten work packages across two programme phases. **One objective per package**, its own
branch, its own approval point. Nothing in a later package should be started or
prepared for while an earlier one is in progress.

Owner: Connor Foreman · Release approval: Rick Wadsworth

---

## Status

| # | Package | Status | Touches production? |
|---|---|---|---|
| **1.1** | Fix the privilege vulnerability | **✅ Complete — applied to prod 29 Jul** | Done |
| 0.1 | Establish the database truth | **✅ Complete — schema verified 29 Jul** | No |
| 0.2 | Build the development database | **✅ Complete — dev matches prod 29 Jul** | No |
| 0.3 | Separate deployments and environments | **✅ Complete — cut over to prod 3 Aug** | Done |
| 0.4 | Safe operating and release controls | **✅ Complete — 11 Aug** | Settings only |
| 1.2 | Harden authentication and administration | **✅ Complete — 11 Aug** | Done |
| 1.3 | Implement the agreed access model | **✅ Complete — 11 Aug** | Done |
| 1.4 | Protect campaign and financial integrity | **✅ Complete — 11 Aug** | Done |
| 1.5 | Auditability and offboarding | **✅ Complete — 11 Aug** | Done |
| 1.6 | Security regression and controlled release | **✅ Complete — 11 Aug** | Done |

**🎉 Programme complete — all 10 packages delivered and verified on production (11 Aug 2026).**

**Sequencing note.** 1.1 runs before Phase 0 by exception — see DECISIONS.md D4.
It is a single policy change with no data migration, and the vulnerability is live.

---

## How each package runs

1. **Read-only assessment** — confirm current state, identify files and settings
2. **Implementation proposal** — exact changes, migrations, risks, tests
3. **Approval** — Connor approves or amends before any code changes
4. **Implementation** — dev branch only
5. **Evidence and release** — report against each acceptance criterion, then Rick approves

Each package has: one objective · one branch · few migrations · explicit
out-of-scope items · a rollback route · a short evidence report.

---

## Open dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| Production schema export (`supabase db dump --schema-only`) — needs the database password | 0.1 completion, all of 0.2 | Connor |
| Dev Supabase project created | 0.2 | Connor |
| Microsoft 365 SMTP credentials — **deferred**: reset emails wait for the O365 migration (~end Aug 2026); interim resets via Supabase dashboard | 1.2 email sending (rest of 1.2 done without it) | Connor |
| Rick's availability for acceptance testing | Every release | Connor |

---

## Explicitly out of scope for this programme

Not rejected — simply not now, and not to be drifted into:

- A third staging environment (see DECISIONS.md D3)
- Point-in-time recovery (D2)
- Multi-tenancy / organisation-level data separation (D5)
- Xero, Google Ads, Meta integrations
- Credit notes and rebates (deferred out of 1.4 deliberately)
- Any framework, hosting or database platform change
