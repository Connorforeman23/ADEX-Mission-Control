import "server-only";

import fs from "node:fs";
import path from "node:path";
import PptxGenJS from "pptxgenjs";
import { BRAND, FONTS, type DeckSpec, type SlideSpec } from "@/lib/proposal-theme";

// Builds an ADEX proposal deck.
//
// The design lives here, not in whatever writes the words. That is the whole
// point: Claude supplies headlines, figures and takeaways; this file decides
// what an ADEX slide looks like. So every proposal comes out looking like ADEX
// made it, because ADEX did.
//
// The frames below are the ones the real decks use. Adding a new kind of slide
// means adding a frame here, deliberately — not letting a generator invent one.

const M = 0.62; // page margin
const W = 13.333;
const H = 7.5;
const CONTENT_TOP = 2.05; // under the eyebrow / headline / standfirst block
const TAKEAWAY_H = 0.98; // two lines of takeaway fit without crowding
const TAKEAWAY_Y = H - 1.72;
const FOOTNOTE_Y = TAKEAWAY_Y - 0.3; // clear of the takeaway above it

function logo() {
  try {
    const p = path.join(process.cwd(), "public", "brand", "adex-logo.png");
    return "image/png;base64," + fs.readFileSync(p).toString("base64");
  } catch {
    return null;
  }
}

/** Eyebrow, headline and standfirst — the top of every content slide. */
function heading(slide: PptxGenJS.Slide, s: SlideSpec, dark = false) {
  const ink = dark ? BRAND.white : BRAND.ink;
  const quiet = dark ? BRAND.line : BRAND.slate;

  if (s.eyebrow) {
    slide.addText(s.eyebrow.toUpperCase(), {
      x: M,
      y: 0.46,
      w: W - M * 2 - 1.6,
      h: 0.3,
      isTextBox: true,
      margin: 0,
      fontFace: FONTS.body,
      fontSize: 11,
      bold: true,
      charSpacing: 2.4,
      color: BRAND.pink,
    });
  }

  slide.addText(s.headline, {
    x: M,
    y: s.eyebrow ? 0.8 : 0.6,
    w: W - M * 2 - 1.6,
    h: 0.78,
    isTextBox: true,
    margin: 0,
    fontFace: FONTS.heading,
    fontSize: 30,
    bold: true,
    color: ink,
    valign: "top",
  });

  if (s.standfirst) {
    slide.addText(s.standfirst, {
      x: M,
      y: 1.58,
      w: W - M * 2 - 1.6,
      h: 0.38,
      isTextBox: true,
      margin: 0,
      fontFace: FONTS.body,
      fontSize: 13.5,
      color: quiet,
    });
  }
}

/** The KEY TAKEAWAY strip — on nearly every real slide, and the best habit. */
function takeaway(slide: PptxGenJS.Slide, text: string, dark = false) {
  const y = TAKEAWAY_Y;
  slide.addShape("roundRect", {
    x: M,
    y,
    w: W - M * 2,
    h: TAKEAWAY_H,
    rectRadius: 0.06,
    fill: { color: dark ? BRAND.inkSoft : BRAND.wash },
    line: { color: dark ? BRAND.inkSoft : BRAND.line, width: 0.75 },
  });
  slide.addText("KEY TAKEAWAY", {
    x: M + 0.22,
    y: y + 0.1,
    w: 1.6,
    h: 0.22,
    isTextBox: true,
    margin: 0,
    fontFace: FONTS.body,
    fontSize: 9,
    bold: true,
    charSpacing: 1.8,
    color: BRAND.pink,
  });
  slide.addText(text, {
    x: M + 0.22,
    y: y + 0.32,
    w: W - M * 2 - 0.44,
    h: TAKEAWAY_H - 0.42,
    isTextBox: true,
    margin: 0,
    fontFace: FONTS.body,
    fontSize: 12.5,
    color: dark ? BRAND.white : BRAND.ink,
  });
}

/** Footer: ADEX, the client, confidentiality and the page number. */
function footer(slide: PptxGenJS.Slide, deck: DeckSpec, n: number, dark = false) {
  const parts = ["Advertising Excellence", deck.clientDomain || deck.client, "Private & Confidential"];
  slide.addText(parts.join("   |   "), {
    x: M,
    y: H - 0.45,
    w: W - M * 2 - 0.5,
    h: 0.25,
    isTextBox: true,
    margin: 0,
    fontFace: FONTS.body,
    fontSize: 8.5,
    color: dark ? BRAND.slate : BRAND.slate,
  });
  slide.addText(String(n), {
    x: W - M - 0.5,
    y: H - 0.45,
    w: 0.5,
    h: 0.25,
    isTextBox: true,
    margin: 0,
    align: "right",
    fontFace: FONTS.body,
    fontSize: 8.5,
    color: BRAND.slate,
  });
}

/** The mark, top right on every slide — Connor: on every one, where it fits. */
function mark(slide: PptxGenJS.Slide, data: string | null, dark = false) {
  if (!data) return;
  const w = 1.12;
  const h = 0.75;
  const x = W - M - w;
  const y = 0.42;
  // The logo is a black oval, so on a dark slide it needs a plate to sit on.
  if (dark) {
    slide.addShape("roundRect", {
      x: x - 0.14,
      y: y - 0.12,
      w: w + 0.28,
      h: h + 0.24,
      rectRadius: 0.06,
      fill: { color: BRAND.white },
      line: { color: BRAND.white, width: 0 },
    });
  }
  slide.addImage({ data, x, y, w, h });
}

/** A figure callout: the big number with its label, as the decks use. */
function figures(
  slide: PptxGenJS.Slide,
  list: NonNullable<SlideSpec["figures"]>,
  y: number,
  dark = false
) {
  const n = Math.min(list.length, 5);
  const gap = 0.18;
  const w = (W - M * 2 - gap * (n - 1)) / n;
  list.slice(0, n).forEach((f, i) => {
    const x = M + i * (w + gap);
    slide.addShape("roundRect", {
      x,
      y,
      w,
      h: 1.5,
      rectRadius: 0.06,
      fill: { color: dark ? BRAND.inkSoft : BRAND.white },
      line: { color: dark ? BRAND.inkSoft : BRAND.line, width: 0.75 },
    });
    slide.addText(f.value, {
      x: x + 0.16,
      y: y + 0.18,
      w: w - 0.32,
      h: 0.62,
      isTextBox: true,
      margin: 0,
      fontFace: FONTS.heading,
      fontSize: 30,
      bold: true,
      color: BRAND.pink,
    });
    slide.addText(f.label.toUpperCase(), {
      x: x + 0.16,
      y: y + 0.82,
      w: w - 0.32,
      h: 0.3,
      isTextBox: true,
      margin: 0,
      fontFace: FONTS.body,
      fontSize: 9,
      bold: true,
      charSpacing: 1.2,
      color: dark ? BRAND.line : BRAND.slate,
    });
    if (f.note) {
      slide.addText(f.note, {
        x: x + 0.16,
        y: y + 1.1,
        w: w - 0.32,
        h: 0.3,
        isTextBox: true,
        margin: 0,
        fontFace: FONTS.body,
        fontSize: 10,
        color: dark ? BRAND.line : BRAND.slate,
      });
    }
  });
}

/** Points in cards — "WHY IT'S INTERESTING" on the real decks. */
function points(
  slide: PptxGenJS.Slide,
  list: NonNullable<SlideSpec["points"]>,
  y: number,
  dark = false
) {
  const n = Math.min(list.length, 4);
  const gap = 0.2;
  const w = (W - M * 2 - gap * (n - 1)) / n;
  list.slice(0, n).forEach((pt, i) => {
    const x = M + i * (w + gap);
    slide.addShape("roundRect", {
      x,
      y,
      w,
      h: 1.9,
      rectRadius: 0.06,
      fill: { color: dark ? BRAND.inkSoft : BRAND.wash },
      line: { color: dark ? BRAND.inkSoft : BRAND.line, width: 0.75 },
    });
    slide.addText(pt.title.toUpperCase(), {
      x: x + 0.18,
      y: y + 0.2,
      w: w - 0.36,
      h: 0.46,
      isTextBox: true,
      margin: 0,
      fontFace: FONTS.body,
      fontSize: 10,
      bold: true,
      charSpacing: 1.2,
      color: BRAND.blue,
    });
    slide.addText(pt.detail, {
      x: x + 0.18,
      y: y + 0.66,
      w: w - 0.36,
      h: 1.1,
      isTextBox: true,
      margin: 0,
      fontFace: FONTS.body,
      fontSize: 11.5,
      color: dark ? BRAND.white : BRAND.ink,
      valign: "top",
    });
  });
}

export async function buildProposalDeck(deck: DeckSpec): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pres.author = "Advertising Excellence";
  pres.company = "Advertising Excellence";
  pres.title = `${deck.client} — ${deck.title}`;
  pres.theme = { headFontFace: FONTS.heading, bodyFontFace: FONTS.body };

  const brandMark = logo();
  let page = 0;

  for (const s of deck.slides) {
    const dark = s.layout === "cover" || s.layout === "closing";
    const slide = pres.addSlide();
    slide.background = { color: dark ? BRAND.ink : BRAND.white };

    // --- cover -----------------------------------------------------------
    if (s.layout === "cover") {
      slide.addShape("rect", {
        x: 0,
        y: 0,
        w: W,
        h: H,
        fill: { color: BRAND.ink },
      });
      if (brandMark) slide.addImage({ data: brandMark, x: M, y: M, w: 1.7, h: 1.14 });

      if (s.eyebrow) {
        slide.addText(s.eyebrow.toUpperCase(), {
          x: M,
          y: 2.5,
          w: W - M * 2,
          h: 0.3,
          isTextBox: true,
          margin: 0,
          fontFace: FONTS.body,
          fontSize: 11.5,
          bold: true,
          charSpacing: 2.6,
          color: BRAND.blue,
        });
      }
      slide.addText(s.headline, {
        x: M,
        y: 2.88,
        w: W - M * 2 - 1,
        h: 1.5,
        isTextBox: true,
        margin: 0,
        fontFace: FONTS.heading,
        fontSize: 44,
        bold: true,
        color: BRAND.white,
      });
      if (s.standfirst) {
        slide.addText(s.standfirst, {
          x: M,
          y: 4.45,
          w: W - M * 2 - 2.5,
          h: 0.9,
          isTextBox: true,
          margin: 0,
          fontFace: FONTS.body,
          fontSize: 15,
          color: BRAND.line,
        });
      }
      slide.addText(`Prepared for ${deck.client}`, {
        x: M,
        y: 5.26,
        w: W - M * 2,
        h: 0.3,
        isTextBox: true,
        margin: 0,
        fontFace: FONTS.body,
        fontSize: 10.5,
        color: BRAND.slate,
      });
      // Clear of the slide foot: the cards are 1.5 tall.
      if (s.figures?.length) figures(slide, s.figures, 5.6, true);
      continue;
    }

    page++;
    mark(slide, brandMark, dark);
    heading(slide, s, dark);

    // How tall the content will be, so a short slide sits centred rather than
    // leaving a lake of white above the takeaway.
    const blocks =
      (s.figures?.length ? 1.78 : 0) +
      (s.steps?.length ? 2.0 : 0) +
      (s.rows?.length ? 0.34 * s.rows.length + 0.3 : 0) +
      (s.columns?.length ? 3.5 : 0) +
      (s.points?.length ? 2.1 : 0);
    const room =
      (s.takeaway ? TAKEAWAY_Y : H - 0.7) - CONTENT_TOP - (s.footnote ? 0.34 : 0.1);
    // A third of the slack above, the rest below: content sits high, which
    // reads better than dead-centre.
    let y = CONTENT_TOP + Math.max(0, (room - blocks) * 0.34);

    if (s.figures?.length) {
      figures(slide, s.figures, y, dark);
      y += 1.78;
    }

    if (s.steps?.length) {
      const n = Math.min(s.steps.length, 5);
      const gap = 0.16;
      const w = (W - M * 2 - gap * (n - 1)) / n;
      s.steps.slice(0, n).forEach((st, i) => {
        const x = M + i * (w + gap);
        slide.addShape("roundRect", {
          x,
          y,
          w,
          h: 1.72,
          rectRadius: 0.06,
          fill: { color: i === 0 ? BRAND.pink : BRAND.wash },
          line: { color: i === 0 ? BRAND.pink : BRAND.line, width: 0.75 },
        });
        slide.addText(st.label.toUpperCase(), {
          x: x + 0.16,
          y: y + 0.16,
          w: w - 0.32,
          h: 0.26,
          isTextBox: true,
          margin: 0,
          fontFace: FONTS.body,
          fontSize: 9,
          bold: true,
          charSpacing: 1.4,
          color: i === 0 ? BRAND.pinkWash : BRAND.blue,
        });
        slide.addText(st.title, {
          x: x + 0.16,
          y: y + 0.44,
          w: w - 0.32,
          h: 0.5,
          isTextBox: true,
          margin: 0,
          fontFace: FONTS.heading,
          fontSize: 16,
          bold: true,
          color: i === 0 ? BRAND.white : BRAND.ink,
        });
        if (st.detail) {
          slide.addText(st.detail, {
            x: x + 0.16,
            y: y + 0.96,
            w: w - 0.32,
            h: 0.66,
            isTextBox: true,
            margin: 0,
            fontFace: FONTS.body,
            fontSize: 10.5,
            color: i === 0 ? BRAND.pinkWash : BRAND.slate,
            valign: "top",
          });
        }
      });
      y += 2.0;
    }

    if (s.rows?.length) {
      const [head, ...body] = s.rows;
      const cols = head.length;
      const colW = (W - M * 2) / cols;
      slide.addTable(
        [
          head.map((h) => ({
            text: h.toUpperCase(),
            options: {
              bold: true,
              fontSize: 9.5,
              charSpacing: 1.1,
              color: BRAND.white,
              fill: { color: BRAND.ink },
              fontFace: FONTS.body,
            },
          })),
          ...body.map((r, ri) =>
            r.map((c) => ({
              text: c,
              options: {
                fontSize: 11.5,
                color: BRAND.ink,
                fontFace: FONTS.body,
                fill: { color: ri % 2 ? BRAND.wash : BRAND.white },
              },
            }))
          ),
        ],
        {
          x: M,
          y,
          w: W - M * 2,
          colW: Array(cols).fill(colW),
          border: { type: "solid", color: BRAND.line, pt: 0.5 },
          margin: 6,
          rowH: 0.34,
        }
      );
      y += 0.34 * s.rows.length + 0.3;
    }

    if (s.columns?.length) {
      const n = Math.min(s.columns.length, 3);
      const gap = 0.22;
      const w = (W - M * 2 - gap * (n - 1)) / n;
      const tint = [BRAND.pink, BRAND.blue, BRAND.ink];
      s.columns.slice(0, n).forEach((col, i) => {
        const x = M + i * (w + gap);
        slide.addShape("roundRect", {
          x,
          y,
          w,
          h: 3.3,
          rectRadius: 0.06,
          fill: { color: BRAND.wash },
          line: { color: BRAND.line, width: 0.75 },
        });
        slide.addText(col.title.toUpperCase(), {
          x: x + 0.2,
          y: y + 0.2,
          w: w - 0.4,
          h: 0.34,
          isTextBox: true,
          margin: 0,
          fontFace: FONTS.body,
          fontSize: 11,
          bold: true,
          charSpacing: 1.6,
          color: tint[i % tint.length],
        });
        slide.addText(
          col.items.map((t, k) => ({
            text: t,
            options: { bullet: true, breakLine: k < col.items.length - 1 },
          })),
          {
            x: x + 0.2,
            y: y + 0.62,
            w: w - 0.4,
            h: 2.5,
            isTextBox: true,
            margin: 0,
            fontFace: FONTS.body,
            fontSize: 11.5,
            color: BRAND.ink,
            paraSpaceAfter: 6,
            valign: "top",
          }
        );
      });
      y += 3.5;
    }

    if (s.points?.length) {
      points(slide, s.points, y, dark);
      y += 2.1;
    }

    if (s.footnote) {
      slide.addText(s.footnote, {
        x: M,
        y: FOOTNOTE_Y,
        w: W - M * 2,
        h: 0.24,
        isTextBox: true,
        margin: 0,
        fontFace: FONTS.body,
        fontSize: 9,
        italic: true,
        color: BRAND.slate,
      });
    }

    if (s.takeaway) takeaway(slide, s.takeaway, dark);
    footer(slide, deck, page, dark);
  }

  // pptxgenjs types the Node output loosely; it is a Buffer here.
  const out = (await pres.write({ outputType: "nodebuffer" })) as unknown as Buffer;
  return out;
}
