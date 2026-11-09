"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProposal } from "@/lib/actions";
import { KIND_LABEL, PROPOSAL_KINDS } from "@/lib/proposals";

/**
 * Start a proposal.
 *
 * The company is a dropdown rather than a text box, for the same reason the
 * opportunity form is: a typed name drifts from the organisation record within
 * a week. Choosing an opportunity narrows the companies to the one it belongs
 * to, so the two can never disagree.
 */
export default function NewProposal({
  organisations,
  leads,
  staff,
  meId,
  openInitially = false,
  preselectLead = "",
}: {
  organisations: { id: string; name: string }[];
  leads: { id: string; name: string; organisation_id: string | null }[];
  staff: { id: string; full_name: string }[];
  meId: string;
  openInitially?: boolean;
  preselectLead?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(openInitially);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preselected = leads.find((l) => l.id === preselectLead);
  const [leadId, setLeadId] = useState(preselected ? preselected.id : "");
  const [organisationId, setOrganisationId] = useState(preselected?.organisation_id ?? "");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("deck");
  const [ownerId, setOwnerId] = useState(meId);

  function chooseLead(id: string) {
    setLeadId(id);
    const lead = leads.find((l) => l.id === id);
    if (lead?.organisation_id) setOrganisationId(lead.organisation_id);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await createProposal({ title, organisationId, leadId, kind, ownerId });
    setBusy(false);
    if ("error" in res && res.error) return setError(res.error);
    if ("id" in res && res.id) router.push(`/proposals/${res.id}`);
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        New proposal
      </button>
    );
  }

  return (
    <section className="card" style={{ minWidth: 340, maxWidth: 520 }}>
      <div className="card-body">
        <div className="form-grid">
          <label className="field wide">
            <span>Title</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="2027 Growth Planning"
              autoFocus
            />
          </label>

          <label className="field">
            <span>Opportunity</span>
            <select className="input" value={leadId} onChange={(e) => chooseLead(e.target.value)}>
              <option value="">Not tied to one</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Company</span>
            <select
              className="input"
              value={organisationId}
              onChange={(e) => setOrganisationId(e.target.value)}
            >
              <option value="">Choose…</option>
              {organisations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Kind</span>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {PROPOSAL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Owner</span>
            <select className="input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p className="sub-line" style={{ color: "var(--crit)", marginTop: 10 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Starting…" : "Start proposal"}
          </button>
          <button className="btn" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </button>
        </div>
        <small className="sub-line" style={{ display: "block", marginTop: 8 }}>
          A presentation starts from the ADEX template with the blanks left blank — nothing is
          invented on the client&rsquo;s behalf.
        </small>
      </div>
    </section>
  );
}
