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

import type { Bar, Column, Contact, Figure, SlideSpec } from "@/lib/proposal-theme";

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
  "cards",
  "callout",
  "chart",
  "brand",
  "contact",
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
/**
 * A separator between two parts of an outline line: a dash with a space on
 * either side, or a double hyphen. The spaces are the point. "£125k – £1.2m"
 * and "months 2–4" both contain a dash, and splitting there put the wrong
 * figure on a card and cut a next step in half. A dash typed as a separator
 * always has spaces round it; a dash inside a range never does.
 */
const SEP = /^(.+?)\s+(?:—|–|-{1,2})\s+(.+)$/;

function parseFigure(line: string): Figure | null {
  const t = debullet(line);
  // "=" is unambiguous, so it wins outright: "£125k – £1.2m = Lodge values"
  // is a range and a label, and must never be read as "£125k" and the rest.
  const eq = t.indexOf("=");
  if (eq > 0) {
    const value = t.slice(0, eq).trim();
    const label = t.slice(eq + 1).trim();
    return value && label ? { value, label } : null;
  }
  const m = t.match(SEP);
  return m ? { value: m[1].trim(), label: m[2].trim() } : null;
}

/** "01. Launch burst - two weeks of OOH", the number optional. */
function parseStep(line: string, index: number) {
  let s = debullet(line);
  // A trailing "| £50k" is the step's value, shown top right.
  let value: string | undefined;
  const bar = s.lastIndexOf("|");
  if (bar > 0) {
    value = s.slice(bar + 1).trim() || undefined;
    s = s.slice(0, bar).trim();
  }
  let label = String(index + 1).padStart(2, "0");
  const numbered = s.match(/^(\d{1,2})[.)]\s*(.*)$/);
  if (numbered) {
    label = numbered[1].padStart(2, "0");
    s = numbered[2];
  }
  const split = s.match(SEP);
  const step = split
    ? { label, title: split[1].trim(), detail: split[2].trim() }
    : { label, title: s.trim() };
  return value ? { ...step, value } : step;
}

/**
 * A card: "£35k = Amazon Prime Video | c. 897k impressions". A leading
 * "!" marks the one that matters — the total — which is drawn navy. "!"
 * rather than "*" because people and assistants both type "*" as a bullet.
 */
function parseCard(line: string): Figure | null {
  let t = line.trim();
  const emphasis = t.startsWith("!");
  if (emphasis) t = t.slice(1).trim();
  t = debullet(t);
  let note: string | undefined;
  const bar = t.indexOf("|");
  if (bar > 0) {
    note = t.slice(bar + 1).trim() || undefined;
    t = t.slice(0, bar).trim();
  }
  const f = parseFigure(t);
  if (!f) return null;
  return { ...f, ...(note ? { note } : {}), ...(emphasis ? { emphasis } : {}) };
}

/** A bar: "GB News = 197". The number may carry a % or commas. */
function parseBar(line: string): Bar | null {
  const m = debullet(line).match(/^(.+?)\s*(?:=|:|\u2014|\u2013|--|\s-\s)\s*([\d.,]+)\s*%?$/);
  if (!m) return null;
  const value = Number(m[2].replace(/,/g, ""));
  return Number.isFinite(value) ? { label: m[1].trim(), value } : null;
}

/** "Commuter corridors - the M5 carries them past twice a day". */
function parseIconRow(line: string) {
  const s = debullet(line);
  const m = s.match(SEP);
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
  cards: Figure[];
  callout: { heading?: string; lines: string[] } | null;
  chart: { heading?: string; bars: Bar[] } | null;
  brand?: string;
  contact?: Contact;
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
  cards: [],
  callout: null,
  chart: null,
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
    !p.steps.length &&
    !p.cards.length &&
    !p.chart?.bars.length &&
    !p.callout
  ) {
    return null;
  }

  const columns: Column[] = [];
  if (p.cards.length) columns.push({ kind: "cards", figures: p.cards });
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
  if (p.chart?.bars.length) {
    columns.push({ kind: "chart", heading: p.chart.heading, bars: p.chart.bars });
  }
  if (p.callout) {
    const text = p.callout.lines.join(" ").trim();
    if (text) columns.push({ kind: "callout", heading: p.callout.heading, text });
  }

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

  const sideBySide = columns.length - (columns[0]?.kind === "cards" && columns.length > 2 ? 1 : 0);
  if (sideBySide > 2) {
    warnings.push(
      `"${p.headline}" has ${sideBySide} blocks side by side — a slide holds two. The rest are still there; split the slide if it looks crowded.`
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
  if (p.brand) slide.brand = p.brand;
  if (p.contact) slide.contact = p.contact;
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
      if (key.key === "brand") {
        current.brand = key.rest || undefined;
        block = null;
        continue;
      }
      if (key.key === "contact") {
        // Name | Title | Phone | Email — any of the last three may be left out.
        const [name, title, phone, email] = key.rest.split("|").map((x) => x.trim());
        if (name) {
          current.contact = {
            name,
            ...(title ? { title } : {}),
            ...(phone ? { phone } : {}),
            ...(email ? { email } : {}),
          };
        }
        block = null;
        continue;
      }
      if (key.key === "callout") {
        // "callout: Heading" then lines of text, or "callout: Heading | text".
        const bar = key.rest.indexOf("|");
        current.callout =
          bar >= 0
            ? {
                heading: key.rest.slice(0, bar).trim() || undefined,
                lines: [key.rest.slice(bar + 1).trim()],
              }
            : { heading: key.rest || undefined, lines: [] };
        continue;
      }
      if (key.key === "chart") {
        // "chart: Strongest environments" — the rest of the line is its title.
        current.chart = { heading: key.rest || undefined, bars: [] };
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
    case "cards": {
      const c = parseCard(line);
      if (c) p.cards.push(c);
      else warnings.push(`Could not read "${line}" as a card — expected "£35k = Label | note".`);
      return;
    }
    case "callout":
      if (!p.callout) p.callout = { lines: [] };
      p.callout.lines.push(debullet(line));
      return;
    case "chart": {
      const b = parseBar(line);
      if (!p.chart) p.chart = { bars: [] };
      if (b) p.chart.bars.push(b);
      else warnings.push(`Could not read "${line}" as a bar — expected "GB News = 197".`);
      return;
    }
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
export const PROPOSAL_PROMPT = `You are writing an advertising proposal deck for Advertising Excellence (ADEX), a UK media agency. The source material follows at the end. Reply with the deck in the outline format below and NOTHING else — no preamble, no explanation, no code fences.

THE FORMAT

# Eyebrow | Deck title
A line under the title saying who it is for.

figures:
£200k = Total media investment

## Section | The headline
A paragraph of argument, if the slide needs one.

Each "## Section | Headline" starts a slide. Under it, use only the blocks that slide needs:

figures:            big numbers, set in type, no boxes
1.4m = Adults reached

cards:              numbers in boxes; "!" marks the one to take away, drawn navy
£35k = Amazon Prime Video | c. 897k impressions
! c. 4m = Gross impressions | Across the campaign

bullets:
- A point

rows:               numbered points, each a title and a detail
Commuter corridors - the M5 carries the audience past the sites twice a day

steps:              a sequence, with an optional value on each
01. Plug / Prime - Precision targeting + retargeting | £50k

table:              first row is the headings, columns separated by |
Channel | Detail | Investment
OOH | 12 x 48-sheet, Birmingham | £18,400

chart: Strongest environments — ABC1 50+ index
GB News = 197
Sky News = 180

callout: Why it's interesting
The paragraph that explains why the numbers above matter.

stop:               three columns — stop, continue, start
- Something we should stop
continue:
- Something working
start:
- Something new

brand: ITV           the media owner this slide is about; its logo goes in the header
logos: Free Radio, Global   several media owners' logos along the foot
strip: The single point this slide exists to make.
note: Source: TAM Ireland, July 2026
layout: closing      only on the final next-steps slide
contact: Kate Johnston | Account Director | 07886 677 122 | kate.johnston@advertisingexcellence.co.uk

THE RULES THAT MATTER

1. NEVER invent a number, a rate, an audience figure, a source, a media owner or a contact detail. If a figure is needed and the source material does not give it, leave the value blank and add "note: Figures to be confirmed". Made-up numbers reach real clients and that is unacceptable.
2. The HEADLINE is a claim, not a label. "Pay only to reach people on your own patch", never "Audience". Someone who reads only the headlines must still follow the argument.
3. Use only the blocks a slide needs — usually two or three. A slide holds two blocks side by side; a row of cards can sit across the top above them.
4. A separator inside a line is a dash with a space either side: "Title - detail". Write ranges without spaces: "2–4", "£125k–£1.2m".

CHOOSING THE FORMAT — what ADEX's own decks do

Pick the format for what the content IS, not for variety:

- A cost breakdown — spend per channel, per media owner, per line: use cards, one per line, and mark the total with "!". Lodges does this on every channel slide.
- One or two headline numbers that ARE the point of the slide: use figures. They read as a statement; cards read as a breakdown.
- A ranking, an index, a share or a comparison across five or more items: use chart. A table of numbers someone has to compare in their head is a chart waiting to happen.
- A sequence over time — a phased plan, a test month by month, a funnel: use steps, with the spend or timing as each step's value.
- A media plan with several columns of detail — channel, format, dates, cost: use table. Keep it to four columns and six rows; cut the least useful column rather than squeezing.
- How something works, or the reasons behind a choice: use rows. Two to five of them.
- The reasoning that sits beside the numbers — "Why it's interesting", "Before we book": use callout. One per slide at most, and only when there is genuine reasoning to give.
- The one sentence the slide exists to make: use strip. Rarely — not every slide has one.
- What should change, stay and begin: use stop / continue / start.
- A slide about one media owner's inventory: put that media owner in brand, so their logo sits in the header.
- Several media owners on one plan: name them in logos.

HOW AN ADEX DECK RUNS

1. A cover: the eyebrow names the client and the kind of proposal; the title is the proposition; figures carry the two or three numbers that frame it — total budget, duration, number of routes.
2. The opportunity or the brief, in the client's terms.
3. The audience — who, and where they are.
4. The approach, often as steps.
5. One slide per channel or media owner, each with brand set and its spend as cards.
6. How success will be judged.
7. A closing slide, "layout: closing", with the next steps as rows and the contact from the source material if it gives one.

Aim for 7 to 12 slides. One idea per slide.

HOW ADEX SOURCE DOCUMENTS MAP ONTO THIS

- A numbered section heading ("01 Executive recommendation") becomes "## Executive recommendation | <the claim it makes>".
- The sentence under a section heading that summarises it becomes the paragraph of argument.
- A strip of capitalised labels with values underneath ("LAUNCH MARKET / ILLUSTRATIVE ENVELOPE") becomes figures.
- A callout in capitals ("SCENARIO ASSUMPTION ...", "TARGETING IMPLICATION ...", "PORTFOLIO CAVEAT ...") becomes strip if it is one line, callout if it is a paragraph.
- Any table becomes table — or chart, if it is one column of numbers being compared.
- A "Source: ..." line becomes note. Carry every source through, and never attach a source to a figure it did not come from.
- Where the material says what the client must decide or do next, that is the closing slide.

The source material:

`;
