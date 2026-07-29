// ADEX commercial model.
//
// Three figures per booking line, kept strictly apart:
//   client_charge  what the client is invoiced (ex VAT) — can exceed supplier
//                  gross where we mark up
//   supplier_gross the rate card
//   supplier_net   gross less 15% commission — what the PO pays
//                  (Creative is time-based and billed at cost)
//
// Invoices only ever read client_charge; POs only ever read gross/net.

export const VAT_RATE = 0.2;
export const COMMISSION_RATE = 0.15;
export const MARGIN_FLOOR = 15;

export type CampaignLine = {
  id: string;
  channel: string;
  vendor: string;
  detail: string | null;
  start_date: string;
  end_date: string;
  supplier_gross: number;
  supplier_net: number;
  client_charge: number;
  // Present on the detail view, omitted from list queries.
  selected_dates?: string | null;
  cpt?: number | null;
  ooh_format?: string | null;
  ooh_disp_type?: string | null;
  copy_instruction?: string;
  urn?: string | null;
};

export type Campaign = {
  id: string;
  ref: string;
  name: string;
  status: string;
  region: string;
  start_date: string | null;
  end_date: string | null;
  fee: number;
  billed: number;
  leads: number;
  cpl: number;
  clients: { name: string } | null;
  profiles: { full_name: string } | null;
  campaign_lines: CampaignLine[];
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const clientGross = (c: Campaign) =>
  sum(c.campaign_lines.map((l) => Number(l.client_charge))) + Number(c.fee);

export const supplierNet = (c: Campaign) =>
  sum(c.campaign_lines.map((l) => Number(l.supplier_net)));

export const supplierGross = (c: Campaign) =>
  sum(c.campaign_lines.map((l) => Number(l.supplier_gross)));

export const dealProfit = (c: Campaign) => clientGross(c) - supplierNet(c);

export const dealMargin = (c: Campaign) => {
  const gross = clientGross(c);
  return gross ? (dealProfit(c) / gross) * 100 : 0;
};

/** The 15% commission element of profit, separate from any markup. */
export const commissionOf = (c: Campaign) => supplierGross(c) - supplierNet(c);

/** Profit earned by charging above supplier gross. */
export const markupOf = (c: Campaign) =>
  sum(c.campaign_lines.map((l) => Number(l.client_charge) - Number(l.supplier_gross)));

export const vatOn = (exVat: number) => Math.round(exVat * VAT_RATE);

// --- formatting ---------------------------------------------------------

export const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

export const gbpK = (n: number) =>
  n >= 1000 ? "£" + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : "£" + Math.round(n);

// --- dates -------------------------------------------------------------
// Postgres hands back ISO (2026-08-03); everything shown to the team is
// British. Sorting still uses the raw ISO value, never these strings.

/** 03 Aug 2026 */
export const dateGB = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

/** 03 Aug (no year, for compact ranges) */
export const dateShortGB = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

/** 03 Aug – 30 Aug 2026, dropping the repeated year */
export const rangeGB = (from: string | null | undefined, to: string | null | undefined) => {
  if (!from && !to) return "—";
  if (!to) return dateGB(from);
  if (!from) return dateGB(to);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${sameYear ? dateShortGB(from) : dateGB(from)} – ${dateGB(to)}`;
};

export const CHANNELS = ["Digital", "TV", "Radio", "OOH", "Print", "Creative"] as const;

export const CHANNEL_COLOUR: Record<string, string> = {
  Digital: "var(--c-digital)",
  TV: "var(--c-tv)",
  Radio: "var(--c-radio)",
  OOH: "var(--c-ooh)",
  Print: "var(--c-print)",
  Creative: "var(--c-creative)",
};

export const channelLabel = (k: string) =>
  k === "Radio" ? "Radio & DAB" : k === "OOH" ? "Out of Home" : k;

export const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  booked: "Booked",
  live: "Live",
  risk: "At risk",
  done: "Complete",
};

export const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
