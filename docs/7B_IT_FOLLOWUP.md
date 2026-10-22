# Follow-up to IT — the app registration is in the wrong directory

*Follows the request in [7B_IT_REQUEST.md](7B_IT_REQUEST.md). Everything in
that request still stands; only the directory it was created in is wrong.*

---

**Subject:** ADEX Mission Control — app registration is in the wrong tenant

Hi,

Thanks for setting up the app registration for ADEX Mission Control. There's
one thing that needs changing before the team can use it, and I don't think it
will take long.

**What's happening**

When anyone with an `@advertisingexcellence.co.uk` account tries to connect
their mailbox, Microsoft turns them away with this:

> Selected user account does not exist in tenant 'Clear Focus Management' and
> cannot access the application 'a806aba2-4c4c-4b4f-8fa5-dda727795533' in that
> tenant. The account needs to be added as an external user in the tenant
> first. Please use a different account.

**What that means**

The app registration was created in the **Clear Focus Management** directory,
not the **Advertising Excellence** one. It was set up as single-tenant, which
is correct — but that means it only accepts sign-ins from accounts in the same
directory as the app. Our staff are all in the Advertising Excellence
directory, so none of them can get in.

Easily done if you administer both companies — Entra puts you back in whichever
directory you used last.

**What we need**

The same registration, in the **Advertising Excellence** directory. Everything
else from the original request is unchanged:

| Setting | Value |
|---|---|
| Directory | **Advertising Excellence** — please check the directory switcher before creating it |
| Name | `ADEX Mission Control` |
| Supported account types | Accounts in this organizational directory only (single tenant) |
| Redirect URI — platform | Web |
| Redirect URI 1 | `https://adex-mission-control.vercel.app/api/microsoft/callback` |
| Redirect URI 2 | `https://adex-mission-control-git-dev-adex3.vercel.app/api/microsoft/callback` |

Delegated Microsoft Graph permissions, as before — `User.Read`, `Mail.Read`,
`Mail.Send`, `Calendars.Read`, `Calendars.ReadWrite`, `offline_access`. No
Application permissions. Then **Grant admin consent for Advertising Excellence
Ltd**.

New client secret, description `Vercel`, expiry 24 months.

**Please send back, securely — not in plain email**

1. Application (client) ID
2. Directory (tenant) ID — this is the one that was wrong, so worth
   double-checking it is the Advertising Excellence directory
3. Client secret value (shown once, on creation)
4. The secret's expiry date

The old registration in Clear Focus Management can be deleted — nothing is
using it.

**Still outstanding from the original request:** is our shared drive on
SharePoint / OneDrive, or a server in the office? We'd like Space Orders filed
to the client's folder automatically when they're sent, which is straightforward
if the drive is in 365 and not possible if it's on a server here.

Thanks,
Connor

---

## What happens at our end once they reply

1. In Vercel → Settings → Environment Variables, update all three for
   **Production and Preview**:
   - `MS_CLIENT_ID` — the new Application (client) ID
   - `MS_TENANT_ID` — the new Directory (tenant) ID
   - `MS_CLIENT_SECRET` — the new secret value
2. **Redeploy.** Vercel bakes environment variables in at build time, so a
   change doesn't take effect until the next deployment.
3. Everyone who has already connected must press **Disconnect** then connect
   again in Settings. Their stored tokens were issued by the old app and the
   new one will not accept them.

The secret expires 24 months from creation. Put the date in a calendar: when it
lapses, every connection stops at once, and the symptom — all mailboxes
silently stopping — looks nothing like the cause.
