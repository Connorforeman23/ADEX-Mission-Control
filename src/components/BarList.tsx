import { gbpK } from "@/lib/money";

export type BarRow = {
  label: string;
  value: number;
  colour: string;
  sub?: string;
};

/** Horizontal bars — used for channel mix and billings by sales team. */
export default function BarList({ rows, empty }: { rows: BarRow[]; empty: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);

  if (!rows.length || max === 0) {
    return <p className="empty-note">{empty}</p>;
  }

  const total = rows.reduce((a, r) => a + r.value, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ minWidth: 104, fontSize: 12.5, color: "var(--mid)" }}>{r.label}</span>
          <div
            style={{
              flex: 1,
              height: 8,
              borderRadius: 99,
              background: "var(--surface-3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(r.value / max) * 100}%`,
                height: "100%",
                borderRadius: 99,
                background: r.colour,
              }}
            />
          </div>
          <span className="num" style={{ width: 64, textAlign: "right", fontSize: 12.5, fontWeight: 650 }}>
            {gbpK(r.value)}
          </span>
          <span className="num" style={{ width: 38, textAlign: "right", fontSize: 11.5, color: "var(--faint)" }}>
            {total ? Math.round((r.value / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}
