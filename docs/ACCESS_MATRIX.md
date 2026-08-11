# Access matrix

**Status: draft — describes what the system does *today*, not what it should do.**
The definitive matrix is agreed in work package 1.3. Do not treat this as approved.

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

## Known gaps — to be resolved in 1.3

| Gap | Detail |
|---|---|
| **Anyone can change their own role** | Critical. `self update profile` permits updating any column including `role`. Fixed in 1.1 |
| **Everyone can read every profile** | All users see all staff names, emails and roles |
| **Restricted users cannot book campaigns** | `po_counters` is full-staff only, so PO generation fails with a database error rather than a clear refusal |
| **Settings is not protected at the database level** | Only the page guard stops a restricted user; the underlying data is readable |
| **`standard` and `admin` are barely distinct** | Both reach Settings. The only real boundary today is `restricted` vs everyone else |
| **No deactivated state** | Removing someone means deleting them; an open session keeps working until the token expires |

---

## To be decided in 1.3

- Should `standard` reach Settings at all?
- Which profile fields are visible to whom — full profiles for admins, display names only for others?
- Should restricted users be able to book campaigns (and so need PO access), or be explicitly refused with a clear message?
- What a deactivated user can see and do, and how quickly access ends
