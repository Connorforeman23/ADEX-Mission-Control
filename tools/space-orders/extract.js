// Step 1 of the Space Order import: find the order files in the synced
// SharePoint library and pull the document XML out of each one.
//
//   node extract.js "<library root>" "<output dir>" [since yyyy-mm-dd]
//
// Read-only on the library. Opening a cloud-only file makes OneDrive download
// it, which is why the XML is cached: the parser can then be re-run as often as
// needed without touching the Word files again.
const fs = require("fs");
const path = require("path");
const { readZipEntry } = require("./zip");

const [, , root, outDir, sinceArg] = process.argv;
if (!root || !outDir) {
  console.error('usage: node extract.js "<library root>" "<output dir>" [since yyyy-mm-dd]');
  process.exit(1);
}
const since = sinceArg ? new Date(sinceArg) : new Date("2025-11-01");

// An order file is named like its PO number: RAN0106.docx, VCC0421a.docx,
// "BWW0014 (1).docx", S4G00010.docx. The prefix is two to four characters with
// at least one letter. Word's "~$" lock files never match.
const ORDER_NAME = /^(?=[A-Za-z0-9]{0,3}[A-Za-z])[A-Za-z0-9]{2,4}\s?\d{3,6}.*\.docx$/;

function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile() && ORDER_NAME.test(e.name)) yield full;
  }
}

fs.mkdirSync(outDir, { recursive: true });
const manifest = [];
let done = 0, failed = 0, cached = 0;
for (const full of walk(root)) {
  const stat = fs.statSync(full);
  if (stat.mtime < since) continue;
  const rel = path.relative(root, full).split(path.sep).join("/");
  const entry = { rel, name: path.basename(full), modified: stat.mtime.toISOString(), bytes: stat.size, xml: null, error: null };
  try {
    const xmlRel = rel.replace(/\.docx$/i, ".xml");
    const target = path.join(outDir, xmlRel);
    // Already cached and the Word file has not changed since: do not open it
    // again, so OneDrive is not made to download it a second time.
    if (fs.existsSync(target) && fs.statSync(target).mtime >= stat.mtime) {
      entry.xml = xmlRel;
      cached++;
      done++;
      manifest.push(entry);
      continue;
    }
    const xml = readZipEntry(fs.readFileSync(full), "word/document.xml");
    if (!xml) throw new Error("no word/document.xml inside");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, xml);
    entry.xml = xmlRel;
    done++;
  } catch (err) {
    entry.error = String(err.message || err);
    failed++;
  }
  manifest.push(entry);
  if ((done + failed) % 25 === 0) console.log(`${done + failed} files…`);
}
manifest.sort((a, b) => a.rel.localeCompare(b.rel));
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(`extracted ${done} (${cached} already cached), failed ${failed}, manifest at ${path.join(outDir, "manifest.json")}`);
if (failed) manifest.filter((m) => m.error).forEach((m) => console.log(`  FAILED ${m.rel}: ${m.error}`));
