import { createClient } from "@/lib/supabase/server";
import CreativeBoard, { type CreativeRow } from "@/components/CreativeBoard";

export const dynamic = "force-dynamic";

type CreativeRecord = {
  id: string;
  item: string;
  format: string | null;
  spec: string | null;
  due_date: string | null;
  stage: string;
  client_id: string | null;
  owner_id: string | null;
  clients: { name: string } | null;
  profiles: { full_name: string } | null;
};

export default async function CreativePage() {
  const supabase = await createClient();
  const [{ data: rows }, { data: clients }, { data: staff }] = await Promise.all([
    supabase
      .from("creative_items")
      .select(
        "id, item, format, spec, due_date, stage, client_id, owner_id, clients ( name ), profiles ( full_name )"
      )
      .order("due_date", { nullsFirst: false }),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  const items: CreativeRow[] = ((rows ?? []) as unknown as CreativeRecord[]).map((r) => ({
    id: r.id,
    item: r.item,
    client: r.clients?.name ?? "—",
    clientId: r.client_id ?? "",
    format: r.format,
    spec: r.spec,
    due_date: r.due_date,
    stage: r.stage,
    owner: r.profiles?.full_name ?? "—",
    ownerId: r.owner_id ?? "",
  }));

  const today = new Date().toISOString().slice(0, 10);
  const overdue = items.filter((i) => i.due_date && i.due_date < today && i.stage !== "Approved");
  const awaitingClient = items.filter((i) => i.stage === "Client approval");

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Studio</div>
          <h1>Creative</h1>
          <p>Scripts, artwork and assets from brief through to approved. Click any card to edit it.</p>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">In production</div>
          <div className="num kpi-value">{items.filter((i) => i.stage !== "Approved").length}</div>
          <div className="kpi-foot">{items.length} items total</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Awaiting client</div>
          <div className="num kpi-value" style={{ color: awaitingClient.length ? "var(--warn)" : undefined }}>
            {awaitingClient.length}
          </div>
          <div className="kpi-foot">Sat with the client for approval</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Overdue</div>
          <div className="num kpi-value" style={{ color: overdue.length ? "var(--crit)" : "var(--ok)" }}>
            {overdue.length}
          </div>
          <div className="kpi-foot">Past their due date</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Approved</div>
          <div className="num kpi-value" style={{ color: "var(--ok)" }}>
            {items.filter((i) => i.stage === "Approved").length}
          </div>
          <div className="kpi-foot">Ready to release</div>
        </div>
      </div>

      <CreativeBoard items={items} clients={clients ?? []} staff={staff ?? []} today={today} />
    </div>
  );
}
