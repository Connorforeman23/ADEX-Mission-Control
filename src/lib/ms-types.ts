// Shared Microsoft types.
//
// Apart from ms-actions.ts because a "use server" module may export ONLY async
// functions — exporting a type from one makes it throw on load. That is what
// broke the Xero panel; the lesson is kept here.

export type MsStatus = {
  /** Whether this environment has Microsoft credentials at all. */
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  accountName: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
};
