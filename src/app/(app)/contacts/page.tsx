import { createClient } from "@/lib/supabase/server";
import ContactsPanel, { type ContactRow } from "@/components/ContactsPanel";

export const dynamic = "force-dynamic";

type Raw = {
  id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  organisation: string;
  organisation_id: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  linkedin: string | null;
  notes: string | null;
  status: string;
  owner_id: string | null;
  lead_id: string | null;
  client_id: string | null;
  profiles: { full_name: string } | null;
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; org?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: rows }, { data: staff }, { data: orgs }, params] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        `id, first_name, last_name, job_title, organisation, organisation_id, email, phone, mobile,
         linkedin, notes, status, owner_id, lead_id, client_id, profiles ( full_name )`
      )
      .order("organisation")
      .order("first_name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("organisations").select("id, name").eq("archived", false).order("name"),
    searchParams,
  ]);

  const contacts: ContactRow[] = ((rows ?? []) as unknown as Raw[]).map((c) => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    job_title: c.job_title,
    organisation: c.organisation,
    organisationId: c.organisation_id,
    email: c.email,
    phone: c.phone,
    mobile: c.mobile,
    linkedin: c.linkedin,
    notes: c.notes,
    status: c.status,
    owner: c.profiles?.full_name ?? "—",
    ownerId: c.owner_id ?? "",
    leadId: c.lead_id,
    isClient: !!c.client_id,
  }));

  const orgCount = new Set(contacts.map((c) => c.organisation)).size;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Prospecting</div>
          <h1>Contacts</h1>
          <p>
            The people behind the pipeline — grouped by organisation, several per organisation
            whenever you have them. Winning a deal turns its contacts into client contacts
            automatically.
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">Contacts</div>
          <div className="num kpi-value">{contacts.length}</div>
          <div className="kpi-foot">Across {orgCount} organisations</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Prospects</div>
          <div className="num kpi-value">{contacts.filter((c) => c.status === "Prospect").length}</div>
          <div className="kpi-foot">Not yet engaged</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Engaged</div>
          <div className="num kpi-value">{contacts.filter((c) => c.status === "Engaged").length}</div>
          <div className="kpi-foot">Active conversations</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Client contacts</div>
          <div className="num kpi-value" style={{ color: "var(--ok)" }}>
            {contacts.filter((c) => c.status === "Client").length}
          </div>
          <div className="kpi-foot">Converted from won deals</div>
        </div>
      </div>

      <ContactsPanel
        contacts={contacts}
        staff={staff ?? []}
        organisations={orgs ?? []}
        meId={user?.id ?? ""}
        openNew={params.new === "1"}
        prefillOrg={params.org ?? ""}
      />
    </div>
  );
}
