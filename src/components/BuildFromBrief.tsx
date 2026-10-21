"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildProposalFromBrief, readBriefDocument, saveClientBrief } from "@/lib/actions";
import { PROPOSAL_PROMPT } from "@/lib/proposal-brief";

/**
 * Write the brief, paste it, get the deck.
 *
 * This is the way in. The slide-by-slide editor below is for tweaking what
 * comes out, not for building from nothing.
 *
 * Two boxes, numbered, because they do opposite jobs and an unlabelled pair
 * is genuinely confusing: the first holds what the CLIENT sent us, the second
 * holds what came BACK from the assistant. The prompt appears in one place
 * only — the button carries it, with the brief already attached, so there is
 * one thing on the clipboard and one paste at the other end.
 */
export default function BuildFromBrief({
  id,
  hasSlides,
  clientBrief: savedBrief,
}: {
  id: string;
  hasSlides: boolean;
  clientBrief: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!hasSlides);
  const [clientBrief, setClientBrief] = useState(savedBrief);
  const [outline, setOutline] = useState("");
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  /** Shown only when the clipboard is refused, so the text can be selected. */
  const [fallback, setFallback] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  /** The prompt and the client's brief, as one thing to paste. */
  const composed = () =>
    PROPOSAL_PROMPT + (clientBrief.trim() || "(paste the client's brief here)");

  async function copyPrompt() {
    setError(null);
    setFallback(null);
    try {
      await navigator.clipboard.writeText(composed());
      setNote("Copied. Paste it into ChatGPT or Claude, then bring the answer back to box 2.");
      setTimeout(() => setNote(null), 6000);
    } catch {
      setFallback(composed());
    }
  }

  async function attach(f: File) {
    setBusy("file");
    setError(null);
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.readAsDataURL(f);
    }).catch(() => "");
    if (!dataUri) {
      setBusy(null);
      return setError("Could not read that file.");
    }
    const res = await readBriefDocument(dataUri, f.name);
    setBusy(null);
    if ("error" in res) return setError(res.error);
    // Added to whatever is already there — briefs arrive in more than one
    // email as often as not.
    setClientBrief((prev) => (prev.trim() ? `${prev.trim()}\n\n${res.text}` : res.text));
    setNote(`Read ${f.name}.`);
    setTimeout(() => setNote(null), 6000);
  }

  async function keepBrief() {
    setBusy("brief");
    setError(null);
    const res = await saveClientBrief(id, clientBrief);
    setBusy(null);
    if (res.error) return setError(res.error);
    setNote("The client's brief is saved against this proposal.");
    setTimeout(() => setNote(null), 6000);
    router.refresh();
  }

  async function build() {
    setBusy("build");
    setError(null);
    setWarnings([]);
    // Keep the client's brief too, so it is not lost when the panel closes.
    if (clientBrief.trim() !== savedBrief.trim()) await saveClientBrief(id, clientBrief);
    const res = await buildProposalFromBrief(id, outline, mode);
    setBusy(null);
    if ("error" in res && res.error) return setError(res.error);
    if ("warnings" in res) setWarnings(res.warnings ?? []);
    setOutline("");
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
            {savedBrief
              ? "The client's brief is saved here. Open this to rebuild the slides from it."
              : "Drop in the client's brief and build the slides from it."}
          </small>
        </div>
      </section>
    );
  }

  const mono = {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12.5,
  } as const;

  return (
    <section className="card" style={{ marginBottom: 14 }}>
      <div className="card-body">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Build from a brief
        </div>

        {/* --- 1 ------------------------------------------------------- */}
        <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>1. The client&rsquo;s brief</h3>
        <p className="sub-line" style={{ margin: "0 0 8px" }}>
          Attach what they sent, or paste it in. It stays on the proposal, so you can re-read what
          was actually asked for.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <button className="btn" onClick={() => file.current?.click()} disabled={!!busy}>
            {busy === "file" ? "Reading…" : "Attach a document"}
          </button>
          <button className="btn" onClick={keepBrief} disabled={!!busy || !clientBrief.trim()}>
            {busy === "brief" ? "Saving…" : "Save the brief"}
          </button>
          <small className="sub-line" style={{ alignSelf: "center" }}>
            Word (.docx) or plain text. For a PDF, open it and paste the text.
          </small>
        </div>

        <textarea
          className="input"
          rows={8}
          value={clientBrief}
          onChange={(e) => setClientBrief(e.target.value)}
          placeholder="Paste the client's brief — the email, the document, whatever they sent."
        />

        {/* --- 2 ------------------------------------------------------- */}
        <h3 style={{ margin: "18px 0 4px", fontSize: 14 }}>2. Turn it into slides</h3>
        <p className="sub-line" style={{ margin: "0 0 8px" }}>
          The button puts our house-style instructions and the brief above on your clipboard as one
          piece. Paste that into ChatGPT or Claude, then paste its answer into the box below.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <button className="btn" onClick={copyPrompt} disabled={!!busy}>
            Copy the house style + this brief
          </button>
          {hasSlides && (
            <select
              className="input"
              style={{ maxWidth: 220 }}
              value={mode}
              onChange={(e) => setMode(e.target.value as "replace" | "append")}
            >
              <option value="replace">Replace the slides</option>
              <option value="append">Add to the end</option>
            </select>
          )}
        </div>

        {fallback && (
          <textarea
            className="input"
            rows={8}
            readOnly
            value={fallback}
            style={{ ...mono, marginBottom: 8 }}
            onFocus={(e) => e.currentTarget.select()}
          />
        )}

        <textarea
          className="input"
          rows={12}
          value={outline}
          onChange={(e) => setOutline(e.target.value)}
          placeholder={
            "Paste the answer here.\n\n# 2027 Growth Planning\nPrepared for Randox Health\n\n## The audience | Who we need to reach\n\nfigures:\n1.4m = Adults reached\n\nstrip: Two thirds of the audience, four times over."
          }
          style={mono}
        />
        <small className="sub-line">
          You can also write this yourself — a slide starts with <code>##</code>, then{" "}
          <code>figures:</code>, <code>bullets:</code>, <code>steps:</code>, <code>table:</code>,{" "}
          <code>logos:</code>, <code>strip:</code> or <code>note:</code>.
        </small>

        {error && <p style={{ color: "var(--crit)", marginBottom: 0 }}>{error}</p>}
        {note && !error && (
          <p className="sub-line" style={{ color: "var(--ok)", marginBottom: 0 }}>
            {note}
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
          <button className="btn btn-primary" onClick={build} disabled={!!busy || !outline.trim()}>
            {busy === "build" ? "Building…" : "Build the slides"}
          </button>
          <button className="btn" onClick={() => setOpen(false)} disabled={!!busy}>
            Close
          </button>
        </div>

        <input
          ref={file}
          type="file"
          accept=".docx,.txt,.md,.markdown,.csv,.eml"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) attach(f);
          }}
        />
      </div>
    </section>
  );
}
