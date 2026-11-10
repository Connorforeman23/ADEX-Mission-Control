// Step 2b of the Space Order import: find what the client was actually charged
// for each booking line, by matching sales-invoice lines to booking lines.
//
//   node match-charges.js "<parsed dir>" "<invoice-lines.json>" "<output dir>" [--from=2025-11-01]
//
// A Space Order never says what the client paid, and an invoice never quotes
// the ADEX PO number, so the two are tied together by what they do share: the
// date, the amount, and the words (ITV1, Metro, the publication).
//
// Nothing here is certain, so every match carries how it was made:
//   exact   — same start date, and the invoice amount equals the supplier gross
//   date    — same start date and matching words, amount differs (a mark-up or
//             a discount): the invoice amount is taken as the charge
//   words   — the invoice line gives no start date, but the amount equals the
//             supplier gross and the wording agrees, near the invoice date
//   rate    — the customer is billed at a steady rate off supplier gross
//             (three or more lines of different amounts at the same ratio),
//             and this line sits at that rate with matching wording
//   group   — one invoice line covers several booking lines (a month of TV)
//             and equals their supplier cost to within 2%: the invoice amount
//             is shared out in proportion to supplier cost
//   group-estimate — as group, but the totals differ by more than 2%. The
//             month's total is real; how it falls on each line is a guess
// Anything weaker is left unmatched and listed, never applied.
const fs = require("fs");
const path = require("path");
const { findDates } = require("./parse");

const args = process.argv.slice(2);
const [parsedDir, invoicePath, outDir] = args.filter((a) => !a.startsWith("--"));
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
if (!parsedDir || !invoicePath || !outDir) {
  console.error('usage: node match-charges.js "<parsed dir>" "<invoice-lines.json>" "<output dir>" [--from=2025-11-01]');
  process.exit(1);
}
const periodFrom = opt.from ?? "2025-11-01";
fs.mkdirSync(outDir, { recursive: true });

const orders = JSON.parse(fs.readFileSync(path.join(parsedDir, "orders.json"), "utf8"));
const invoices = JSON.parse(fs.readFileSync(invoicePath, "utf8"));
const channelsPath = path.join(outDir, "channels.json");
const channels = fs.existsSync(channelsPath) ? JSON.parse(fs.readFileSync(channelsPath, "utf8")) : {};

// ------------------------------------------------------------------- helpers
const STOP = new Set("campaign colour color page full the and for inc per new copy with from activity additional insertions bookings booking cost total media ltd limited".split(" "));
const tokens = (s) => new Set(String(s ?? "").toLowerCase().replace(/&/g, " and ").split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t)));
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const overlap = (a, b) => { let n = 0; for (const t of a) if (b.has(t)) n++; return n; };

// A month named in an invoice line ("TV September"), given the year nearest
// to the invoice's own date.
function monthIn(desc, invoiceDate) {
  const m = String(desc).toLowerCase().match(new RegExp(`\\b(${MONTHS.join("|")})[a-z]*\\b`));
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1]);
  const y = Number(invoiceDate.slice(0, 4));
  const best = [y - 1, y, y + 1].map((yy) => `${yy}-${String(mi + 1).padStart(2, "0")}`)
    .sort((a, b) => Math.abs(days(`${a}-15`, invoiceDate)) - Math.abs(days(`${b}-15`, invoiceDate)))[0];
  return best;
}
// A month written on a booking that gives no dates ("Nov 2026", "August").
// With no year, it is the first such month from a little before the order.
function monthFromText(text, orderDate) {
  const m = String(text ?? "").toLowerCase().match(new RegExp(`\\b(${MONTHS.join("|")})[a-z]*\\.?\\s*(20\\d\\d|\\d\\d)?\\b`));
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1]);
  let y = m[2] ? (m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])) : null;
  if (!y) {
    const oy = orderDate ? Number(orderDate.slice(0, 4)) : new Date().getFullYear();
    const om = orderDate ? Number(orderDate.slice(5, 7)) - 1 : 0;
    y = mi < om - 2 ? oy + 1 : oy;
  }
  return `${y}-${String(mi + 1).padStart(2, "0")}`;
}
const lastDay = (ym) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);
const VOD_WORDS = ["vod", "prime", "itvx", "streaming", "adsmart", "olv"];
const CHANNEL_WORDS = { vod: "VOD", tv: "TV", television: "TV", radio: "Radio", newspaper: "Print", newspapers: "Print", print: "Print", press: "Print", magazine: "Print", magazines: "Print", outdoor: "OOH", ooh: "OOH", digital: "Digital", online: "Digital" };
const channelIn = (desc) => { for (const t of String(desc).toLowerCase().split(/[^a-z]+/)) if (CHANNEL_WORDS[t]) return CHANNEL_WORDS[t]; return null; };

// ------------------------------------------------------------- booking lines
// Revised copies: VCC0419, VCC0419a and VCC0419b are one order re-issued. For
// adding up a month, only the last revision counts (same PO number, same media
// owner). Vintage's monthly invoices tie to the bookings on exactly this rule.
const families = new Map();
for (const o of orders) {
  if (!o.client_code) continue;
  const k = `${o.client_code}|${o.po_sequence}|${String(o.media_owner ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6)}`;
  families.set(k, [...(families.get(k) ?? []), o]);
}
const superseded = new Map(); // po → the revision that replaces it
for (const list of families.values()) {
  if (list.length < 2) continue;
  list.sort((a, b) => String(a.po_suffix ?? "").localeCompare(String(b.po_suffix ?? "")));
  for (const o of list.slice(0, -1)) superseded.set(o.po_number, list.at(-1).po_number);
}
fs.writeFileSync(path.join(outDir, "superseded.json"), JSON.stringify(Object.fromEntries([...superseded].sort()), null, 1));

const book = [];
for (const o of orders) {
  if (o.status === "unreadable" || !o.lines?.length) continue;
  const last = o.booked_to ?? o.order_date;
  if (!last || last < periodFrom) continue;
  const orderText = [o.media_owner, ...Object.entries(o.fields ?? {}).filter(([k]) => /channel|campaign type|title|section|station|details|publication/i.test(k)).map(([, v]) => v)].join(" ");
  for (const l of o.lines) {
    const cost = l.is_production ? (l.gross ?? l.net) : l.gross;
    if (cost === null || cost === undefined) continue;
    // A line dated only by month still belongs to that month.
    const month = l.start_date ? l.start_date.slice(0, 7) : monthFromText(l.date_text || o.fields?.Dates || o.fields?.Date || "", o.order_date);
    book.push({
      key: `${o.po_number}|${l.line_no}`, po: o.po_number, line_no: l.line_no, folder: o.client_folder, supplier: o.media_owner,
      description: [l.section, l.description].filter(Boolean).join(" – "),
      start: l.start_date ?? (month ? `${month}-01` : null), end: l.end_date ?? l.start_date ?? (month ? lastDay(month) : null),
      approx: !l.start_date, month, superseded: superseded.has(o.po_number),
      cost, production: l.is_production, channel: channels[o.po_number] ?? null, status: o.status,
      tok: tokens(`${orderText} ${l.section ?? ""} ${l.description} ${Object.values(l.columns ?? {}).join(" ")}`),
    });
  }
}

// ITV Breakfast is airtime on ITV1 and is invoiced under ITV1 (the client's
// own plan lists it as 'ITV1 - including Breakfast').
for (const b of book) if (b.tok.has('breakfast') && [...b.tok].some((t) => t.startsWith('itv'))) b.tok.add('itv1');

// ------------------------------------------------------------- invoice lines
const inv = [];
for (const i of invoices) {
  i.lines.forEach((l, n) => {
    if (!(l.net > 0)) return; // "PO Number 227936" and other zero lines
    const ds = findDates(l.description).filter((d) => d.iso).map((d) => d.iso);
    inv.push({
      key: `${i.invoice_number}|${n + 1}`, invoice: i.invoice_number, customer: i.contact, invoice_date: i.invoice_date, description: l.description, net: l.net,
      first: ds[0] ?? null, last: ds.length > 1 ? ds.at(-1) : null, month: ds[0] ? ds[0].slice(0, 7) : monthIn(l.description, i.invoice_date),
      channel: channelIn(l.description), tok: tokens(l.description),
    });
  });
}

// ------------------------------------------------------- one-to-one matching
function score(a, b) {
  let date = 0;
  if (b.approx) {
    // The booking only names a month: it can agree on the month, never the day.
    if (!b.month) return null;
    const am = a.first ? a.first.slice(0, 7) : a.month;
    if (am) { if (am !== b.month) return null; date = 1; }
    else { const d = days(b.start, a.invoice_date); if (d < -45 || d > 62) return null; date = 0.5; }
  } else if (a.first && b.start) {
    if (a.first === b.start) date = a.last && b.end && a.last === b.end ? 4 : 3;
    else if (a.first >= b.start && a.first <= b.end) date = 1.5;
    else if (Math.abs(days(a.first, b.start)) > 45) return null;
  } else if (!a.first && a.month && b.start && b.start.slice(0, 7) === a.month) date = 1;
  else if (!a.first && !a.month && b.start) {
    // The invoice line names no date at all ("4. Sky DRTV £3cpt"). Bookings
    // are invoiced close to when they run, so allow a window around the
    // invoice date and prefer the nearest.
    const d = days(b.start, a.invoice_date);
    if (d < -45 || d > 62) return null;
    date = 0.5 + 0.4 * (1 - Math.abs(d) / 62);
  }
  const ratio = b.cost > 0 ? a.net / b.cost : null;
  const amount = Math.abs(a.net - b.cost) <= 0.5 ? 3 : ratio !== null && ratio >= 0.8 && ratio <= 1.6 ? 1 : 0;
  const text = Math.min(2, overlap(a.tok, b.tok));
  if (!date && !(text && amount === 3)) return null;
  if (!amount) return null;
  // A superseded revision can still be what was invoiced, but the live
  // revision is preferred when both fit equally.
  return { total: date + amount + text - (b.superseded ? 0.3 : 0), date, amount, text };
}
function assign(pairs, takenInv, takenBook, out, methodOf) {
  pairs.sort((x, y) => y.s.total - x.s.total || x.a.key.localeCompare(y.a.key));
  for (const p of pairs) {
    if (takenInv.has(p.a.key) || takenBook.has(p.b.key)) continue;
    const method = methodOf(p.s);
    if (!method) continue;
    takenInv.add(p.a.key); takenBook.add(p.b.key);
    out.push({ ...p, method });
  }
}
const exactOnly = (s) => (s.date >= 3 && s.amount === 3 ? "exact" : null);
// "words": the invoice line gives no exact start date, but the amount equals
// the supplier gross and the wording agrees, in the right month or window.
const exactOrDate = (s) => (s.date >= 3 && s.amount === 3 ? "exact" : s.date >= 3 && s.text >= 1 ? "date" : s.amount === 3 && s.text >= 1 && s.date >= 0.5 ? "words" : null);

// Pass 1: only matches that are beyond argument, across every client, to learn
// which invoiced customer is which client folder.
const pass1 = [];
{
  const pairs = [];
  for (const a of inv) for (const b of book) { const s = score(a, b); if (s && s.date >= 3 && s.amount === 3) pairs.push({ a, b, s }); }
  assign(pairs, new Set(), new Set(), pass1, exactOnly);
}
const learned = {};
for (const m of pass1) ((learned[m.a.customer] ??= {})[m.b.folder] ??= 0, learned[m.a.customer][m.b.folder]++);
// The customer → folder map is written once and then read back, so it can be
// corrected by hand. Folders are kept if they explain a fair share of the
// customer's certain matches.
const mapPath = path.join(outDir, "invoice-customers.json");
const seed = {};
for (const c of [...new Set(inv.map((a) => a.customer))].sort()) {
  const f = Object.entries(learned[c] ?? {}).sort((x, y) => y[1] - x[1]);
  const top = f[0]?.[1] ?? 0;
  seed[c] = f.filter(([, n]) => n >= Math.max(1, top * 0.2)).map(([name]) => name);
}
if (!fs.existsSync(mapPath)) fs.writeFileSync(mapPath, JSON.stringify(seed, null, 1));
const customerMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));
// What is known about customers that are not bookings at all (a commission, a
// lead-generation recharge), so the unmatched list explains itself.
const notesPath = path.join(outDir, "invoice-customers-notes.json");
const customerNotes = fs.existsSync(notesPath) ? JSON.parse(fs.readFileSync(notesPath, "utf8")) : {};
for (const [c, f] of Object.entries(seed)) if (!(c in customerMap)) customerMap[c] = f;

// Pass 2: within each customer's own folders, exact matches then same-date
// matches where the amount differs.
const matches = [];
const takenInv = new Set(), takenBook = new Set();
{
  const pairs = [];
  for (const a of inv) {
    const folders = new Set(customerMap[a.customer] ?? []);
    if (!folders.size) continue;
    for (const b of book) { if (!folders.has(b.folder)) continue; const s = score(a, b); if (s) pairs.push({ a, b, s }); }
  }
  assign(pairs, takenInv, takenBook, matches, exactOrDate);
}

// Pass 3: a customer billed at a steady rate off supplier gross. Media Addict,
// an agency, is invoiced at gross less 7.5% on every line and the lines carry
// no dates, so neither test above can see them. If three or more of a
// customer's invoice lines sit at the same ratio to a booking with matching
// words, that ratio is their rate, and lines at it are matched.
const rates = {};
{
  const byCustomer = new Map();
  for (const a of inv) {
    if (takenInv.has(a.key)) continue;
    const folders = new Set(customerMap[a.customer] ?? []);
    if (!folders.size) continue;
    for (const b of book) {
      if (!folders.has(b.folder) || takenBook.has(b.key) || !(b.cost > 0)) continue;
      const s = score(a, b);
      if (!s || s.text < 1) continue;
      const r = a.net / b.cost;
      if (Math.abs(r - 1) < 0.002) continue;
      byCustomer.set(a.customer, [...(byCustomer.get(a.customer) ?? []), { a, b, s, r }]);
    }
  }
  for (const [customer, pairs] of byCustomer) {
    const support = new Map();
    // Counted by distinct amounts: three lines of 92,500 against three 60,000
    // bookings share a ratio by accident, not because it is anyone's rate.
    for (const p of pairs) { const k = p.r.toFixed(3); support.set(k, (support.get(k) ?? new Set()).add(p.a.net)); }
    // A customer has one rate, perhaps two. A ratio with far less support than
    // the commonest one is a coincidence of round numbers, not a rate.
    const top = Math.max(...[...support.values()].map((set) => set.size));
    const good = [...support].filter(([, set]) => set.size >= Math.max(3, top * 0.5)).map(([k]) => Number(k));
    if (!good.length) continue;
    rates[customer] = good;
    const picked = pairs.filter((p) => good.some((g) => Math.abs(p.r - g) <= 0.0006));
    picked.sort((x, y) => y.s.total - x.s.total || x.a.key.localeCompare(y.a.key));
    for (const p of picked) {
      if (takenInv.has(p.a.key) || takenBook.has(p.b.key)) continue;
      takenInv.add(p.a.key); takenBook.add(p.b.key);
      matches.push({ a: p.a, b: p.b, s: p.s, method: 'rate', ratio: p.r });
    }
  }
}

// Pass 4: one invoice line for a month of something ('TV February 460,000').
// Revised copies are left out (only the last revision counts), and bookings
// dated only by month are included. The month is the one the line names; if
// that does not tie, the month the invoice itself falls in is tried, because
// a line is sometimes labelled with the wrong month.
const groups = [];
const prevMonth = (ym) => { const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 2, 1)); return d.toISOString().slice(0, 7); };
const pending = inv.filter((a) => !takenInv.has(a.key) && (customerMap[a.customer] ?? []).length)
  .sort((x, y) => Number(y.channel === 'VOD') - Number(x.channel === 'VOD') || y.net - x.net);
for (const a of pending) {
  const folders = new Set(customerMap[a.customer] ?? []);
  const own = a.invoice_date.slice(0, 7);
  // Tried in order: the month the line names, the invoice's own month (work
  // billed in advance or at month end), the month before (billed on the 1st in
  // arrears), and the month after (billed late in the month ahead).
  const nextMonth = (ym) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 1)).toISOString().slice(0, 7);
  const months = [...new Set([a.month, own, prevMonth(own), nextMonth(own)].filter(Boolean))];
  const fits = (b) => a.channel === 'VOD' ? VOD_WORDS.some((w) => b.tok.has(w)) : a.channel ? b.channel === a.channel : overlap(a.tok, b.tok) >= 1;
  let best = null;
  for (const month of months) {
    const inMonth = (b) => b.start && (a.first && a.last && month === a.month ? b.start >= a.first && b.start <= a.last : b.month === month);
    const cands = book.filter((b) => folders.has(b.folder) && !b.superseded && !takenBook.has(b.key) && b.cost > 0 && inMonth(b) && fits(b));
    const sum = cands.reduce((t, b) => t + b.cost, 0);
    if (!cands.length) continue;
    const ratio = a.net / sum;
    const rate = (rates[a.customer] ?? []).find((g) => Math.abs(ratio - g) <= 0.005);
    const off = rate ? 0 : Math.abs(ratio - 1);
    if (!best || off < best.off) best = { month, cands, sum, ratio, rate, off };
    if (off <= 0.02) break;
  }
  if (!best) continue;
  if (best.ratio < 0.8 || best.ratio > 1.6) { groups.push({ a, sum: best.sum, ratio: best.ratio, applied: false }); continue; }
  takenInv.add(a.key);
  let left = a.net;
  best.cands.forEach((b, i) => {
    const share = i === best.cands.length - 1 ? +left.toFixed(2) : +(b.cost * best.ratio).toFixed(2);
    left -= share;
    takenBook.add(b.key);
    // Within 2% (or at the customer's known rate) the invoice plainly is those
    // bookings added up. Further out the share-out is an estimate.
    matches.push({ a, b, s: { total: 0 }, method: best.off <= 0.02 ? 'group' : 'group-estimate', share, ratio: best.ratio,
      note: best.month !== a.month && a.month ? 'labelled ' + a.month + ', ties to ' + best.month + ' bookings' : undefined });
  });
  groups.push({ a, sum: best.sum, ratio: best.ratio, applied: true });
}

// -------------------------------------------------------------------- output
const charges = {};
for (const m of matches) {
  charges[m.b.key] = {
    charge: m.share !== undefined ? m.share : m.a.net, method: m.method, invoice: m.a.invoice, customer: m.a.customer,
    invoice_line: m.a.description, ...(m.ratio !== undefined ? { ratio: +m.ratio.toFixed(4) } : {}),
    ...(m.note ? { note: m.note } : {}),
  };
}
fs.writeFileSync(path.join(outDir, "charges.json"), JSON.stringify(charges, null, 1));

const cell = (v) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (cols, data) => "﻿" + [cols.join(","), ...data.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
fs.writeFileSync(path.join(outDir, "charge-matches.csv"), csv(
  ["client_folder", "po", "line_no", "booking", "start", "end", "supplier_cost", "client_charge", "margin_pct", "how", "invoice", "invoice_line", "invoice_customer"],
  matches.map((m) => { const c = charges[m.b.key].charge; return { client_folder: m.b.folder, po: m.b.po, line_no: m.b.line_no, booking: `${m.b.supplier}: ${m.b.description}`, start: m.b.start, end: m.b.end, supplier_cost: m.b.cost, client_charge: c, margin_pct: m.b.cost > 0 ? +(((c - m.b.cost) / m.b.cost) * 100).toFixed(1) : "", how: m.method, invoice: m.a.invoice, invoice_line: m.a.description, invoice_customer: m.a.customer }; })
    .sort((x, y) => String(x.client_folder).localeCompare(String(y.client_folder)) || x.po.localeCompare(y.po) || x.line_no - y.line_no)));
fs.writeFileSync(path.join(outDir, "invoice-lines-unmatched.csv"), csv(
  ["customer", "invoice", "invoice_date", "description", "net", "note"],
  inv.filter((a) => !takenInv.has(a.key)).map((a) => {
    const g = groups.find((x) => x.a === a && !x.applied);
    return { customer: a.customer, invoice: a.invoice, invoice_date: a.invoice_date, description: a.description, net: a.net,
      note: !(customerMap[a.customer] ?? []).length ? (customerNotes[a.customer] ?? "customer not linked to a client folder") : g ? `bookings found for that month add to ${g.sum.toFixed(2)} (${(g.ratio * 100).toFixed(0)}% of them) – too far apart to share out` : "no booking line matches" };
  }).sort((x, y) => x.customer.localeCompare(y.customer) || x.invoice.localeCompare(y.invoice))));

const byCustomer = {};
for (const a of inv) { const c = (byCustomer[a.customer] ??= { invoiced: 0, matched: 0, lines: 0, matched_lines: 0 }); c.invoiced += a.net; c.lines++; if (takenInv.has(a.key)) { c.matched += a.net; c.matched_lines++; } }
const inPeriodBook = book.length;
const summary = {
  invoice_lines: inv.length, invoiced_net: +inv.reduce((t, a) => t + a.net, 0).toFixed(2),
  invoice_lines_matched: inv.filter((a) => takenInv.has(a.key)).length, invoiced_net_matched: +inv.filter((a) => takenInv.has(a.key)).reduce((t, a) => t + a.net, 0).toFixed(2),
  booking_lines_in_period: inPeriodBook, booking_lines_with_a_charge: Object.keys(charges).length,
  by_method: matches.reduce((t, m) => ((t[m.method] = (t[m.method] ?? 0) + 1), t), {}),
  customers_linked: Object.fromEntries(Object.entries(customerMap).filter(([, f]) => f.length)),
  customers_not_linked: Object.entries(customerMap).filter(([, f]) => !f.length).map(([c]) => c),
  by_customer: Object.fromEntries(Object.entries(byCustomer).sort((x, y) => y[1].invoiced - x[1].invoiced).map(([c, v]) => [c, `${v.matched_lines}/${v.lines} lines, £${Math.round(v.matched).toLocaleString("en-GB")} of £${Math.round(v.invoiced).toLocaleString("en-GB")}`])),
};
fs.writeFileSync(path.join(outDir, "charge-summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
