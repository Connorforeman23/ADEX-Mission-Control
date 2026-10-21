import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { draftDeckFromBrief, pence } from "@/lib/proposal-ai";
import { getProposal } from "@/lib/queries";

// Drop in the client's brief, press one button, get the deck.
//
// A route rather than a server action because writing a deck from a long
// document takes longer than a server action is allowed to run by default,
// and a request cut off at the default limit looks like a bug.
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // RLS does the deciding — a reader who may not have this proposal gets
  // nothing back from getProposal, and therefore nothing from here.
  const proposal = await getProposal(id);
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.kind !== "deck") {
    return NextResponse.json(
      { error: "This proposal is an email offer, not a presentation." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    clientBrief?: string;
    mode?: "replace" | "append";
  };

  // What was typed in the box wins over what was saved, so pressing the
  // button straight after an edit uses what is on screen.
  const brief =
    typeof body.clientBrief === "string" && body.clientBrief.trim()
      ? body.clientBrief
      : (proposal.content.clientBrief ?? "");

  const drafted = await draftDeckFromBrief(
    brief,
    proposal.content.client || proposal.organisation,
    proposal.content.title || proposal.title
  );
  if ("error" in drafted) {
    return NextResponse.json({ error: drafted.error }, { status: 400 });
  }

  const supabase = await createClient();
  const content = proposal.content as Record<string, unknown>;
  const existing = Array.isArray(content.slides) ? (content.slides as unknown[]) : [];
  const slides = body.mode === "append" ? [...existing, ...drafted.slides] : drafted.slides;

  const { error } = await supabase
    .from("proposals")
    .update({ content: { ...content, slides, clientBrief: brief.trim() || undefined } })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    built: drafted.slides.length,
    warnings: drafted.warnings,
    pence: pence(drafted.inputTokens, drafted.outputTokens),
  });
}
