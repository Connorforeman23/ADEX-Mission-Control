// Proposals: the record of what we offered a client, and what came of it.
//
// Kept free of server-only imports so the browser components can use the
// types and labels without dragging queries.ts into the bundle — the same
// arrangement as lib/organisations.ts.

import type { DeckSpec, SlideSpec } from "@/lib/proposal-theme";

/** A written offer by email, or a presentation. Connor: both happen. */
export const PROPOSAL_KINDS = ["deck", "email"] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export const KIND_LABEL: Record<string, string> = {
  deck: "Presentation",
  email: "Email offer",
};

/**
 * Draft while it is being written, Sent once it has gone out, then whatever
 * the client decided. Superseded is for the earlier version when a new one
 * replaces it — Benson Goldstein reached v7, so this is the normal case, not
 * an edge one.
 */
export const PROPOSAL_STATUSES = ["Draft", "Sent", "Won", "Lost", "Superseded"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** Badge colour per status, matching the pills used elsewhere. */
export const STATUS_CLASS: Record<string, string> = {
  Draft: "planning",
  Sent: "live",
  Won: "done",
  Lost: "risk",
  Superseded: "done",
};

/** What the email kind stores in `content` instead of a deck. */
export type EmailOffer = { subject: string; body: string };

/** The `content` column: a deck specification, or an email offer. */
export type ProposalContent = Partial<DeckSpec> & Partial<EmailOffer>;

export type ProposalRow = {
  id: string;
  title: string;
  kind: string;
  status: string;
  version: number;
  organisationId: string;
  organisation: string;
  /** The opportunity it belongs to, when it is tied to one. */
  leadId: string | null;
  lead: string | null;
  owner: string;
  ownerId: string | null;
  sentAt: string | null;
  sentBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** How many slides the deck has — 0 for an email offer. */
  slideCount: number;
};

export type ProposalDetail = ProposalRow & {
  content: ProposalContent;
  /** Earlier and later proposals for the same opportunity, newest first. */
  siblings: { id: string; version: number; status: string; title: string }[];
};

/**
 * A new deck's starting point: the spine every ADEX proposal follows, with
 * the client's name already in it and nothing invented. The author fills the
 * blanks — or, once the generation is switched on, drafts them from the CRM.
 *
 * Every headline below is a prompt, not filler: a reader who skims only the
 * headlines should still follow the argument, so the placeholders say what
 * each slide has to claim.
 */
export function starterDeck(client: string, title: string): DeckSpec {
  const slides: SlideSpec[] = [
    {
      layout: "cover",
      eyebrow: "Advertising Excellence",
      headline: title,
      standfirst: `Prepared for ${client}`,
    },
    {
      layout: "split",
      eyebrow: "The brief",
      headline: "What you asked us to solve",
      columns: [
        { kind: "prose", heading: "In your words", text: "" },
        { kind: "bullets", heading: "What that means for the plan", items: ["", "", ""] },
      ],
    },
    {
      layout: "full",
      eyebrow: "The audience",
      headline: "Who we need to reach, and where they already are",
      figures: [
        { value: "", label: "Audience" },
        { value: "", label: "Coverage" },
        { value: "", label: "Frequency" },
      ],
      footnote: "Figures to be confirmed",
    },
    {
      layout: "steps",
      eyebrow: "The plan",
      headline: "How the campaign builds",
      steps: [
        { label: "01", title: "", detail: "" },
        { label: "02", title: "", detail: "" },
        { label: "03", title: "", detail: "" },
      ],
    },
    {
      layout: "full",
      eyebrow: "The media",
      headline: "Where the money goes, and what it buys",
      columns: [{ kind: "table", rows: [["Channel", "Detail", "Investment"], ["", "", ""]] }],
      footnote: "Rates requested",
    },
    {
      layout: "closing",
      eyebrow: "Next steps",
      headline: "What happens if you say yes",
      columns: [{ kind: "bullets", items: ["", "", ""] }],
    },
  ];
  return { client, title, slides };
}

/** Everything stored for an email offer, started from nothing much. */
export function starterEmail(client: string, title: string): EmailOffer {
  return {
    subject: title,
    body: `Hi,\n\nFollowing our conversation, here is what we would recommend for ${client}.\n\n`,
  };
}

/** A filename that sorts and reads well in a mailbox. */
export function deckFilename(p: { organisation: string; title: string; version: number }) {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9 &-]/g, "").trim().replace(/\s+/g, " ");
  return `${safe(p.organisation)} - ${safe(p.title)} v${p.version}.pptx`;
}
