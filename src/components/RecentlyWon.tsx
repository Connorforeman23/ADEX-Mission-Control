import Link from "next/link";
import { clientGross, dateGB, gbp, repCommission, type Campaign } from "@/lib/money";

/**
 * What's been won lately.
 *
 * Derived from campaigns created in the window rather than from the pipeline:
 * Closed Won opens a campaign, and so does a booking that never went through
 * the pipeline at all. Both are wins; only one appears on the board.
 */
export default function RecentlyWon({
  campaigns,
  days = 30,
  showOwner = false,
  showCommission = false,
}: {
  campaigns: Campaign[];
  days?: number;
  /** Admin view names who won it; a rep's own view doesn't need to. */
  showOwner?: boolean;
  /** A rep sees what the win earns them. */
  showCommission?: boolean;
}) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  const won = campaigns
    .filter((c) => c.created_at && c.created_at >= sinceIso)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  const total = won.reduce((a, c) => a + clientGross(c), 0);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Recently won</h2>
        <span className="sub">
          Last {days} days · {gbp(total)} ex VAT
        </span>
      </div>
      <div className="card-body">
        {won.length === 0 ? (
          <p className="empty-note">Nothing won in the last {days} days.</p>
        ) : (
          <div className="rows">
            {won.map((c) => (
              <Link className="row" href={`/campaigns?open=${c.id}`} key={c.id}>
                <div className="grow">
                  <p>
                    {c.ref} · {c.name}
                  </p>
                  <small>
                    {c.clients?.name ?? "—"}
                    {showOwner ? ` · ${c.profiles?.full_name ?? "Unassigned"}` : ""}
                    {c.created_at ? ` · ${dateGB(c.created_at.slice(0, 10))}` : ""}
                  </small>
                </div>
                {showCommission && (
                  <span className="num sub-line" style={{ whiteSpace: "nowrap" }}>
                    {gbp(repCommission(c))} to you
                  </span>
                )}
                <span className="num strong">{gbp(clientGross(c))}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
