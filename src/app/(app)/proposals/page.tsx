import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getProposals } from "@/lib/queries";
import { dateGB } from "@/lib/money";
import { KIND_LABEL, STATUS_CLASS } from "@/lib/proposals";
import NewProposal from "@/components/NewProposal";

export const dynamic = "force-dynamic";

// Proposals — the record of what we offered, which version, and what came of
// it. Sometimes a proposal is a short email; sometimes it is a deck. Both are
// tracked the same way, because the question is the same either way.
export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; owner?: string; new?: string; lead?: string }>;
}) {
  const supabase = await createClient();
  const [rows, profile, { data: orgs }, { data: leads }, { data: staff }, params] =
    await Promise.all([
      getProposals(),
      getMyProfile(),
      supabase.from("organisations").select("id, name").eq("archived", false).order("name"),
      supabase
        .from("leads")
        .select("id, name, organisation_id")
        .not("stage", "in", '("Closed Won","Closed Lost")')
        .order("name"),
      supabase.from("profiles").select("id, full_name").eq("is_sales", true).order("full_name"),
      searchParams,
    ]);

  const status = params.status ?? "open";
  const byStatus =
    status === "all"
      ? rows
      : status === "open"
        ? rows.filter((p) => p.status === "Draft" || p.status === "Sent")
        : rows.filter((p) => p.status === status);
  const filtered =
    params.owner === "mine" ? byStatus.filter((p) => p.ownerId === profile?.id) : byStatus;

  const sent = rows.filter((p) => p.status === "Sent");
  const won = rows.filter((p) => p.status === "Won");
  const decided = won.length + rows.filter((p) => p.status === "Lost").length;
  const winRate = decided ? Math.round((won.length / decided) * 100) : null;

  const tabs: { key: string; label: string }[] = [
    { key: "open", label: "In play" },
    { key: "Draft", label: "Draft" },
    { key: "Sent", label: "Sent" },
    { key: "Won", label: "Won" },
    { key: "Lost", label: "Lost" },
    { key: "all", label: "Everything" },
  ];
  const keep = params.owner === "mine" ? "&owner=mine" : "";

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">New business</div>
          <h1>Proposals</h1>
          <p>
            What we offered, which version of it, and when it went out. A presentation is built
            from the template so every deck looks like an ADEX deck; an email offer is recorded
            here too, so nothing we have quoted is only in somebody&rsquo;s sent items.
          </p>
        </div>
        <NewProposal
          organisations={orgs ?? []}
          leads={leads ?? []}
          staff={staff ?? []}
          meId={profile?.id ?? ""}
          openInitially={params.new === "1"}
          preselectLead={params.lead ?? ""}
        />
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">Out with clients</div>
          <div className="num kpi-value">{sent.length}</div>
          <div className="kpi-foot">Sent and awaiting a decision</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">In draft</div>
          <div className="num kpi-value">{rows.filter((p) => p.status === "Draft").length}</div>
          <div className="kpi-foot">Being written</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Won</div>
          <div className="num kpi-value" style={{ color: "var(--ok)" }}>
            {won.length}
          </div>
          <div className="kpi-foot">On the record</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Win rate</div>
          <div className="num kpi-value">{winRate === null ? "—" : `${winRate}%`}</div>
          <div className="kpi-foot">
            {decided ? `Of ${decided} decided` : "Nothing decided yet"}
          </div>
        </div>
      </div>

      <div className="filters">
        {tabs.map((t) => (
          <Link
            key={t.key}
            className={`btn${status === t.key ? " btn-primary" : ""}`}
            href={`/proposals?status=${t.key}${keep}`}
          >
            {t.label}
          </Link>
        ))}
        <Link
          className={`btn${params.owner === "mine" ? " btn-primary" : ""}`}
          href={`/proposals?status=${status}${params.owner === "mine" ? "" : "&owner=mine"}`}
        >
          Mine only
        </Link>
      </div>

      <section className="card">
        <div className="card-body" style={{ padding: filtered.length ? 0 : undefined }}>
          {filtered.length === 0 ? (
            <p className="empty-note">
              {rows.length === 0
                ? "No proposals recorded yet. Start one above and it will show here from draft through to won or lost."
                : "Nothing matches that filter."}
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Proposal</th>
                    <th>Company</th>
                    <th>Opportunity</th>
                    <th>Kind</th>
                    <th>Owner</th>
                    <th>Sent</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td className="strong">
                        <Link href={`/proposals/${p.id}`} style={{ color: "var(--blue)" }}>
                          {p.title}
                        </Link>{" "}
                        <span className="sub-line">v{p.version}</span>
                      </td>
                      <td>
                        <Link
                          href={`/organisations/${p.organisationId}`}
                          style={{ color: "var(--blue)" }}
                        >
                          {p.organisation}
                        </Link>
                      </td>
                      <td className="sub-line">{p.lead ?? "—"}</td>
                      <td className="sub-line">
                        {KIND_LABEL[p.kind] ?? p.kind}
                        {p.kind === "deck" && p.slideCount ? ` · ${p.slideCount} slides` : ""}
                      </td>
                      <td className="sub-line">{p.owner}</td>
                      <td className="sub-line">
                        {p.sentAt ? `${dateGB(p.sentAt)}${p.sentBy ? ` · ${p.sentBy}` : ""}` : "—"}
                      </td>
                      <td>
                        <span className={`pill ${STATUS_CLASS[p.status] ?? ""}`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
