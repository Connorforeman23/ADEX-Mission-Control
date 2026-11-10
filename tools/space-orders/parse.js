// Step 2 of the Space Order import: turn each order's document XML into a
// structured record, and say plainly what could not be read with confidence.
//
//   node parse.js "<xml dir from extract.js>" "<output dir>"
//
// Rules this parser holds to:
//   * The FILE NAME is the PO number. The "Order Number" printed inside is
//     often a stale copy from the order the file was cloned from, so it is
//     recorded and compared, never trusted.
//   * Nothing is guessed. A value that is missing, struck through, impossible
//     or ambiguous is left null (or kept as printed) and listed under `checks`.
//   * Columns are read by their header ("Gross Cost", "Net Cost", …), not by
//     position, because layouts differ between TV, press and outdoor orders.
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------- XML helpers

// Top-level occurrences of <name>…</name>, balanced, so nested tables and text
// boxes stay inside their parent. `name` must not match longer tags
// (w:tbl vs w:tblPr), hence the lookahead.
function elements(xml, name) {
  const re = new RegExp(`<(/?)${name}(?=[\\s>/])[^>]*?(/?)>`, "g");
  const out = [];
  let depth = 0, innerStart = 0, outerStart = 0, m;
  while ((m = re.exec(xml))) {
    if (!m[1] && m[2] === "/") continue; // self-closing: empty
    if (!m[1]) {
      if (depth === 0) { outerStart = m.index; innerStart = re.lastIndex; }
      depth++;
    } else if (depth > 0) {
      depth--;
      if (depth === 0) out.push({ start: outerStart, end: re.lastIndex, inner: xml.slice(innerStart, m.index) });
    }
  }
  return out;
}

const decode = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

const isOn = (rPr, tag) => {
  const m = rPr.match(new RegExp(`<w:${tag}(?:\\s+w:val="([^"]*)")?\\s*/>`));
  return !!m && !["0", "false", "off"].includes(m[1] ?? "1");
};

// Text of one paragraph. Struck-through runs are dropped (that is how a
// revised figure is usually marked) and reported back so they can be flagged.
function paragraphText(p, struck) {
  let out = "";
  for (const run of elements(p, "w:r")) {
    const rPr = (run.inner.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) ?? [""])[0];
    let t = "";
    const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab(?:\s[^>]*)?\/>|<w:br(?:\s[^>]*)?\/>|<w:cr\/>|<w:noBreakHyphen\/>/g;
    let m;
    while ((m = re.exec(run.inner))) {
      if (m[1] !== undefined) t += decode(m[1]);
      else if (m[0].startsWith("<w:tab")) t += " ";
      else if (m[0].startsWith("<w:noBreak")) t += "-";
      else t += "\n";
    }
    if (isOn(rPr, "strike") || isOn(rPr, "dstrike")) { if (t.trim()) struck.push(t.trim()); continue; }
    out += t;
  }
  return out;
}

const squash = (s) => String(s ?? "").replace(/[ \s]+/g, " ").trim();

function cellText(tc, struck) {
  return elements(tc, "w:p").map((p) => paragraphText(p.inner, struck).replace(/[  \t]+/g, " ").trim()).join("\n").trim();
}

// Whole document → tables (rows of cells with column positions) + loose text.
function readDocument(xmlRaw) {
  // Word stores a fallback copy of drawings/text boxes; keep one copy only.
  const xml = xmlRaw.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, "");
  const struck = [];
  const tbls = elements(xml, "w:tbl");
  const tables = tbls.map((t) =>
    elements(t.inner, "w:tr").map((tr) => {
      let col = 0;
      return elements(tr.inner, "w:tc").map((tc) => {
        const span = Number((tc.inner.match(/<w:gridSpan w:val="(\d+)"/) ?? [])[1] ?? 1);
        const cell = { text: cellText(tc.inner, struck), col, span };
        col += span;
        return cell;
      });
    }).filter((r) => r.length)
  );
  let outside = "", at = 0;
  for (const t of tbls) { outside += xml.slice(at, t.start); at = t.end; }
  outside += xml.slice(at);
  const loose = elements(outside, "w:p").map((p) => squash(paragraphText(p.inner, struck))).filter(Boolean);
  return { tables, loose, struck };
}

// --------------------------------------------------------------- value parsing

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function makeDate(d, mo, y, raw) {
  const typo = String(mo).length > 2; // "10/010/2026"
  const made = makeDateInner(d, mo, y, raw);
  return typo && made.iso ? { ...made, typo: true } : made;
}
function makeDateInner(d, mo, y, raw) {
  d = Number(d); mo = Number(mo);
  let year = Number(y);
  if (String(y).length === 2) year += 2000;
  if (String(y).length === 3 || year < 2000 || year > 2100) return { iso: null, raw, invalid: true };
  const dt = new Date(Date.UTC(year, mo - 1, d));
  const ok = dt.getUTCFullYear() === year && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  return ok
    ? { iso: `${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`, raw, weekday: dt.getUTCDay() }
    : { iso: null, raw, invalid: true };
}

// Every date written in a piece of text, in order. Impossible dates
// (31.09.26) come back with iso null so the caller can flag them.
function findDates(text) {
  let s = String(text ?? "");
  for (let i = 0; i < 2; i++) s = s.replace(/(\d)\s*([./])\s*(\d)/g, "$1$2$3"); // "0 1 . 11 .26"
  s = s.replace(/([./])\1+/g, "$1"); // "01.06..26"
  // "14.09-30.09 2026": a range that shares one year
  s = s.replace(/(?<![\d.\/])(\d{1,2})[.\/](\d{1,2})\s*[-–]\s*(\d{1,2})[.\/](\d{1,2})[.\/\s]\s*(\d{4}|\d{2})(?!\d)/g, "$1.$2.$5 - $3.$4.$5");
  // "5–25 October 2026": a range that shares one month and year
  s = s.replace(new RegExp(`(?<!\\d)(\\d{1,2})(?:st|nd|rd|th)?\\s*[-–]\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+((?:${MONTHS.join("|")})[a-z]*)\\.?,?\\s+(\\d{4}|\\d{2})(?!\\d)`, "gi"), "$1 $3 $4 - $2 $3 $4");
  const found = [];
  const numeric =/(?<![\d.\/])(\d{1,2})[.\/](\d{1,3})[.\/](\d{2,4})(?![\d.\/])/g;
  let m;
  while ((m = numeric.exec(s))) found.push({ at: m.index, ...makeDate(m[1], m[2], m[3], m[0]) });
  const worded = new RegExp(`(?<!\\d)(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join("|")})[a-z]*\\.?,?\\s+(\\d{2,4})(?!\\d)`, "gi");
  while ((m = worded.exec(s))) found.push({ at: m.index, ...makeDate(m[1], MONTHS.indexOf(m[2].toLowerCase()) + 1, m[3], m[0]) });
  return found.sort((a, b) => a.at - b.at);
}

const weekdayIn = (text) => {
  const m = String(text ?? "").toLowerCase().match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/g);
  return m && m.length === 1 ? WEEKDAYS.indexOf(m[0].slice(0, 3)) : null;
};

// Amounts in a money cell. Returns { values, foc, odd } — `odd` lists anything
// that looks mistyped, such as "4.250" for 4,250.
function findMoney(text) {
  const s = String(text ?? "");
  const out = { values: [], foc: /free\s*of\s*charge|\bfoc\b|\bn\/c\b|no charge/i.test(s), odd: [], currency: /€|eur/i.test(s) ? "EUR" : /£|gbp/i.test(s) ? "GBP" : null };
  const re = /(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?![\d,])/g;
  let cleaned = s.replace(/(\d)\s+(?=[,.]\s*\d)/g, "$1").replace(/([,.])\s+(?=\d)/g, "$1").replace(/([£€])\s+/g, "$1");
  // Thousands typed with a full stop — "34.000.00", "4.250". Money never has
  // three decimals, so this is read as thousands and always flagged.
  cleaned = cleaned.replace(/(?<![\d.,])(\d{1,3})\.(\d{3})(?:\.(\d{2}))?(?![\d,.])/g, (all, a, b, c) => {
    const fixed = `${a}${b}${c ? "." + c : ""}`;
    out.odd.push(`typed as '${all}' – read as ${fixed}`);
    return fixed;
  });
  let m;
  while ((m = re.exec(cleaned))) {
    if (m[2] && m[2].length > 3) out.odd.push(`'${m[0]}' has an unusual number of decimals`);
    out.values.push(Number((m[1] + (m[2] ?? "")).replace(/,/g, "")));
  }
  return out;
}

// ------------------------------------------------------------------ the order

const ROLE = (label) => {
  const l = label.toLowerCase();
  if (/gross/.test(l)) return "gross";
  if (/inc|incl|vat/.test(l)) return "inc_vat";
  if (/\bnet\b/.test(l)) return "net";
  if (/start/.test(l) || /^from$/.test(l)) return "start";
  if (/\bend\b/.test(l) || /^to$/.test(l)) return "end";
  if (/date|^month$|^when$/.test(l)) return "date";
  return "desc";
};
const isHeaderRow = (row) => {
  const t = row.map((c) => c.text.toLowerCase());
  return t.some((x) => /gross/.test(x) && x.length < 40) && t.some((x) => /\bnet\b|vat/.test(x) && x.length < 40);
};

function guessMedium(text) {
  const t = text.toLowerCase();
  if (/\bvod\b|itvx|prime video|streaming|adsmart|\bbvod\b|\bctv\b/.test(t)) return "vod";
  if (/\bradio\b|\bdab\b|\bheart\b|\blbc\b|talksport|boom|\bspots?\b.*station|station/.test(t)) return "radio";
  if (/sheets?\b|\bd6\b|panel|billboard|\btower\b|\btcp|outdoor|\booh\b|streethub|bus (rear|side)|6 ?sheet|48 ?sheet/.test(t)) return "ooh";
  if (/\bitv\d?\b|\bsky\b|channel 4|\bc4\b|uktv|drtv|\btv\b|linear|talking pictures|copy length/.test(t)) return "tv";
  if (/publication|insertion|full page|classified|\bpage\b|supplement|magazine|\bmetro\b|telegraph|times|\bmail\b|\bsun\b|\bftwm\b|colour|\d+\s?x\s?\d+/.test(t)) return "press";
  if (/email|newsletter|impressions|programmatic|display|social|partnership|online|leads?\b/.test(t)) return "digital";
  return "other";
}

function parseOrder(entry, xml) {
  const { tables, loose, struck } = readDocument(xml);
  const checks = [], info = [];
  // Line-level findings are grouped, so a 100-line order with the same typo on
  // every flight reads as one finding, not fifty.
  const perLine = { checks: new Map(), info: new Map() };
  const lineNote = (kind, n, msg) => perLine[kind].set(msg, [...(perLine[kind].get(msg) ?? []), n]);
  const ranges = (ns) => {
    const out = [];
    for (let i = 0; i < ns.length; i++) {
      let j = i;
      while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
      out.push(j > i ? `${ns[i]}–${ns[j]}` : `${ns[i]}`);
      i = j;
    }
    return out.join(", ");
  };
  const flush = (kind, target) => {
    for (const [msg, ns] of perLine[kind]) {
      const where = ns.length > 12 ? `${ns.length} lines (from line ${ns[0]})` : `line${ns.length > 1 ? "s" : ""} ${ranges(ns)}`;
      target.push(`${where}: ${msg}`);
    }
  };
  const allText = [...tables.flatMap((t) => t.flatMap((r) => r.map((c) => c.text))), ...loose].join("\n");

  // --- PO number from the file name
  const base = entry.name.replace(/\.docx$/i, "");
  const copyMark = (base.match(/\s*\((\d+)\)\s*$/) ?? [])[0] ?? null;
  const poNumber = base.replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, "").toUpperCase();
  // Prefix is letters, occasionally with a digit (S4G0005), ending in a letter.
  const pm = poNumber.match(/^([A-Z0-9]{1,3}[A-Z])0*(\d+)(.*)$/);
  const clientCode = pm ? pm[1] : null;
  const poSeq = pm ? Number(pm[2]) : null;
  const poSuffix = pm ? pm[3] : "";
  if (copyMark) checks.push(`file name ends "${copyMark.trim()}" – a second file for PO ${poNumber}`);
  if (pm && !/^[A-Z0-9]{1,3}[A-Z]\d{4}[A-Z0-9]*$/.test(poNumber)) info.push(`PO number '${poNumber}' is not the usual three letters + four digits`);

  // --- header block: Company / To / From / Date
  const grab = (re) => { const m = allText.match(re); return m ? squash(m[1]) || null : null; };
  const mediaOwner = grab(/Company\s*:\s*([\s\S]*?)\s*(?=\bTo\s*:)/i);
  const toContact = grab(/\bTo\s*:\s*([\s\S]*?)\s*(?=\bFrom\s*:)/i);
  const fromStaff = grab(/\bFrom\s*:\s*([\s\S]*?)\s*(?=\bDate\s*:)/i);
  const dateRaw = grab(/\bDate\s*:\s*([^\n]*?)\s*(?=Email\s*:|\n|$)/i);
  let orderDate = null;
  if (!dateRaw) checks.push("no order date");
  else {
    const d = findDates(dateRaw)[0];
    if (d?.iso) { orderDate = d.iso; if (d.typo) checks.push(`order date typed as '${dateRaw}' – read as ${d.iso}`); }
    else checks.push(`order date not readable: '${dateRaw}'`);
  }
  if (!mediaOwner) checks.push("no media owner (Company:)");
  if (!/space\s*order/i.test(allText)) checks.push("document does not say 'Space Order'");

  // --- tables: detail fields, booking lines, notes
  const fields = {};
  const lines = [];
  const printedTotals = [];
  const notes = [];
  let currencySeen = new Set();
  let lastCols = null; // header of the most recent lines table
  const schedule = [];

  for (const table of tables) {
    let cols = null; // header of the lines table, once seen
    const headerRow = table.find(isHeaderRow);
    let hasHeader = !!headerRow;

    // A month-by-month invoicing schedule repeats the money already on the
    // booking lines. Keep it, but never add it to them.
    if (headerRow && lines.length && /^month$/i.test(squash(headerRow[0].text)) && /invoic/i.test(allText)) {
      schedule.push(table.map((r) => r.map((c) => squash(c.text))));
      info.push(`invoicing schedule table (${table.length - 1} rows) kept apart from the booking lines`);
      continue;
    }
    // Word sometimes splits one table in two; the second half has no header
    // row but the same columns and carries on with more costed rows.
    if (!hasHeader && lastCols) {
      const filled = table.filter((r) => r.some((c) => squash(c.text)));
      if (filled.length && filled.every((r) => r.length === lastCols.length) && filled.some((r) => r.some((c) => /[£€]\s*\d/.test(c.text)))) {
        cols = lastCols;
        hasHeader = true;
      }
    }

    let section = null;        // heading row above a group of lines ("4 Sheets - GD — 30 panels")
    let mark = lines.length;   // first line of the current group, for sub-totals
    for (const [rowIndex, row] of table.entries()) {
      const texts = row.map((c) => squash(c.text));
      if (!texts.some(Boolean)) continue;

      if (isHeaderRow(row)) {
        cols = row.map((c) => ({ col: c.col, label: squash(c.text), role: ROLE(squash(c.text)) }));
        lastCols = cols;
        continue;
      }

      if (!hasHeader) {
        // Detail table: "Client | Randox", "Agency Commission | 15%".
        if (row.length === 2 && texts[0] && texts[0].length <= 40) {
          const label = texts[0].replace(/\s*:\s*$/, "");
          if (/^order notes?$/i.test(label)) { if (texts[1]) notes.push(texts[1]); }
          else if (!/^space\s*order$/i.test(label)) fields[label] = texts[1];
        } else if (row.length >= 2 && row.length % 2 === 0 && texts.every((t) => t.length <= 60) && !/company\s*:/i.test(texts.join(" "))) {
          for (let i = 0; i < row.length; i += 2) if (texts[i]) fields[texts[i].replace(/\s*:\s*$/, "")] = texts[i + 1];
        } else if (!/company\s*:/i.test(texts.join(" "))) {
          const t = texts.filter(Boolean).join(" ").replace(/^order notes?\s*:?\s*/i, "");
          if (t && !/^space\s*order$/i.test(t)) notes.push(t);
        }
        continue;
      }
      if (!cols) { // rows above the header inside a lines table
        const t = texts.filter(Boolean).join(" ");
        if (t) notes.push(t);
        continue;
      }

      // Match each cell to a header column: by position when the row has the
      // same shape as the header, otherwise by where the cell starts.
      const sameShape = row.length === cols.length;
      const line = { desc: [], columns: {}, dateCells: [], money: { gross: null, net: null, inc_vat: null } };
      row.forEach((c, i) => {
        const text = squash(c.text);
        if (!text) return;
        const h = sameShape ? cols[i] : [...cols].reverse().find((k) => k.col <= c.col) ?? cols[0];
        if (h.role === "desc") { line.desc.push(text); line.columns[h.label || `col${i}`] = text; }
        else if (h.role === "gross" || h.role === "net" || h.role === "inc_vat") line.money[h.role] = { text, ...findMoney(text) };
        else line.dateCells.push({ role: h.role, text });
      });

      const description = line.desc.join(", ");
      // "FREE | OF | CHARGE" is often typed one word per cost column.
      const moneyWords = ["gross", "net", "inc_vat"].map((k) => line.money[k]?.text ?? "").join(" ");
      if (/free\s*of\s*charge|\bfoc\b/i.test(moneyWords) && !/\d/.test(moneyWords)) {
        for (const k of ["gross", "net", "inc_vat"]) if (line.money[k]) line.money[k] = { ...line.money[k], foc: true, values: [] };
      }
      const moneyCells = Object.values(line.money).filter(Boolean);
      const hasMoney = moneyCells.some((m) => m.values.length || m.foc);
      const cellDates = line.dateCells.flatMap((d) => findDates(d.text).map((x) => ({ ...x, role: d.role, cell: d.text })));
      const descDates = findDates(description);

      if (/^\s*(sub[\s-]?)?total\b/i.test(description) || (/total/i.test(description) && !cellDates.length && !descDates.length && description.length < 40)) {
        const kind = /sub[\s-]?total/i.test(description) ? "group" : /media/i.test(description) ? "media" : /production/i.test(description) ? "production" : "all";
        printedTotals.push({ label: description, kind, from: mark, to: lines.length, gross: line.money.gross?.values.at(-1) ?? null, net: line.money.net?.values.at(-1) ?? null, inc_vat: line.money.inc_vat?.values.at(-1) ?? null });
        if (kind === "group") { mark = lines.length; section = null; }
        continue;
      }
      if (!hasMoney && !cellDates.length && !descDates.length && (!description || !line.dateCells.length)) {
        const onlyCell = texts.filter(Boolean).length === 1;
        const moreCostsBelow = table.slice(rowIndex + 1).some((r) => r.some((c) => /[£€]\s*\d/.test(c.text)));
        if (description && onlyCell && description.length <= 160 && moreCostsBelow) {
          // A heading for the lines that follow.
          section = description;
          mark = lines.length;
        } else {
          // A remark sitting in the table ("Dates Inclusive"), not a booking.
          const remark = description || line.dateCells.map((d) => d.text).join(" ");
          if (remark) notes.push(remark);
        }
        continue;
      }
      if (/^per\b/i.test(description) && !cellDates.length && !descDates.length) {
        // "Per print run: … £4,926" states a rate; the bookings follow it.
        notes.push(`${description} ${Object.values(line.money).filter(Boolean).map((m) => m.text).join(" / ")}`.trim());
        info.push(`rate row not counted as a booking: '${description.slice(0, 60)}'`);
        continue;
      }

      const n = lines.length + 1;
      const out = {
        line_no: n, section: section ? section.split(/\s+[—|]\s+/)[0].trim() : null, description, columns: line.columns, start_date: null, end_date: null, date_text: null,
        gross: null, net: null, inc_vat: null, is_production: /production|print run|\bprod\b/i.test(`${description} ${section ?? ""}`), free_of_charge: false,
      };

      // money
      for (const k of ["gross", "net", "inc_vat"]) {
        const m = line.money[k];
        if (!m) continue;
        if (m.currency) currencySeen.add(m.currency);
        if (m.foc && !m.values.length) { out[k] = 0; out.free_of_charge = true; continue; }
        if (!m.values.length) {
          if (!/^([-–—]+|n\/?a\.?)$/i.test(m.text)) { lineNote("checks", n, `${k.replace("_", " ")} cell not a number: '${m.text}'`); if (k === "gross") out.gross_text = m.text; }
          continue;
        }
        out[k] = m.values.at(-1);
        if (m.values.length > 1) lineNote("checks", n, `${k.replace("_", " ")} cell holds ${m.values.length} amounts ('${m.text}') – used the last`);
        m.odd.forEach((o) => lineNote("checks", n, `${k.replace("_", " ")} ${o}`));
      }

      // dates
      const dates = cellDates.length ? cellDates : descDates.map((d) => ({ ...d, role: "desc", cell: description }));
      dates.filter((d) => d.invalid).forEach((d) => lineNote("checks", n, `impossible date '${d.raw}'`));
      dates.filter((d) => d.typo).forEach((d) => lineNote("checks", n, `date typed as '${d.raw}' – read as ${d.iso}`));
      const start = dates.find((d) => d.role === "start") ?? dates.find((d) => d.role !== "end");
      const end = dates.find((d) => d.role === "end") ?? (dates.filter((d) => d.role !== "start").length > 1 ? dates.filter((d) => d.role !== "start").at(-1) : null);
      out.start_date = start?.iso ?? null;
      out.end_date = end && end !== start ? end.iso ?? null : null;
      if (!out.start_date) {
        out.date_text = line.dateCells.map((d) => d.text).filter(Boolean).join(" – ") || null;
        if (!out.is_production) lineNote("checks", n, out.date_text ? `no full date, only '${out.date_text}'` : "no date");
      }
      if (out.start_date && out.end_date && out.end_date < out.start_date) lineNote("checks", n, `end ${end.raw} is before start ${start.raw}`);
      // A booking that starts months before its own order is usually a year typo.
      if (out.start_date && orderDate && (Date.parse(orderDate) - Date.parse(out.start_date)) / 864e5 > 60) lineNote("checks", n, `starts ${start.raw}, more than two months before the order date ${orderDate}`);
      for (const d of dates.filter((x) => x.iso)) {
        const wd = weekdayIn(d.role === "desc" ? "" : d.cell);
        if (wd !== null && findDates(d.cell).length === 1 && wd !== d.weekday) lineNote("checks", n, `${d.raw} is not a ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][wd]}`);
        if (orderDate) {
          const oy = Number(orderDate.slice(0, 4)), y = Number(d.iso.slice(0, 4));
          if (y < oy - 1 || y > oy + 2) lineNote("checks", n, `year in ${d.raw} looks wrong for an order dated ${orderDate}`);
        }
      }
      if (out.gross === null && out.net === null && out.inc_vat === null) lineNote("checks", n, "no cost");
      lines.push(out);
    }
  }

  // --- detail fields we rely on
  const field = (re) => { const k = Object.keys(fields).find((x) => re.test(x)); return k ? fields[k] || null : null; };

  // --- costs written in the notes when the costs table was left empty
  if (!lines.length) {
    const found = {};
    for (const raw of allText.split("\n")) {
      const t = squash(raw);
      let m;
      if ((m = t.match(/^(?:net\s+(?:cost|spend)\s*\+\s*vat|(?:net\s+)?cost\s+inc\.?\s*vat|inc\.?\s*vat)\s*:\s*(.+)$/i))) found.inc_vat ??= m[1];
      else if ((m = t.match(/^net\s+(?:cost|spend)\s*:\s*(.+)$/i))) found.net ??= m[1];
      else if ((m = t.match(/^(?:total\s+)?(?:gross\s+)?(?:cost|spend)\s*:\s*(.+)$/i))) found.gross ??= m[1];
      else if ((m = t.match(/^(?:dates?|campaign\s+period)\s*:\s*(.+)$/i))) found.dates ??= m[1];
    }
    if (found.gross || found.net) {
      const out = { line_no: 1, description: field(/campaign|channels?|title|details/i) ?? mediaOwner ?? "", columns: {}, start_date: null, end_date: null, date_text: null, gross: null, net: null, inc_vat: null, is_production: false, free_of_charge: false, from_notes: true };
      for (const k of ["gross", "net", "inc_vat"]) {
        if (!found[k]) continue;
        const m = findMoney(found[k]);
        if (m.currency) currencySeen.add(m.currency);
        if (m.values.length) out[k] = m.values.at(-1);
        else { lineNote("checks", 1, `${k.replace("_", " ")} in the notes is not a number: '${found[k]}'`); if (k === "gross") out.gross_text = found[k]; }
        m.odd.forEach((o) => lineNote("checks", 1, `${k.replace("_", " ")} ${o}`));
      }
      const ds = found.dates ? findDates(found.dates).filter((d) => d.iso) : [];
      out.start_date = ds[0]?.iso ?? null;
      out.end_date = ds.length > 1 ? ds.at(-1).iso : null;
      if (!out.start_date) { out.date_text = found.dates ?? null; lineNote("checks", 1, out.date_text ? `no full date, only '${out.date_text}'` : "no date"); }
      lines.push(out);
      checks.push("costs taken from the order notes – the costs table is empty");
    }
  }
  const docNumber = (field(/^order\s*(number|no)/i) ?? "").replace(/\s+/g, "").toUpperCase() || null;
  const clientInDoc = field(/^client$/i);
  const commRaw = field(/commission/i);
  const commission = commRaw && /\d/.test(commRaw) ? Number(commRaw.match(/(\d+(?:\.\d+)?)/)[1]) : null;
  if (commission === null) checks.push(commRaw ? `agency commission not readable: '${commRaw}'` : "no agency commission stated");
  if (!docNumber) info.push("no order number printed inside");
  else if (docNumber !== poNumber) info.push(`order number printed inside is ${docNumber}`);

  // --- money checks
  const currency = currencySeen.has("EUR") ? (currencySeen.has("GBP") ? "mixed" : "EUR") : "GBP";
  if (currency !== "GBP") info.push(`amounts in ${currency}`);
  for (const l of lines) {
    if (commission !== null && l.gross > 0 && l.net !== null && !l.is_production) {
      const want = +(l.gross * (1 - commission / 100)).toFixed(2);
      if (Math.abs(want - l.net) > 1) lineNote("checks", l.line_no, `net ${l.net} is not gross ${l.gross} less ${commission}% (${want})`);
    }
    if (currency === "GBP" && l.net > 0 && l.inc_vat !== null && Math.abs(l.net * 1.2 - l.inc_vat) > 1) lineNote("checks", l.line_no, `inc VAT ${l.inc_vat} is not net ${l.net} + 20% (${+(l.net * 1.2).toFixed(2)})`);
    if (l.gross === null && l.gross_text && l.net > 0 && commission !== null && commission < 100) lineNote("checks", l.line_no, `gross unreadable; net ${l.net} at ${commission}% commission implies ${+(l.net / (1 - commission / 100)).toFixed(2)}`);
    if (l.is_production && l.gross === null && l.net !== null) lineNote("info", l.line_no, "production row has no gross figure");
    if (l.free_of_charge) lineNote("info", l.line_no, "free of charge");
    else if (l.gross === 0 || (l.gross === null && l.net === 0)) lineNote("info", l.line_no, "zero value");
  }
  flush("checks", checks);
  flush("info", info);

  // Some orders print campaign totals in the detail block above the lines.
  const amountIn = (v) => (v ? findMoney(v).values[0] ?? null : null);
  const mediaGross = lines.filter((l) => !l.is_production && l.gross !== null).reduce((a, l) => a + l.gross, 0);
  const prodNet = lines.filter((l) => l.is_production).reduce((a, l) => a + (l.net ?? l.gross ?? 0), 0);
  const statedCampaign = amountIn(field(/total\s+campaign\s+cost/i));
  const statedProduction = amountIn(field(/total\s+production/i));
  if (statedCampaign !== null && Math.abs(statedCampaign - mediaGross) > 1) checks.push(`'Total Campaign Cost' prints ${statedCampaign} but the media lines add to ${+mediaGross.toFixed(2)}`);
  if (statedProduction !== null && Math.abs(statedProduction - prodNet) > 1) checks.push(`'Total Production Cost' prints ${statedProduction} but the production lines add to ${+prodNet.toFixed(2)}`);
  const sum = (k) => { const v = lines.filter((l) => l[k] !== null); return v.length ? +v.reduce((a, l) => a + l[k], 0).toFixed(2) : null; };
  const totals = { gross: sum("gross"), net: sum("net"), inc_vat: sum("inc_vat") };
  // A printed total is checked against the lines it covers: its own group for
  // a sub-total, media or production lines for those totals, else every line.
  for (const t of printedTotals) {
    const subset = t.kind === "group" ? lines.slice(t.from, t.to) : t.kind === "media" ? lines.filter((l) => !l.is_production) : t.kind === "production" ? lines.filter((l) => l.is_production) : lines;
    const off = [];
    for (const k of ["gross", "net", "inc_vat"]) {
      const have = subset.filter((l) => l[k] !== null);
      if (t[k] === null || !have.length) continue;
      const s = +have.reduce((a, l) => a + l[k], 0).toFixed(2);
      if (Math.abs(t[k] - s) > 1) off.push(`${k.replace("_", " ")} ${t[k]} vs ${s}`);
    }
    if (off.length) checks.push(`printed '${t.label || "total"}' does not match its lines: ${off.join("; ")}`);
  }
  if (!lines.length) checks.push(struck.length ? "no booking lines – everything in the costs table is struck through" : "no booking lines found");
  if (/cancel+ed|cancellation/i.test(allText)) checks.push("document mentions a cancellation");
  if (struck.length) info.push(`struck-through text ignored: ${struck.slice(0, 6).map((s) => `'${s}'`).join(", ")}${struck.length > 6 ? ` (+${struck.length - 6} more)` : ""}`);

  const dir = path.posix.dirname(entry.rel).split("/");
  const orderNotes = [...notes, ...loose.filter((t) => !/^please confirm receipt/i.test(t) && !/^order notes?:?$/i.test(t))]
    .map((t) => t.replace(/^order notes?\s*:?\s*/i, "")).filter(Boolean);

  return {
    po_number: poNumber, client_code: clientCode, po_sequence: poSeq, po_suffix: poSuffix,
    file: entry.rel, staff_folder: dir[0] ?? null, client_folder: dir.slice(1).join(" / ") || null, modified: entry.modified,
    status: checks.length ? "check" : "clean", checks, info,
    order_date: orderDate, media_owner: mediaOwner, to_contact: toContact, from_staff: fromStaff,
    client_in_doc: clientInDoc, order_number_in_doc: docNumber, commission_pct: commission, currency,
    medium_guess: guessMedium([mediaOwner, ...Object.entries(fields).flat(), ...lines.map((l) => l.description)].join(" ")),
    // First and last day anything on the order is booked for.
    booked_from: lines.map((l) => l.start_date).filter(Boolean).sort()[0] ?? null,
    booked_to: lines.map((l) => l.end_date ?? l.start_date).filter(Boolean).sort().at(-1) ?? null,
    cancelled: /cancel+ed|cancellation/i.test(allText),
    fields, lines, totals, printed_totals: printedTotals, invoice_schedule: schedule, order_notes: orderNotes.join(" | ") || null,
  };
}

// ------------------------------------------------------------------------ run

function main() {
  const [, , xmlDir, outDir] = process.argv;
  if (!xmlDir || !outDir) { console.error('usage: node parse.js "<xml dir>" "<output dir>"'); process.exit(1); }
  const manifest = JSON.parse(fs.readFileSync(path.join(xmlDir, "manifest.json"), "utf8"));
  const orders = [];
  for (const entry of manifest) {
    if (!entry.xml) { orders.push({ po_number: entry.name.replace(/\.docx$/i, ""), file: entry.rel, status: "unreadable", checks: [`could not open file: ${entry.error}`], info: [], lines: [], totals: {} }); continue; }
    try { orders.push(parseOrder(entry, fs.readFileSync(path.join(xmlDir, entry.xml), "utf8"))); }
    catch (err) { orders.push({ po_number: entry.name.replace(/\.docx$/i, ""), file: entry.rel, status: "unreadable", checks: [`parser error: ${err.message}`], info: [], lines: [], totals: {} }); }
  }

  // Cross-file checks: the same PO number twice, and families like 0421 / 0421a.
  const byPo = new Map(), byBase = new Map();
  for (const o of orders) {
    byPo.set(o.po_number, [...(byPo.get(o.po_number) ?? []), o]);
    if (o.client_code) { const k = `${o.client_code}${o.po_sequence}`; byBase.set(k, [...(byBase.get(k) ?? []), o]); }
  }
  for (const [po, list] of byPo) if (list.length > 1) for (const o of list) {
    const msg = `PO ${po} is on ${list.length} files: ${list.map((x) => path.posix.basename(x.file)).join(", ")}`;
    if (!o.checks.includes(msg)) { o.checks.push(msg); o.status = o.status === "clean" ? "check" : o.status; }
  }
  for (const list of byBase.values()) if (new Set(list.map((o) => o.po_number)).size > 1) for (const o of list) {
    o.info.push(`related files: ${list.filter((x) => x !== o).map((x) => path.posix.basename(x.file)).join(", ")}`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "orders.json"), JSON.stringify(orders, null, 1));

  const cell = (v) => { if (v === null || v === undefined) return ""; const s = Array.isArray(v) ? v.join("; ") : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (cols, rows) => "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
  const sorted = [...orders].sort((a, b) => String(a.client_folder).localeCompare(String(b.client_folder)) || String(a.po_number).localeCompare(String(b.po_number)));
  fs.writeFileSync(path.join(outDir, "orders.csv"), csv(
    ["client_folder", "po_number", "status", "checks", "info", "booked_from", "booked_to", "order_date", "media_owner", "medium_guess", "to_contact", "from_staff", "client_in_doc", "order_number_in_doc", "commission_pct", "currency", "line_count", "gross_total", "net_total", "inc_vat_total", "order_notes", "staff_folder", "modified", "file"],
    sorted.map((o) => ({ ...o, line_count: o.lines.length, gross_total: o.totals.gross, net_total: o.totals.net, inc_vat_total: o.totals.inc_vat }))));
  fs.writeFileSync(path.join(outDir, "lines.csv"), csv(
    ["client_folder", "po_number", "line_no", "section", "description", "start_date", "end_date", "date_text", "gross", "net", "inc_vat", "is_production", "free_of_charge", "media_owner", "order_date"],
    sorted.flatMap((o) => o.lines.map((l) => ({ ...l, client_folder: o.client_folder, po_number: o.po_number, media_owner: o.media_owner, order_date: o.order_date })))));

  const count = (s) => orders.filter((o) => o.status === s).length;
  console.log(`orders ${orders.length}: clean ${count("clean")}, to check ${count("check")}, unreadable ${count("unreadable")}; lines ${orders.reduce((a, o) => a + o.lines.length, 0)}`);
}

if (require.main === module) main();
module.exports = { parseOrder, readDocument, findDates, findMoney };
