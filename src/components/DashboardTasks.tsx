"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dateGB } from "@/lib/money";
import { toggleTask } from "@/lib/actions";
import type { TaskRow } from "@/lib/queries";

/**
 * Tasks on the dashboard, tickable in place.
 *
 * The point of putting them here is that they get done — so they can be
 * ticked without a trip to the Tasks page, and the list re-orders itself the
 * moment one is.
 */
export default function DashboardTasks({ tasks, today }: { tasks: TaskRow[]; today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function tick(t: TaskRow) {
    setBusy(t.id);
    await toggleTask(t.id, true);
    setBusy(null);
    router.refresh();
  }

  if (tasks.length === 0) {
    return <p className="empty-note">Nothing outstanding. Anything raised for you lands here.</p>;
  }

  return (
    <div className="rows">
      {tasks.map((t) => {
        const overdue = !!t.due_date && t.due_date < today;
        const due = !!t.due_date && t.due_date === today;
        return (
          <div className="row" key={t.id}>
            <input
              type="checkbox"
              checked={false}
              disabled={busy === t.id}
              onChange={() => tick(t)}
              aria-label={`Mark ${t.title} done`}
              style={{ width: 16, height: 16, accentColor: "var(--blue)", flex: "none" }}
            />
            <div className="grow">
              <p>{t.title}</p>
              <small>{t.about || "No link"}</small>
            </div>
            <span
              className="num"
              style={{
                whiteSpace: "nowrap",
                color: overdue ? "var(--crit)" : due ? "var(--warn)" : "var(--faint)",
              }}
            >
              {t.due_date ? (overdue ? `${dateGB(t.due_date)} ⚠` : due ? "Today" : dateGB(t.due_date)) : "—"}
            </span>
          </div>
        );
      })}
      <div className="row">
        <Link href="/tasks" style={{ color: "var(--blue)", fontSize: 12.5 }}>
          All tasks →
        </Link>
      </div>
    </div>
  );
}
