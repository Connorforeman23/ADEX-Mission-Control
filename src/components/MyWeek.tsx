import Link from "next/link";
import DashboardTasks from "@/components/DashboardTasks";
import {
  clientGross,
  dateGB,
  dealMargin,
  dealProfit,
  gbp,
  gbpK,
  MARGIN_FLOOR,
  rangeGB,
  repCommission,
  REP_COMMISSION_PCT,
  STATUS_LABEL,
  type Campaign,
} from "@/lib/money";
import type { Lead, TaskRow } from "@/lib/queries";

/**
 * The account manager's dashboard — everything is theirs.
 *
 * Deliberately NOT the director's view: no company billings, no billings by
 * sales team, no business-wide margin. Those are management numbers and they
 * belong on the admin dashboard. What a rep needs is what to do today, what is
 * coming, and how their own book is doing — including what they earn on it.
 */
export default function MyWeek({
  name,
  campaigns,
  leads,
  tasks,
  today,
}: {
  name: string;
  campaigns: Campaign[];
  leads: Lead[];
  tasks: TaskRow[];
  today: string;
}) {
  const open = tasks.filter((t) => !t.done);
  const dueOrOverdue = open.filter((t) => t.due_date && t.due_date <= today);
  const soonDate = new Date();
  soonDate.setDate(soonDate.getDate() + 14);
  const soon = soonDate.toISOString().slice(0, 10);

  const live = campaigns.filter((c) => c.status === "live" || c.status === "risk");
  const startingSoon = campaigns
    .filter((c) => c.status === "booked" && c.start_date && c.start_date > today && c.start_date <= soon)
    .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
  const openBook = campaigns.filter((c) => c.status !== "done");

  // The rep's own money. Profit is client gross less what we pay suppliers;
  // their commission is 15% of that profit.
  const myBillings = campaigns.reduce((a, c) => a + clientGross(c), 0);
  const myProfit = campaigns.reduce((a, c) => a + dealProfit(c), 0);
  const myCommission = campaigns.reduce((a, c) => a + repCommission(c), 0);

  const thisYear = String(new Date(today).getFullYear());
  const yearCampaigns = campaigns.filter((c) => (c.start_date ?? "").startsWith(thisYear));
  const yearCommission = yearCampaigns.reduce((a, c) => a + repCommission(c), 0);

  const lowMargin = openBook.filter((c) => clientGross(c) > 0 && dealMargin(c) < MARGIN_FLOOR);
  const stalled = leads.filter((l) => !l.next_action);
  const pipelineValue = leads.reduce((a, l) => a + Number(l.value), 0);

  const sortedTasks = [...open].sort((a, b) => {
    const av = a.due_date ?? "9999-12-31";
    const bv = b.due_date ?? "9999-12-31";
    return av.localeCompare(bv);
  });

  return (
    <>
      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">Due today &amp; overdue</div>
          <div
            className="num kpi-value"
            style={{ color: dueOrOverdue.length ? "var(--crit)" : "var(--ok)" }}
          >
            {dueOrOverdue.length}
          </div>
          <div className="kpi-foot">{open.length} open in total</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Live now</div>
          <div className="num kpi-value">{live.length}</div>
          <div className="kpi-foot">{campaigns.length} campaigns on your book</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Starting soon</div>
          <div className="num kpi-value">{startingSoon.length}</div>
          <div className="kpi-foot">Booked, next 14 days</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Your pipeline</div>
          <div className="num kpi-value">{gbpK(pipelineValue)}</div>
          <div className="kpi-foot">
            {leads.length} live conversation{leads.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">Your billings — ex VAT</div>
          <div className="num kpi-value">{gbpK(myBillings)}</div>
          <div className="kpi-foot">Client gross across your campaigns</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Your profit</div>
          <div className="num kpi-value" style={{ color: "var(--ok)" }}>
            {gbpK(myProfit)}
          </div>
          <div className="kpi-foot">Client gross less supplier net</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Your commission</div>
          <div className="num kpi-value">{gbpK(myCommission)}</div>
          <div className="kpi-foot">
            {REP_COMMISSION_PCT}% of profit · {gbpK(yearCommission)} in {thisYear}
          </div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Below the margin floor</div>
          <div
            className="num kpi-value"
            style={{ color: lowMargin.length ? "var(--crit)" : "var(--ok)" }}
          >
            {lowMargin.length}
          </div>
          <div className="kpi-foot">Of your open campaigns · floor is {MARGIN_FLOOR}%</div>
        </div>
      </div>

      <div className="cols">
        <section className="card">
          <div className="card-head">
            <h2>Your tasks</h2>
            <span className="sub">Soonest first · tick them here</span>
          </div>
          <div className="card-body">
            <DashboardTasks tasks={sortedTasks.slice(0, 8)} today={today} />
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Needs you</h2>
            <span className="sub">{stalled.length + lowMargin.length} open</span>
          </div>
          <div className="card-body">
            {stalled.length === 0 && lowMargin.length === 0 ? (
              <p className="empty-note">
                Nothing flagged. Every opportunity has a next action and every campaign is above the
                margin floor.
              </p>
            ) : (
              <div className="rows">
                {stalled.map((l) => (
                  <Link className="row" href="/pipeline" key={l.id}>
                    <span className="flag warn">!</span>
                    <div className="grow">
                      <p>{l.name} has no next action</p>
                      <small>{l.stage}</small>
                    </div>
                    <span className="num" style={{ whiteSpace: "nowrap" }}>
                      {gbp(Number(l.value))}
                    </span>
                  </Link>
                ))}
                {lowMargin.map((c) => (
                  <Link className="row" href={`/campaigns?open=${c.id}`} key={c.id}>
                    <span className="flag crit">%</span>
                    <div className="grow">
                      <p>
                        {c.ref} · {c.name}
                      </p>
                      <small>{c.clients?.name ?? "—"}</small>
                    </div>
                    <span className="num" style={{ color: "var(--crit)", whiteSpace: "nowrap" }}>
                      {dealMargin(c).toFixed(1)}%
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="cols">
        <section className="card">
          <div className="card-head">
            <h2>Starting soon</h2>
            <span className="sub">Booked, next 14 days</span>
          </div>
          <div className="card-body">
            {startingSoon.length === 0 ? (
              <p className="empty-note">Nothing starting in the next fortnight.</p>
            ) : (
              <div className="rows">
                {startingSoon.map((c) => (
                  <Link className="row" href={`/campaigns?open=${c.id}`} key={c.id}>
                    <div className="grow">
                      <p>
                        {c.ref} · {c.name}
                      </p>
                      <small>{c.clients?.name ?? "—"}</small>
                    </div>
                    <span className="num sub-line" style={{ whiteSpace: "nowrap" }}>
                      {c.start_date ? dateGB(c.start_date) : "—"}
                    </span>
                    <span className="num strong">{gbp(clientGross(c))}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Your pipeline</h2>
            <span className="sub">{gbpK(pipelineValue)} in play</span>
          </div>
          <div className="card-body">
            {leads.length === 0 ? (
              <p className="empty-note">
                No open opportunities. <Link href="/pipeline?new=1" style={{ color: "var(--blue)" }}>Add one →</Link>
              </p>
            ) : (
              <div className="rows">
                {leads.map((l) => (
                  <Link className="row" href="/pipeline" key={l.id}>
                    <div className="grow">
                      <p>{l.name}</p>
                      <small>{l.next_action ?? "No next action"}</small>
                    </div>
                    <span className="pill">{l.stage}</span>
                    <span className="num strong">{gbp(Number(l.value))}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Your campaigns</h2>
          <span className="sub">{openBook.length} open</span>
        </div>
        <div className="card-body" style={{ padding: openBook.length ? 0 : undefined }}>
          {openBook.length === 0 ? (
            <p className="empty-note">
              Nothing on your book yet, {name.split(" ")[0] || "there"}.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Campaign</th>
                    <th>Dates</th>
                    <th>Status</th>
                    <th className="r">Billings</th>
                    <th className="r">Profit</th>
                    <th className="r">Your {REP_COMMISSION_PCT}%</th>
                  </tr>
                </thead>
                <tbody>
                  {openBook.map((c) => {
                    const low = clientGross(c) > 0 && dealMargin(c) < MARGIN_FLOOR;
                    return (
                      <tr key={c.id}>
                        <td className="num ref">
                          <Link href={`/campaigns?open=${c.id}`} style={{ color: "var(--blue)" }}>
                            {c.ref}
                          </Link>
                        </td>
                        <td>
                          <div className="strong">{c.name}</div>
                          <div className="sub-line">{c.clients?.name ?? "—"}</div>
                        </td>
                        <td className="sub-line">{rangeGB(c.start_date, c.end_date)}</td>
                        <td>
                          <span className={`st ${c.status}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
                        </td>
                        <td className="r num">{gbp(clientGross(c))}</td>
                        <td className="r num" style={{ color: low ? "var(--crit)" : "var(--ok)" }}>
                          {gbp(dealProfit(c))}
                        </td>
                        <td className="r num strong">{gbp(repCommission(c))}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>Total</td>
                    <td className="r num">{gbp(openBook.reduce((a, c) => a + clientGross(c), 0))}</td>
                    <td className="r num">{gbp(openBook.reduce((a, c) => a + dealProfit(c), 0))}</td>
                    <td className="r num">{gbp(openBook.reduce((a, c) => a + repCommission(c), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
