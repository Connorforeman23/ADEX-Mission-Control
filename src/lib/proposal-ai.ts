import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { PROPOSAL_PROMPT, parseBrief, type BriefResult } from "@/lib/proposal-brief";

// Turn a client's brief straight into ADEX slides.
//
// This is the whole point of the feature. Connor's words: "i normally then
// just put that document into Claude and ask it to build a proposal in house
// style similar to older presentations". So the CRM does that itself — no
// copying a prompt out, no pasting an answer back.
//
// The model is asked for the same outline format a person can type, rather
// than JSON, because the parser for it is already written and tested, and
// because an outline degrades gracefully: a line it gets slightly wrong still
// lands as prose on the right slide instead of failing to parse at all.

/** What the deck builder needs back, plus what it cost to find out. */
export type DraftResult =
  | { error: string }
  | (BriefResult & { inputTokens: number; outputTokens: number });

/**
 * Roughly what one draft costs, in pence, at Opus 5.5 list prices
 * ($4 per million in, $20 per million out). Shown to the user because a
 * per-deck cost nobody can see is a per-deck cost nobody controls.
 */
export function pence(inputTokens: number, outputTokens: number) {
  const usd = (inputTokens / 1_000_000) * 4 + (outputTokens / 1_000_000) * 20;
  // Not a currency conversion anybody should bank on — an order of magnitude,
  // so the number on screen is honest about being approximate.
  return Math.max(1, Math.round(usd * 80));
}

export async function draftDeckFromBrief(
  clientBrief: string,
  client: string,
  title: string
): Promise<DraftResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      error:
        "No Anthropic API key is set, so the CRM cannot write the deck itself. Add ANTHROPIC_API_KEY in Vercel and redeploy.",
    };
  }
  if (!clientBrief.trim()) {
    return { error: "There is no brief to work from yet." };
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    // Streamed because a long brief at high effort can run past the SDK's
    // default request timeout, and a timeout here looks like a bug rather
    // than a wait.
    const stream = anthropic.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "high" },
      system:
        "You write proposal decks for Advertising Excellence, a UK media agency. " +
        "You follow the house format exactly and you never invent a figure, a rate, " +
        "a source or a media owner that the source material does not contain.",
      messages: [
        {
          role: "user",
          content:
            PROPOSAL_PROMPT +
            clientBrief.trim() +
            `\n\nThe client is ${client}. The deck is titled "${title}".`,
        },
      ],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return {
        error:
          "The model declined to write this one. If the brief is ordinary advertising work, tell me and I will look at why.",
      };
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      return { error: "The model returned nothing. Try again." };
    }

    const parsed = parseBrief(text);
    if (!parsed.slides.length) {
      return {
        error:
          "The deck came back in a shape the builder could not read. Try again, or paste an outline yourself.",
      };
    }

    if (message.stop_reason === "max_tokens") {
      parsed.warnings.push(
        "The deck ran long and was cut off — the last slide may be incomplete."
      );
    }

    return {
      ...parsed,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return { error: "The Anthropic API key was rejected. Check it in Vercel." };
    }
    if (e instanceof Anthropic.RateLimitError) {
      return { error: "Anthropic is rate limiting us. Wait a minute and try again." };
    }
    if (e instanceof Anthropic.APIError) {
      return { error: `Anthropic returned ${e.status}: ${e.message}` };
    }
    return { error: e instanceof Error ? e.message : "The draft failed." };
  }
}
