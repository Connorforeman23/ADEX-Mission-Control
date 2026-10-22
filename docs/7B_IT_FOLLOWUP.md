# Follow-up to IT — make the app registration multi-tenant

*Follows the request in [7B_IT_REQUEST.md](7B_IT_REQUEST.md). The permissions,
redirect URIs and secret from that request are all correct and unchanged. One
setting needs to change, and one approval needs granting.*

**Why multi-tenant rather than moving it:** Connor uses the CRM with mailboxes
in both Clear Focus Management and Advertising Excellence. A single-tenant app
can only ever serve one of them, so the app has to accept both directories.
The original request asked for single tenant, which was wrong about this
requirement — that part is on us, not IT.

---

**Subject:** ADEX Mission Control — one setting change on the app registration

Hi,

Thanks for setting up the app registration for ADEX Mission Control. There's
one setting that needs changing before the team can use it. The permissions,
redirect URIs and secret are all correct — please don't change those.

**What's happening**

When anyone with an `@advertisingexcellence.co.uk` account tries to connect
their mailbox, Microsoft turns them away:

> Selected user account does not exist in tenant 'Clear Focus Management' and
> cannot access the application 'a806aba2-4c4c-4b4f-8fa5-dda727795533' in that
> tenant. The account needs to be added as an external user in the tenant
> first. Please use a different account.

**Why**

The app lives in the Clear Focus Management directory and is registered as
single-tenant, so it only accepts sign-ins from that directory. Our staff are
in the Advertising Excellence directory.

I need it to work for both — I use the CRM with mailboxes in each. So rather
than moving it, please make the app multi-tenant.

**Change 1 — on the existing registration (Clear Focus Management directory)**

Entra admin centre → App registrations → `ADEX Mission Control`
(`a806aba2-4c4c-4b4f-8fa5-dda727795533`) → **Authentication** → Supported
account types:

| From | To |
|---|---|
| Accounts in this organizational directory only | **Accounts in any organizational directory (Any Microsoft Entra ID tenant — Multitenant)** |

Save. Nothing else on that page changes — the redirect URIs stay as they are,
implicit grant stays off, public client flows stay off.

Please choose the **Multitenant** option, not the one that also includes
personal Microsoft accounts. This should be work and school accounts only.

**Change 2 — approve it in the Advertising Excellence directory**

A multi-tenant app still has to be approved by each organisation that uses it.
Someone with Global Administrator or Privileged Role Administrator in the
**Advertising Excellence** directory needs to open this link, sign in with
their Advertising Excellence account, and approve:

```
https://login.microsoftonline.com/common/adminconsent?client_id=a806aba2-4c4c-4b4f-8fa5-dda727795533&redirect_uri=https://adex-mission-control.vercel.app/api/microsoft/callback
```

It will list the same delegated permissions as before — `User.Read`,
`Mail.Read`, `Mail.Send`, `Calendars.Read`, `Calendars.ReadWrite`,
`offline_access`. Approving shows a short "Consent granted" page; there's
nothing to do after that, and no CRM account is needed to do it.

To be clear about what this grants: these are **delegated** permissions only.
The CRM can act only for a person who has signed in and linked their own
mailbox, and only on that person's own mail and calendar. It cannot read
anyone else's, and it cannot do anything when nobody is signed in.

**Please confirm back**

1. That the app is now multitenant
2. That admin consent has been granted in the Advertising Excellence directory
3. The **Directory (tenant) ID** for Advertising Excellence, for our records

Nothing needs re-issuing — the client ID and secret stay the same.

**Still outstanding from the original request:** is our shared drive on
SharePoint / OneDrive, or a server in the office? We'd like Space Orders filed
to the client's folder automatically when they're sent, which is straightforward
if the drive is in 365 and not possible if it's on a server here.

Thanks,
Connor

---

## What happens at our end once they confirm

1. In Vercel → Settings → Environment Variables, change **one** variable for
   **Production and Preview**:
   - `MS_TENANT_ID` → `organizations`

   That literal word, not an ID. It tells Microsoft to accept a work or school
   account from any directory, which is what multi-tenant means. `MS_CLIENT_ID`
   and `MS_CLIENT_SECRET` do not change.
2. **Redeploy.** Vercel bakes environment variables in at build time, so the
   change does nothing until the next deployment.
3. Connections made before the change keep working — same app, same secret, so
   the refresh tokens stay valid. Nobody needs to reconnect.

## What multi-tenant actually widens

Any Microsoft work account, in any organisation, could in principle consent to
this app. In practice the exposure is bounded by the CRM itself: the only way
to reach the connect button is to be signed in to Mission Control, and accounts
there are created by an administrator. Someone outside ADEX would need a CRM
login before any of this is reachable.

Worth knowing, not worth losing sleep over — and it is the price of having both
companies' mailboxes in one CRM, which is the requirement.

The client secret still expires 24 months from creation. Put the date in a
calendar: when it lapses every connection stops at once, and the symptom — all
mailboxes silently stopping — looks nothing like the cause.
