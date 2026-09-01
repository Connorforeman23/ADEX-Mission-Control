"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer from "@/components/Drawer";
import { saveOrganisation, type OrganisationInput } from "@/lib/actions";
import { CUSTOMER_STATUS_LABEL } from "@/lib/organisations";

// Create or edit a company. The customer status goes through the same tracked
// path as a won deal, so changing it by hand still records who, when and why.
const STATUSES = ["prospect", "active_client", "former_client", "not_pursuing", "none"];

export const blankOrganisation = (ownerId = ""): OrganisationInput => ({
  name: "",
  sector: "",
  ownerId,
  isSupplier: false,
  customerStatus: "prospect",
  statusReason: "",
  companiesHouseNo: "",
  website: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postcode: "",
  country: "",
  phone: "",
  notes: "",
  archived: false,
  contactFirstName: "",
  contactLastName: "",
  contactJobTitle: "",
  contactEmail: "",
  contactPhone: "",
});

export default function OrganisationEditor({
  open,
  initial,
  staff,
  onClose,
}: {
  open: boolean;
  initial: OrganisationInput;
  staff: { id: string; full_name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<OrganisationInput>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when a different organisation is opened.
  const [lastId, setLastId] = useState(initial.id);
  if (initial.id !== lastId) {
    setLastId(initial.id);
    setForm(initial);
    setError(null);
  }

  const set = <K extends keyof OrganisationInput>(k: K, v: OrganisationInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const statusChanged = Boolean(initial.id) && form.customerStatus !== initial.customerStatus;

  async function save() {
    setBusy(true);
    setError(null);
    const res = await saveOrganisation(form);
    setBusy(false);
    if (res.error) return setError(res.error);
    onClose();
    router.refresh();
    if (!initial.id && res.id) router.push(`/organisations/${res.id}`);
  }

  return (
    <Drawer
      open={open}
      eyebrow={initial.id ? "Edit organisation" : "New organisation"}
      title={form.name || "New organisation"}
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="field">
          <span>Company name</span>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label className="field" style={{ flex: "1 1 160px" }}>
            <span>Sector</span>
            <input className="input" value={form.sector} onChange={(e) => set("sector", e.target.value)} />
          </label>
          <label className="field" style={{ flex: "1 1 160px" }}>
            <span>Owner</span>
            <select className="input" value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="field" style={{ flex: "1 1 200px" }}>
            <span>Customer status</span>
            <select
              className="input"
              value={form.customerStatus}
              onChange={(e) => set("customerStatus", e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CUSTOMER_STATUS_LABEL[s] ?? s}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, paddingBottom: 8 }}>
            <input
              type="checkbox"
              checked={form.isSupplier}
              onChange={(e) => set("isSupplier", e.target.checked)}
            />
            Supplier
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, paddingBottom: 8 }}>
            <input
              type="checkbox"
              checked={form.archived}
              onChange={(e) => set("archived", e.target.checked)}
            />
            Archived
          </label>
        </div>

        {statusChanged && (
          <label className="field">
            <span>Why is the status changing? (recorded in the history)</span>
            <input
              className="input"
              value={form.statusReason}
              onChange={(e) => set("statusReason", e.target.value)}
              placeholder="e.g. Moved agency · Retainer ended · Won the pitch"
            />
          </label>
        )}

        <div className="eyebrow" style={{ marginTop: 4 }}>
          Contact details
        </div>
        <label className="field">
          <span>Address</span>
          <input
            className="input"
            value={form.addressLine1}
            onChange={(e) => set("addressLine1", e.target.value)}
            placeholder="Building and street"
          />
        </label>
        <input
          className="input"
          value={form.addressLine2}
          onChange={(e) => set("addressLine2", e.target.value)}
          placeholder="Address line 2 (optional)"
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label className="field" style={{ flex: "1 1 140px" }}>
            <span>Town / city</span>
            <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </label>
          <label className="field" style={{ flex: "1 1 110px" }}>
            <span>Postcode</span>
            <input className="input" value={form.postcode} onChange={(e) => set("postcode", e.target.value)} />
          </label>
          <label className="field" style={{ flex: "1 1 120px" }}>
            <span>Country</span>
            <input className="input" value={form.country} onChange={(e) => set("country", e.target.value)} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label className="field" style={{ flex: "1 1 150px" }}>
            <span>Phone</span>
            <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </label>
          <label className="field" style={{ flex: "1 1 180px" }}>
            <span>Website</span>
            <input className="input" value={form.website} onChange={(e) => set("website", e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Companies House number</span>
          <input
            className="input"
            value={form.companiesHouseNo}
            onChange={(e) => set("companiesHouseNo", e.target.value)}
            placeholder="e.g. 03508906 — unique, so it stops duplicate companies"
          />
        </label>

        {/* Only when creating: an existing organisation has "Add contact" on
            its own page, and repeating it here would be confusing. */}
        {!initial.id && (
          <>
            <div className="eyebrow" style={{ marginTop: 4 }}>
              First contact — optional
            </div>
            <p className="sub-line" style={{ margin: "-4px 0 0" }}>
              Add the person you deal with now if you have them. Leave blank and the company is
              created on its own — you can add people later.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label className="field" style={{ flex: "1 1 140px" }}>
                <span>First name</span>
                <input
                  className="input"
                  value={form.contactFirstName ?? ""}
                  onChange={(e) => set("contactFirstName", e.target.value)}
                />
              </label>
              <label className="field" style={{ flex: "1 1 140px" }}>
                <span>Last name</span>
                <input
                  className="input"
                  value={form.contactLastName ?? ""}
                  onChange={(e) => set("contactLastName", e.target.value)}
                />
              </label>
            </div>
            <label className="field">
              <span>Job title</span>
              <input
                className="input"
                value={form.contactJobTitle ?? ""}
                onChange={(e) => set("contactJobTitle", e.target.value)}
              />
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label className="field" style={{ flex: "1 1 180px" }}>
                <span>Email</span>
                <input
                  className="input"
                  type="email"
                  value={form.contactEmail ?? ""}
                  onChange={(e) => set("contactEmail", e.target.value)}
                />
              </label>
              <label className="field" style={{ flex: "1 1 150px" }}>
                <span>Phone</span>
                <input
                  className="input"
                  value={form.contactPhone ?? ""}
                  onChange={(e) => set("contactPhone", e.target.value)}
                />
              </label>
            </div>
          </>
        )}

        <label className="field">
          <span>Notes</span>
          <textarea
            className="input"
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </label>

        {error && <p style={{ color: "var(--crit)", fontSize: 12.5 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : initial.id ? "Save changes" : "Create organisation"}
          </button>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </Drawer>
  );
}
