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
  /** The sentence at the foot: the client's own terms, or the house default. */
  terms: string;
  /** First day of the month this invoice covers; null = the whole campaign. */
  periodMonth: string | null;
  /** Every month this campaign runs in — what else could be invoiced. */
  availableMonths: string[];
  /** Months already invoiced, so the preview doesn't offer them twice. */
  invoicedMonths: string[];
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

/** The 25th of the month after the invoice date — the house default. */
export function dueAfter(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return new Date(d.getFullYear(), d.getMonth() + 1, 25).toISOString().slice(0, 10);
}

export type PaymentTerms = { days: number | null; basis: string | null };

/**
 * When an invoice falls due.
 *
 * A client with recorded terms — 30/45/60 days from the end of the month, or
 * from the date of publication (the campaign's first day) — gets exactly that.
 * A client with none keeps the house default: dated month end, due the 25th
 * of the next. (Decision A, 16 Sept.)
 */
export function dueDateFor(invoiceDate: string, publicationDate: string | null, terms: PaymentTerms) {
  if (!terms.days) return dueAfter(invoiceDate);
  const addDays = (iso: string, n: number) => {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  if (terms.basis === "publication" && publicationDate) return addDays(publicationDate, terms.days);
  return addDays(monthEnd(invoiceDate), terms.days);
}

/** "30 days from end of month", for the foot of the invoice. */
export function termsSentence(terms: PaymentTerms) {
  if (!terms.days) return PAYMENT_TERMS;
  return `Payment due within ${terms.days} days from ${terms.basis === "publication" ? "the date of publication" : "the end of the month"}.`;
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

// --- monthly invoicing (decision B) -------------------------------------
//
// Randox books campaigns running over several months and wants an invoice per
// month. Connor's rule, and it is deliberately simple:
//
//   A line is invoiced WHOLE, in the month it runs. Nothing is ever split
//   across months by days. At the end of September ADEX invoices everything
//   running in October — a line that starts AND finishes inside October is
//   invoiced then, and nothing else is.
//
// A line crossing a month end belongs to the month it STARTS, so every line
// lands in exactly one invoice and nothing is billed twice or missed.

/** "2026-10-01" — the first day of the month a date falls in. */
export function monthStart(iso: string) {
  return iso.slice(0, 8) + "01";
}

/** "October 2026", for the invoice and the period picker. */
export function monthName(iso: string) {
  return new Date(iso.slice(0, 8) + "01T00:00:00").toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

/** Does this line belong to that month? By the month it starts in. */
export function lineInMonth(l: CampaignLine, periodMonth: string) {
  return !!l.start_date && monthStart(l.start_date) === monthStart(periodMonth);
}

/**
 * Every month a campaign has lines running in, oldest first.
 *
 * This is what the preview offers as periods to invoice, and what tells you
 * at a glance that a campaign needs three invoices rather than one.
 */
export function campaignMonths(campaign: Campaign): string[] {
  const months = new Set<string>();
  for (const l of campaign.campaign_lines) {
    if (l.start_date) months.add(monthStart(l.start_date));
  }
  return [...months].sort();
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
export function draftInvoiceLines(campaign: Campaign, periodMonth?: string | null): InvoiceLine[] {
  // For a client invoiced monthly, only the lines running in that month.
  const inScope = periodMonth
    ? campaign.campaign_lines.filter((l) => lineInMonth(l, periodMonth))
    : campaign.campaign_lines;

  const groups = new Map<string, CampaignLine[]>();
  for (const l of inScope) {
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
  // On a monthly campaign it belongs to the FIRST month only — charging it
  // every month would bill it three times over.
  const months = campaignMonths(campaign);
  const feeApplies = !periodMonth || monthStart(periodMonth) === months[0];
  const fee = feeApplies ? Number(campaign.fee) : 0;
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
