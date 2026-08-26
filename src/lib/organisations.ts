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
  /** Billings less what the suppliers are paid — carried over from the old Clients page. */
  profit: number;
  margin: number;
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

// --- detail view ---------------------------------------------------------

export type OrgContact = {
  id: string;
  name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

export type OrgOpportunity = {
  id: string;
  name: string;
  value: number;
  stage: string;
  next_action: string | null;
  owner: string;
};

export type OrgCampaign = {
  id: string;
  ref: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  value: number;
};

export type OrgInvoice = {
  id: string;
  invoice_no: string | null;
  invoice_date: string;
  amount_ex_vat: number;
  outstanding: number;
  status: string;
};

export type OrgStatusEvent = {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  changed_by: string;
  reason: string | null;
};

export type OrganisationDetail = {
  id: string;
  name: string;
  sector: string | null;
  owner: string;
  customer_status: string;
  is_supplier: boolean;
  archived: boolean;
  companies_house_no: string | null;
  website: string | null;
  contacts: OrgContact[];
  opportunities: OrgOpportunity[];
  campaigns: OrgCampaign[];
  invoices: OrgInvoice[];
  history: OrgStatusEvent[];
  supplier_spend: number;
};
