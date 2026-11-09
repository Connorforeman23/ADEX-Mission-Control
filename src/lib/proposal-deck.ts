import "server-only";

import fs from "node:fs";
import path from "node:path";
import PptxGenJS from "pptxgenjs";
import {
  BRAND,
  FONTS,
  type Column,
  type DeckSpec,
  type Figure,
  type IconRow,
  type SlideSpec,
} from "@/lib/proposal-theme";

// Builds an ADEX proposal deck.
//
// The design lives here, not in whatever writes the words. Claude supplies
// headlines, figures and arguments; this file decides what an ADEX slide looks
// like, so every proposal comes out looking like ADEX made it.
//
// Rebuilt after comparing the first attempt against Affinity Water and Benson
// Goldstein. The first was all grey cards. The real decks are typographic:
// figures stand alone with a small-caps label, points sit in numbered navy
// discs, sub-headings are pink, and the one thing that matters goes in a navy
// strip. Boxes are the exception, not the layout.

const M = 0.62;
const W = 13.333;
const H = 7.5;
const HEAD_BOTTOM = 1.72; // where content may start under the headline block

function asset(file: string) {
  try {
    const p = path.join(process.cwd(), "public", "brand", file);
    return "image/png;base64," + fs.readFileSync(p).toString("base64");
  } catch {
    return null;
  }
}

/**
 * The pixel size of a PNG data URI, read straight out of the IHDR chunk.
 *
 * Needed because pptxgenjs cannot measure a pre-encoded image: given a box
 * it stretches the picture to fill it, which turns a square logo into a
 * smear. Every logo the CRM stores is a PNG, so the width and height are the
 * eight bytes at offset 16. Anything else returns null and the caller falls
 * back to the box.
 */
function pngSize(dataUri: string): { w: number; h: number } | null {
  try {
    const base64 = dataUri.slice(dataUri.indexOf("base64,") + 7);
    const head = Buffer.from(base64.slice(0, 64), "base64");
    if (head.length < 24 || head.toString("ascii", 12, 16) !== "IHDR") return null;
    const w = head.readUInt32BE(16);
    const h = head.readUInt32BE(20);
    return w > 0 && h > 0 ? { w, h } : null;
  } catch {
    return null;
  }
}

/**
 * Letterbox an image inside a box: the same proportions it came with,
 * centred, never larger than the space allowed.
 */
function fitted(dataUri: string, x: number, y: number, w: number, h: number) {
  const size = pngSize(dataUri);
  if (!size) return { data: dataUri, x, y, w, h };
  const scale = Math.min(w / size.w, h / size.h);
  const fw = size.w * scale;
  const fh = size.h * scale;
  return { data: dataUri, x: x + (w - fw) / 2, y: y + (h - fh) / 2, w: fw, h: fh };
}

// --- the pieces ----------------------------------------------------------

/**
 * Roughly how many lines a string takes in a box of this width.
 *
 * PowerPoint does the real wrapping, so this only has to be close enough to
 * stop a long headline sitting on top of the content below it. The constant
 * is Calibri's average advance width as a fraction of its point size,
 * measured against headlines that actually wrapped.
 */
function wrappedLines(text: string, widthIn: number, fontSize: number) {
  const perLine = Math.max(8, Math.floor(widthIn / (fontSize * 0.0064)));
  return text
    .split("\n")
    .reduce((n, para) => n + Math.max(1, Math.ceil(para.length / perLine)), 0);
}

/**
 * Eyebrow in pink caps, headline in bold navy, optional standfirst.
 *
 * Returns the y the content may start at. A two-line headline used to be
 * drawn over the top of whatever came next, because the content always began
 * at a fixed height — which only looked right while every headline was short.
 */
function heading(slide: PptxGenJS.Slide, s: SlideSpec, dark: boolean): number {
  const ink = dark ? BRAND.white : BRAND.ink;
  const textW = W - M * 2 - 1.5;
  const headTop = s.eyebrow ? 0.72 : 0.52;
  const headH = wrappedLines(s.headline, textW, 31) * 0.52;
  if (s.eyebrow) {
    slide.addText(s.eyebrow.toUpperCase(), {
      x: M,
      y: 0.42,
      w: W - M * 2 - 1.5,
      h: 0.28,
      isTextBox: true,
      margin: 0,
      fontFace: FONTS.body,
      fontSize: 11,
      bold: true,
      charSpacing: 2.6,
      color: BRAND.pink,
    });
  }
  slide.addText(s.headline, {
    x: M,
    y: headTop,
    w: textW,
    h: Math.max(0.7, headH),
    isTextBox: true,
    margin: 0,
    fontFace: FONTS.heading,
    fontSize: 31,
    bold: true,
    color: ink,
    valign: "top",
  });

  let bottom = headTop + Math.max(0.7, headH);
  if (s.standfirst) {
    const sfH = wrappedLines(s.standfirst, textW, 13) * 0.23;
    slide.addText(s.standfirst, {
      x: M,
      y: bottom + 0.04,
      w: textW,
      h: Math.max(0.34, sfH),
      isTextBox: true,
      margin: 0,
      fontFace: FONTS.body,
      fontSize: 13,
      color: dark ? BRAND.line : BRAND.slate,
    });
    bottom += 0.04 + Math.max(0.34, sfH);
  }
  return bottom + 0.3;
}

/**
 * Figures as the real decks set them: the number large, the label in small
 * caps beneath. No box — the number is the thing.
 */
function figures(
  slide: PptxGenJS.Slide,
  list: Figure[],
  x: number,
  y: number,
  w: number,
  dark: boolean,
  size = 30
) {
  const n = Math.min(list.length, 5);
  const each = w / n;
  list.slice(0, n).forEach((f, i) => {
    const fx = x + i * each;
    slide.addText(f.value, {
      x: fx,
      y,
      w: each - 0.12,
      h: 0.58,
      isTextBox: true,
      margin: 0,
      fontFace: FONTS.heading,
      fontSize: size,
      bold: true,
      color: dark ? BRAND.blue : BRAND.ink,
    });
    slide.addText(f.label.toUpperCase(), {
      x: fx,
      y: y + 0.6,
      w: each - 0.12,
      h: 0.42,
      isTextBox: true,
      margin: 0,
      fontFace: FONTS.body,
      fontSize: 9,
      bold: true,
      charSpacing: 1.3,
      color: dark ? BRAND.line : BRAND.label,
      valign: "top",
    });
    if (f.note) {
      slide.addText(f.note, {
        x: fx,
        y: y + 1.0,
        w: each - 0.12,
        h: 0.3,
        isTextBox: true,
        margin: 0,
        fontFace: FONTS.body,
        fontSize: 10.5,
        color: dark ? BRAND.line : BRAND.slate,
      });
    }
  });
}

/** A pink sub-heading — "The problem", "How we buy it". */
function subhead(slide: PptxGenJS.Slide, text: string, x: number, y: number, w: number) {
  slide.addText(text, {
    x,
    y,
    w,
    h: 0.34,
    isTextBox: true,
    margin: 0,
    fontFace: FONTS.heading,
    fontSize: 15.5,
    bold: true,
    color: BRAND.pink,
  });
}

/**
 * Numbered navy discs with a bold label and grey detail — the Affinity
 * "how we buy it" pattern. Numbers rather than pictograms: they carry the same
 * weight, match the decks' own "IDEA 01" habit, and can never arrive as the
 * wrong icon.
 */
function iconRows(slide: PptxGenJS.Slide, rows: IconRow[], x: number, y: number, w: number) {
  const gap = 0.74;
  rows.slice(0, 5).forEach((r, i) => {
    const ry = y + i * gap;
    slide.addShape("ellipse", {
      x,
      y: ry,
      w: 0.52,
      h: 0.52,
      fill: { color: BRAND.ink },
      line: { type: "none" },
    });
    slide.addText(String(i + 1).padStart(2, "0"), {
      x,
      y: ry + 0.11,
      w: 0.52,
      h: 0.3,
      isTextBox: true,
      margin: 0,
      align: "center",
      fontFace: FONTS.body,
      fontSize: 11,
      bold: true,
      color: BRAND.white,
    });
    slide.addText(
      [
        { text: r.label, options: { bold: true, color: BRAND.ink } },
        { text: "   " + r.detail, options: { color: BRAND.slate } },
      ],
      {
        x: x + 0.72,
        y: ry + 0.02,
        w: w - 0.72,
        h: 0.6,
        isTextBox: true,
        margin: 0,
        fontFace: FONTS.body,
        fontSize: 12.5,
        valign: "top",
      }
    );
  });
}

/** The quiet striped table the decks use — no heavy grid. */
function table(slide: PptxGenJS.Slide, rows: string[][], x: number, y: number, w: number) {
  const [head, ...body] = rows;
  const cols = head.length;
  // The first column carries the name and earns more room.
  const first = cols > 1 ? w * 0.34 : w;
  const rest = cols > 1 ? (w - first) / (cols - 1) : 0;
  const alignOf = (i: number) => (i > 0 && i === cols - 1 ? "right" : "left") as "right" | "left";

  slide.addTable(
    [
      head.map((h, i) => ({
        text: h.toUpperCase(),
        options: {
          bold: true,
          fontSize: 9,
          charSpacing: 1.2,
          color: BRAND.label,
          fontFace: FONTS.body,
          align: alignOf(i),
        },
      })),
      ...body.map((r, ri) =>
        r.map((c, i) => ({
          text: c,
          options: {
            fontSize: 11.5,
            bold: i === 0,
            color: i === 0 ? BRAND.ink : BRAND.slate,
            fontFace: FONTS.body,
            fill: { color: ri % 2 ? BRAND.wash : BRAND.white },
            align: alignOf(i),
          },
        }))
      ),
    ],
    {
      x,
      y,
      w,
      colW: [first, ...Array(Math.max(0, cols - 1)).fill(rest)],
      border: { type: "none" },
      margin: 7,
      rowH: 0.33,
    }
  );
}

/** The navy strip: the one point the slide exists to make. */
function strip(slide: PptxGenJS.Slide, text: string, x: number, y: number, w: number) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h: 0.52,
    rectRadius: 0.04,
    fill: { color: BRAND.ink },
    line: { type: "none" },
  });
  slide.addText(text, {
    x: x + 0.22,
    y: y + 0.08,
    w: w - 0.44,
    h: 0.36,
    isTextBox: true,
    margin: 0,
    fontFace: FONTS.body,
    fontSize: 12,
    bold: true,
    color: BRAND.white,
  });
}

/**
  * Media owner logos along the foot, as Benson Goldstein does under the TV
  * slide. The CRM holds a logo against each supplier, so these arrive without
  * anyone sourcing them; a supplier with no logo yet falls back to its name
  * set in grey, which still reads deliberately.
  */
function logoRow(
  slide: PptxGenJS.Slide,
  names: string[],
  y: number,
  logos: Record<string, string> = {}
) {
  const n = Math.min(names.length, 6);
  const w = (W - M * 2) / n;
  names.slice(0, n).forEach((name, i) => {
    const art = logos[name.trim().toLowerCase()];
    const x = M + i * w;
    if (art) {
      // Boxed into a consistent height so a tall logo cannot tower over a wide
      // one — the row has to read as a row — and fitted rather than stretched,
      // so a square logo stays square.
      const boxW = w * 0.72;
      slide.addImage(fitted(art, x + (w - boxW) / 2, y - 0.08, boxW, 0.5));
      return;
    }
    slide.addText(name.toUpperCase(), {
      x,
      y,
      w,
      h: 0.34,
      isTextBox: true,
      margin: 0,
      align: "center",
      fontFace: FONTS.heading,
      fontSize: 15,
      bold: true,
      color: BRAND.line,
      charSpacing: 0.6,
    });
  });
}

function footer(slide: PptxGenJS.Slide, deck: DeckSpec, n: number) {
  slide.addText(
    ["Advertising Excellence", deck.clientDomain || deck.client, "Private & Confidential"].join(
      "   |   "
    ),
    {
      x: M,
      y: H - 0.42,
      w: W - M * 2 - 0.5,
      h: 0.24,
      isTextBox: true,
      margin: 0,
      fontFace: FONTS.body,
      fontSize: 8.5,
      color: BRAND.label,
    }
  );
  slide.addText(String(n), {
    x: W - M - 0.5,
    y: H - 0.42,
    w: 0.5,
    h: 0.24,
    isTextBox: true,
    margin: 0,
    align: "right",
    fontFace: FONTS.body,
    fontSize: 8.5,
    color: BRAND.label,
  });
}

function mark(slide: PptxGenJS.Slide, data: string | null, dark: boolean) {
  if (!data) return;
  const w = 0.96;
  const h = 0.65;
  const x = W - M - w;
  const y = 0.4;
  if (dark) {
    slide.addShape("roundRect", {
      x: x - 0.12,
      y: y - 0.1,
      w: w + 0.24,
      h: h + 0.2,
      rectRadius: 0.05,
      fill: { color: BRAND.white },
      line: { type: "none" },
    });
  }
  slide.addImage({ data, x, y, w, h });
}

/** Soft brand geometry bleeding off the edges, as the Benson cover does. */
function coverGeometry(slide: PptxGenJS.Slide) {
  slide.addShape("ellipse", {
    x: W - 3.1,
    y: -2.0,
    w: 5.2,
    h: 5.2,
    fill: { color: BRAND.pink, transparency: 84 },
    line: { type: "none" },
  });
  slide.addShape("ellipse", {
    x: W - 2.0,
    y: -1.1,
    w: 3.0,
    h: 3.0,
    fill: { color: BRAND.pink, transparency: 72 },
    line: { type: "none" },
  });
  slide.addShape("ellipse", {
    x: -2.4,
    y: H - 2.6,
    w: 4.6,
    h: 4.6,
    fill: { color: BRAND.blue, transparency: 86 },
    line: { type: "none" },
  });
}

/** One column of a split, or the single column of a full-width slide. */
function column(slide: PptxGenJS.Slide, col: Column, x: number, y: number, w: number) {
  let cy = y;
  if ("heading" in col && col.heading) {
    subhead(slide, col.heading, x, cy, w);
    cy += 0.46;
  }
  switch (col.kind) {
    case "prose":
      slide.addText(col.text, {
        x,
        y: cy,
        w,
        h: 1.9,
        isTextBox: true,
        margin: 0,
        fontFace: FONTS.body,
        fontSize: 13,
        color: BRAND.slate,
        valign: "top",
        lineSpacingMultiple: 1.2,
      });
      return cy + 2.0;
    case "iconRows":
      iconRows(slide, col.rows, x, cy, w);
      return cy + col.rows.length * 0.74 + 0.1;
    case "figures":
      figures(slide, col.figures, x, cy, w, false, 27);
      return cy + 1.3;
    case "table":
      table(slide, col.rows, x, cy, w);
      return cy + col.rows.length * 0.33 + 0.2;
    case "bullets":
      slide.addText(
        col.items.map((t, i) => ({
          text: t,
          options: { bullet: true, breakLine: i < col.items.length - 1 },
        })),
        {
          x,
          y: cy,
          w,
          h: 2.4,
          isTextBox: true,
          margin: 0,
          fontFace: FONTS.body,
          fontSize: 12.5,
          color: BRAND.ink,
          paraSpaceAfter: 7,
          valign: "top",
        }
      );
      return cy + 2.5;
    case "image": {
      const h = 2.9;
      if (col.dataUri) {
        slide.addImage({ data: col.dataUri, x, y: cy, w, h, sizing: { type: "cover", w, h } });
      } else {
        // A visible slot, so the author knows exactly where the picture goes.
        slide.addShape("roundRect", {
          x,
          y: cy,
          w,
          h,
          rectRadius: 0.04,
          fill: { color: BRAND.wash },
          line: { color: BRAND.line, width: 0.75, dashType: "dash" },
        });
        slide.addText("Drop an image here", {
          x,
          y: cy + h / 2 - 0.2,
          w,
          h: 0.4,
          isTextBox: true,
          margin: 0,
          align: "center",
          fontFace: FONTS.body,
          fontSize: 12,
          color: BRAND.label,
        });
      }
      if (col.caption) {
        slide.addText(col.caption, {
          x,
          y: cy + h + 0.08,
          w,
          h: 0.26,
          isTextBox: true,
          margin: 0,
          fontFace: FONTS.body,
          fontSize: 9,
          color: BRAND.label,
        });
      }
      return cy + h + 0.4;
    }
  }
}

// --- the deck ------------------------------------------------------------

export async function buildProposalDeck(deck: DeckSpec): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "Advertising Excellence";
  pres.company = "Advertising Excellence";
  pres.title = `${deck.client} — ${deck.title}`;
  pres.theme = { headFontFace: FONTS.heading, bodyFontFace: FONTS.body };

  const brandMark = asset("adex-logo.png");
  let page = 0;

  for (const s of deck.slides) {
    const dark = s.layout === "cover" || s.layout === "closing";
    const slide = pres.addSlide();
    slide.background = { color: dark ? BRAND.ink : BRAND.white };

    // --- cover and closing ----------------------------------------------
    if (dark) {
      coverGeometry(slide);

      if (brandMark) slide.addImage({ data: brandMark, x: M, y: 0.72, w: 1.32, h: 0.9 });
      if (deck.clientLogo) {
        slide.addImage(fitted(deck.clientLogo, M + 1.62, 0.72, 1.9, 0.9));
      }

      if (s.eyebrow) {
        slide.addText(s.eyebrow.toUpperCase(), {
          x: M,
          y: 2.42,
          w: W - M * 2,
          h: 0.3,
          isTextBox: true,
          margin: 0,
          fontFace: FONTS.body,
          fontSize: 11.5,
          bold: true,
          charSpacing: 2.8,
          color: BRAND.blue,
        });
      }
      slide.addText(s.headline, {
        x: M,
        y: 2.78,
        w: 8.6,
        h: 1.5,
        isTextBox: true,
        margin: 0,
        fontFace: FONTS.heading,
        fontSize: 42,
        bold: true,
        color: BRAND.white,
        valign: "top",
      });
      // The short pink rule under the headline, as on the Benson cover.
      slide.addShape("rect", {
        x: M,
        y: 4.36,
        w: 1.5,
        h: 0.045,
        fill: { color: BRAND.pink },
        line: { type: "none" },
      });

      if (s.figures?.length) {
        // Stacked, number left and label right — the Benson treatment.
        s.figures.slice(0, 4).forEach((f, i) => {
          const fy = 4.7 + i * 0.56;
          slide.addText(f.value, {
            x: M,
            y: fy,
            w: 2.3,
            h: 0.44,
            isTextBox: true,
            margin: 0,
            fontFace: FONTS.heading,
            fontSize: 21,
            bold: true,
            color: BRAND.blue,
          });
          slide.addText(f.label, {
            x: M + 2.45,
            y: fy + 0.08,
            w: 4.6,
            h: 0.34,
            isTextBox: true,
            margin: 0,
            fontFace: FONTS.body,
            fontSize: 12.5,
            color: BRAND.line,
          });
        });
      }

      if (s.standfirst) {
        slide.addText(s.standfirst, {
          x: M,
          y: H - 1.08,
          w: 7.8,
          h: 0.6,
          isTextBox: true,
          margin: 0,
          fontFace: FONTS.body,
          fontSize: 12,
          color: BRAND.label,
          valign: "top",
        });
      }
      continue;
    }

    // --- content ---------------------------------------------------------
    page++;
    mark(slide, brandMark, false);
    const headBottom = heading(slide, s, false);

    // The old fixed start is the floor, so slides with a one-line headline sit
    // exactly where they always did; a longer headline pushes the content down
    // rather than being drawn over it.
    let y = Math.max(s.standfirst ? HEAD_BOTTOM + 0.22 : HEAD_BOTTOM, headBottom);

    if (s.figures?.length) {
      figures(slide, s.figures, M, y, W - M * 2 - 1.2, false);
      y += 1.34;
    }

    if (s.layout === "split" && s.columns?.length) {
      const gap = 0.7;
      const colW = (W - M * 2 - gap) / 2;
      const leftEnd = column(slide, s.columns[0], M, y, colW);
      const rightEnd = s.columns[1] ? column(slide, s.columns[1], M + colW + gap, y, colW) : y;
      y = Math.max(leftEnd, rightEnd);
    } else if (s.columns?.length) {
      y = column(slide, s.columns[0], M, y, W - M * 2);
    }

    if (s.steps?.length) {
      const n = Math.min(s.steps.length, 5);
      const gap = 0.26;
      const w = (W - M * 2 - gap * (n - 1)) / n;
      s.steps.slice(0, n).forEach((st, i) => {
        const x = M + i * (w + gap);
        slide.addText(st.label.toUpperCase(), {
          x,
          y,
          w,
          h: 0.26,
          isTextBox: true,
          margin: 0,
          fontFace: FONTS.body,
          fontSize: 9,
          bold: true,
          charSpacing: 1.4,
          color: BRAND.pink,
        });
        slide.addText(st.title, {
          x,
          y: y + 0.3,
          w,
          h: 0.46,
          isTextBox: true,
          margin: 0,
          fontFace: FONTS.heading,
          fontSize: 17,
          bold: true,
          color: BRAND.ink,
        });
        slide.addShape("rect", {
          x,
          y: y + 0.82,
          w: w * 0.42,
          h: 0.035,
          fill: { color: BRAND.line },
          line: { type: "none" },
        });
        if (st.detail) {
          slide.addText(st.detail, {
            x,
            y: y + 0.96,
            w,
            h: 0.8,
            isTextBox: true,
            margin: 0,
            fontFace: FONTS.body,
            fontSize: 11.5,
            color: BRAND.slate,
            valign: "top",
          });
        }
      });
      y += 2.0;
    }

    if (s.lists?.length) {
      const n = Math.min(s.lists.length, 3);
      const gap = 0.5;
      const w = (W - M * 2 - gap * (n - 1)) / n;
      const tint = [BRAND.pink, BRAND.blue, BRAND.ink];
      s.lists.slice(0, n).forEach((col, i) => {
        const x = M + i * (w + gap);
        slide.addText(col.title.toUpperCase(), {
          x,
          y,
          w,
          h: 0.32,
          isTextBox: true,
          margin: 0,
          fontFace: FONTS.body,
          fontSize: 11.5,
          bold: true,
          charSpacing: 1.8,
          color: tint[i % tint.length],
        });
        slide.addShape("rect", {
          x,
          y: y + 0.36,
          w,
          h: 0.035,
          fill: { color: tint[i % tint.length] },
          line: { color: tint[i % tint.length], width: 0 },
        });
        slide.addText(
          col.items.map((t, k) => ({
            text: t,
            options: { bullet: true, breakLine: k < col.items.length - 1 },
          })),
          {
            x,
            y: y + 0.52,
            w,
            h: 2.8,
            isTextBox: true,
            margin: 0,
            fontFace: FONTS.body,
            fontSize: 12,
            color: BRAND.ink,
            paraSpaceAfter: 7,
            valign: "top",
          }
        );
      });
      y += 3.3;
    }

    if (s.logos?.length) logoRow(slide, s.logos, H - 1.34, deck.supplierLogos ?? {});
    if (s.footnote) {
      slide.addText(s.footnote, {
        x: M,
        y: H - 0.76,
        w: W - M * 2,
        h: 0.24,
        isTextBox: true,
        margin: 0,
        fontFace: FONTS.body,
        fontSize: 9,
        italic: true,
        color: BRAND.label,
      });
    }
    if (s.strip) {
      const stripY = Math.min(y + 0.14, H - (s.footnote ? 1.46 : 1.12));
      strip(slide, s.strip, M, stripY, W - M * 2);
    }

    footer(slide, deck, page);
  }

  const out = (await pres.write({ outputType: "nodebuffer" })) as unknown as Buffer;
  return out;
}
