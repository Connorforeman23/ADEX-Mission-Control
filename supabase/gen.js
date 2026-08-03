// Turn the parsed Space Orders into one idempotent import.
const fs = require("fs");
const d = require("./parsed.json");
const TODAY = "2026-07-29";

// PO → campaign. Several orders legitimately belong to one campaign.
const GROUPS = [
  ["AE-2578", "Global OOH 2026 — GD sheets, TCPs & DEP", "London & SE", ["0078"]],
  ["AE-2579", "Train Card Panels 2026", "London & SE", ["0079"]],
  ["AE-2580", "Radio — Capital UK & Heart 80s", "National", ["0080", "0081"]],
  ["AE-2581", "FTWM — Jan/Feb 26", "National", ["0082"]],
  ["AE-2582", "M4 Tower — Mar–Aug 26", "London", ["0083"]],
  ["AE-2583", "FTWM — Mar/Apr 26", "National", ["0084"]],
  ["AE-2584", "Mancunian Arch — 30 weeks", "Granada", ["0085"]],
  ["AE-2585", "FTWM — May/Jun 26", "National", ["0086"]],
  ["AE-2586", "Liverpool D6s", "Granada", ["0087"]],
  ["AE-2587", "FTWM — Mar–Jun 26 (x7)", "National", ["0088"]],
  ["AE-2588", "FTWM — Additional page 16 May", "National", ["0089"]],
  ["AE-2589", "Wimbledon Activation", "London", ["0090"]],
  ["AE-2590", "Kingston OOH — Summer", "London", ["0091", "0092"]],
  ["AE-2591", "FTWM — Jul/Aug 26", "National", ["0093"]],
  ["AE-2592", "M4 Tower — 6 month package", "London", ["0094", "0097"]],
  ["AE-2593", "Daily Telegraph — 01 Jul", "National", ["0095"]],
  ["AE-2594", "Irish Times — July", "National", ["0096", "0098"]],
  ["AE-2595", "Telegraph & Mail — w/c 06 Jul", "National", ["0099"]],
  ["AE-2596", "Glasgow OOH — Jul/Aug", "National", ["0100", "0101"]],
];

// Supplier names normalised to the booking-form rosters.
const VENDOR = {
  "Global Media": "Global OOH", Global: "Global OOH", JCDecaux: "JCD", JCD: "JCD",
  KBH: "KBH Media", FT: "FT", "Mail Metro Media": "MMM", "Irish Times": "Irish Times",
  Treacle7: "Treacle7", "Ocean OOH": "Ocean OOH",
};

const channelOf = (po, label, vendor, isProd) => {
  if (isProd || /production/i.test(label)) return "Creative";
  if (po === "0080") return "Radio";
  if (po === "0081") return "Creative";
  if (["FT", "Irish Times", "MMM", "Mail Metro Media"].includes(vendor)) return "Print";
  return "OOH";
};

// Typos in the source orders, corrected on the way in.
const DATE_FIX = {
  "2024-02-22": "2026-02-22", // RAN0078 burst 2 end — year typed as 2024
  "2026-06-26": "2026-07-26", // RAN0078 burst 4 end — ended before it started
  "2025-07-01": "2026-07-01", // RAN0095/0096 — year typed as 2025
};
const fixDate = (s) => (s ? DATE_FIX[s] ?? s : s);

const esc = (s) => String(s ?? "").replace(/'/g, "''").replace(/\s+/g, " ").trim();
const sqlDate = (s) => (s ? `date '${s}'` : "null");

const rows = [];
for (const [ref, name, region, pos] of GROUPS) {
  for (const po of pos) {
    const doc = d[po];
    if (!doc) continue;
    const vendorRaw = (doc.company || "").trim();
    const vendor = VENDOR[vendorRaw] ?? vendorRaw;
    for (const l of doc.lines) {
      if (l.gross == null || l.gross <= 0) continue;
      // Skip the order's own summary and metric rows — they aren't bookings.
      if (/^(CPT|Impacts|Reach)$/i.test(l.label)) continue;
      if (/^Total\b|Campaign Length|Agency Commission|Order Number|Space Order/i.test(l.label)) continue;
      if (/^(Gross|Media|Total) (Media|Net|Campaign|Production)/i.test(l.label)) continue;
      const isProd = l.isProduction;
      const channel = channelOf(po, l.label, vendorRaw, isProd);
      // Production is billed at cost — no commission.
      const commission = isProd ? 0 : doc.commission;
      // Irish Times bills in euros; the invoice run shows £7,327.38 per
      // insertion, so store that GBP equivalent to keep one currency.
      let gross = l.gross;
      if (vendorRaw === "Irish Times") gross = 7327.38;
      rows.push({
        ref, name, region, po: `RAN${po}`, channel, vendor,
        contact: doc.to, detail: l.label || vendor,
        start: fixDate(l.dates[0] ?? null), end: fixDate(l.dates[1] ?? l.dates[0] ?? null),
        gross, commission, copy: doc.copy,
      });
    }
  }
}

// Campaign dates and status derive from their lines.
const camps = new Map();
for (const r of rows) {
  const c = camps.get(r.ref) ?? { ref: r.ref, name: r.name, region: r.region, start: null, end: null, pos: new Set() };
  if (r.start && (!c.start || r.start < c.start)) c.start = r.start;
  if (r.end && (!c.end || r.end > c.end)) c.end = r.end;
  c.pos.add(r.po);
  camps.set(r.ref, c);
}
for (const c of camps.values()) {
  c.status = !c.start ? "planning" : c.end && c.end < TODAY ? "done" : c.start <= TODAY ? "live" : "booked";
}

const out = [];
out.push(`-- ADEX Mission Control — Randox Health import (RAN0078–RAN0101)
-- Generated from the 24 supplier Space Orders. Client charge is set equal to
-- supplier gross throughout, pending the full invoice report.
-- Idempotent: re-running adds nothing that is already present.

alter table campaign_lines add column if not exists commission_pct numeric(5,2) not null default 15;
alter table campaign_lines add column if not exists supplier_contact text;
alter table campaign_lines drop column if exists supplier_net;
alter table campaign_lines add column supplier_net numeric(12,2)
  generated always as (round(supplier_gross * (1 - commission_pct / 100.0), 2)) stored;
drop index if exists campaign_lines_supplier_po_key;

insert into clients (name, sector, owner_id, status)
select 'Randox Health', 'Healthcare / diagnostics',
       (select id from profiles where lower(email) = 'connor.foreman@advertisingexcellence.co.uk'), 'live'
on conflict (name) do nothing;
`);

out.push(`\n-- campaigns\ninsert into campaigns (ref, name, client_id, status, owner_id, region, start_date, end_date, fee, note)`);
out.push([...camps.values()].map((c, i) =>
  `${i ? "union all " : "select * from (\n  "}select '${c.ref}', '${esc(c.name)}', (select id from clients where name='Randox Health'), '${c.status}', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), '${esc(c.region)}', ${sqlDate(c.start)}, ${sqlDate(c.end)}, 0, '${[...c.pos].join(" + ")}'`
).join("\n  ") + "\n) v\non conflict (ref) do nothing;");

out.push(`\n-- booking lines\ninsert into campaign_lines (campaign_id, supplier_po, supplier_contact, channel, vendor, detail, start_date, end_date, copy_instruction, supplier_gross, commission_pct, client_charge)\nselect * from (`);
out.push(rows.map((r, i) =>
  `  ${i ? "union all " : ""}select (select id from campaigns where ref='${r.ref}'), '${r.po}', '${esc(r.contact)}', '${r.channel}', '${esc(r.vendor)}', '${esc(r.detail)}', ${sqlDate(r.start)}, ${sqlDate(r.end)}, '${r.copy}', ${r.gross}, ${r.commission}, ${r.gross}`
).join("\n"));
out.push(`) v\nwhere not exists (select 1 from campaign_lines cl where cl.supplier_po like 'RAN%');`);

// ---- client invoices from the Sage activity report ----------------------
const invoices = JSON.parse(fs.readFileSync("invoices.json", "utf8"));
// Match an invoice to a campaign by what its lines describe.
const MATCH = [
  [/train card/i, "AE-2579"], [/capital|heart 80/i, "AE-2580"],
  [/mancunian/i, "AE-2584"], [/liverpool/i, "AE-2586"],
  [/wimbledon/i, "AE-2589"], [/kingston|brental|brentall/i, "AE-2590"],
  [/glasgow|streethub|streetliner/i, "AE-2596"], [/irish times/i, "AE-2594"],
  [/daily mail/i, "AE-2595"], [/telegraph/i, "AE-2593"],
  [/m4 tower/i, "AE-2592"], [/sheets|tcp|dep |train/i, "AE-2578"],
  [/ftwm/i, "AE-2591"],
];
const campOf = (inv) => {
  const text = inv.lines.join(" ");
  for (const [re, ref] of MATCH) if (re.test(text)) return ref;
  return null;
};
out.push(`\n-- client invoices (Sage), with payment status
alter table client_invoices add column if not exists client_id uuid references clients(id) on delete cascade;
alter table client_invoices add column if not exists outstanding numeric(12,2) not null default 0;
alter table client_invoices alter column campaign_id drop not null;
insert into client_invoices (invoice_no, invoice_date, amount_ex_vat, outstanding, status, client_id, campaign_id)
select * from (`);
out.push(invoices.map((i, idx) => {
  const ref = campOf(i);
  const exVat = +(i.gross / 1.2).toFixed(2);
  const status = i.os > 0.005 ? "Unpaid" : "Paid";
  return `  ${idx ? "union all " : ""}select '${i.ref}', date '${i.date}', ${exVat}, ${(+i.os).toFixed(2)}, '${status}', (select id from clients where name='Randox Health'), ${ref ? `(select id from campaigns where ref='${ref}')` : "null"}`;
}).join("\n"));
out.push(`) v\non conflict (invoice_no) do update set
  outstanding = excluded.outstanding, status = excluded.status;

insert into po_counters (prefix, last_number) values ('INV', 18817)
on conflict (prefix) do update set last_number = greatest(po_counters.last_number, 18817);`);

out.push(`\n-- counters continue from the last order\ninsert into po_counters (prefix, last_number) values ('RAN', 101)
on conflict (prefix) do update set last_number = greatest(po_counters.last_number, 101);

select 'Randox import complete' as result,
       (select count(*) from campaigns where ref between 'AE-2578' and 'AE-2596') as campaigns,
       (select count(*) from campaign_lines where supplier_po like 'RAN%') as booking_lines,
       (select count(distinct supplier_po) from campaign_lines where supplier_po like 'RAN%') as distinct_pos;`);

fs.writeFileSync("import.sql", out.join("\n"));

// Summary for Connor
console.log("ref      campaign                                    status  lines   gross");
let total = 0;
for (const c of camps.values()) {
  const mine = rows.filter((r) => r.ref === c.ref);
  const g = mine.reduce((a, r) => a + r.gross, 0);
  total += g;
  console.log(`${c.ref}  ${c.name.slice(0, 42).padEnd(42)} ${c.status.padEnd(8)} ${String(mine.length).padStart(3)}  £${g.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`);
}
console.log(`\n${rows.length} lines · ${camps.size} campaigns · total gross £${total.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`);
