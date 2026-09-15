"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Drawer from "@/components/Drawer";
import { deleteContact, saveContact, type ContactInput } from "@/lib/actions";
import { CUSTOMER_STATUS_CLASS, CUSTOMER_STATUS_LABEL } from "@/lib/organisations";

export type ContactRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  organisation: string;
  organisationId: string | null;
  /** The company's customer status — the only status a contact has. */
  organisationStatus: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  linkedin: string | null;
  notes: string | null;
  owner: string;
  ownerId: string;
  leadId: string | null;
  isClient: boolean;
};

const blank = (ownerId: string): ContactInput => ({
  firstName: "",
  lastName: "",
  jobTitle: "",
  organisation: "",
  email: "",
  phone: "",
  mobile: "",
  linkedin: "",
  notes: "",
  ownerId,
});

export default function ContactsPanel({
  contacts,
  staff,
  organisations,
  meId,
  openNew,
  prefillOrg = "",
}: {
  contacts: ContactRow[];
  staff: { id: string; full_name: string }[];
  /** Existing companies. A contact can only be added to one of these —
   *  organisation first, then contact, as two clean steps. */
  organisations: { id: string; name: string }[];
  meId: string;
  openNew?: boolean;
  /** Company carried through from an organisation page. */
  prefillOrg?: string;
}) {
  const router = useRouter();
  const [owner, setOwner] = useState("All");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ContactInput | null>(
    openNew ? { ...blank(meId), organisation: prefillOrg } : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = contacts.filter(
    (c) =>
      (owner === "All" || c.owner === owner) &&
      (!search ||
        `${c.first_name} ${c.last_name ?? ""} ${c.organisation} ${c.email ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()))
  );

  // Group by organisation — several contacts per organisation is the norm.
  const orgs = new Map<string, ContactRow[]>();
  rows.forEach((c) => {
    const list = orgs.get(c.organisation) ?? [];
    list.push(c);
    orgs.set(c.organisation, list);
  });

  async function save() {
    if (!editing) return;
    setBusy(true);
    const res = await saveContact(editing);
    setBusy(false);
    if (res.error) return setError(res.error);
    setEditing(null);
    router.refresh();
  }

  function openEdit(c: ContactRow) {
    setError(null);
    setEditing({
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name ?? "",
      jobTitle: c.job_title ?? "",
      organisation: c.organisation,
      email: c.email ?? "",
      phone: c.phone ?? "",
      mobile: c.mobile ?? "",
      linkedin: c.linkedin ?? "",
      notes: c.notes ?? "",
      ownerId: c.ownerId,
      leadId: c.leadId ?? undefined,
    });
  }

  const owners = [...new Set(contacts.map((c) => c.owner))].filter((o) => o !== "—").sort();

  return (
    <>
      <div className="filters">
        <label className="field">
          <span>Search</span>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, organisation, email…"
          />
        </label>
        <label className="field">
          <span>Owner</span>
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="All">Everyone</option>
            {owners.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <button
          className="btn btn-primary"
          style={{ marginLeft: "auto" }}
          onClick={() => {
            setError(null);
            setEditing(blank(meId));
          }}
        >
          New contact
        </button>
      </div>

      {orgs.size === 0 ? (
        <section className="card">
          <div className="card-body">
            <p className="empty-note">
              {contacts.length === 0
                ? "No contacts yet. Add the people you're prospecting — several per organisation is fine."
                : "No contacts match those filters."}
            </p>
          </div>
        </section>
      ) : (
        [...orgs.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([org, people]) => {
          const status = people[0]?.organisationStatus;
          return (
            <section className="card" key={org} style={{ marginBottom: 14 }}>
              <div className="card-head">
                <h2>
                  {people[0]?.organisationId ? (
                    <Link href={`/organisations/${people[0].organisationId}`} style={{ color: "inherit" }}>
                      {org}
                    </Link>
                  ) : (
                    org
                  )}
                </h2>
                <span className="sub" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                  {people.length} contact{people.length === 1 ? "" : "s"}
                  {status && status !== "none" && (
                    <span className={`st ${CUSTOMER_STATUS_CLASS[status] ?? "done"}`}>
                      {CUSTOMER_STATUS_LABEL[status] ?? status}
                    </span>
                  )}
                </span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Owner</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {people.map((c) => (
                        <tr key={c.id}>
                          <td>
                            {/* The name opens the contact, the way an organisation's
                                name opens the organisation. */}
                            <button type="button" className="link-btn strong" onClick={() => openEdit(c)}>
                              {c.first_name} {c.last_name ?? ""}
                            </button>
                            {c.linkedin && (
                              <a
                                className="sub-line"
                                href={c.linkedin.startsWith("http") ? c.linkedin : `https://${c.linkedin}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "var(--blue)", display: "block" }}
                              >
                                LinkedIn ↗
                              </a>
                            )}
                          </td>
                          <td className="sub-line">{c.job_title ?? "—"}</td>
                          <td className="sub-line">
                            {c.email ? <a href={`mailto:${c.email}`} style={{ color: "var(--blue)" }}>{c.email}</a> : "—"}
                          </td>
                          <td className="num sub-line">{c.mobile || c.phone || "—"}</td>
                          <td className="sub-line">{c.owner}</td>
                          <td>
                            <button className="row-edit" aria-label={`Edit ${c.first_name}`} onClick={() => openEdit(c)}>
                              <svg viewBox="0 0 24 24">
                                <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          );
        })
      )}

      <Drawer
        open={!!editing}
        eyebrow={editing?.id ? "Edit contact" : "New contact"}
        title={editing ? `${editing.firstName} ${editing.lastName}`.trim() || "New contact" : ""}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-grid">
              <label className="field">
                <span>First name</span>
                <input className="input" value={editing.firstName} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })} />
              </label>
              <label className="field">
                <span>Last name</span>
                <input className="input" value={editing.lastName} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })} />
              </label>
              <label className="field">
                <span>Job title</span>
                <input className="input" value={editing.jobTitle} onChange={(e) => setEditing({ ...editing, jobTitle: e.target.value })} />
              </label>
              <label className="field">
                <span>Organisation</span>
                <select
                  className="input"
                  value={editing.organisation}
                  onChange={(e) => setEditing({ ...editing, organisation: e.target.value })}
                >
                  <option value="">Choose an organisation…</option>
                  {organisations.map((o) => (
                    <option key={o.id} value={o.name}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <small className="sub-line" style={{ marginTop: 4 }}>
                  Not listed?{" "}
                  <Link href="/organisations?new=1" style={{ color: "var(--blue)" }}>
                    Create the organisation first
                  </Link>
                  , then add the contact.
                </small>
              </label>
              <label className="field">
                <span>Email</span>
                <input className="input" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input className="input num" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </label>
              <label className="field">
                <span>Mobile</span>
                <input className="input num" value={editing.mobile} onChange={(e) => setEditing({ ...editing, mobile: e.target.value })} />
              </label>
              <label className="field">
                <span>LinkedIn</span>
                <input className="input" value={editing.linkedin} onChange={(e) => setEditing({ ...editing, linkedin: e.target.value })} placeholder="Profile URL" />
              </label>
              <label className="field">
                <span>Owner</span>
                <select className="input" value={editing.ownerId} onChange={(e) => setEditing({ ...editing, ownerId: e.target.value })}>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field wide">
                <span>Notes</span>
                <input className="input" value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </label>
            </div>

            {error && <p style={{ color: "var(--crit)", fontSize: 12.5, margin: 0 }}>{error}</p>}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save contact"}
              </button>
              {editing.id && (
                <button
                  className="btn"
                  style={{ marginLeft: "auto", color: "var(--crit)" }}
                  disabled={busy}
                  onClick={async () => {
                    await deleteContact(editing.id!);
                    setEditing(null);
                    router.refresh();
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
