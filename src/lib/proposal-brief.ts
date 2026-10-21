// Turn a written brief into deck slides.
//
// Connor's actual workflow: think the deck through slide by slide in a chat,
// then build it. Filling in a form per slide is the part nobody wants to do,
// so this reads the brief instead. No API key needed — the thinking happens
// wherever he likes, and the CRM does the building.
//
// Two formats are accepted, because two things produce them:
//
//   JSON     what an assistant returns when handed PROPOSAL_PROMPT below.
//   Outline  the same thing written by hand, in a shape you can type.
//
// Deliberately forgiving. A brief that does not quite follow the grammar
// should still produce a deck with the words in roughly the right places,
// because the slide editor is right there to fix the rest. It warns rather
// than refuses.

import type { Column, Figure, SlideSpec } from "@/lib/proposal-theme";

export type BriefResult = {
  slides: SlideSpec[];
  /** Things worth saying out loud — never fatal. */
  warnings: string[];
};

/** Block keys recognised at the start of a line inside a slide. */
const BLOCK_KEYS = [
  "figures",
  "steps",
  "table",
  "bullets",
  "rows",
  "stop",
  "continue",
  "start",
  "logos",
  "strip",
  "note",
  "footnote",
  "layout",
  "text",
] as const;
type BlockKey = (typeof BLOCK_KEYS)[number];

/** "figures:" or "figures" on its own line, case-insensitive. */
function blockKeyOf(line: string): { key: BlockKey; rest: string } | null {
  const m = line.match(/^([A-Za-z]+)\s*:\s*(.*)$/);
  if (!m) return null;
  const key = m[1].toLowerCase() as BlockKey;
  return (BLOCK_KEYS as readonly string[]).includes(key) ? { key, rest: m[2].trim() } : null;
}

/** Strip a leading bullet character, which people type out of habit. */
const debullet = (s: string) => s.replace(/^\s*[-*•]\s*/, "").trim();

/** "1.4m = Adults reached", or "1.4m - Adults reached". */
function parseFigure(line: string): Figure | null {
  const m = debullet(line).match(/^(.+?)\s*(?:=|—|–|--|-)\s*(.+)$/);
  if (!m) return null;
  return { value: m[1].trim(), label: m[2].trim() };
}

/** "01. Launch burst - two weeks of OOH", the number optional. */
function parseStep(line: string, index: number) {
  let s = debullet(line);
  let label = String(index + 1).padStart(2, "0");
  const numbered = s.match(/^(\d{1,2})[.)]\s*(.*)$/);
  if (numbered) {
    label = numbered[1].padStart(2, "0");
    s = numbered[2];
  }
  const split = s.match(/^(.+?)\s*(?:—|–|--|\s-\s)\s*(.+)$/);
  return split
    ? { label, title: split[1].trim(), detail: split[2].trim() }
    : { label, title: s.trim() };
}

/** "Commuter corridors - the M5 carries them past twice a day". */
function parseIconRow(line: string) {
  const s = debullet(line);
  const m = s.match(/^(.+?)\s*(?:—|–|--|\s-\s)\s*(.+)$/);
  return m ? { label: m[1].trim(), detail: m[2].trim() } : { label: s, detail: "" };
}

type Pending = {
  eyebrow?: string;
  headline: string;
  standfirst: string[];
  layout?: SlideSpec["layout"];
  figures: Figure[];
  steps: { label: string; title: string; detail?: string }[];
  table: string[][];
  bullets: string[];
  rows: { label: string; detail: string }[];
  /** Paragraphs, each a list of the lines that were wrapped into it. */
  prose: string[][];
  lists: { title: string; items: string[] }[];
  logos: string[];
  strip?: string;
  footnote?: string;
  isCover: boolean;
};

const blank = (headline: string, isCover: boolean): Pending => ({
  headline,
  standfirst: [],
  figures: [],
  steps: [],
  table: [],
  bullets: [],
  rows: [],
  prose: [],
  lists: [],
  logos: [],
  isCover,
});

/** Turn the gathered blocks into the slide the template understands. */
function finish(p: Pending, warnings: string[]): SlideSpec | null {
  if (
    !p.headline &&
    !p.prose.some((para) => para.length) &&
    !p.bullets.length &&
    !p.figures.length &&
    !p.table.length &&
    !p.steps.length
  ) {
    return null;
  }

  const columns: Column[] = [];
  // Lines that were wrapped belong to one paragraph; only a blank line in the
  // brief starts a new one.
  const prose = p.prose
    .map((para) => para.join(" ").trim())
    .filter(Boolean)
    .join("\n\n");
  if (prose) columns.push({ kind: "prose", text: prose });
  if (p.rows.length) columns.push({ kind: "iconRows", rows: p.rows });
  if (p.bullets.length) columns.push({ kind: "bullets", items: p.bullets });
  if (p.table.length) columns.push({ kind: "table", rows: p.table });

  // Inferred, unless the brief said otherwise. A cover is a cover; a slide
  // with steps is a steps slide; two blocks of substance want two columns;
  // everything else runs full width.
  let layout: SlideSpec["layout"] = p.isCover
    ? "cover"
    : p.lists.length
      ? "stopContinueStart"
      : p.steps.length
        ? "steps"
        : columns.length > 1
          ? "split"
          : "full";
  if (p.layout) layout = p.layout;

  if (columns.length > 2) {
    warnings.push(
      `"${p.headline}" has ${columns.length} blocks of content — a slide holds two. The rest are still there; split the slide if it looks crowded.`
    );
  }

  const slide: SlideSpec = { layout, headline: p.headline };
  if (p.eyebrow) slide.eyebrow = p.eyebrow;
  if (p.standfirst.length) slide.standfirst = p.standfirst.join(" ");
  if (p.figures.length) slide.figures = p.figures;
  if (p.steps.length) slide.steps = p.steps;
  if (p.lists.length) slide.lists = p.lists;
  if (columns.length) slide.columns = columns;
  if (p.logos.length) slide.logos = p.logos;
  if (p.strip) slide.strip = p.strip;
  if (p.footnote) slide.footnote = p.footnote;
  return slide;
}

/** The outline format: "# cover", "## eyebrow | headline", then blocks. */
function parseOutline(text: string): BriefResult {
  const warnings: string[] = [];
  const slides: SlideSpec[] = [];
  let current: Pending | null = null;
  let block: BlockKey | null = null;

  const close = () => {
    if (!current) return;
    const slide = finish(current, warnings);
    if (slide) slides.push(slide);
    current = null;
    block = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();

    if (!line) {
      // A blank line ends a block and a paragraph, but not the slide, so
      // prose and lists sit next to each other without ceremony.
      block = null;
      if (current?.prose.length && current.prose[current.prose.length - 1].length) {
        current.prose.push([]);
      }
      continue;
    }

    const cover = line.match(/^#\s+(.*)$/);
    const heading = line.match(/^#{2,}\s+(.*)$/);

    if (cover || heading) {
      close();
      const titleText = (cover ? cover[1] : heading![1]).trim();
      // "Eyebrow | Headline", or just a headline.
      const bar = titleText.indexOf("|");
      const eyebrow = bar >= 0 ? titleText.slice(0, bar).trim() : "";
      const headline = bar >= 0 ? titleText.slice(bar + 1).trim() : titleText;
      current = blank(headline, !!cover);
      if (eyebrow) current.eyebrow = eyebrow;
      continue;
    }

    if (!current) {
      // Words before the first heading are the cover's standfirst.
      current = blank("", true);
      current.standfirst.push(line);
      continue;
    }

    const key = blockKeyOf(line);
    if (key) {
      block = key.key;
      // Single-value keys take their value from the same line.
      if (key.key === "logos") {
        current.logos.push(
          ...key.rest
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        );
        block = null;
        continue;
      }
      if (key.key === "strip") {
        current.strip = key.rest;
        block = null;
        continue;
      }
      if (key.key === "note" || key.key === "footnote") {
        current.footnote = key.rest;
        block = null;
        continue;
      }
      if (key.key === "layout") {
        const want = key.rest.toLowerCase().replace(/[^a-z]/g, "");
        const map: Record<string, SlideSpec["layout"]> = {
          cover: "cover",
          split: "split",
          twocolumns: "split",
          full: "full",
          fullwidth: "full",
          steps: "steps",
          closing: "closing",
          stopcontinuestart: "stopContinueStart",
        };
        if (map[want]) current.layout = map[want];
        else warnings.push(`"${key.rest}" is not a layout — ignoring it.`);
        block = null;
        continue;
      }
      // Multi-line blocks may still carry their first item inline.
      if (key.rest) pushInto(current, block, key.rest, warnings);
      continue;
    }

    if (block) pushInto(current, block, line, warnings);
    // A cover has no columns — the template only draws its standfirst — so
    // loose lines there must go to the standfirst or they vanish.
    else if (current.isCover) current.standfirst.push(line);
    else pushProse(current, line);
  }

  close();
  return { slides, warnings };
}

/** Add a line to the paragraph in progress, starting one if need be. */
function pushProse(p: Pending, line: string) {
  if (!p.prose.length) p.prose.push([]);
  p.prose[p.prose.length - 1].push(line);
}

function pushInto(p: Pending, block: BlockKey | null, line: string, warnings: string[]) {
  switch (block) {
    case "figures": {
      const f = parseFigure(line);
      if (f) p.figures.push(f);
      else warnings.push(`Could not read "${line}" as a figure — expected "1.4m = Adults reached".`);
      return;
    }
    case "steps":
      p.steps.push(parseStep(line, p.steps.length));
      return;
    case "table":
      p.table.push(line.split("|").map((c) => c.trim()));
      return;
    case "bullets":
      p.bullets.push(debullet(line));
      return;
    case "rows":
      p.rows.push(parseIconRow(line));
      return;
    case "stop":
    case "continue":
    case "start": {
      const title = block[0].toUpperCase() + block.slice(1);
      let list = p.lists.find((l) => l.title === title);
      if (!list) {
        list = { title, items: [] };
        p.lists.push(list);
      }
      list.items.push(debullet(line));
      return;
    }
    case "text":
      pushProse(p, line);
      return;
    default:
      pushProse(p, line);
  }
}

/** JSON straight from an assistant, validated loosely and repaired quietly. */
function parseJson(text: string): BriefResult | null {
  // Tolerate a ```json fence, which assistants add whether asked to or not.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  if (!body.startsWith("{") && !body.startsWith("[")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  const raw = Array.isArray(parsed)
    ? parsed
    : ((parsed as { slides?: unknown }).slides as unknown);
  if (!Array.isArray(raw)) return null;

  const warnings: string[] = [];
  const LAYOUTS = ["cover", "split", "full", "steps", "stopContinueStart", "closing"];
  const slides: SlideSpec[] = [];

  raw.forEach((item, i) => {
    const s = item as Partial<SlideSpec>;
    if (!s || typeof s !== "object" || typeof s.headline !== "string") {
      warnings.push(`Slide ${i + 1} had no headline, so it was left out.`);
      return;
    }
    const layout = LAYOUTS.includes(String(s.layout)) ? s.layout! : "full";
    if (s.layout && layout !== s.layout) {
      warnings.push(`Slide ${i + 1} asked for layout "${s.layout}", which is not one of ours.`);
    }
    slides.push({ ...s, layout, headline: s.headline } as SlideSpec);
  });

  return slides.length ? { slides, warnings } : null;
}

/** Read a brief in whichever of the two shapes it arrived in. */
export function parseBrief(text: string): BriefResult {
  if (!text.trim()) return { slides: [], warnings: ["The brief was empty."] };
  return parseJson(text) ?? parseOutline(text);
}

/**
 * The prompt to hand an assistant, so what comes back is something this file
 * can read. It lives next to the parser on purpose: if the grammar changes,
 * the prompt changes in the same edit.
 */
export const PROPOSAL_PROMPT = `You are writing an advertising proposal deck for Advertising Excellence (ADEX), a UK media agency. I will give you the brief. Reply with the deck in the outline format below and NOTHING else — no preamble, no explanation.

The format:

# Deck title
A line under the title saying who it is for.

## Section name | The headline
A paragraph of argument, if the slide needs one.

figures:
1.4m = Adults reached
68% = Of the target audience

bullets:
- A point
- Another point

rows:
Commuter corridors - the M5 carries the audience past the sites twice a day
Clinic catchments - every site sits within a 20 minute drive

steps:
01. Launch burst - two weeks of OOH to build coverage
02. Digital sustain - search and social carry it between bursts

table:
Channel | Detail | Investment
OOH | 12 x 48-sheet, Birmingham | £18,400

stop:
- Something we should stop doing
continue:
- Something working
start:
- Something new

logos: Free Radio, Global, JCDecaux
strip: The single point this slide exists to make.
note: Rates requested

Rules that matter:

1. The HEADLINE is a claim, not a label. "Pay only to reach people on your own patch", never "Audience". A reader who reads only the headlines must still follow the argument.
2. NEVER invent a number, a rate, an audience figure, a source or a media owner. If a figure is needed and the source material does not give it, leave the value blank and add "note: Figures to be confirmed". Made-up numbers go to real clients and that is unacceptable.
3. Use only the blocks a slide needs. Most slides need one or two. Never put every block on one slide.
4. "logos:" takes media owner names only — the CRM supplies the images.
5. Aim for 6 to 12 slides. One slide per section of the source material, plus a cover.

How ADEX documents map onto these blocks — follow this, it is our house style:

- A numbered section heading ("01 Executive recommendation") becomes the "## Executive recommendation | <the claim it makes>".
- The sentence under a section heading that summarises it becomes the paragraph of argument.
- A figure strip — a row of labels in capitals with values underneath, like "LAUNCH MARKET / ILLUSTRATIVE ENVELOPE" — becomes "figures:", written as "€116,700 = Illustrative envelope".
- A callout in capitals ("SCENARIO ASSUMPTION ...", "TARGETING IMPLICATION ...", "PORTFOLIO CAVEAT ...") becomes "strip:" — it is the one point that slide exists to make. One per slide at most.
- Any table becomes "table:", first row the headings, columns separated by |. Keep it to four columns and six rows; cut the least useful column rather than squeezing.
- A "Source: ..." line becomes "note:". Carry the source through — never drop an attribution, and never attach one to a figure it did not come from.
- Where the material says what the client must decide or do next, that is the closing slide: "layout: closing" with bullets.

The source material:

`;
