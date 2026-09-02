// Shared Xero types.
//
// These live apart from xero-actions.ts deliberately: a "use server" module may
// export ONLY async functions. Exporting a type from one compiles to a runtime
// reference to something that no longer exists, and the module then throws
// "ReferenceError: <Type> is not defined" on load — which is exactly what broke
// the Xero panel. Types belong here; actions export functions and nothing else.

export type XeroStatus = {
  configured: boolean;
  connected: boolean;
  tenantName: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
};

export type XeroContact = {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
};

export type XeroContactRow = {
  xeroId: string;
  name: string;
  email: string | null;
  matchedOrg: string | null;
};

export type LoadContactsResult =
  | { ok: true; rows: XeroContactRow[]; total: number }
  | { ok: false; error: string };

export type PushInvoiceResult = { ok: true; message: string } | { ok: false; error: string };

export type XeroInvoiceResult =
  | { ok: true; invoiceNumber: string | null; message: string }
  | { ok: false; error: string };
