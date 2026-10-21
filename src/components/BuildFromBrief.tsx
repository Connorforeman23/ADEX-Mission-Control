"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildProposalFromBrief, readBriefDocument, saveClientBrief } from "@/lib/actions";

/**
 * The client's brief goes in. The deck comes out. One button.
 *
 * Connor, on the version this replaced: "i normally then just put that
 * document into Claude and ask it to build a proposal in house style... I
 * just want this to be like that in the system instead, there is too many
 * steps in this". He was right — copying a prompt out to another tab and
 * pasting an answer back is not a feature, it is a missing one.
 *
 * Writing an outline by hand still works, but it lives behind a disclosure
 * now: it is the fallback, not the way in.
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
  const [brief, setBrief] = useState(savedBrief);
  const [outline, setOutline] = useState("");
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const file = useRef<HTMLInputElement>(null);

  function flash(message: string) {
    setNote(message);
    setTimeout(() => setNote(null), 8000);
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
    // Added to what is already there — briefs arrive in more than one email
    // as often as not.
    setBrief((prev) => (prev.trim() ? `${prev.trim()}\n\n${res.text}` : res.text));
    flash(`Read ${f.name}.`);
  }

  /** The one that matters: brief in, slides out. */
  async function write() {
    setBusy("write");
    setError(null);
    setWarnings([]);
    try {
      const res = await fetch(`/api/proposals/${id}/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientBrief: brief, mode }),
      });
      const data = (await res.json()) as {
        error?: string;
        built?: number;
        warnings?: string[];
        pence?: number;
      };
      if (!res.ok || data.error) {
        setBusy(null);
        return setError(data.error ?? "The deck could not be written.");
      }
      setWarnings(data.warnings ?? []);
      setBusy(null);
      setOpen(false);
      flash(
        `Wrote ${data.built} slides${data.pence ? ` — about ${data.pence}p` : ""}. Read them through before it goes anywhere.`
      );
      router.refresh();
    } catch {
      setBusy(null);
      setError("The request failed before it finished. Try again.");
    }
  }

  async function keepBrief() {
    setBusy("brief");
    setError(null);
    const res = await saveClientBrief(id, brief);
    setBusy(null);
    if (res.error) return setError(res.error);
    flash("Saved.");
    router.refresh();
  }

  /** The fallback, for an outline written or pasted by hand. */
  async function buildFromOutline() {
    setBusy("outline");
    setError(null);
    setWarnings([]);
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
            {note ?? "Drop in the client's brief and the deck writes itself."}
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
        <p className="sub-line" style={{ margin: "0 0 10px" }}>
          Attach the client&rsquo;s document or paste it in, then press Write the deck. It comes
          out in ADEX house style, and nothing is invented &mdash; a figure the brief does not give
          is left blank rather than guessed.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <button className="btn" onClick={() => file.current?.click()} disabled={!!busy}>
            {busy === "file" ? "Reading…" : "Attach a document"}
          </button>
          <button className="btn" onClick={keepBrief} disabled={!!busy || !brief.trim()}>
            {busy === "brief" ? "Saving…" : "Save the brief"}
          </button>
          {hasSlides && (
            <select
              className="input"
              style={{ maxWidth: 210 }}
              value={mode}
              onChange={(e) => setMode(e.target.value as "replace" | "append")}
              disabled={!!busy}
            >
              <option value="replace">Replace the slides</option>
              <option value="append">Add to the end</option>
            </select>
          )}
          <small className="sub-line" style={{ alignSelf: "center" }}>
            Word (.docx) or plain text. For a PDF, open it and paste the text.
          </small>
        </div>

        <textarea
          className="input"
          rows={14}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Paste the client's brief — the email, the report, whatever they sent."
          disabled={busy === "write"}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className="btn btn-primary"
            onClick={write}
            disabled={!!busy || !brief.trim()}
          >
            {busy === "write" ? "Writing the deck…" : "Write the deck"}
          </button>
          <button className="btn" onClick={() => setOpen(false)} disabled={!!busy}>
            Close
          </button>
          {busy === "write" && (
            <small className="sub-line">
              A long brief takes a minute or two. Leave this page open.
            </small>
          )}
        </div>

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

        <details style={{ marginTop: 16 }}>
          <summary className="sub-line" style={{ cursor: "pointer" }}>
            Write the slides yourself instead
          </summary>
          <p className="sub-line" style={{ margin: "8px 0" }}>
            A slide starts with <code>##</code>, then <code>figures:</code>, <code>bullets:</code>,{" "}
            <code>steps:</code>, <code>table:</code>, <code>logos:</code>, <code>strip:</code> or{" "}
            <code>note:</code>.
          </p>
          <textarea
            className="input"
            rows={10}
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            placeholder={
              "## The audience | Who we need to reach\n\nfigures:\n1.4m = Adults reached\n\nstrip: Two thirds of the audience, four times over."
            }
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5 }}
          />
          <button
            className="btn"
            style={{ marginTop: 8 }}
            onClick={buildFromOutline}
            disabled={!!busy || !outline.trim()}
          >
            {busy === "outline" ? "Building…" : "Build from this outline"}
          </button>
        </details>

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
