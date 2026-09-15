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
  /** Set once Xero holds it — from then on Xero is the record. */
  xeroId: string | null;
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
export function lineSubject(l: CampaignLine) {
  return (l.detail ?? "").trim() || (l.publication ?? "").trim() || l.vendor || l.channel;
}

export function lineDescription(l: CampaignLine) {
  const what = lineSubject(l);
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
 * One line per THING BOUGHT, at the client charge ex VAT — which is not the
 * same as one line per booking line. 18824 lists nine formats because nine
 * different things were bought, but 18826 lists "M4 Tower 07.09.26 - 04.10.26"
 * once, even though the Space Order behind it books six separately-priced
 * bursts on that tower. The client is buying the tower for a month; how we
 * bought it is our business.
 *
 * So booking lines are grouped by what they are — the detail, or failing that
 * the publication — with the charges summed and the dates spanning the lot.
 * Media and production stay apart because the client is shown them apart.
 *
 * Zero-value lines are kept: 18824 prints "1 x DEP Platinum Production" at
 * 0.00 because the client expects to see the item listed either way.
 */
export function draftInvoiceLines(campaign: Campaign): InvoiceLine[] {
  const groups = new Map<string, CampaignLine[]>();
  for (const l of campaign.campaign_lines) {
    const key = `${l.line_type ?? "media"}|${lineSubject(l).toLowerCase()}`;
    const group = groups.get(key);
    if (group) group.push(l);
    else groups.set(key, [l]);
  }

  const lines: InvoiceLine[] = [...groups.values()].map((group) => {
    const first = group[0];
    // The span covers every booking in the group, so six bursts on one tower
    // read as the single date range the client was sold.
    const span: CampaignLine = {
      ...first,
      start_date: group.reduce((a, l) => (l.start_date < a ? l.start_date : a), first.start_date),
      end_date: group.reduce((a, l) => (l.end_date > a ? l.end_date : a), first.end_date),
    };
    return {
      id: first.id,
      // Only a group of one can be traced back to a single booking line.
      campaignLineId: group.length === 1 ? first.id : null,
      description: lineDescription(span),
      net: group.reduce((a, l) => a + Number(l.client_charge), 0),
    };
  });

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
