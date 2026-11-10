# Space Order parser

Reads ADEX Space Orders (the Word files sent to media owners) out of the synced
SharePoint library and turns them into structured data for import into Mission
Control. Read-only: it never changes a Word file and writes nothing to the
database.

## Run it

```bash
node tools/space-orders/extract.js "C:/Users/Admin/Advertising Excellence/ADEX Data - Documents" imports/space-order-inventory/xml 2025-11-01
```

```bash
node tools/space-orders/parse.js imports/space-order-inventory/xml imports/space-order-inventory/parsed
```

`extract.js` finds every order-named `.docx` modified since the date given and
caches its document XML. Opening a cloud-only file makes OneDrive download it
(about 0.9 MB each), so this is the slow step; the cache means `parse.js` can be
re-run freely. `parse.js` writes `orders.json`, `orders.csv` and `lines.csv`.

```bash
node tools/space-orders/to-import.js imports/space-order-inventory/parsed imports/space-order-inventory/import
```

```bash
node tools/space-orders/match-charges.js imports/space-order-inventory/parsed imports/space-order-inventory/xero/invoice-lines.json imports/space-order-inventory/import
```

`match-charges.js` finds what the client was charged for each booking line by
matching sales-invoice lines (from Xero or Sage) to booking lines on date,
amount and wording. It writes `charges.json`, plus `charge-matches.csv` and
`invoice-lines-unmatched.csv` for review. `invoice-customers.json` says which
client folder each invoiced customer is; edit it where it is wrong or empty.
Run it before `to-import.js`.

`to-import.js` writes `bookings-import.csv` in the layout the app's **Import
bookings** page reads, and `held-back.csv` listing every order left out and why.
By default an order goes in only if every line has a charge found on an invoice.
Options: `--from=2025-11-01`, `--campaign=month|po`, `--charge=matched|gross|zero`,
`--unmatched=hold|gross|zero`, `--estimates=hold|use`, `--include=RAN`.

The file also carries `owner` and `handled_by`. The importer does not read them
yet, and makes whoever runs the import the owner.

It reads three files from the output folder, which are meant to be edited:

- `client-names.json` and `supplier-names.json` — the name to use for each
  folder and media owner. The importer creates a new client when a name does
  not match one on the books exactly, so set these to the names already there.
- `channels.json` — the channel for each PO. An order with no entry is held
  back, never guessed.

The output holds client financials. `imports/` must stay out of git.

## Rules the parser holds to

- **The file name is the PO number.** The "Order Number" printed inside is often
  a stale copy from the order the file was cloned from. It is recorded and
  compared, never used.
- **Struck-through text is ignored.** That is how a replaced or cancelled line is
  marked in these files. What was ignored is listed under `info`.
- **Nothing is guessed.** A missing, impossible or ambiguous value is left null,
  or kept as printed, and listed under `checks`. The one exception is a
  thousands separator typed as a full stop ("34.000.00"), which is read as
  thousands and always flagged.
- **Columns are read by their header**, not by position, because TV, press and
  outdoor orders are laid out differently.

## Status

- `clean` — nothing to check.
- `check` — parsed, but one or more findings need a person to look. Each finding
  says which line and what is wrong.
- `unreadable` — the file could not be opened or parsed.

## What it checks

- Order date present and real; media owner present; commission stated.
- Every line has a date and a cost.
- Impossible dates, end before start, weekday not matching the date, a booking
  starting more than two months before its own order (usually a year typo).
- Net equals gross less commission; inc VAT equals net plus 20% (sterling only).
- Printed sub-totals and totals agree with the lines they cover.
- The same PO number on more than one file; cancelled orders; costs written in
  the notes because the costs table was left empty.

## Known limits

- A line dated only by month ("Nov 2026") is flagged, not given dates.
- `medium_guess` is a keyword guess and is not reliable enough to import from.
- An invoicing-schedule table is kept in `invoice_schedule` and not added to the
  booking lines.
