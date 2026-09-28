"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { copyCampaign } from "@/lib/actions";

/**
 * Repeat a campaign in a later month.
 *
 * Asks for the new start date rather than assuming "a month later" — a
 * fortnight in October does not always land neatly a month after one in
 * September, and the account handler knows which Monday they mean.
 */
export default function CopyCampaign({
  campaignId,
  needsCreativeDeadline,
}: {
  campaignId: string;
  /** Any line on New Copy means the studio needs a deadline for the copy too. */
  needsCreativeDeadline: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    if (!start) return setError("Choose the date the new campaign starts.");
    setBusy(true);
    setError(null);
    const res = await copyCampaign(campaignId, start, deadline);
    setBusy(false);
    if (res.error) return setError(res.error);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        Copy to a new month
      </button>
    );
  }

  return (
    <div
      className="card"
      style={{ padding: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}
    >
      <label className="field">
        <span>New start date</span>
        <input
          className="input num"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      {needsCreativeDeadline && (
        <label className="field">
          <span>Creative deadline</span>
          <input
            className="input num"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
      )}
      <button className="btn btn-primary" onClick={copy} disabled={busy}>
        {busy ? "Copying…" : "Create the copy"}
      </button>
      <button className="btn" onClick={() => setOpen(false)} disabled={busy}>
        Cancel
      </button>
      <p className="sub-line" style={{ flex: "1 1 100%", margin: 0 }}>
        Every date shifts by the same number of days, so the shape of the booking is kept. The copy
        arrives as <b>Planning</b> with its own reference and its own Space Orders.
      </p>
      {error && <p style={{ color: "var(--crit)", fontSize: 12.5, flex: "1 1 100%", margin: 0 }}>{error}</p>}
    </div>
  );
}
