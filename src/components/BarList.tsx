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
      {/* Stacked share bar — the whole mix at a glance, in channel colours. */}
      <div
        style={{
          display: "flex",
          height: 10,
          borderRadius: 99,
          overflow: "hidden",
          gap: 2,
          marginBottom: 2,
        }}
      >
        {rows.map((r) => (
          <div
            key={r.label}
            title={`${r.label} — ${Math.round((r.value / total) * 100)}%`}
            style={{ width: `${(r.value / total) * 100}%`, background: r.colour }}
          />
        ))}
      </div>

      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              minWidth: 104,
              fontSize: 12.5,
              color: "var(--mid)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: r.colour,
                display: "block",
                flex: "none",
              }}
            />
            {r.label}
          </span>
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
                boxShadow: `0 0 12px -2px ${r.colour}`,
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
