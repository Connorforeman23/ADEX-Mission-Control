// Flexible date entry for booking lines.
//
// "Selected dates" is typed by people in a hurry, in whatever form the media
// owner used: "20 Oct", "20.10.26", "20/10/2026", "Sat 20 Oct", "2026-10-20".
// Rick's rule: accept the lot, but VERIFY — a date that doesn't parse, or one
// outside the line's start and end, is an error, not a guess.
//
// Dates are STORED as ISO (2026-10-20, comma-separated) so every other part of
// the system can read them without repeating this parsing; the Space Order
// prints them in its own dd.MM.yy form.

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

const iso = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m, d));
  // Reject 31 Feb and friends: the Date constructor silently rolls them over.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
};

const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/**
 * One token → ISO date, or null if it can't be read.
 * `yearHint` fills in a missing year — the line's start year — so "20 Oct"
 * on a campaign booked for 2026 means 2026.
 */
export function parseFlexibleDate(token: string, yearHint: number): string | null {
  let t = token.trim().toLowerCase();
  if (!t) return null;
  // Drop a leading weekday: "sat 20 oct", "saturday 20th".
  t = t.replace(/^(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s+/, "");
  // 20th → 20
  t = t.replace(/(\d)(st|nd|rd|th)\b/g, "$1");

  let m: RegExpMatchArray | null;

  // 2026-10-20
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    return iso(+m[1], +m[2] - 1, +m[3]);
  }
  // 20.10.26  20/10/2026  20-10-26
  if ((m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/))) {
    return iso(fullYear(+m[3]), +m[2] - 1, +m[1]);
  }
  // 20.10  20/10  (no year)
  if ((m = t.match(/^(\d{1,2})[./-](\d{1,2})$/))) {
    return iso(yearHint, +m[2] - 1, +m[1]);
  }
  // 20 oct  20 october 2026  20oct26
  if ((m = t.match(/^(\d{1,2})\s*([a-z]+)\.?,?\s*(\d{2,4})?$/))) {
    const month = MONTHS[m[2]];
    if (month === undefined) return null;
    return iso(m[3] ? fullYear(+m[3]) : yearHint, month, +m[1]);
  }
  // oct 20  october 20 2026
  if ((m = t.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s*(\d{2,4})?$/))) {
    const month = MONTHS[m[1]];
    if (month === undefined) return null;
    return iso(m[3] ? fullYear(+m[3]) : yearHint, month, +m[2]);
  }
  return null;
}

export type SelectedDates =
  | { ok: true; dates: string[]; normalised: string }
  | { ok: false; error: string };

/**
 * The whole field → a checked, ordered, de-duplicated list of ISO dates.
 * Every date must sit inside [start, end]; the message names the offender.
 */
export function parseSelectedDates(text: string, start: string, end: string): SelectedDates {
  const tokens = text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!tokens.length) return { ok: true, dates: [], normalised: "" };

  const yearHint = start ? Number(start.slice(0, 4)) : new Date().getFullYear();
  const dates: string[] = [];
  for (const token of tokens) {
    const d = parseFlexibleDate(token, yearHint);
    if (!d) {
      return { ok: false, error: `"${token}" isn't a date I can read. Try 20 Oct, 20.10.26 or 20/10/2026.` };
    }
    if (start && d < start) {
      return { ok: false, error: `${token} is before the line starts (${start}).` };
    }
    if (end && d > end) {
      return { ok: false, error: `${token} is after the line ends (${end}).` };
    }
    if (!dates.includes(d)) dates.push(d);
  }
  dates.sort();
  return { ok: true, dates, normalised: dates.join(", ") };
}
