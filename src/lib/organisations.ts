// Organisation types and labels (Phase 3).
//
// Deliberately free of server-only imports so both the server queries and the
// browser components can use it — queries.ts pulls in next/headers, so a client
// component must never import from there.

export type OrganisationRow = {
  id: string;
  name: string;
  sector: string;
  owner: string;
  customer_status: string;
  is_supplier: boolean;
  archived: boolean;
  contacts: number;
  campaigns: number;
  billings: number;
  supplier_spend: number;
};

/** The customer lifecycle, in the words the team uses. */
export const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  prospect: "Prospect",
  active_client: "Active client",
  former_client: "Former client",
  not_pursuing: "Not pursuing",
  none: "No customer relationship",
};
