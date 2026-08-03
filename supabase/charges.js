// Set client_charge from what Randox was actually invoiced (ex VAT).
// Every rate below is taken from the Sage report, not assumed.
const fs = require("fs");
const rows = JSON.parse(fs.readFileSync("rows.json", "utf8"));

// Rate per booking line, derived from the invoices.
function chargeFor(r) {
  const d = `${r.detail} ${r.vendor}`;

  // FTWM: bought at 3,276, invoiced at 3,500 every time (27 insertions seen).
  if (r.vendor === "FT") return 3500;

  // M4 Tower: invoiced 6,000 a month (Connor confirmed).
  if (/m4 tower/i.test(d) && r.lineType === "media") return 6000;

  // Mancunian Arch: invoiced 4,766.67 a month. The order is one 30-week line,
  // so it carries the full run Connor quotes at 36,000.
  if (r.po === "RAN0085" && r.lineType === "media") return 36000;

  // Glasgow: Streethubs marked up (5,267.44 -> 6,728), Streetliners at cost,
  // airport D6s invoiced below rate card (858 -> 780).
  if (/streethub/i.test(d)) return 6728;
  if (/d6.*airport|airport/i.test(d)) return 780;

  // Everything else was invoiced at the supplier's gross.
  return r.gross;
}

const out = [];
let net = 0, charged = 0;
const byCamp = new Map();

rows.forEach((r) => {
  const charge = chargeFor(r);
  const lineNet = r.commission ? +(r.gross * (1 - r.commission / 100)).toFixed(2) : r.gross;
  net += lineNet;
  charged += charge;
  const c = byCamp.get(r.ref) ?? { ref: r.ref, name: r.name, net: 0, charged: 0, lines: 0 };
  c.net += lineNet; c.charged += charge; c.lines++;
  byCamp.set(r.ref, c);
  if (charge !== r.gross) {
    out.push({ po: r.po, detail: r.detail, start: r.start, gross: r.gross, charge });
  }
});

// SQL: set the charge on every line, keyed by PO + detail + start date.
const esc = (s) => String(s).replace(/'/g, "''");
const sql = [`-- Client charges from the Randox invoice report (ex VAT).
-- Most lines were invoiced at the supplier's gross; the exceptions are the
-- FTWM pages, M4 Tower, Mancunian Arch and two Glasgow lines.

update campaign_lines set client_charge = supplier_gross where supplier_po like 'RAN%';
`];
sql.push(`update campaign_lines set client_charge = 3500
where supplier_po like 'RAN%' and vendor = 'FT';`);
sql.push(`update campaign_lines set client_charge = 6000
where supplier_po like 'RAN%' and line_type = 'media' and detail ilike '%M4 Tower%';`);
sql.push(`update campaign_lines set client_charge = 36000
where supplier_po = 'RAN0085' and line_type = 'media';`);
sql.push(`update campaign_lines set client_charge = 6728
where supplier_po like 'RAN%' and detail ilike '%Streethub%';`);
sql.push(`update campaign_lines set client_charge = 780
where supplier_po like 'RAN%' and detail ilike '%Airport%';`);
sql.push(`
-- Margin by campaign
select c.ref, c.name,
       sum(l.client_charge)::numeric(12,2) as charged_ex_vat,
       sum(l.supplier_net)::numeric(12,2)  as supplier_net,
       (sum(l.client_charge) - sum(l.supplier_net))::numeric(12,2) as margin,
       round((sum(l.client_charge) - sum(l.supplier_net)) / nullif(sum(l.client_charge),0) * 100, 1) as margin_pct
from campaigns c join campaign_lines l on l.campaign_id = c.id
where l.supplier_po like 'RAN%'
group by c.ref, c.name
order by c.ref;`);
fs.writeFileSync("charges.sql", sql.join("\n\n") + "\n");

console.log("=== lines charged at something other than supplier gross ===");
out.forEach((o) => console.log(" ", o.po, o.detail.slice(0, 30).padEnd(30), o.start, "gross", String(o.gross).padStart(9), "-> charge", o.charge));

console.log("\nref      campaign                              charged      net       margin    %");
[...byCamp.values()].forEach((c) => {
  const m = c.charged - c.net;
  console.log(c.ref, c.name.slice(0, 34).padEnd(34),
    String(c.charged.toFixed(2)).padStart(11), String(c.net.toFixed(2)).padStart(11),
    String(m.toFixed(2)).padStart(10), (m / c.charged * 100).toFixed(1).padStart(6));
});
console.log("\nTOTAL charged GBP", charged.toFixed(2), " supplier net GBP", net.toFixed(2),
  "\nMARGIN  GBP", (charged - net).toFixed(2), "(" + ((charged - net) / charged * 100).toFixed(1) + "%)");
