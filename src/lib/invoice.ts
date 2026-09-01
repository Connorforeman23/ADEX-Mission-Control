import { VAT_RATE, type Campaign, type CampaignLine } from "@/lib/money";
import { poDate } from "@/lib/po";

// The client invoice. Where the Space Order shows a supplier what we pay them,
// this shows the client what they are charged — and the two must never meet.
//
// The shape comes from three real Randox invoices (18824, 18825, 18826):
//
//   Description                                Net        VAT       Gross
//   PO Number 227936                           0.00       0.00       0.00
//   50 x 4 Sheets GD 07.09.26 - 20.09.26   3,750.00     750.00   4,500.00
//   50 x 4 Sheets GD Production               819.00     163.80     982.80
//   …
//                          Total Net Amount  72,995.00
//                          Total VAT Amount  14,599.00
//                          Invoice Total     87,594.00

/** Invoice terms on the real invoices: dated month end, due the 25th of the next. */
export const PAYMENT_TERMS = "Payment due on or before the 25th of the following month.";

export type InvoiceLine = {
  id: string;
  campaignLineId: string | null;
  description: string;
  net: number;
};

export type ClientInvoice = {
  id: string;
  invoiceNo: string | null;
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  clientPo: string | null;
  client: string;
  clientAddress: string[];
  campaignId: string | null;
  campaignRef: string;
  campaignName: string;
  lines: InvoiceLine[];
  net: number;
  vat: number;
  total: number;
};

/** Month end — the date every one of the sample invoices carries. */
export function monthEnd(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}

/** The 25th of the month after the invoice date. */
export function dueAfter(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return new Date(d.getFullYear(), d.getMonth() + 1, 25).toISOString().slice(0, 10);
}

/**
 * The description a booking line gets on the invoice.
 *
 * Media lines carry the dates, production lines do not — 18824 pairs
 * "50 x 4 Sheets GD 07.09.26 - 20.09.26" with "50 x 4 Sheets GD Production".
 *
 * What the client sees is the booking detail, falling back to the publication
 * and then the supplier. 18826 reads "M4 Tower" — the site, never "JCDecaux".
 * The client is not told who we bought from.
 */
export function lineDescription(l: CampaignLine) {
  const what =
    (l.detail ?? "").trim() ||
    (l.publication ?? "").trim() ||
    l.vendor ||
    l.channel;

  if (l.line_type === "production") return `${what} Production`;

  const dates =
    l.start_date === l.end_date
      ? poDate(l.start_date)
      : `${poDate(l.start_date)} - ${poDate(l.end_date)}`;
  return dates ? `${what} ${dates}` : what;
}

/**
 * The invoice ADEX would send for a campaign, before anyone edits it.
 *
 * One line per booking line, in booking order, at the client charge ex VAT.
 * Zero-value lines are kept — 18824 prints "1 x DEP Platinum Production" at
 * 0.00 because the client expects to see the item listed either way.
 */
export function draftInvoiceLines(campaign: Campaign): InvoiceLine[] {
  const lines: InvoiceLine[] = campaign.campaign_lines.map((l) => ({
    id: l.id,
    campaignLineId: l.id,
    description: lineDescription(l),
    net: Number(l.client_charge),
  }));

  // The agency fee is charged on top of the media, so it is its own line.
  const fee = Number(campaign.fee);
  if (fee) {
    lines.push({
      id: "fee",
      campaignLineId: null,
      description: "Agency fee",
      net: fee,
    });
  }

  return lines;
}

export function invoiceTotals(lines: { net: number }[]) {
  const net = lines.reduce((a, l) => a + Number(l.net), 0);
  const vat = Math.round(net * VAT_RATE * 100) / 100;
  return { net, vat, total: net + vat };
}
