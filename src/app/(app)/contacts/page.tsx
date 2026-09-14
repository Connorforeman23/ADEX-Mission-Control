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
         linkedin, notes, owner_id, lead_id, client_id, profiles ( full_name )`
      )
      .order("organisation")
      .order("first_name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase
      .from("organisations")
      .select("id, name, customer_status")
      .eq("archived", false)
      .order("name"),
    searchParams,
  ]);

  // Status belongs to the organisation, not the person — a contact is a
  // prospect because their company is. So the panel shows the company's
  // status against each group rather than carrying one per contact.
  const organisations = (orgs ?? []) as { id: string; name: string; customer_status: string }[];
  const statusByOrgId = new Map(organisations.map((o) => [o.id, o.customer_status]));

  const contacts: ContactRow[] = ((rows ?? []) as unknown as Raw[]).map((c) => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    job_title: c.job_title,
    organisation: c.organisation,
    organisationId: c.organisation_id,
    organisationStatus: (c.organisation_id && statusByOrgId.get(c.organisation_id)) || null,
    email: c.email,
    phone: c.phone,
    mobile: c.mobile,
    linkedin: c.linkedin,
    notes: c.notes,
    owner: c.profiles?.full_name ?? "—",
    ownerId: c.owner_id ?? "",
    leadId: c.lead_id,
    isClient: !!c.client_id,
  }));

  const orgCount = new Set(contacts.map((c) => c.organisation)).size;
  const clientContacts = contacts.filter((c) => c.organisationStatus === "active_client").length;
  const noEmail = contacts.filter((c) => !c.email).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Prospecting</div>
          <h1>Contacts</h1>
          <p>
            The people at each organisation — several per organisation whenever you have them.
            Status lives on the organisation: win the deal and everyone there becomes a client
            contact.
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
          <div className="eyebrow">Client contacts</div>
          <div className="num kpi-value" style={{ color: "var(--ok)" }}>
            {clientContacts}
          </div>
          <div className="kpi-foot">At active clients</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Missing an email</div>
          <div className="num kpi-value" style={{ color: noEmail ? "var(--warn)" : undefined }}>
            {noEmail}
          </div>
          <div className="kpi-foot">Can&rsquo;t be written to yet</div>
        </div>
      </div>

      <ContactsPanel
        contacts={contacts}
        staff={staff ?? []}
        organisations={organisations.map((o) => ({ id: o.id, name: o.name }))}
        meId={user?.id ?? ""}
        openNew={params.new === "1"}
        prefillOrg={params.org ?? ""}
      />
    </div>
  );
}
