// Reading a year of bookings out of a spreadsheet.
//
// Connor is waiting a month for the Xero migration and cannot load this
// year's history until it finishes. He does not actually need to: Xero holds
// INVOICES. A booking is a supplier, a publication, dates, what we paid and
// what we charged — and that lives in Sage, in the Space Orders already filed,
// and in the team's spreadsheets. None of it depends on Xero.
//
// So: one spreadsheet, one row per booking line, read here.
//
// Parsing and checking are kept in this file, away from the database, because
// the hard part is telling someone exactly which row is wrong and why. A row
// that cannot be read must never stop the other three hundred from loading.

import { parseFlexibleDate } from "@/lib/dates";

/** The columns a row may carry. Everything is matched case-insensitively. */
export const IMPORT_COLUMNS = [
  "client",
  "campaign",
  "channel",
  "supplier",
  "publication",
  "start",
  "end",
  "supplier_gross",
  "client_charge",
  "commission_pct",
  "po",
  "line_type",
  "detail",
  "client_po",
] as const;

export const REQUIRED_COLUMNS = [
  "client",
  "campaign",
  "channel",
  "supplier",
  "start",
  "end",
  "supplier_gross",
  "client_charge",
] as const;

const CHANNELS = ["Digital", "TV", "Radio", "OOH", "Print", "Creative"] as const;

export type ImportLine = {
  /** 1-based row number in the file, so an error can be pointed at. */
  row: number;
  client: string;
  campaign: string;
  channel: string;
  supplier: string;
  publication: string;
  start: string;
  end: string;
  supplierGross: number;
  clientCharge: number;
  commissionPct: number;
  po: string;
  lineType: "media" | "production";
  detail: string;
  clientPo: string;
};

export type RowProblem = { row: number; problem: string };

export type ParsedImport = {
  lines: ImportLine[];
  problems: RowProblem[];
  /** Header names found in the file that we do not use — usually a typo. */
  ignoredColumns: string[];
};

/**
 * A CSV reader that handles quotes, because a publication called
 * "Birmingham Mail, Saturday" is not an unreasonable thing to type and a
 * split on commas would silently shift every column after it.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  // Strip a UTF-8 BOM, which Excel writes and which otherwise becomes part of
  // the first header name.
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      // Swallow the \n of a \r\n pair.
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

/** "£1,234.50" and "1234.5" both mean the same thing on a spreadsheet. */
function money(raw: string): number | null {
  const cleaned = raw.replace(/[£$€,\s]/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Match a header however it was typed: "Supplier Gross", "supplier_gross". */
function normaliseHeader(h: string) {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Channel, however it was capitalised — and a few names people actually use. */
function channelOf(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  const aliases: Record<string, string> = {
    ooh: "OOH",
    outdoor: "OOH",
    billboard: "OOH",
    digital: "Digital",
    online: "Digital",
    ppc: "Digital",
    tv: "TV",
    television: "TV",
    radio: "Radio",
    audio: "Radio",
    print: "Print",
    press: "Print",
    newspaper: "Print",
    creative: "Creative",
    production: "Creative",
  };
  if (aliases[v]) return aliases[v];
  const exact = CHANNELS.find((c) => c.toLowerCase() === v);
  return exact ?? null;
}

export function parseBookingCsv(text: string): ParsedImport {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return {
      lines: [],
      problems: [{ row: 0, problem: "The file has no rows under the headings." }],
      ignoredColumns: [],
    };
  }

  const headers = rows[0].map(normaliseHeader);
  const index: Record<string, number> = {};
  headers.forEach((h, i) => {
    if ((IMPORT_COLUMNS as readonly string[]).includes(h) && !(h in index)) index[h] = i;
  });

  const problems: RowProblem[] = [];
  const missing = REQUIRED_COLUMNS.filter((c) => !(c in index));
  if (missing.length) {
    return {
      lines: [],
      problems: [
        {
          row: 0,
          problem: `These headings are missing: ${missing.join(", ")}. The first row of the file must be the headings.`,
        },
      ],
      ignoredColumns: [],
    };
  }

  const ignoredColumns = headers.filter(
    (h) => h && !(IMPORT_COLUMNS as readonly string[]).includes(h)
  );

  const cell = (r: string[], name: string) => (index[name] === undefined ? "" : (r[index[name]] ?? "").trim());

  const lines: ImportLine[] = [];
  const thisYear = new Date().getFullYear();

  rows.slice(1).forEach((r, i) => {
    const rowNo = i + 2; // the heading row is 1
    const complain = (problem: string) => problems.push({ row: rowNo, problem });

    const client = cell(r, "client");
    const campaign = cell(r, "campaign");
    const supplier = cell(r, "supplier");
    if (!client) return complain("No client.");
    if (!campaign) return complain("No campaign name.");
    if (!supplier) return complain("No supplier.");

    const channel = channelOf(cell(r, "channel"));
    if (!channel) {
      return complain(
        `"${cell(r, "channel")}" is not a channel. Use one of: ${CHANNELS.join(", ")}.`
      );
    }

    // Dates are read as day-first, which is what a UK spreadsheet writes.
    // A row with no year at all falls back to this year.
    const start = parseFlexibleDate(cell(r, "start"), thisYear);
    if (!start) return complain(`Could not read the start date "${cell(r, "start")}".`);
    // The end date takes its year from the start, so "28 Mar" on a line
    // starting in 2026 does not quietly become 2027.
    const end = parseFlexibleDate(cell(r, "end"), Number(start.slice(0, 4))) ?? start;
    if (!end) return complain(`Could not read the end date "${cell(r, "end")}".`);
    if (end < start) return complain("The end date is before the start date.");

    const supplierGross = money(cell(r, "supplier_gross"));
    const clientCharge = money(cell(r, "client_charge"));
    if (supplierGross === null) return complain(`"${cell(r, "supplier_gross")}" is not a number.`);
    if (clientCharge === null) return complain(`"${cell(r, "client_charge")}" is not a number.`);

    const rawCommission = cell(r, "commission_pct");
    const commissionPct = rawCommission === "" ? 15 : Number(rawCommission.replace("%", ""));
    if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) {
      return complain(`"${rawCommission}" is not a commission percentage.`);
    }

    const rawType = cell(r, "line_type").toLowerCase();
    const lineType = rawType === "production" ? "production" : "media";

    lines.push({
      row: rowNo,
      client,
      campaign,
      channel,
      supplier,
      publication: cell(r, "publication"),
      start,
      end,
      supplierGross,
      clientCharge,
      // Production is bought at cost, so an unstated rate is 0 rather than 15.
      commissionPct: rawCommission === "" && lineType === "production" ? 0 : commissionPct,
      po: cell(r, "po"),
      lineType,
      detail: cell(r, "detail"),
      clientPo: cell(r, "client_po"),
    });
  });

  return { lines, problems, ignoredColumns };
}

/** One campaign's worth of rows, as the importer will create them. */
export type ImportGroup = {
  client: string;
  campaign: string;
  start: string;
  end: string;
  clientPo: string;
  lines: ImportLine[];
  billings: number;
  cost: number;
};

/**
 * Rows become campaigns by client and campaign name — the way anyone filling
 * in a spreadsheet would expect. Campaign dates are the span of their lines,
 * rather than another column to get wrong.
 */
export function groupForImport(lines: ImportLine[]): ImportGroup[] {
  const groups = new Map<string, ImportGroup>();
  for (const l of lines) {
    const key = `${l.client.toLowerCase()}\u0000${l.campaign.toLowerCase()}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        client: l.client,
        campaign: l.campaign,
        start: l.start,
        end: l.end,
        clientPo: l.clientPo,
        lines: [],
        billings: 0,
        cost: 0,
      };
      groups.set(key, g);
    }
    g.lines.push(l);
    if (l.start < g.start) g.start = l.start;
    if (l.end > g.end) g.end = l.end;
    if (!g.clientPo && l.clientPo) g.clientPo = l.clientPo;
    g.billings += l.clientCharge;
    g.cost += l.supplierGross * (1 - l.commissionPct / 100);
  }
  return [...groups.values()];
}

/** The headings, as a file somebody can open in Excel and fill in. */
export const TEMPLATE_CSV = [
  IMPORT_COLUMNS.join(","),
  'Randox Health,Spring Health Check,Radio,Free Radio,Free Radio Birmingham,01/03/2026,28/03/2026,9250,11500,15,RAN0094,media,4 week burst,PO-4471',
  'Randox Health,Spring Health Check,OOH,JCDecaux,12 x 48 Sheet,01/03/2026,14/03/2026,18400,22000,15,RAN0095,media,,PO-4471',
  'Randox Health,Spring Health Check,Creative,Studio,,01/02/2026,14/02/2026,850,1200,0,,production,Artwork and amends,PO-4471',
].join("\n");

/**
 * What the importer reports back.
 *
 * A discriminated union rather than a bag of optional fields: the screen has
 * to tell "the file was unreadable" apart from "the file was fine and nothing
 * needed importing", and those look identical through optional properties.
 */
export type ImportOutcome =
  | { ok: false; error: string; problems: RowProblem[] }
  | {
      ok: true;
      created: { clients: number; campaigns: number; lines: number };
      problems: RowProblem[];
      /** Lines already on the books, so running the same file twice is safe. */
      skipped: string[];
      /** Rows the database itself refused. */
      failures: string[];
      ignoredColumns: string[];
      /** How many campaigns the rows grouped into. */
      groups: number;
    };
