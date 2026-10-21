import { NextResponse } from "next/server";
import { getProposal, getSupplierLogos } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { buildProposalDeck } from "@/lib/proposal-deck";
import { deckFilename } from "@/lib/proposals";
import type { DeckSpec } from "@/lib/proposal-theme";

// Download the deck for a proposal.
//
// The file is built on the way out rather than stored: the row holds the
// content, and the template turns it into a .pptx on request. So an
// improvement to the template reaches every proposal, and the database stays
// small enough to be quick.
//
// RLS decides whether the reader may have it — getProposal returns nothing if
// they may not, and this hands back a 404 rather than leaking its existence.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) return new NextResponse("Not found", { status: 404 });
  if (proposal.kind !== "deck") {
    return new NextResponse("That proposal is an email offer, not a presentation.", {
      status: 400,
    });
  }

  // Logos come from the CRM, so nobody sources an image by hand: the media
  // owners' by name, the client's from its own organisation record.
  const supabase = await createClient();
  const [logos, { data: org }] = await Promise.all([
    getSupplierLogos(),
    supabase.from("organisations").select("logo, website").eq("id", proposal.organisationId).maybeSingle(),
  ]);

  const content = proposal.content as Partial<DeckSpec>;
  const spec: DeckSpec = {
    client: content.client || proposal.organisation,
    title: content.title || proposal.title,
    subtitle: content.subtitle,
    clientDomain: content.clientDomain ?? org?.website ?? undefined,
    clientLogo: content.clientLogo ?? org?.logo ?? undefined,
    supplierLogos: logos,
    slides: content.slides ?? [],
  };

  const buffer = await buildProposalDeck(spec);
  const filename = deckFilename(proposal);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      // RFC 5987 as well as the plain form, so a title with an ampersand or an
      // accent survives the trip.
      "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}
