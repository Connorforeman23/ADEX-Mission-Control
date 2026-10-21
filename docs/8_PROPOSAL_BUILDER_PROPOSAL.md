# Phase 8 — Proposal Builder

**Status: PROPOSAL for approval. Nothing built yet.**
Written 21 October 2026, after reading four real ADEX proposals:
Faster Property Solutions, Affinity Water (C-04487), Vintage 2027 Growth
Planning, Benson Goldstein.

---

## What the decks actually do

Four proposals, four different clients, one grammar. Every content slide is
built the same way:

| Part | Example |
|---|---|
| Eyebrow — the section, in caps | `TARGETED DIGITAL` |
| Headline — **a claim, never a label** | "Around 80% of investment is concentrated in linear TV" |
| Standfirst — one line of context | "Media investment by channel, January to October 2026" |
| The substance | Costed routes, metrics, a table, a process |
| **KEY TAKEAWAY** — what it means | "Reach is high across audiences. Repeated exposure, not additional reach, accounts for most of the over-indexing." |
| Footer | `Advertising Excellence | Vintage.com | Private & Confidential` |

Four more habits worth naming, because they are what makes them good:

1. **Headlines assert.** "Reaching homeowners at scale", not "Television".
   A reader who only reads headlines still gets the argument.
2. **Media numbers lead.** £38,000 · 10.86m impacts · 2.38m reach · 4.6 OTS ·
   c.100 spots · £3.50 CPT — presented as callouts, not buried in prose.
3. **Uncertainty is stated, not hidden.** "Rate requested", "Detail to follow",
   "being confirmed with Plug", "Impacts, reach and OTS are estimates."
   This is the hardest habit to automate and the most important to keep.
4. **Test → measure → learn → scale** is the recurring spine, and the closing
   slide almost always restates it.

### Two kinds of deck, not one

- **Opportunity decks** (Faster Property, Affinity Water) — here are the routes,
  what each costs, what it would deliver, how we would judge it.
- **Review and planning decks** (Vintage 2027) — here is what we did, what it
  returned, what should change.

They share the grammar and need different scaffolding. The builder should ask
which it is making.

---

## Where it lives

A **Proposals** section under Pipeline — Connor's placement, and the right one:
a proposal belongs to an opportunity, and "has it gone out?" is a pipeline
question.

| Field | Why |
|---|---|
| Opportunity, client, owner | What it is for |
| Kind | Email offer · Deck |
| Status | Draft → Sent → Won / Lost / Superseded |
| Version | v1, v2 — Benson Goldstein reached v7, so versions are normal |
| Sent on, sent by | The thing Connor asked for: when did it go |
| The document | The generated file, kept against the record |

Pipeline cards show whether a proposal exists and when it went. The Follow-ups
page gains an obvious question it can now answer: **sent, and heard nothing.**

---

## How a proposal gets made

**1. Gather.** The builder reads what the CRM already knows: the client, their
history, what they have bought, what it returned, the opportunity's channels,
budget and notes. Where something essential is missing it says so rather than
inventing it.

**2. Choose the shape.** Email offer or deck; opportunity or review.

**3. Draft.** The CRM sends that material to Claude along with two or three of
ADEX's own proposals as examples of house style, and gets back a draft
structured as above — eyebrow, headline, standfirst, substance, takeaway, per
section.

**4. Edit.** The draft lands in an editable page — the same pattern as the
invoice preview. Nothing is sent from the CRM; a person reads it first.

**5. Produce.** Email offer → text to paste into Outlook. Deck → a .pptx built
on an ADEX template.

**6. Record.** Mark it sent; the date and version are kept, and the proposal
appears on the client's timeline beside the emails.

---

## The honest part: how the deck gets made

Those decks are properly designed — custom layouts, logos, charts, maps. An AI
writing PowerPoint from nothing produces something that looks like an AI wrote
PowerPoint from nothing.

So the design does not come from the AI. **A template deck carries the design** —
ADEX's layouts, fonts, colours, logo, footer, and one slide frame per kind of
content (costed route, metrics table, process, comparison, closing). The builder
writes the *words and the numbers* into those frames.

That is not a compromise; it is how these decks already work. The grammar above
is a template in everything but name. Making it an actual template means every
proposal comes out looking like ADEX built it, because ADEX did.

**It needs building once**, from the four existing decks. Half a day, and it is
the thing that decides whether the output is usable or embarrassing.

---

## What it will not do

- **Send anything.** Proposals leave through Outlook, by a person.
- **Invent numbers.** A rate the CRM does not hold is "Rate requested", exactly
  as the real decks say it. Inventing a CPT would be worse than useless.
- **Replace judgement.** Whether ITV1 London at £38k is the right answer for
  this client is a media decision. The builder removes the blank page and the
  formatting, not the thinking.

---

## Cost

Per proposal: a few pages of output with context behind it — pennies, not
pounds. A hundred a month is single-digit pounds, against six Claude seats at
£20. It bills to an ADEX API account and touches nobody's personal plan.

Needs a spending cap so a fault cannot run up a bill overnight.

---

## What it depends on

**The historic import.** A proposal is persuasive because it cites what this
client bought and what it returned. With an empty CRM the builder writes from
an empty filing cabinet and produces something generic — which is exactly what
everyone already gets from a blank Claude chat.

This is the strongest argument yet for loading the Sage and PO history.

---

## Decisions needed

1. **Deck template** — build it from the four existing proposals? Any brand
   rules, fonts or logo files to work from beyond what is in the decks?
2. **Who may generate** — everyone, or owners and admins? Every press of the
   button costs money, however little.
3. **Client data to the API** — the same decision taken for email capture, and
   worth taking deliberately again: proposal context includes client names,
   spend and performance.
4. **Does "Sent" come from the email integration?** The CRM can already see
   outbound mail. It could notice a proposal going out and mark it sent, rather
   than relying on someone remembering.

---

## Order

After the historic import, and alongside the email-booking work (both are "the
CRM drafts, a person decides"). Building it before the import would be building
it twice.
