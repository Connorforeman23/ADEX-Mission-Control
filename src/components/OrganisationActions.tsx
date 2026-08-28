"use client";

import { useState } from "react";
import Link from "next/link";
import OrganisationEditor from "@/components/OrganisationEditor";
import type { OrganisationInput } from "@/lib/actions";
import type { OrganisationDetail } from "@/lib/organisations";

/**
 * Edit and quick actions on an organisation's page.
 *
 * The quick actions carry the company through to whichever screen does the job,
 * so nobody re-picks the company they were already looking at.
 */
export default function OrganisationActions({
  org,
  staff,
}: {
  org: OrganisationDetail;
  staff: { id: string; full_name: string }[];
}) {
  const [editing, setEditing] = useState(false);

  const initial: OrganisationInput = {
    id: org.id,
    name: org.name,
    sector: org.sector ?? "",
    ownerId: org.ownerId ?? "",
    isSupplier: org.is_supplier,
    customerStatus: org.customer_status,
    statusReason: "",
    companiesHouseNo: org.companies_house_no ?? "",
    website: org.website ?? "",
    addressLine1: org.addressLine1 ?? "",
    addressLine2: org.addressLine2 ?? "",
    city: org.city ?? "",
    postcode: org.postcode ?? "",
    country: org.country ?? "",
    phone: org.phone ?? "",
    notes: org.notes ?? "",
    archived: org.archived,
  };

  const company = encodeURIComponent(org.name);

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => setEditing(true)}>
          Edit organisation
        </button>
        <Link className="btn" href={`/contacts?new=1&org=${company}`}>
          Add contact
        </Link>
        <Link className="btn" href={`/pipeline?new=1&org=${company}`}>
          Add opportunity
        </Link>
        <Link className="btn" href={`/campaigns?new=1&client=${company}`}>
          Book campaign
        </Link>
      </div>

      <OrganisationEditor
        open={editing}
        initial={initial}
        staff={staff}
        onClose={() => setEditing(false)}
      />
    </>
  );
}
