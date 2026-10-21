import "server-only";

// Pull the words out of a document a client sent us.
//
// A brief arrives as a Word file, an email somebody saved, or a wall of text
// pasted into a box. All we want is the words — the formatting is the
// client's house style, not ours, and the deck is built in ours.
//
// Word only, plus plain text. A .docx is a zip with the text in one XML file,
// which is a handful of lines and no new dependency. PDFs would need a real
// parser and are the format most likely to be a scan with no text in it at
// all, so they are refused with an explanation rather than half-read.

/** What we will try to read, by extension. */
const PLAIN = [".txt", ".md", ".markdown", ".csv", ".eml"];

export type ExtractResult = { text: string } | { error: string };

/** Undo the five XML entities, which is all Word's document.xml uses. */
function decodeEntities(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * The text of a .docx.
 *
 * Paragraphs and line breaks become newlines, tabs become spaces, and every
 * other tag is dropped. Table cells end up one per line, which is the right
 * reading order for a brief and close enough for everything else.
 */
async function docxText(bytes: Buffer): Promise<ExtractResult> {
  let xml: string;
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(bytes);
    const doc = zip.file("word/document.xml");
    if (!doc) return { error: "That Word file has no document inside it." };
    xml = await doc.async("string");
  } catch {
    return { error: "That file could not be opened as a Word document." };
  }

  const text = decodeEntities(
    xml
      // A paragraph or an explicit break is a new line.
      .replace(/<w:p[ >]/g, "\n<w:p ")
      .replace(/<w:br\s*\/?>/g, "\n")
      .replace(/<w:tab\s*\/?>/g, " ")
      // Everything else is markup.
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text
    ? { text }
    : { error: "That Word file has no text in it — is it a scan or just images?" };
}

/**
 * Read an uploaded document, given as a data URI the browser produced.
 *
 * The extension decides how, because a client's file is not to be trusted to
 * declare its own type honestly, and guessing from the bytes buys nothing
 * here: we support two shapes and refuse the rest by name.
 */
export async function extractDocumentText(
  dataUri: string,
  filename: string
): Promise<ExtractResult> {
  const comma = dataUri.indexOf("base64,");
  if (comma < 0) return { error: "That file could not be read." };
  const bytes = Buffer.from(dataUri.slice(comma + 7), "base64");

  if (bytes.length > 8 * 1024 * 1024) {
    return { error: "That file is over 8MB. Paste the text in instead." };
  }

  const name = filename.toLowerCase();
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot) : "";

  if (ext === ".docx") return docxText(bytes);

  if (ext === ".doc") {
    return {
      error:
        "That is the old Word format. Open it in Word and save as .docx, or copy the text and paste it in.",
    };
  }

  if (ext === ".pdf") {
    return {
      error:
        "PDFs are not read here — half of them are scans with no text in them. Open it, select all, and paste the text in.",
    };
  }

  if (PLAIN.includes(ext)) {
    const text = bytes.toString("utf8").replace(/\r\n/g, "\n").trim();
    return text ? { text } : { error: "That file is empty." };
  }

  return {
    error: `${ext || "That file type"} is not one we read. Word (.docx) and plain text work — otherwise paste the text in.`,
  };
}
