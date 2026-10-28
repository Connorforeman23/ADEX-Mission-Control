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
  /**
   * Which app registration and directory this BUILD is using.
   *
   * Neither is a secret — a client ID is public by design, and the error
   * screen Microsoft shows prints it anyway. They are here because a
   * setting changed in Vercel does nothing until a new build, and without
   * seeing the value the only way to tell whether a build had picked it up
   * was to try a sign-in and read the failure.
   */
  clientId: string | null;
  tenant: string | null;
};
