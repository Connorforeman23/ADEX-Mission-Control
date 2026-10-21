"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProposal, newProposalVersion, setProposalStatus } from "@/lib/actions";

/**
 * What you can do to a proposal: send it, record the answer, start the next
 * version, or throw it away.
 *
 * Marking it Sent is the step that matters — that is the date the pipeline
 * reads, and it also writes the organisation's timeline, so the proposal sits
 * beside the calls and the emails rather than only on its own page.
 */
export default function ProposalActions({
  id,
  kind,
  status,
}: {
  id: string;
  kind: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function move(next: string) {
    setBusy(next);
    setError(null);
    const res = await setProposalStatus(id, next);
    setBusy(null);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function version() {
    setBusy("version");
    setError(null);
    const res = await newProposalVersion(id);
    setBusy(null);
    if ("error" in res && res.error) return setError(res.error);
    if ("id" in res && res.id) router.push(`/proposals/${res.id}`);
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    const res = await deleteProposal(id);
    setBusy(null);
    if (res.error) return setError(res.error);
    router.push("/proposals");
  }

  const decided = status === "Won" || status === "Lost";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {kind === "deck" && (
          // A plain link, not fetch(): the browser handles the download, and
          // the file is built on request so it is always the current template.
          <a className="btn" href={`/api/proposals/${id}/deck`}>
            Download deck
          </a>
        )}

        {status === "Draft" && (
          <button className="btn btn-primary" onClick={() => move("Sent")} disabled={!!busy}>
            {busy === "Sent" ? "Recording…" : "Mark as sent"}
          </button>
        )}

        {status === "Sent" && (
          <>
            <button className="btn btn-primary" onClick={() => move("Won")} disabled={!!busy}>
              Won
            </button>
            <button className="btn" onClick={() => move("Lost")} disabled={!!busy}>
              Lost
            </button>
          </>
        )}

        {decided && (
          <button className="btn" onClick={() => move("Sent")} disabled={!!busy}>
            Reopen
          </button>
        )}

        {status === "Superseded" && (
          <button className="btn" onClick={() => move("Draft")} disabled={!!busy}>
            Make this the live version
          </button>
        )}

        <button className="btn" onClick={version} disabled={!!busy}>
          {busy === "version" ? "Copying…" : "New version"}
        </button>

        {confirming ? (
          <>
            <button className="btn" onClick={remove} disabled={!!busy} style={{ color: "var(--crit)" }}>
              {busy === "delete" ? "Deleting…" : "Really delete"}
            </button>
            <button className="btn" onClick={() => setConfirming(false)} disabled={!!busy}>
              Keep it
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => setConfirming(true)} disabled={!!busy}>
            Delete
          </button>
        )}
      </div>

      {error && <small style={{ color: "var(--crit)" }}>{error}</small>}
      {status === "Draft" && (
        <small className="sub-line">
          Download it, send it from your own mailbox, then mark it sent.
        </small>
      )}
    </div>
  );
}
