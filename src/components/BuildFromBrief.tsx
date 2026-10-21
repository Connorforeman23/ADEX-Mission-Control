"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildProposalFromBrief } from "@/lib/actions";
import { PROPOSAL_PROMPT } from "@/lib/proposal-brief";

/**
 * Write the brief, paste it, get the deck.
 *
 * This is the way in. The slide-by-slide editor below is for tweaking what
 * comes out, not for building from nothing — filling in a form per slide is
 * the part nobody wants to do.
 *
 * The prompt that teaches an assistant the format is one button away, so the
 * round trip is: copy prompt, paste brief into whichever chat you like, paste
 * the answer back here.
 */
export default function BuildFromBrief({
  id,
  hasSlides,
}: {
  id: string;
  hasSlides: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!hasSlides);
  const [brief, setBrief] = useState("");
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(PROPOSAL_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access can be refused; the textarea fallback is below.
      setError("Your browser would not let me use the clipboard — the prompt is shown below.");
    }
  }

  async function build() {
    setBusy(true);
    setError(null);
    setWarnings([]);
    const res = await buildProposalFromBrief(id, brief, mode);
    setBusy(false);
    if ("error" in res && res.error) return setError(res.error);
    if ("warnings" in res) setWarnings(res.warnings ?? []);
    setBrief("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <section className="card" style={{ marginBottom: 14 }}>
        <div
          className="card-body"
          style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
        >
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            Build from a brief
          </button>
          <small className="sub-line">
            Write the deck through as a brief and paste it in — the slides below are for tweaking
            what comes out.
          </small>
        </div>
      </section>
    );
  }

  return (
    <section className="card" style={{ marginBottom: 14 }}>
      <div className="card-body">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Build from a brief
        </div>

        <p className="sub-line" style={{ marginTop: 0 }}>
          Copy the prompt, paste it into ChatGPT or Claude with your brief underneath, then paste
          what comes back into the box. You can also just write the outline yourself — headings
          start with <code>##</code>.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button className="btn" onClick={copyPrompt}>
            {copied ? "Copied" : "Copy the prompt"}
          </button>
          {hasSlides && (
            <select
              className="input"
              style={{ maxWidth: 240 }}
              value={mode}
              onChange={(e) => setMode(e.target.value as "replace" | "append")}
            >
              <option value="replace">Replace the slides</option>
              <option value="append">Add to the end</option>
            </select>
          )}
        </div>

        <textarea
          className="input"
          rows={14}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={"# 2027 Growth Planning\nPrepared for Randox Health\n\n## The audience | Who we need to reach, and where they already are\n\nfigures:\n1.4m = Adults reached\n68% = Of the target audience\n\nstrip: Two thirds of the audience, four times over."}
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5 }}
        />

        {error && (
          <p style={{ color: "var(--crit)", marginBottom: 0 }}>
            {error}
          </p>
        )}

        {warnings.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {warnings.map((w, i) => (
              <small key={i} style={{ display: "block", color: "var(--warn)" }}>
                {w}
              </small>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={build} disabled={busy || !brief.trim()}>
            {busy ? "Building…" : "Build the slides"}
          </button>
          <button className="btn" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </button>
        </div>

        <details style={{ marginTop: 12 }}>
          <summary className="sub-line" style={{ cursor: "pointer" }}>
            Show the prompt
          </summary>
          <textarea
            className="input"
            rows={10}
            readOnly
            value={PROPOSAL_PROMPT}
            style={{
              marginTop: 8,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
            }}
          />
        </details>
      </div>
    </section>
  );
}
