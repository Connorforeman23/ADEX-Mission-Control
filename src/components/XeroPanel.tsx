"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  disconnectXero,
  getXeroStatus,
  loadXeroContacts,
  pushTestDraftInvoice,
  type XeroStatus,
} from "@/lib/xero-actions";

// Admin-only Xero panel on Settings. Deliberately a proof of connection:
// connect, read the contact list, and push one DRAFT invoice.
type ContactRow = {
  xeroId: string;
  name: string;
  email: string | null;
  matchedOrg: string | null;
};

function when(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function XeroPanel() {
  const params = useSearchParams();
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [contacts, setContacts] = useState<ContactRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(params.get("xero"));

  useEffect(() => {
    getXeroStatus().then(setStatus);
  }, []);

  async function refreshStatus() {
    setStatus(await getXeroStatus());
  }

  async function onLoadContacts() {
    setBusy("contacts");
    setError(null);
    const res = await loadXeroContacts();
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setContacts(res.rows);
    setTotal(res.total);
    refreshStatus();
  }

  async function onPushTest(c: ContactRow) {
    const ok = window.confirm(
      `Create a £1.00 DRAFT invoice in Xero for "${c.name}"?\n\n` +
        "It is a draft — nothing is sent to anyone, and you can delete it in Xero afterwards."
    );
    if (!ok) return;
    setBusy(c.xeroId);
    setError(null);
    const res = await pushTestDraftInvoice(c.xeroId, c.name);
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setNotice(res.message);
  }

  async function onDisconnect() {
    const ok = window.confirm("Disconnect Xero? The stored tokens are deleted.");
    if (!ok) return;
    setBusy("disconnect");
    const res = await disconnectXero();
    setBusy(null);
    if (res.error) return setError(res.error);
    setContacts(null);
    setNotice("Xero disconnected.");
    refreshStatus();
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Xero</h2>
        <span className="sub">
          {status?.connected ? `Connected · ${status.tenantName ?? "—"}` : "Not connected"}
        </span>
      </div>
      <div className="card-body">
        {error && <p style={{ color: "var(--crit)", fontSize: 12.5, marginBottom: 12 }}>{error}</p>}
        {notice && <p style={{ color: "var(--ok)", fontSize: 12.5, marginBottom: 12 }}>{notice}</p>}

        {!status ? (
          <p className="empty-note">Checking the connection…</p>
        ) : !status.configured ? (
          <p className="empty-note">
            Xero isn&rsquo;t set up on this environment yet — the app credentials haven&rsquo;t been
            added. Nothing here will work until they are.
          </p>
        ) : !status.connected ? (
          <>
            <p className="sub-line" style={{ marginBottom: 12 }}>
              Connect the CRM to your Xero organisation. You&rsquo;ll be sent to Xero to approve it,
              and only an administrator can do this.
            </p>
            <a className="btn btn-primary" href="/api/xero/connect">
              Connect Xero
            </a>
          </>
        ) : (
          <>
            <div className="rows" style={{ marginBottom: 12 }}>
              <div className="row">
                <div className="grow">
                  <p>{status.tenantName}</p>
                  <small>
                    Connected {when(status.connectedAt)} · last read {when(status.lastSyncAt)}
                  </small>
                </div>
                <button className="btn" onClick={onDisconnect} disabled={busy === "disconnect"}>
                  Disconnect
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={onLoadContacts} disabled={busy === "contacts"}>
                {busy === "contacts" ? "Reading…" : "Read Xero contacts"}
              </button>
            </div>

            {contacts && (
              <>
                <p className="sub-line" style={{ marginTop: 14 }}>
                  {total} contacts in Xero{total > contacts.length ? `, showing ${contacts.length}` : ""}.
                  &ldquo;Matched&rdquo; means a CRM organisation already has that exact name.
                </p>
                <div className="rows" style={{ marginTop: 8 }}>
                  {contacts.map((c) => (
                    <div className="row" key={c.xeroId}>
                      <div className="grow">
                        <p>{c.name}</p>
                        <small>{c.email ?? "No email"}</small>
                      </div>
                      {c.matchedOrg ? (
                        <span className="pill" style={{ color: "var(--ok)" }}>
                          Matched
                        </span>
                      ) : (
                        <span className="pill">No CRM match</span>
                      )}
                      <button
                        className="btn"
                        onClick={() => onPushTest(c)}
                        disabled={busy === c.xeroId}
                      >
                        {busy === c.xeroId ? "Sending…" : "Test draft invoice"}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
