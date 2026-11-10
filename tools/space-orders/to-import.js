// Step 3 of the Space Order import: write the spreadsheet that Mission
// Control's "Import bookings" page reads, from the parser's orders.json.
//
//   node to-import.js "<parsed dir>" "<output dir>" [--campaign=month|po] [--charge=gross|zero] [--include=RAN,…]
//
// Only orders the parser marked clean go in. Everything else is listed in
// held-back.csv with the reason, so nothing disappears quietly.
//
// What the Space Orders cannot supply, and what is done about each:
//   campaign       — orders carry no campaign name. --campaign=month (default)
//                    groups a client's orders by the month they start in;
//                    --campaign=po makes one campaign per PO.
//   client_charge  — never on a Space Order. --charge=gross (default) charges
//                    media at supplier gross and production at cost, which is
//                    a PLACEHOLDER until invoices are matched; --charge=zero
//                    leaves it at 0.
//   channel        — taken only where two independent readings agree (see
//                    channels.json); otherwise the order is held back.
//   names          — client and supplier names are passed through
//                    client-names.json / supplier-names.json, created here on
//                    first run and never overwritten, so they can be edited to
//                    match what is already on the books.
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const [parsedDir, outDir] = args.filter((a) => !a.startsWith("--"));
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
if (!parsedDir || !outDir) {
  console.error('usage: node to-import.js "<parsed dir>" "<output dir>" [--campaign=month|po] [--charge=gross|zero] [--include=RAN]');
  process.exit(1);
}
// Only orders with something booked on or after this date are considered.
const periodFrom = opt.from ?? "2025-11-01";
// Who owns what (Connor, 10 Nov 2026): Randox is Connor's, every other client
// is Steve's. Whoever raised the order is only the person on the deal.
const OWNER_BY_CODE = { RAN: "Connor Foreman" };
const DEFAULT_OWNER = "Steve Foreman";
const campaignRule = opt.campaign ?? "month";
// --charge=matched (default): the client charge found on a sales invoice by
//   match-charges.js. --unmatched says what to do with a line that has none:
//   hold the order back (default), or fall back to supplier gross, or zero.
//   --estimates=use also accepts shared-out monthly totals that did not tie.
// --charge=gross / zero ignore invoices altogether.
const chargeRule = opt.charge ?? "matched";
const unmatchedRule = opt.unmatched ?? "hold";
const useEstimates = (opt.estimates ?? "hold") === "use";
const includeCodes = new Set((opt.include ?? "").split(",").filter(Boolean).map((s) => s.toUpperCase()));
// Clients already loaded into Mission Control by an earlier import.
const ALREADY_LOADED = new Set(["RAN"]);

// Orders whose printed number agrees with the file name are taken first, so
// when two files hold the same lines it is the stale copy that is held back.
const orders = JSON.parse(fs.readFileSync(path.join(parsedDir, "orders.json"), "utf8"))
  .sort((a, b) => Number(a.order_number_in_doc !== a.po_number) - Number(b.order_number_in_doc !== b.po_number) || String(a.po_number).localeCompare(String(b.po_number)));
fs.mkdirSync(outDir, { recursive: true });

// --- editable name maps ------------------------------------------------------
function loadMap(file, seed) {
  const p = path.join(outDir, file);
  if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(seed, null, 1));
  const saved = JSON.parse(fs.readFileSync(p, "utf8"));
  // New names seen since the file was written are added, existing ones kept.
  let grew = false;
  for (const [k, v] of Object.entries(seed)) if (!(k in saved)) { saved[k] = v; grew = true; }
  if (grew) fs.writeFileSync(p, JSON.stringify(saved, null, 1));
  return saved;
}
const tidy = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const clientSeed = {};
for (const o of orders) if (o.client_folder) clientSeed[o.client_folder] ??= o.client_folder.split(" / ").pop();
const clientNames = loadMap("client-names.json", Object.fromEntries(Object.entries(clientSeed).sort()));

// Only spellings that are plainly the same company are merged by default.
const SAME_COMPANY = { "newsuk": "News UK", "plug": "Plug Media", "boom": "Boom Radio", "axiom": "Axiom Media", "think": "Think Publishing", "canopy": "Canopy Media", "jcd": "JCDecaux" };
const supplierSeed = {};
for (const o of orders) {
  const name = tidy(o.media_owner);
  if (name) supplierSeed[name] ??= SAME_COMPANY[name.toLowerCase().replace(/[^a-z]/g, "")] ?? name;
}
const supplierNames = loadMap("supplier-names.json", Object.fromEntries(Object.entries(supplierSeed).sort()));

// Channel per PO: { "VCC0484": "TV", … }. Written by whoever settled it; an
// order with no entry here is held back rather than guessed.
const chargesPath = path.join(outDir, "charges.json");
const charges = chargeRule === "matched" && fs.existsSync(chargesPath) ? JSON.parse(fs.readFileSync(chargesPath, "utf8")) : {};
const chargeHow = {};
const supersededPath = path.join(outDir, 'superseded.json');
const supersededKnown = fs.existsSync(supersededPath);
const superseded = supersededKnown ? JSON.parse(fs.readFileSync(supersededPath, 'utf8')) : {};
const channelsPath = path.join(outDir, "channels.json");
const channels = fs.existsSync(channelsPath) ? JSON.parse(fs.readFileSync(channelsPath, "utf8")) : {};
const CHANNELS = ["Digital", "TV", "Radio", "OOH", "Print", "Creative"];

// --- choose the orders -------------------------------------------------------
const held = [];
const hold = (o, reason) => held.push({ po_number: o.po_number, client_folder: o.client_folder, media_owner: o.media_owner, gross: o.totals?.gross ?? "", reason });
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const rows = [];
const seenKeys = new Map(); // supplier + date + cost within a campaign → the PO that holds it
const inPeriod = [];
let ordersIn = 0;

const outside = [];
for (const o of orders) {
  // In the period if anything on it runs on or after the start date; an order
  // with no readable line dates is judged by the date it was raised.
  const lastDay = o.booked_to ?? o.order_date;
  if (o.status === "unreadable" || !lastDay) { if (o.status !== "unreadable") { hold(o, "no dates at all, so it cannot be placed in or out of the year"); continue; } }
  else if (lastDay < periodFrom) { outside.push(o.po_number); continue; }
  inPeriod.push(o);
  if (o.status !== "clean") { hold(o, o.status === "check" ? `needs checking: ${o.checks[0]}${o.checks.length > 1 ? ` (+${o.checks.length - 1} more)` : ""}` : "could not be read"); continue; }
  // A later revision of the same order replaces this one (see superseded.json,
  // written by match-charges.js). Only the last revision can go in.
  if (superseded[o.po_number]) { hold(o, `superseded by ${superseded[o.po_number]}, a later revision of the same order`); continue; }
  if (!supersededKnown && o.info.some((i) => /^related files/.test(i))) { hold(o, 'revised copies exist; decide which is the live order'); continue; }
  if (ALREADY_LOADED.has(o.client_code) && !includeCodes.has(o.client_code)) { hold(o, "client already loaded by an earlier import – check for duplicates before adding"); continue; }
  if (o.currency !== "GBP") { hold(o, `priced in ${o.currency}; the importer has no currency column`); continue; }
  const channel = channels[o.po_number];
  if (!channel) { hold(o, "channel not settled (no entry in channels.json)"); continue; }
  if (!CHANNELS.includes(channel)) { hold(o, `channels.json has '${channel}', which is not a channel`); continue; }

  const dated = o.lines.filter((l) => l.start_date);
  if (!dated.length) { hold(o, "no dated line to take dates from"); continue; }
  const spanStart = dated.map((l) => l.start_date).sort()[0];
  const spanEnd = dated.map((l) => l.end_date ?? l.start_date).sort().at(-1);

  // A file saved loose in the library root has no client folder: fall back to
  // the client named inside it.
  const client = tidy(clientNames[o.client_folder] ?? o.client_folder ?? o.client_in_doc);
  if (!client) { hold(o, "no client folder and no client named inside"); continue; }
  const supplier = tidy(supplierNames[tidy(o.media_owner)] ?? o.media_owner);
  const campaign = campaignRule === "po"
    ? `${o.po_number} ${supplier}`
    : `${client} ${MONTH[Number(spanStart.slice(5, 7)) - 1]} ${spanStart.slice(0, 4)}`;

  const orderRows = [];
  let lineProblem = null;
  for (const l of o.lines) {
    // Production rows print one cost, under Net. It is bought at cost: that
    // figure is the supplier cost and carries no commission.
    const production = l.is_production;
    const gross = production ? (l.gross ?? l.net) : l.gross;
    if (gross === null || gross === undefined) { lineProblem = `line ${l.line_no} has no cost`; break; }
    const commission = production ? (l.gross !== null && l.net !== null && l.gross !== l.net ? o.commission_pct : 0) : o.commission_pct;
    // What the client was charged for this line.
    let clientCharge, how;
    if (chargeRule === "zero") { clientCharge = 0; how = "zero"; }
    else if (chargeRule === "gross") { clientCharge = gross; how = "supplier gross (placeholder)"; }
    else {
      const m = charges[`${o.po_number}|${l.line_no}`];
      if (m && (m.method !== "group-estimate" || useEstimates)) { clientCharge = m.charge; how = `invoice ${m.invoice} (${m.method})`; }
      else if (gross === 0) { clientCharge = 0; how = "free of charge"; }
      else if (unmatchedRule === "gross") { clientCharge = gross; how = "supplier gross (placeholder)"; }
      else if (unmatchedRule === "zero") { clientCharge = 0; how = "zero"; }
      else { lineProblem = m ? `client charge for line ${l.line_no} is only an estimate (invoice ${m.invoice})` : `no invoice found for line ${l.line_no}, so no client charge`; break; }
    }
    chargeHow[how.replace(/invoice \S+ /, "invoice ")] = (chargeHow[how.replace(/invoice \S+ /, "invoice ")] ?? 0) + 1;
    const publication = l.columns?.Publication ?? l.columns?.Title ?? l.columns?.Titles ?? "";
    const detail = [l.section, ...Object.entries(l.columns ?? {}).filter(([k]) => !/^(publication|titles?)$/i.test(k)).map(([, v]) => v), l.free_of_charge ? "Free of charge" : null]
      .filter(Boolean).join(" – ");
    orderRows.push({
      client, campaign, channel, supplier, publication: tidy(publication),
      start: l.start_date ?? spanStart, end: l.end_date ?? l.start_date ?? spanEnd,
      supplier_gross: gross, client_charge: clientCharge,
      commission_pct: commission ?? "", po: o.po_number, line_type: production ? "production" : "media",
      detail: tidy(detail), client_po: "",
      owner: OWNER_BY_CODE[o.client_code] ?? DEFAULT_OWNER, handled_by: tidy(o.from_staff),
    });
  }
  if (lineProblem) { hold(o, lineProblem); continue; }

  // The importer recognises a line already on the books by supplier + start
  // date + gross within a campaign, and skips it. So a line that shares all
  // three with another would be dropped without a word. Rather than lose it,
  // the whole order is held back and the reason given.
  const key = (r) => [r.client, r.campaign, r.supplier, r.start, r.supplier_gross].join("\u0000").toLowerCase();
  const own = new Set();
  let twin = false;
  const others = new Set();
  for (const r of orderRows) {
    const k = key(r);
    if (own.has(k)) twin = true;
    own.add(k);
    if (seenKeys.has(k)) others.add(seenKeys.get(k));
  }
  if (others.size) {
    const all = orderRows.every((r) => seenKeys.has(key(r)));
    hold(o, all ? `every line matches ${[...others].join(", ")} – looks like a copy of that order` : `shares lines with ${[...others].join(", ")} (same supplier, date and cost)`);
    continue;
  }
  if (twin) { hold(o, "has two lines with the same supplier, date and cost – the importer would drop one as a repeat"); continue; }
  for (const r of orderRows) seenKeys.set(key(r), o.po_number);
  rows.push(...orderRows);
  ordersIn++;
}
const clashes = []; // nothing left to clash: such orders are held back above

// --- write -------------------------------------------------------------------
// `owner` and `handled_by` are not read by the importer yet (it reports them as
// ignored and makes whoever runs the import the owner). They are in the file so
// the ownership rule travels with the data and is ready when it can be read.
const COLS = ["client", "campaign", "channel", "supplier", "publication", "start", "end", "supplier_gross", "client_charge", "commission_pct", "po", "line_type", "detail", "client_po", "owner", "handled_by"];
const cell = (v) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (cols, data) => [cols.join(","), ...data.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
rows.sort((a, b) => a.client.localeCompare(b.client) || a.start.localeCompare(b.start) || a.po.localeCompare(b.po));
fs.writeFileSync(path.join(outDir, "bookings-import.csv"), csv(COLS, rows));
held.sort((a, b) => String(a.client_folder).localeCompare(String(b.client_folder)) || a.po_number.localeCompare(b.po_number));
fs.writeFileSync(path.join(outDir, "held-back.csv"), "﻿" + csv(["client_folder", "po_number", "media_owner", "gross", "reason"], held));

const sum = (k) => +rows.reduce((a, r) => a + Number(r[k]), 0).toFixed(2);
const reasons = {};
for (const h of new Map(held.map((h) => [h.po_number, h])).values()) {
  const k = h.reason.replace(/:.*/, "").replace(/ – .*/, "").replace(/priced in \w+/, "priced in another currency").replace(/line \d+ has/, "a line has")
    .replace(/no invoice found for line \d+.*/, "no invoice found for a line, so no client charge").replace(/client charge for line \d+ is only an estimate.*/, "client charge is only an estimate")
    .replace(/superseded by .*/, "superseded by a later revision").replace(/every line matches .*/, "looks like a copy of another order").replace(/shares lines with .*/, "shares lines with another order");
  reasons[k] = (reasons[k] ?? 0) + 1;
}
const summary = {
  options: { campaign: campaignRule, charge: chargeRule, unmatched: unmatchedRule, estimates: useEstimates ? "use" : "hold", from: periodFrom },
  order_files_read: orders.length, booked_before_the_period: outside.length, booked_in_the_period: inPeriod.length,
  client_folders_in_the_period: new Set(inPeriod.map((o) => o.client_folder)).size,
  orders_in_file: ordersIn, lines_in_file: rows.length,
  owners: Object.fromEntries([...new Set(rows.map((r) => r.owner))].map((n) => [n, new Set(rows.filter((r) => r.owner === n).map((r) => r.client)).size + " clients"])),
  clients: new Set(rows.map((r) => r.client)).size,
  campaigns: new Set(rows.map((r) => `${r.client}\u0000${r.campaign}`.toLowerCase())).size,
  suppliers: new Set(rows.map((r) => r.supplier.toLowerCase())).size,
  supplier_gross: sum("supplier_gross"), client_charge: sum("client_charge"),
  // Counted as lines were read, so it includes lines of orders later held back.
  where_charges_came_from: chargeHow,
  by_channel: Object.fromEntries(CHANNELS.map((c) => [c, rows.filter((r) => r.channel === c).length]).filter(([, n]) => n)),
  orders_held_back: new Set(held.map((h) => h.po_number)).size, held_back_reasons: reasons,
  lines_importer_would_skip_as_repeats: clashes,
};
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
