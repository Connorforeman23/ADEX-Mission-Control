// The ADEX proposal look, taken from four real decks rather than invented:
// Faster Property Solutions, Affinity Water C-04487, Vintage 2027 Growth
// Planning and Benson Goldstein.
//
// Every colour below is one the decks actually use, by frequency. The pink and
// the blue are the brand; the navy is what the decks put behind white text;
// the slate and the washes are the supporting greys.

export const BRAND = {
  /** The ADEX pink — accent1 across the decks, and the dominant accent. */
  pink: "D93B6E",
  /** The ADEX blue — the same blue as the dots in the logo. */
  blue: "29ABE2",
  /** Deep navy: dark slide backgrounds, headings on light slides. */
  ink: "0D1B2A",
  /** A lighter navy, for panels on a dark slide. */
  inkSoft: "1B2E44",
  /** Secondary text, labels, footers. */
  slate: "5A6B7B",
  /** The light page wash. */
  wash: "F2F4F7",
  /** A slightly deeper wash, for cards on a light slide. */
  washDeep: "E3E8EE",
  /** Hairlines and card borders. */
  line: "C4D2DE",
  white: "FFFFFF",
  /** Tints of the brand pink, used behind figures. */
  pinkSoft: "E77FA2",
  pinkWash: "F4C6D5",
} as const;

/**
 * Calibri throughout, Calibri Light for headings — what the decks use.
 *
 * Both ship with Office and render at true width when the deck is checked,
 * so what we see when proofing is what the client will see.
 */
export const FONTS = {
  heading: "Calibri Light",
  body: "Calibri",
} as const;

/** 16:9, the size every ADEX deck is built at. */
export const SLIDE = { w: 13.333, h: 7.5 } as const;

/**
 * The grammar every ADEX content slide follows. Named here because it is the
 * thing that makes the decks good, and the thing the generator must not drift
 * from:
 *
 *   eyebrow     the section, in caps        "TARGETED DIGITAL"
 *   headline    a CLAIM, never a label      "Around 80% of investment is in linear TV"
 *   standfirst  one line of context         "Media investment by channel, Jan–Oct 2026"
 *   body        the substance
 *   takeaway    what it means               "Reach is high; repeated exposure explains the index"
 *
 * A reader who reads only the headlines should still follow the argument.
 */
export type SlideSpec = {
  layout:
    | "cover"
    | "routes" // the menu of options, as on Faster Property slide 1
    | "route" // one costed route with its metrics
    | "metrics" // a figure-led slide
    | "table"
    | "process" // numbered steps with arrows
    | "stopContinueStart"
    | "closing";
  eyebrow?: string;
  headline: string;
  standfirst?: string;
  /** Big figures: value, label, and an optional note under it. */
  figures?: { value: string; label: string; note?: string }[];
  /** Points — a heading and a line, as the decks use for "WHY IT'S INTERESTING". */
  points?: { title: string; detail: string }[];
  /** Rows for a table layout. First row is the header. */
  rows?: string[][];
  /** Numbered steps for a process layout. */
  steps?: { label: string; title: string; detail?: string }[];
  /** Three columns, for the stop / continue / start slide. */
  columns?: { title: string; items: string[] }[];
  takeaway?: string;
  /**
   * Anything not yet confirmed. The real decks say "Rate requested" and
   * "Detail to follow" rather than inventing a number, and so must we.
   */
  footnote?: string;
};

export type DeckSpec = {
  /** "Faster Property Solutions" */
  client: string;
  /** "Media Opportunities" */
  title: string;
  /** The line under the title on the cover. */
  subtitle?: string;
  /** Printed in the footer beside the ADEX name. */
  clientDomain?: string;
  slides: SlideSpec[];
};
