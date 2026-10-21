// The ADEX proposal look, taken from the real decks rather than invented:
// Affinity Water C-04487, Benson Goldstein v7, Faster Property Solutions and
// Vintage 2027 Growth Planning.
//
// Every colour below is one the decks actually use, by frequency. The pink and
// the blue are the brand; the navy is what the decks put behind white text;
// the slate and the washes are the supporting greys.

export const BRAND = {
  /** The ADEX pink — the dominant accent, used for eyebrows and figures. */
  pink: "D93B6E",
  /** The ADEX blue — the same blue as the dots in the logo. */
  blue: "29ABE2",
  /** Deep navy: dark slides, headlines, emphasis strips. */
  ink: "0D1B2A",
  /** A lighter navy, for panels on a dark slide. */
  inkSoft: "1B2E44",
  /** Body copy on a light slide, and secondary text. */
  slate: "5A6B7B",
  /** Small-caps labels under figures. */
  label: "5B6B7F",
  /** The light page wash, used for table stripes and image grounds. */
  wash: "F1F4F8",
  washDeep: "E3E8EE",
  line: "C9D3DE",
  white: "FFFFFF",
  pinkSoft: "E77FA2",
  pinkWash: "F4C6D5",
} as const;

/**
 * Calibri throughout — what every deck uses. Headlines are Calibri BOLD, not
 * Light: the real decks lead with weight, and that is most of why they look
 * confident.
 */
export const FONTS = {
  heading: "Calibri",
  body: "Calibri",
} as const;

/** 16:9, the size every ADEX deck is built at. */
export const SLIDE = { w: 13.333, h: 7.5 } as const;

/**
 * The grammar every ADEX content slide follows:
 *
 *   eyebrow     the section, in pink caps   "IDEA 01 · ZERO-WASTE GEOGRAPHY"
 *   headline    a CLAIM, never a label      "Pay only to reach people on Affinity's network"
 *   then one or two blocks of substance, and where it earns its place,
 *   a navy strip carrying the single point the slide exists to make.
 *
 * A reader who reads only the headlines should still follow the argument.
 */

/** A big figure: the number, and a small-caps label beneath it. */
export type Figure = { value: string; label: string; note?: string };

/** A numbered row: navy disc, bold label, grey detail — the Affinity pattern. */
export type IconRow = { label: string; detail: string };

/** One side of a two-column slide. */
export type Column =
  | { kind: "prose"; heading?: string; text: string }
  | { kind: "iconRows"; heading?: string; rows: IconRow[] }
  | { kind: "figures"; figures: Figure[] }
  | { kind: "table"; rows: string[][] }
  | { kind: "bullets"; heading?: string; items: string[] }
  /** A picture the author drops in: a photo, a chart, a schematic. */
  | { kind: "image"; dataUri?: string; caption?: string };

export type SlideSpec = {
  layout:
    | "cover"
    | "split" // two columns — the workhorse: image or figures left, argument right
    | "full" // one column across the slide
    | "steps" // numbered process
    | "stopContinueStart"
    | "closing";
  eyebrow?: string;
  headline: string;
  standfirst?: string;
  /** Left and right for "split"; the first is used for "full". */
  columns?: Column[];
  /** Figures that run across the slide under the headline. */
  figures?: Figure[];
  steps?: { label: string; title: string; detail?: string }[];
  /** Three columns of bullets, for stop / continue / start. */
  lists?: { title: string; items: string[] }[];
  /** Supplier names whose logos should run along the foot of the slide. */
  logos?: string[];
  /** The navy strip: the one point the slide exists to make. */
  strip?: string;
  /**
   * Anything not yet confirmed. The real decks say "Rate requested" and
   * "Detail to follow" rather than inventing a number, and so must we.
   */
  footnote?: string;
};

export type DeckSpec = {
  client: string;
  title: string;
  subtitle?: string;
  clientDomain?: string;
  /** The client's own logo for the cover, beside the ADEX mark. */
  clientLogo?: string;
  slides: SlideSpec[];
};
