# Follow-up to IT — make the ADEX Mission Control app multi-tenant

*Follows [7B_IT_REQUEST.md](7B_IT_REQUEST.md). The app registration exists and
is correctly named; two settings on it need changing, and a new secret is
needed. Connor cannot make these changes himself — they are admin-restricted.*

**The app:** `ADEX Mission Control`, Application (client) ID
`d5070f62-f6d8-4024-adee-e2d69f9f12be`.

**Why multi-tenant:** Connor runs the CRM with mailboxes in two directories —
Advertising Excellence and Clear Focus Management — and needs both connected.
A single-tenant app can only ever serve one. The original request asked for
single tenant, which was our specification missing that requirement, not IT
building it wrong.

---

**Subject:** ADEX Mission Control — two settings on the app registration, plus a new secret

Hi,

Thanks for setting up the `ADEX Mission Control` app registration. I've hit two
things I can't change myself because they need admin rights, and I need one new
secret. All three are below.

The app is **ADEX Mission Control**, Application (client) ID
`d5070f62-f6d8-4024-adee-e2d69f9f12be`.

**1. Please change it to multi-tenant**

Entra admin centre → App registrations → **ADEX Mission Control** →
**Authentication** → Supported account types:

| From | To |
|---|---|
| Accounts in this organizational directory only | **Accounts in any organizational directory (Any Microsoft Entra ID tenant — Multitenant)** |

Please pick the **Multitenant** option, not the one that also includes personal
Microsoft accounts — this should be work and school accounts only.

*Why:* I use the CRM with mailboxes in two companies, and I need both to
connect. A single-tenant app can only ever accept one of them.

**2. Please confirm the redirect URIs**

On the same Authentication page, these two need to be listed under **Web**.
Please add either if it's missing:

- `https://adex-mission-control.vercel.app/api/microsoft/callback`
- `https://adex-mission-control-git-dev-adex3.vercel.app/api/microsoft/callback`

The second is our test environment. Implicit grant stays unticked; allow public
client flows stays **No**.

**3. Please confirm the permissions, and grant admin consent**

**API permissions** → these seven, all **Delegated**, Microsoft Graph. Please
add any that are missing:

| Permission | What it is for |
|---|---|
| `User.Read` | Identify who has signed in |
| `Mail.Read` | File client and supplier emails against the right company |
| `Mail.Send` | One summary email per person at 09:30 |
| `Calendars.Read` | Show a person's meetings in the CRM |
| `Calendars.ReadWrite` | Put a task the person themselves timed into their own calendar |
| `offline_access` | Stay connected without asking them to sign in daily |
| `Files.ReadWrite.All` | File Space Orders into the client's folder on the shared drive, and read back the order numbers already there |

Then **Grant admin consent for Advertising Excellence Ltd**, so staff aren't
each blocked or prompted when they sign in.

### About `Files.ReadWrite.All`

This is the new one since my last request, and the name sounds broader than it
is, so here is exactly what it does and does not mean.

It is **delegated**, like everything else above. That means it reaches only the
files the signed-in person can already open themselves. It gives the CRM no
access of its own, nothing when nobody is signed in, and nothing a member of
staff could not already reach through File Explorer.

Two uses, both on our Space Orders folder:

1. **Write.** When a Space Order is sent to a supplier, the CRM saves a copy to
   that client's folder, so the paperwork is filed without anyone doing it by
   hand. It only ever creates new files. It will never overwrite an existing
   one — if a file of that name is already there, the CRM stops and asks,
   because that means something is out of step.
2. **Read.** Order numbers run in a sequence per client (ADE0001, ADE0002 and
   so on), and a lot of that history predates the CRM. Reading the filenames
   already in the folder lets it carry on from the right number instead of
   starting again at 0001 and issuing a supplier a number we have already used.

The narrower `Files.ReadWrite` would not do: it covers only a person's own
OneDrive, not a shared SharePoint library, which is where the orders live.

If your policy would rather this were scoped to one site or library instead of
the tenant, say so and we will work to whatever you prefer — the CRM only ever
touches the Space Orders folder.

Please do **not** add any *Application* permissions. These are all delegated,
which means the CRM can only ever act for a person who has signed in and linked
their own mailbox, on that person's own mail and calendar. It cannot read
anyone else's, and it cannot do anything when nobody is signed in.

**4. Please issue a new client secret**

**Certificates & secrets** → **New client secret** → description `Vercel`,
expiry **24 months**.

The value is shown once, on creation, so please copy it then and send it to me
**securely — not in plain email**. A password manager share, or a Teams message
you delete afterwards, is fine.

**Please send back**

1. The **client secret value** (securely, as above)
2. The secret's **expiry date**, so I can diary it — when it lapses, every
   connection stops at once
3. The **Directory (tenant) ID** for Advertising Excellence, for our records
4. Confirmation that the app is now multitenant and admin consent has been
   granted

The Application (client) ID I already have.

**One last thing.** Our shared drive is on SharePoint and OneDrive, which is
what makes the filing above possible — so `Files.ReadWrite.All` does earn its
place.

Could you send me the **site and library path to the folder where Space Orders
are filed**? Something like
`https://advertisingexcellence.sharepoint.com/sites/<site>/<library>/<folder>`.
The CRM needs to know where to put them, and it will only ever touch that
folder.

Thanks,
Connor

---

## What Connor does once they reply

In Vercel → Settings → Environment Variables, set all three for **Production
and Preview**, then **Redeploy** (Vercel bakes these in at build time, so
nothing changes until the next deployment):

| Variable | Value |
|---|---|
| `MS_CLIENT_ID` | `d5070f62-f6d8-4024-adee-e2d69f9f12be` |
| `MS_TENANT_ID` | `organizations` — that literal word, not an ID |
| `MS_CLIENT_SECRET` | the new secret value from IT |

`MS_TENANT_ID` being the word `organizations` is what tells Microsoft to accept
a work account from any directory, which is the point of multi-tenant.

**Note the client ID is changing.** Vercel currently points at
`a806aba2-4c4c-4b4f-8fa5-dda727795533`, which is not the app registration that
exists — that mismatch is why nothing was connecting. Anyone already connected
will need to disconnect and reconnect in Settings afterwards, because their
tokens were issued by the old app.

Then everyone connects their own mailbox at
https://adex-mission-control.vercel.app/settings — Connor's
`@clearfocusmgmt.co.uk` account included, which is what the multi-tenant change
buys.

## What multi-tenant widens

Any Microsoft work account, in any organisation, could in principle consent to
this app. In practice the exposure is bounded by the CRM: the only route to the
connect button is a Mission Control login, and those are created by an
administrator. Worth knowing; it is the price of having both companies'
mailboxes in one CRM.
