"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createApiKey, revokeApiKey } from "@/lib/actions";
import { dateGB } from "@/lib/money";
import CollapsibleCard from "@/components/CollapsibleCard";

type Key = {
  id: string;
  label: string;
  owner: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

/**
 * Keys that let another system read a person's clients.
 *
 * The key is shown once, on creation, and then never again — the database
 * only holds its hash. That is the whole security model in one sentence, so
 * the screen says it plainly rather than letting someone discover it when
 * they come back looking for a key that is no longer there.
 */
export default function ApiKeys({
  keys,
  staff,
}: {
  keys: Key[];
  staff: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await createApiKey(label, ownerId);
    setBusy(false);
    if ("error" in res && res.error) return setError(res.error);
    if ("key" in res && res.key) {
      setFresh(res.key);
      setLabel("");
      router.refresh();
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError(null);
    const res = await revokeApiKey(id);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  const live = keys.filter((k) => !k.revokedAt);

  return (
    <CollapsibleCard
      id="api-keys"
      title="Read-only access for another system"
      sub={`${live.length} active`}
    >
      <div className="card-body">
        <p className="sub-line" style={{ marginTop: 0 }}>
          A key lets an outside system read one person&rsquo;s clients &mdash; name, sector,
          status, how many campaigns and what they have billed. Nothing else is reachable, and
          nothing can be changed through it. The key says whose clients it may read, so the system
          holding it cannot ask for anybody else&rsquo;s.
        </p>

        {fresh && (
          <div
            style={{
              border: "1px solid var(--ok)",
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div className="eyebrow" style={{ color: "var(--ok)", marginBottom: 6 }}>
              Copy this now &mdash; it is never shown again
            </div>
            <code
              style={{
                display: "block",
                wordBreak: "break-all",
                fontSize: 12.5,
                marginBottom: 8,
              }}
            >
              {fresh}
            </code>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(fresh);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                  } catch {
                    setError("Your browser would not let me use the clipboard — select it above.");
                  }
                }}
              >
                {copied ? "Copied" : "Copy the key"}
              </button>
              <button className="btn" onClick={() => setFresh(null)}>
                Done
              </button>
            </div>
            <small className="sub-line" style={{ display: "block", marginTop: 8 }}>
              Only its fingerprint is stored, so nobody &mdash; including me &mdash; can look it up
              later. Lose it and issue a new one.
            </small>
          </div>
        )}

        <div className="form-grid" style={{ marginBottom: 10 }}>
          <label className="field">
            <span>What is it for</span>
            <input
              className="input"
              value={label}
              placeholder="CFM Command"
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Whose clients it may read</span>
            <select className="input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Choose…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="btn btn-primary"
          onClick={create}
          disabled={busy || !label.trim() || !ownerId}
        >
          {busy ? "Creating…" : "Create a key"}
        </button>

        {error && (
          <p style={{ color: "var(--crit)", marginBottom: 0 }}>{error}</p>
        )}

        {keys.length > 0 && (
          <div className="rows" style={{ marginTop: 14 }}>
            {keys.map((k) => (
              <div className="row" key={k.id}>
                <div className="grow">
                  <p>
                    {k.label}
                    {k.revokedAt && <span className="sub-line"> · revoked</span>}
                  </p>
                  <small>
                    {`Reads ${k.owner}'s clients · created ${dateGB(k.createdAt)} · `}
                    {k.lastUsedAt ? `last used ${dateGB(k.lastUsedAt)}` : "never used"}
                  </small>
                </div>
                {!k.revokedAt && (
                  <button className="btn" onClick={() => revoke(k.id)} disabled={busy}>
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <details style={{ marginTop: 14 }}>
          <summary className="sub-line" style={{ cursor: "pointer" }}>
            How the other system calls it
          </summary>
          <pre
            className="input"
            style={{
              marginTop: 8,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
{`GET https://adex-mission-control.vercel.app/api/external/clients
Authorization: Bearer <the key>

Returns:
{ "clients": [
    { "id": "…", "name": "Randox Health", "sector": "Healthcare",
      "status": "live", "campaigns": 7, "billingsExVat": 148200,
      "lastCampaignEnded": "2026-09-30" } ] }`}
          </pre>
          <small className="sub-line">
            Send the key in the header, never in the address. A key in a URL ends up in logs and
            browser history, and a key in either of those has leaked.
          </small>
        </details>
      </div>
    </CollapsibleCard>
  );
}
