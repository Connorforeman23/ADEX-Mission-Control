import Link from "next/link";
import { notFound } from "next/navigation";
import { getLogoOwnerNames, getProposal } from "@/lib/queries";
import { dateGB } from "@/lib/money";
import { KIND_LABEL, STATUS_CLASS } from "@/lib/proposals";
import ProposalActions from "@/components/ProposalActions";
import ProposalEditor from "@/components/ProposalEditor";

export const dynamic = "force-dynamic";

// One proposal: what it says, where it sits in the sequence, and what to do
// with it next. RLS decides whether this page returns anything at all, so
// there is no role test here — a reader who may not see it gets the 404.
export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [proposal, logoNames] = await Promise.all([getProposal(id), getLogoOwnerNames()]);
  if (!proposal) notFound();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Link href="/proposals" style={{ color: "var(--blue)" }}>
              Proposals
            </Link>
          </div>
          <h1>{proposal.title}</h1>
          <p>
            <Link href={`/organisations/${proposal.organisationId}`} style={{ color: "var(--blue)" }}>
              {proposal.organisation}
            </Link>
            {` · ${KIND_LABEL[proposal.kind] ?? proposal.kind} · v${proposal.version} · `}
            <span className={`pill ${STATUS_CLASS[proposal.status] ?? ""}`}>{proposal.status}</span>
          </p>
          <p className="sub-line">
            {`Owner: ${proposal.owner}`}
            {proposal.lead ? ` · Opportunity: ${proposal.lead}` : " · Not tied to an opportunity"}
            {proposal.sentAt
              ? ` · Sent ${dateGB(proposal.sentAt)}${proposal.sentBy ? ` by ${proposal.sentBy}` : ""}`
              : " · Not sent yet"}
          </p>
        </div>
        <ProposalActions id={proposal.id} kind={proposal.kind} status={proposal.status} />
      </div>

      {proposal.siblings.length > 1 && (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Versions of this proposal
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {proposal.siblings.map((s) => (
                <Link
                  key={s.id}
                  className={`btn${s.id === proposal.id ? " btn-primary" : ""}`}
                  href={`/proposals/${s.id}`}
                >
                  {`v${s.version} · ${s.status}`}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {proposal.status === "Superseded" && (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <p className="sub-line" style={{ margin: 0 }}>
              A later version has replaced this one. It is kept so the history reads as a sequence
              — edit it only if you mean to go back to it.
            </p>
          </div>
        </section>
      )}

      <ProposalEditor
        id={proposal.id}
        kind={proposal.kind}
        content={proposal.content}
        logoNames={logoNames}
      />
    </div>
  );
}
