"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removeOrganisationLogo, saveOrganisationLogo } from "@/lib/actions";

/**
 * The company's logo, for proposal decks.
 *
 * The file is read in the browser only to get the bytes across; everything
 * that matters — resizing, converting to PNG, the size limit — happens on the
 * server, so what lands in the database is predictable however odd the
 * original was.
 */
export default function LogoUpload({
  organisationId,
  name,
  logo,
}: {
  organisationId: string;
  name: string;
  logo: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File) {
    setBusy(true);
    setError(null);
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.readAsDataURL(file);
    }).catch((e: Error) => {
      setError(e.message);
      return "";
    });
    if (!dataUri) return setBusy(false);

    const res = await saveOrganisationLogo(organisationId, dataUri);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await removeOrganisationLogo(organisationId);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div
        style={{
          width: 128,
          height: 72,
          flex: "none",
          borderRadius: 8,
          border: `1px ${logo ? "solid" : "dashed"} var(--line)`,
          background: "var(--surface-2)",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          padding: 8,
        }}
      >
        {logo ? (
          // Already normalised to a 400px PNG by the server.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={`${name} logo`}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        ) : (
          <span className="sub-line" style={{ fontSize: 11 }}>
            No logo
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? "Saving…" : logo ? "Replace logo" : "Add logo"}
          </button>
          {logo && (
            <button className="btn" onClick={remove} disabled={busy}>
              Remove
            </button>
          )}
        </div>
        <small className="sub-line">
          Used on proposal decks — a media owner&rsquo;s logo appears on the channel slide it
          belongs to. PNG with a transparent background works best.
        </small>
        {error && <small style={{ color: "var(--crit)" }}>{error}</small>}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) choose(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
