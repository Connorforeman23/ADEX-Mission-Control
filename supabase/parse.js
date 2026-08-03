// Parse each Randox Space Order's table rows into structured booking lines.
const fs = require("fs");

const text = (xml) =>
  xml
    .replace(/<w:tab[^>]*\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Only a cell carrying a currency symbol counts as money — otherwise dates
// like "22.02" get read as amounts.
const money = (s) => {
  const str = String(s);
  if (!/[£€]/.test(str)) return null;
  const n = parseFloat(str.replace(/[£€,\s]/g, "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const currencyOf = (cells) => (cells.some((c) => /€/.test(String(c))) ? "EUR" : "GBP");

// dd.mm.yy or dd.mm.yyyy → ISO
const isoDate = (s) => {
  const m = String(s).match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
  if (!m) return null;
  let [, d, mo, y] = m;
  y = y.length === 2 ? `20${y}` : y;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

function rowsOf(po) {
  const xml = fs.readFileSync(`${po}/word/document.xml`, "utf8");
  const out = [];
  for (const tbl of xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? []) {
    for (const tr of tbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) ?? []) {
      const cells = (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map(text);
      if (cells.length) out.push(cells);
    }
  }
  return out;
}

const header = (po) => {
  const xml = fs.readFileSync(`${po}/word/document.xml`, "utf8");
  const flat = text(xml);
  const company = (flat.match(/Company:\s*([^F]*?)\s*To:/) ?? [])[1]?.trim();
  const to = (flat.match(/To:\s*(.*?)\s*From:/) ?? [])[1]?.trim();
  const from = (flat.match(/From:\s*(.*?)\s*Date:/) ?? [])[1]?.trim();
  const comm = (flat.match(/Agency Commission\s*(\d+)%/) ?? [])[1];
  const copy = /Repeat/i.test(flat) ? "Repeat Copy" : "New Copy";
  return { company, to, from, commission: comm ? Number(comm) : 15, copy };
};

const POS = process.argv.slice(2);
const result = {};
for (const po of POS) {
  const h = header(po);
  const lines = [];
  for (const cells of rowsOf(po)) {
    const joined = cells.join(" | ");
    if (/Gross Cost|Gross Media/i.test(joined) && /Net/i.test(joined)) continue; // header row
    const amounts = cells.map(money).filter((n) => n !== null && n > 0);
    if (!amounts.length) continue;
    const currency = currencyOf(cells);
    const dates = cells.flatMap((c) => {
      const all = String(c).match(/\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}/g) ?? [];
      return all.map(isoDate);
    });
    const label = cells.find((c) => c && !/^[£€\d.,\s]*$/.test(c) && !/^(Monday|Sunday|Saturday|Tuesday|Wednesday|Thursday|Friday)/i.test(c));
    lines.push({
      label: label ?? "",
      dates,
      currency,
      gross: amounts[0] ?? null,
      net: amounts.length >= 3 ? amounts[1] : null,
      incVat: amounts[amounts.length - 1] ?? null,
      isProduction: /production/i.test(label ?? ""),
    });
  }
  result[po] = { ...h, lines };
}
fs.writeFileSync("parsed.json", JSON.stringify(result, null, 1));
for (const [po, v] of Object.entries(result)) {
  console.log(`\n### RAN${po}  ${v.company} (${v.to}) comm ${v.commission}%  — ${v.lines.length} lines`);
  v.lines.forEach((l) =>
    console.log(
      `  ${(l.label || "").slice(0, 34).padEnd(34)} ${(l.dates[0] ?? "").padEnd(11)}${(l.dates[1] ?? "").padEnd(11)} g=${l.gross ?? ""} n=${l.net ?? ""}${l.isProduction ? " [prod]" : ""}`
    )
  );
}
