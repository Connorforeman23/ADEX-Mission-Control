"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importBookings } from "@/lib/actions";
import { IMPORT_COLUMNS, REQUIRED_COLUMNS, TEMPLATE_CSV } from "@/lib/import-bookings";

type Result = Awaited<ReturnType<typeof importBookings>>;

/**
 * Loading a year of bookings from a spreadsheet.
 *
 * Nothing is written until the preview has been seen. The preview runs the
 * real importer with the writes switched off, so what it promises and what
 * happens cannot drift apart — the usual way a preview starts lying.
 */
export default function BookingImport() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Result | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function run(dryRun: boolean) {
    setBusy(dryRun ? "preview" : "import");
    const res = await importBookings(csv, dryRun);
    setBusy(null);
    if (dryRun) {
      setPreview(res);
      setDone(null);
    } else {
      setDone(res);
      setPreview(null);
      router.refresh();
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ADEX booking import template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const result = done ?? preview;
  const counts = result?.ok ? result.created : null;

  return (
    <>
      <section className="card" style={{ marginBottom: 14 }}>
        <div className="card-body">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button className="btn" onClick={downloadTemplate}>
              Download the template
            </button>
            <button className="btn" onClick={() => file.current?.click()} disabled={!!busy}>
              Choose a CSV
            </button>
          </div>

          <p className="sub-line" style={{ marginTop: 0 }}>
            One row per booking line. Headings must be on the first row. Required:{" "}
            <Cols names={[...REQUIRED_COLUMNS]} />. Optional:{" "}
            <Cols
              names={IMPORT_COLUMNS.filter(
                (c) => !(REQUIRED_COLUMNS as readonly string[]).includes(c)
              )}
            />
            .
          </p>
          <p className="sub-line">
            Dates are read day first &mdash; <code>01/03/2026</code> is the 1st of March. Rows for
            the same client and campaign name become one campaign, and its dates are the span of
            its lines. Put the old order number in <code>po</code> and the CRM will carry on above
            it rather than reissuing a number a supplier already has.
          </p>

          <textarea
            className="input"
            rows={10}
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
              setDone(null);
            }}
            placeholder="Paste the spreadsheet here, or choose a CSV above."
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5 }}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => run(true)} disabled={!!busy || !csv.trim()}>
              {busy === "preview" ? "Checking…" : "Check the file"}
            </button>
            {preview?.ok && preview.created.lines > 0 && (
              <button className="btn btn-primary" onClick={() => run(false)} disabled={!!busy}>
                {busy === "import"
                  ? "Importing…"
                  : `Import ${preview.created.lines} lines`}
              </button>
            )}
          </div>

          <input
            ref={file}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => {
                setCsv(String(reader.result));
                setPreview(null);
                setDone(null);
              };
              reader.readAsText(f);
            }}
          />
        </div>
      </section>

      {result && !result.ok && (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <p style={{ color: "var(--crit)", margin: 0 }}>{result.error}</p>
          </div>
        </section>
      )}

      {counts && (
        <>
          <div className="kpis">
            <div className="card kpi">
              <div className="eyebrow">{done ? "Lines imported" : "Lines to import"}</div>
              <div className="num kpi-value">{counts.lines}</div>
              <div className="kpi-foot">
                {`${result?.ok ? result.groups : 0} campaigns in the file`}
              </div>
            </div>
            <div className="card kpi">
              <div className="eyebrow">{done ? "Campaigns created" : "New campaigns"}</div>
              <div className="num kpi-value">{counts.campaigns}</div>
              <div className="kpi-foot">The rest already existed</div>
            </div>
            <div className="card kpi">
              <div className="eyebrow">{done ? "Clients created" : "New clients"}</div>
              <div className="num kpi-value">{counts.clients}</div>
              <div className="kpi-foot">Matched on name</div>
            </div>
            <div className="card kpi">
              <div className="eyebrow">Already on the books</div>
              <div className="num kpi-value">
                {result?.ok ? result.skipped.length : 0}
              </div>
              <div className="kpi-foot">Skipped, not duplicated</div>
            </div>
          </div>

          {done && (
            <section className="card" style={{ marginBottom: 14 }}>
              <div className="card-body">
                <p style={{ margin: 0, color: "var(--ok)" }}>
                  Imported. {counts.lines} lines are now on the books.
                </p>
                <small className="sub-line">
                  Check a campaign or two before loading the next batch.
                </small>
              </div>
            </section>
          )}
        </>
      )}

      {result && result.problems.length > 0 && (
        <Issues
          title={`${result.problems.length} rows could not be read`}
          tone="var(--crit)"
          note="These rows were left out. Everything else still imports — fix these and run the file again."
          items={result.problems.map((p) => (p.row ? `Row ${p.row}: ${p.problem}` : p.problem))}
        />
      )}

      {result?.ok && result.failures.length > 0 && (
        <Issues
          title={`${result.failures.length} rows the database refused`}
          tone="var(--crit)"
          note="Everything else went in."
          items={result.failures}
        />
      )}

      {result?.ok && result.skipped.length > 0 && (
        <Issues
          title={`${result.skipped.length} already on the books`}
          tone="var(--warn)"
          note="Matched on supplier, start date and cost — safe to run the same file twice."
          items={result.skipped}
        />
      )}

      {result?.ok && result.ignoredColumns.length > 0 && (
        <Issues
          title="Columns that were ignored"
          tone="var(--warn)"
          note="Not headings the importer knows. If one of these was meant to be used, it is probably a typo."
          items={result.ignoredColumns}
        />
      )}
    </>
  );
}

/** A comma-separated list of column names, each in its own <code>. */
function Cols({ names }: { names: readonly string[] }) {
  return (
    <>
      {names.map((n, i) => (
        <span key={n}>
          {i > 0 && ", "}
          <code>{n}</code>
        </span>
      ))}
    </>
  );
}

function Issues({
  title,
  tone,
  note,
  items,
}: {
  title: string;
  tone: string;
  note: string;
  items: string[];
}) {
  return (
    <section className="card" style={{ marginBottom: 14 }}>
      <div className="card-body">
        <div className="eyebrow" style={{ color: tone, marginBottom: 6 }}>
          {title}
        </div>
        <p className="sub-line" style={{ marginTop: 0 }}>
          {note}
        </p>
        <div style={{ maxHeight: 260, overflow: "auto" }}>
          {items.slice(0, 200).map((t, i) => (
            <small key={i} style={{ display: "block", padding: "2px 0" }}>
              {t}
            </small>
          ))}
          {items.length > 200 && (
            <small className="sub-line">and {items.length - 200} more…</small>
          )}
        </div>
      </div>
    </section>
  );
}
