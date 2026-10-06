import Link from "next/link";
import { dateGB } from "@/lib/money";
import { getFollowUpExceptions, getMyProfile } from "@/lib/queries";
import CollapsibleCard from "@/components/CollapsibleCard";

export const dynamic = "force-dynamic";

// Where the follow-up discipline is slipping: prospects and clients nobody is
// chasing, and tasks that were raised and then missed. A page rather than a
// card, because it is meant to be worked through rather than glanced at.
export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  const [rows, profile, params] = await Promise.all([
    getFollowUpExceptions(),
    getMyProfile(),
    searchParams,
  ]);

  const owners = [...new Set(rows.map((r) => r.owner))].sort();
  const mine = params.owner === "mine" ? (profile?.full_name ?? "") : "";
  const filtered = params.owner && params.owner !== "all"
    ? rows.filter((r) => r.owner === (params.owner === "mine" ? mine : params.owner))
    : rows;

  const unchased = filtered.filter((r) => r.kind === "no-next-action");
  const overdue = filtered.filter((r) => r.kind === "overdue");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Follow-ups</div>
          <h1>Needs chasing</h1>
          <p>
            Every active prospect should have a future task unless it has been deliberately parked.
            This is where that is slipping.
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">No next action</div>
          <div className="num kpi-value" style={{ color: unchased.length ? "var(--crit)" : "var(--ok)" }}>
            {unchased.length}
          </div>
          <div className="kpi-foot">Prospects and clients nobody is chasing</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Overdue tasks</div>
          <div className="num kpi-value" style={{ color: overdue.length ? "var(--warn)" : "var(--ok)" }}>
            {overdue.length}
          </div>
          <div className="kpi-foot">Raised, then missed</div>
        </div>
      </div>

      <div className="filters">
        <Link className={`btn${!params.owner || params.owner === "all" ? " btn-primary" : ""}`} href="/follow-ups">
          Everyone
        </Link>
        <Link className={`btn${params.owner === "mine" ? " btn-primary" : ""}`} href="/follow-ups?owner=mine">
          Mine
        </Link>
        {owners.map((o) => (
          <Link
            key={o}
            className={`btn${params.owner === o ? " btn-primary" : ""}`}
            href={`/follow-ups?owner=${encodeURIComponent(o)}`}
          >
            {o}
          </Link>
        ))}
      </div>

      <CollapsibleCard id="page-no-next-action" title="No next action" sub="Park one to set it aside deliberately">
        <div className="card-body" style={{ padding: unchased.length ? 0 : undefined }}>
          {unchased.length === 0 ? (
            <p className="empty-note">
              Everyone has a next action. That is the whole point of this page being empty.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Organisation</th>
                    <th>Why</th>
                    <th>Owner</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {unchased.map((r) => (
                    <tr key={`${r.kind}-${r.organisationId}`}>
                      <td className="strong">
                        <Link href={r.href} style={{ color: "var(--blue)" }}>
                          {r.organisation}
                        </Link>
                      </td>
                      <td className="sub-line">{r.what}</td>
                      <td className="sub-line">{r.owner}</td>
                      <td>
                        <Link className="btn" href={`/tasks?new=1&org=${encodeURIComponent(r.organisation)}`}>
                          Add task
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CollapsibleCard>

      <CollapsibleCard id="page-overdue" title="Overdue" sub={<>{overdue.length} past their date</>}>
        {/* was: style={{ marginTop: 14 }} */}
        <div className="card-body" style={{ padding: overdue.length ? 0 : undefined }}>
          {overdue.length === 0 ? (
            <p className="empty-note">Nothing overdue.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Organisation</th>
                    <th>Owner</th>
                    <th>Was due</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((r, i) => {
                    const days = r.since
                      ? Math.round(
                          (new Date(today).getTime() - new Date(r.since).getTime()) / 86_400_000
                        )
                      : 0;
                    return (
                      <tr key={`${r.kind}-${i}`}>
                        <td className="strong">
                          <Link href={r.href} style={{ color: "var(--blue)" }}>
                            {r.what}
                          </Link>
                        </td>
                        <td className="sub-line">
                          {r.organisationId ? (
                            <Link href={`/organisations/${r.organisationId}`} style={{ color: "var(--blue)" }}>
                              {r.organisation}
                            </Link>
                          ) : (
                            r.organisation
                          )}
                        </td>
                        <td className="sub-line">{r.owner}</td>
                        <td className="num" style={{ color: "var(--crit)", whiteSpace: "nowrap" }}>
                          {r.since ? dateGB(r.since) : "—"}
                          {days > 0 ? ` · ${days}d` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CollapsibleCard>
    </div>
  );
}
