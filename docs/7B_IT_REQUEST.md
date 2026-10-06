# Request to IT — Microsoft 365 app registration for ADEX Mission Control

*This replaces the request sent on 16 September. The permission list has grown:
please work from this one.*

Hi,

We're connecting our in-house CRM (ADEX Mission Control) to Microsoft 365 so
that staff can, individually and by their own choice, link their own mailbox
and calendar to it. The CRM will:

- file emails with clients and suppliers against the right company record
- put an entry in someone's calendar when they give one of their own tasks a time
- show meetings from their calendar in the CRM
- send each person one summary email at 09:30

**Every permission below is delegated**, meaning the CRM can only ever act for a
person who has signed in and granted access to their own mailbox and calendar.
It can never read anyone else's, and it cannot act when nobody is signed in.

Nothing needs installing. It is one app registration in Entra ID.

## Please create

**Entra admin centre → Applications → App registrations → New registration**

| Setting | Value |
|---|---|
| Name | `ADEX Mission Control` |
| Supported account types | **Accounts in this organizational directory only** (single tenant) |
| Redirect URI — platform | **Web** |
| Redirect URI 1 | `https://adex-mission-control.vercel.app/api/microsoft/callback` |
| Redirect URI 2 | `https://adex-mission-control-git-dev-adex3.vercel.app/api/microsoft/callback` |

Both URIs on the same registration — the second is our test environment.

**Authentication** → leave "Implicit grant" unticked. Allow public client
flows: **No**.

**API permissions** → Add a permission → Microsoft Graph → **Delegated**
(not Application):

| Permission | What it is for |
|---|---|
| `User.Read` | Identify who has signed in |
| `Mail.Read` | File client and supplier emails against the right company |
| `Mail.Send` | One summary email per person at 09:30 |
| `Calendars.Read` | Show a person's meetings in the CRM |
| `Calendars.ReadWrite` | Put a task the person themselves timed into their calendar |
| `offline_access` | Stay connected without asking them to sign in daily |

Then **Grant admin consent for Advertising Excellence Ltd**, so individual
staff aren't each prompted for consent (or blocked by policy) when they sign
in.

Please do **not** add any *Application* permissions. The CRM must not be able
to read mail or calendars without a signed-in user.

### About `Calendars.ReadWrite`

This is the one worth querying, so here is exactly what uses it: when a person
gives one of their own CRM tasks a time, the CRM creates a matching entry in
that person's own calendar. Nothing else writes to a calendar — no invitations
to anyone, no edits to meetings the CRM did not create, and nothing in anyone
else's calendar.

## Certificates & secrets

New client secret → description `Vercel`, expiry **24 months**. Please note the
expiry date; a new one is needed before it lapses or every connection stops at
once.

## Please send back (securely — not in plain email)

1. **Application (client) ID**
2. **Directory (tenant) ID**
3. The **client secret value** — shown once, on creation, so copy it then
4. The secret's expiry date

A password manager share, or a Teams message you delete afterwards, is fine.

## Two things to check at your end

1. If the tenant blocks users consenting to apps, the admin consent step above
   covers it. If anything else would stop a user signing in to a single-tenant
   app with delegated permissions — Conditional Access on OAuth apps, for
   example — please let us know.
2. **Is our shared drive on SharePoint / OneDrive, or a server in the office?**
   We'd like Space Orders filed automatically to the client's folder when they
   are sent. That is straightforward if the drive is in 365 (one more delegated
   permission, `Files.ReadWrite`), and not possible directly if it is on a
   server here, since the CRM runs in the cloud.

## What the CRM will store, for the record

- Emails where someone outside advertisingexcellence.co.uk matches a company
  already in the CRM. Internal-only mail is never captured.
- Full message content, retained for **two years**, after which the body is
  deleted and only subject, date and participants are kept.
- Readable by ADEX staff with full CRM access; hidden entirely from restricted
  users.
- Tokens are held in a table that is unreachable from any browser and readable
  only by the application itself.

Thanks,
Connor
