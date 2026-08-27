import { VAT_RATE, type Campaign, type CampaignLine } from "@/lib/money";

// Purchase orders ("Space Orders") are one per booking line, raised once the
// campaign is sold. Order numbers run as a per-client sequence in the format
// Connor's real orders use — Randox → RAN0097 — derived from the client's
// first three letters plus the position of that line in the client's history.

export const SOLD_STATUSES = ["booked", "live", "risk", "done"];

export type PurchaseOrder = {
  po: string;
  lineId: string;
  campaignId: string;
  campaignRef: string;
  campaignName: string;
  client: string;
  owner: string;
  vendor: string;
  channel: string;
  detail: string;
  copy: string;
  startDate: string;
  endDate: string;
  gross: number;
  net: number;
  vat: number;
  total: number;
  status: "Draft" | "Sent" | "Invoiced";
};

export const clientCode = (name: string) =>
  (name.replace(/[^A-Za-z]/g, "").slice(0, 3) || "ADX").toUpperCase();

export function buildPurchaseOrders(campaigns: Campaign[]): PurchaseOrder[] {
  const sold = campaigns.filter((c) => SOLD_STATUSES.includes(c.status));

  // Stable ordering so a given line always gets the same order number.
  const rows = sold
    .flatMap((c) => c.campaign_lines.map((l) => ({ c, l })))
    .sort((a, b) => {
      const client = (a.c.clients?.name ?? "").localeCompare(b.c.clients?.name ?? "");
      if (client) return client;
      const start = (a.l.start_date ?? "").localeCompare(b.l.start_date ?? "");
      if (start) return start;
      return a.l.id.localeCompare(b.l.id);
    });

  const seq = new Map<string, number>();

  return rows.map(({ c, l }) => {
    const client = c.clients?.name ?? "Unassigned";
    const code = clientCode(client);
    const n = (seq.get(code) ?? 0) + 1;
    seq.set(code, n);

    const net = Number(l.supplier_net);
    const vat = Math.round(net * VAT_RATE);

    return {
      // The number stored at booking time wins; the derived one covers
      // campaigns booked before numbering existed.
      po: l.supplier_po ?? code + String(n).padStart(4, "0"),
      lineId: l.id,
      campaignId: c.id,
      campaignRef: c.ref,
      campaignName: c.name,
      client,
      owner: c.profiles?.full_name ?? "—",
      vendor: l.vendor,
      channel: l.channel,
      detail: detailOf(l),
      copy: copyOf(l),
      startDate: l.start_date,
      endDate: l.end_date,
      gross: Number(l.supplier_gross),
      net,
      vat,
      total: net + vat,
      status: c.status === "done" ? "Invoiced" : c.status === "booked" ? "Draft" : "Sent",
    };
  });
}

function detailOf(l: CampaignLine) {
  const base = l.detail ?? "";
  if (l.channel === "OOH" && l.ooh_format) {
    return `${base}${base ? " · " : ""}${l.ooh_format} (${l.ooh_disp_type ?? "Static"})`;
  }
  return base;
}

function copyOf(l: CampaignLine) {
  const copy = l.copy_instruction ?? "New Copy";
  return l.urn ? `${copy} · URN ${l.urn}` : copy;
}

// --- reconciliation -----------------------------------------------------

export const INVOICE_TOLERANCE = 25;

export type SupplierInvoice = {
  campaign_line_id: string;
  invoice_no: string;
  invoice_date: string;
  amount: number;
  approved: boolean;
};

export type Recon =
  | { state: "awaiting" }
  | { state: "matched"; invoice: SupplierInvoice; diff: number }
  | { state: "variance"; invoice: SupplierInvoice; diff: number };

export function reconcile(po: PurchaseOrder, invoices: Map<string, SupplierInvoice>): Recon {
  const invoice = invoices.get(po.lineId);
  if (!invoice) return { state: "awaiting" };
  const diff = Number(invoice.amount) - po.net;
  if (invoice.approved || Math.abs(diff) <= INVOICE_TOLERANCE) {
    return { state: "matched", invoice, diff };
  }
  return { state: "variance", invoice, diff };
}

// --- Space Order document ------------------------------------------------
// The sheet sent to a media owner confirming a booking. Note what is NOT here:
// the client charge. The supplier sees the rate card and what we pay them —
// never what the client is charged.

/** ADEX's own details, as they appear on the order. Taken from the real
 *  RAN0102 order so the document matches what suppliers already recognise. */
export const ADEX = {
  name: "Advertising Excellence Ltd",
  address: "G4 Ash House Business Centre, Ash Road, New Ash Green, DA3 8JD",
  phone: "01474 365 155",
  web: "www.advertisingexcellence.co.uk",
  invoicesTo: ["Lynsey.tester@advertisingexcellence.co.uk", "Accounts@advertisingexcellence.co.uk"],
};

export type SpaceOrderRow = {
  media: string;
  date: string;
  detail: string;
  gross: number;
  net: number;
  total: number;
};

export type SpaceOrder = {
  lineId: string;
  po: string;
  supplier: string;
  supplierOrgId: string | null;
  supplierContact: string;
  fromName: string;
  fromEmail: string;
  date: string;
  client: string;
  summary: string;
  commissionPct: number;
  copy: string;
  orderNotes: string;
  rows: SpaceOrderRow[];
  gross: number;
  net: number;
  vat: number;
  total: number;
  /** Contacts already saved against this supplier, for the "To:" dropdown. */
  contacts: { id: string; name: string }[];
};

/**
 * Split a line into one row per insertion.
 *
 * A single booking line often covers several dates (the FT order runs to nine
 * insertions), and the supplier expects to see them itemised. `selected_dates`
 * is free text, so we split on commas and divide the line's cost evenly.
 */
export function spaceOrderRows(
  media: string,
  detail: string,
  selectedDates: string | null,
  startDate: string,
  endDate: string,
  gross: number,
  commissionPct: number
): SpaceOrderRow[] {
  const dates = (selectedDates ?? "")
    .split(/[,;\n]+/)
    .map((d) => d.trim())
    .filter(Boolean);

  const list = dates.length
    ? dates
    : [startDate === endDate ? startDate : `${startDate} – ${endDate}`];

  const perGross = gross / list.length;
  const perNet = perGross * (1 - commissionPct / 100);

  return list.map((date) => ({
    media,
    date,
    detail,
    gross: perGross,
    net: perNet,
    total: perNet * (1 + VAT_RATE),
  }));
}
