# Access matrix

**Status: AGREED — work package 1.3 (11 Aug 2026).** This is the approved model.

---

## Roles today

| Role | Who | Intent |
|---|---|---|
| `admin` | Connor, Steve, Lynsey | Everything, including Settings |
| `standard` | Jon, Kate, Rick, James | Everything except administration |
| `restricted` | Darren | Own clients and prospects only; no Finance, Reports or Settings |

---

## Current behaviour, by area

| Area | admin | standard | restricted | Enforced by |
|---|---|---|---|---|
| Dashboard | Full | Full | Own records | RLS |
| Campaigns | Full | Full | Own / own clients | RLS |
| Media plan | Full | Full | Own | RLS |
| Creative | Full | Full | Own | RLS |
| Clients | Full | Full | Own | RLS |
| Contacts | Full | Full | Own | RLS |
| Pipeline | Full | Full | Own | RLS |
| Tasks | Full | Full | Assigned to them | RLS |
| Finance | Full | Full | **No access** | RLS + `requireFullAccess()` |
| Reports | Full | Full | **No access** | RLS + `requireFullAccess()` |
| Settings | Full | Full | **No access** | `requireFullAccess()` only |

---

## Gaps — resolution status

| Gap | Resolution |
|---|---|
| **Anyone can change their own role** | ✅ Fixed in 1.1 (`guard_profile_fields` trigger). |
| **Restricted users cannot book campaigns** | ✅ **1.3** — booking is refused cleanly with a clear message (server-side, authoritative) and the booking entry points are hidden from restricted users. No more raw database error. |
| **Restricted users could create records they then can't see** | ✅ **1.3** — a restricted user's new leads/contacts/creative are auto-owned by them, so the "own only" model can't trap them. |
| **`standard` and `admin` barely distinct** | ✅ Real boundary since 1.2: only admins manage the team. Standard keeps Settings as read-only reference (agreed). |
| **Everyone can read every profile** | Accepted. Colleagues seeing colleague names is normal for a CRM, and the owner dropdowns need it. Emails/roles exposure judged low-risk. |
| **No deactivated state** | Deferred to **1.5 (offboarding)** — actually revoking an active login. |

---

## Decisions taken in 1.3 (11 Aug 2026)

- **Standard keeps Settings** — as read-only reference; administration (team) is already admin-only.
- **Profile visibility** — left as-is (all authenticated can read profiles); low-risk, and forms depend on it.
- **Restricted users cannot book** — refused cleanly with a message; booking is an admin/standard task.
- **Deactivation** — out of scope here; belongs to 1.5.
- **Restricted role is not yet in use** — the model is built and tested on dev with a test account; real
  data owner-assignment happens if/when a restricted user is onboarded.
