"use client";

import { useMemo, useState } from "react";
import { CHANNEL_COLOUR, channelLabel, dateShortGB, gbp, rangeGB } from "@/lib/money";

export type PlanLine = {
  id: string;
  campaignId: string;
  campaignRef: string;
  client: string;
  owner: string;
  vendor: string;
  channel: string;
  detail: string;
  start: string;
  end: string;
  gross: number;
  net: number;
};

const DAY = 86400000;
const WEEKS = 13;

/** Monday of the week containing the given date. */
function weekStart(d: Date) {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function MediaSchedule({ lines, today }: { lines: PlanLine[]; today: string }) {
  const [client, setClient] = useState("All");
  const [owner, setOwner] = useState("All");

  const clients = [...new Set(lines.map((l) => l.client))].sort();
  const owners = [...new Set(lines.map((l) => l.owner))].filter((o) => o !== "—").sort();

  const filtered = lines.filter(
    (l) => (client === "All" || l.client === client) && (owner === "All" || l.owner === owner)
  );

  // The grid starts on the Monday of the earliest booked week, or this week if
  // nothing is booked, and runs for a quarter.
  const gridStart = useMemo(() => {
    if (!filtered.length) return weekStart(new Date());
    const earliest = filtered
      .map((l) => new Date(l.start + "T00:00:00").getTime())
      .sort((a, b) => a - b)[0];
    return weekStart(new Date(earliest));
  }, [filtered]);

  const weeks = Array.from({ length: WEEKS }, (_, i) => new Date(gridStart.getTime() + i * 7 * DAY));
  const gridEnd = new Date(gridStart.getTime() + WEEKS * 7 * DAY);

  const grouped = new Map<string, PlanLine[]>();
  filtered.forEach((l) => {
    const list = grouped.get(l.client) ?? [];
    list.push(l);
    grouped.set(l.client, list);
  });

  const now = new Date(today + "T00:00:00").getTime();
  const todayOffset =
    now < gridStart.getTime() || now > gridEnd.getTime()
      ? null
      : ((now - gridStart.getTime()) / (WEEKS * 7 * DAY)) * 100;

  const committed = filtered.reduce((a, l) => a + l.net, 0);

  return (
    <>
      <div className="filters">
        <label className="field">
          <span>Client</span>
          <select className="input" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="All">All clients</option>
            {clients.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Sales staff</span>
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="All">All staff</option>
            {owners.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <button
          className="btn"
          onClick={() => {
            setClient("All");
            setOwner("All");
          }}
        >
          Clear
        </button>
        <span className="sub-line" style={{ marginLeft: "auto" }}>
          {filtered.length} line{filtered.length === 1 ? "" : "s"} · {gbp(committed)} supplier net
        </span>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Schedule</h2>
          <span className="sub">
            13 weeks from {dateShortGB(gridStart.toISOString().slice(0, 10))} · bars show in-market
            weeks
          </span>
        </div>
        <div className="card-body" style={{ padding: "12px 6px 6px" }}>
          {filtered.length === 0 ? (
            <p className="empty-note" style={{ padding: "12px 10px" }}>
              Nothing booked in this window. Booking lines appear here as soon as a campaign is saved.
            </p>
          ) : (
            <div className="sched">
              <div className="sched-inner">
                <div className="sched-head">
                  <div>Client / supplier</div>
                  {weeks.map((w) => (
                    <div key={w.toISOString()}>{dateShortGB(w.toISOString().slice(0, 10))}</div>
                  ))}
                </div>

                {todayOffset !== null && (
                  <div
                    className="now-line"
                    style={{ left: `calc(220px + (100% - 220px) * ${todayOffset / 100})` }}
                  />
                )}

                {[...grouped.entries()].map(([clientName, group]) =>
                  group.map((l, i) => {
                    const s = new Date(l.start + "T00:00:00").getTime();
                    const e = new Date(l.end + "T00:00:00").getTime();
                    const from = Math.max(0, Math.floor((s - gridStart.getTime()) / (7 * DAY)));
                    const to = Math.min(WEEKS - 1, Math.floor((e - gridStart.getTime()) / (7 * DAY)));
                    if (to < 0 || from > WEEKS - 1) return null;
                    return (
                      <div className="sched-row" key={l.id}>
                        <div className="sched-label">
                          <p>{i === 0 ? clientName : " "}</p>
                          <small>
                            {l.vendor} · {channelLabel(l.channel)}
                          </small>
                        </div>
                        {Array.from({ length: WEEKS }, (_, w) => (
                          <div className="sched-cell" style={{ gridColumn: w + 2 }} key={w} />
                        ))}
                        <div
                          className="sbar"
                          style={{
                            gridColumn: `${from + 2} / span ${to - from + 1}`,
                            background: CHANNEL_COLOUR[l.channel],
                          }}
                          title={`${l.vendor} · ${rangeGB(l.start, l.end)} · ${gbp(l.gross)} gross, ${gbp(l.net)} net`}
                        >
                          {l.detail || l.vendor}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <style jsx>{`
        .sched {
          overflow-x: auto;
        }
        .sched-inner {
          min-width: 940px;
          position: relative;
        }
        .sched-head {
          display: grid;
          grid-template-columns: 220px repeat(${WEEKS}, 1fr);
          border-bottom: 1px solid var(--line);
          position: sticky;
          top: 0;
          background: var(--surface);
          z-index: 2;
        }
        .sched-head div {
          padding: 8px 6px;
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--faint);
          text-align: center;
        }
        .sched-head div:first-child {
          text-align: left;
          padding-left: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .sched-row {
          display: grid;
          grid-template-columns: 220px repeat(${WEEKS}, 1fr);
          align-items: center;
          border-bottom: 1px solid var(--line-soft);
          min-height: 44px;
        }
        .sched-row:hover {
          background: var(--surface-2);
        }
        .sched-label {
          padding: 8px 12px;
          min-width: 0;
        }
        .sched-label p {
          margin: 0;
          font-size: 12.5px;
          font-weight: 560;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sched-label small {
          color: var(--faint);
          font-size: 11px;
        }
        .sched-cell {
          grid-row: 1;
          border-left: 1px solid var(--line-soft);
          height: 100%;
        }
        .sbar {
          grid-row: 1;
          height: 22px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          padding: 0 8px;
          margin: 0 2px;
          font-size: 10.5px;
          color: #fff;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          box-shadow: 0 2px 8px -3px rgba(0, 0, 0, 0.5);
        }
        .now-line {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          background: var(--pink);
          opacity: 0.75;
          z-index: 3;
        }
      `}</style>
    </>
  );
}
