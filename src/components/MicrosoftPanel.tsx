"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import CollapsibleCard from "@/components/CollapsibleCard";
import { disconnectMicrosoft, getMsStatus, syncMail, testMicrosoft } from "@/lib/ms-actions";
import type { MsStatus } from "@/lib/ms-types";

// Everyone's own Microsoft 365 connection, on Settings.
//
// Not admin-only, unlike Xero: each person links their own mailbox and
// calendar by their own choice, and can unlink it at any time.

function when(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function MicrosoftPanel() {
  const params = useSearchParams();
  const [status, setStatus] = useState<MsStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(params.get("ms"));

  // Never leave this spinning: if the check fails, say so.
  useEffect(() => {
    getMsStatus()
      .then(setStatus)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Could not check the connection.");
        setStatus({
          configured: true,
          connected: false,
          accountEmail: null,
          accountName: null,
          connectedAt: null,
          lastSyncAt: null,
        });
      });
  }, []);

  async function disconnect() {
    setBusy("disconnect");
    setError(null);
    const res = await disconnectMicrosoft();
    setBusy(null);
    if (res.error) return setError(res.error);
    setNotice("Disconnected. Emails already filed against a company stay — they are company history.");
    setStatus(await getMsStatus());
  }

  async function sync(days?: number) {
    setBusy("sync");
    setError(null);
    setNotice(null);
    const res = await syncMail(days);
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setNotice(res.message);
    setStatus(await getMsStatus());
  }

  async function test() {
    setBusy("test");
    setError(null);
    setNotice(null);
    const res = await testMicrosoft();
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setNotice(res.message);
    setStatus(await getMsStatus());
  }

  const sub = !status
    ? "Checking…"
    : !status.configured
      ? "Not configured on this environment"
      : status.connected
        ? `Connected · ${status.accountEmail ?? "your account"}`
        : "Not connected";

  return (
    <CollapsibleCard id="microsoft" title="Microsoft 365" sub={sub}>
      <div className="card-body">
        {!status ? (
          <p className="empty-note">Checking the connection…</p>
        ) : !status.configured ? (
          <p className="empty-note">
            Microsoft 365 isn&rsquo;t configured on this environment. That is expected on
            deployments where it hasn&rsquo;t been set up.
          </p>
        ) : status.connected ? (
          <div className="rows">
            <div className="row">
              <div className="grow">
                <p>{status.accountName ?? "Connected"}</p>
                <small>
                  {status.accountEmail} · connected {when(status.connectedAt)} · last checked{" "}
                  {when(status.lastSyncAt)}
                </small>
              </div>
              <button className="btn btn-primary" onClick={() => sync()} disabled={!!busy}>
                {busy === "sync" ? "Reading your mailbox…" : "Sync my mail"}
              </button>
              <button className="btn" onClick={test} disabled={!!busy}>
                {busy === "test" ? "Checking…" : "Test"}
              </button>
              <button className="btn" onClick={disconnect} disabled={!!busy}>
                {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
            <div className="row">
              <small className="sub-line">
                Only mail involving a company already in the CRM is kept — never internal or
                personal mail. The first sync reaches back three months; after that it picks up
                what has arrived since.
              </small>
            </div>
          </div>
        ) : (
          <>
            <p className="empty-note" style={{ marginBottom: 12 }}>
              Link your own Outlook mailbox and calendar. Mission Control will file emails with
              clients and suppliers against the right company, show your meetings, and put a
              calendar entry against any task you give a time to.
            </p>
            <ul style={{ margin: "0 0 14px 18px", padding: 0, color: "var(--mid)", fontSize: 12.5, lineHeight: 1.7 }}>
              <li>Only mail involving a company already in the CRM is kept — never internal or personal mail.</li>
              <li>Nothing is read when you are not signed in. Disconnect at any time.</li>
              <li>Filed emails are readable by colleagues with full access; that is the point of shared history.</li>
            </ul>
            <a className="btn btn-primary" href="/api/microsoft/connect">
              Connect my Microsoft account
            </a>
          </>
        )}

        {notice && <p style={{ color: "var(--ok)", fontSize: 12.5, marginTop: 12 }}>{notice}</p>}
        {error && <p style={{ color: "var(--crit)", fontSize: 12.5, marginTop: 12 }}>{error}</p>}
      </div>
    </CollapsibleCard>
  );
}
