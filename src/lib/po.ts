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
