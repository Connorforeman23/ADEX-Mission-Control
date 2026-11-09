// The ADEX proposal look, taken from the real decks rather than invented:
// Affinity Water C-04487, Benson Goldstein v7, Faster Property Solutions,
// Vintage 2027 Growth Planning and Luxury Lodges TV Test.
//
// ONE look across all of them (Connor: "just make it the same look across
// all and use the formats you need on bespoke briefs"). The decks differ in
// which FORMATS they reach for — Lodges is full of cards, a bar chart and
// media owner logos in the header; Affinity is typographic — but not in
// their palette or type. So the formats are a vocabulary, and the brief
// decides which ones a slide uses.
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
  /** The warm panel behind a callout — Lodges' "Why it's interesting". */
  cream: "F6EFE3",
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
export type Figure = {
  value: string;
  label: string;
  note?: string;
  /** The figure the slide is about — usually the total. Drawn as the navy card. */
  emphasis?: boolean;
};

/** One bar of a horizontal bar chart: an index, a share, a reach figure. */
export type Bar = { label: string; value: number };

/** Who to call. Shown at the foot of the closing slide. */
export type Contact = { name: string; title?: string; phone?: string; email?: string };

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
  | { kind: "image"; dataUri?: string; caption?: string }
  /** Figures in cards — the Lodges spend breakdown. The emphasised one is navy. */
  | { kind: "cards"; figures: Figure[] }
  /** The cream panel: the reasoning beside the numbers, "Why it's interesting". */
  | { kind: "callout"; heading?: string; text: string }
  /** A horizontal bar chart — an index, a ranking, a comparison. */
  | { kind: "chart"; heading?: string; bars: Bar[] };

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
  steps?: { label: string; title: string; detail?: string; value?: string }[];
  /** Three columns of bullets, for stop / continue / start. */
  lists?: { title: string; items: string[] }[];
  /** Supplier names whose logos run along the foot — the CRM supplies the
   *  images, so nobody sources them by hand. */
  logos?: string[];
  /**
   * The media owner this slide is about — ITV, Sky, Prime Video. Its logo
   * sits in the header beside the ADEX mark, as on every Lodges channel
   * slide, so a reader knows whose inventory they are looking at.
   */
  brand?: string;
  /** Who to call. Drawn on the closing slide only. */
  contact?: Contact;
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
  /** Supplier name (lower case) → data URI, taken from the organisations. */
  supplierLogos?: Record<string, string>;
  title: string;
  subtitle?: string;
  clientDomain?: string;
  /** The client's own logo for the cover, beside the ADEX mark. */
  clientLogo?: string;
  slides: SlideSpec[];
};
