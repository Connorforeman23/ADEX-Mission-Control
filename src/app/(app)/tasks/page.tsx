import { createClient } from "@/lib/supabase/server";
import { getTasks } from "@/lib/queries";
import TasksPanel from "@/components/TasksPanel";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; org?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [tasks, { data: staff }, { data: clients }, params, { data: campaignRows }, { data: leadRows }] = await Promise.all([
    getTasks(),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    // Any organisation, client or supplier — "chase Plug for the Modern Milkman
    // proposal" is a task about a supplier. owner_id comes along so a task for
    // a company defaults to whoever owns that company.
    supabase.from("organisations").select("id, name, owner_id, is_supplier, customer_status").eq("archived", false).order("name"),
    searchParams,
    // A task can point at the campaign or the opportunity it is about, not
    // only the client (Rick) — so the org page can list everything about them.
    supabase.from("campaigns").select("id, ref, name").neq("status", "done").order("ref", { ascending: false }),
    supabase.from("leads").select("id, name, stage").in("stage", ["Engaged", "Proposal"]).order("name"),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => t.due_date && t.due_date < today);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Follow-ups</div>
          <h1>Tasks &amp; reminders</h1>
          <p>
            Everything that needs chasing — creative deadlines, pipeline follow-ups and client
            reminders — with a date and an owner.
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">Open</div>
          <div className="num kpi-value">{open.length}</div>
          <div className="kpi-foot">{tasks.length - open.length} completed</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Overdue</div>
          <div className="num kpi-value" style={{ color: overdue.length ? "var(--crit)" : "var(--ok)" }}>
            {overdue.length}
          </div>
          <div className="kpi-foot">Past their follow-up date</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Due this week</div>
          <div className="num kpi-value">
            {
              open.filter((t) => {
                if (!t.due_date) return false;
                const week = new Date();
                week.setDate(week.getDate() + 7);
                return t.due_date >= today && t.due_date <= week.toISOString().slice(0, 10);
              }).length
            }
          </div>
          <div className="kpi-foot">Next 7 days</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Creative deadlines</div>
          <div className="num kpi-value">{open.filter((t) => t.kind === "creative").length}</div>
          <div className="kpi-foot">Raised from new-copy bookings</div>
        </div>
      </div>

      <TasksPanel
        tasks={tasks}
        staff={staff ?? []}
        organisations={(clients ?? []) as { id: string; name: string; owner_id: string | null; is_supplier: boolean; customer_status: string }[]}
        prefillOrg={params.org ?? ""}
        campaigns={(campaignRows ?? []) as { id: string; ref: string; name: string }[]}
        leads={(leadRows ?? []) as { id: string; name: string; stage: string }[]}
        meId={user?.id ?? ""}
        today={today}
        openNew={params.new === "1"}
      />
    </div>
  );
}
