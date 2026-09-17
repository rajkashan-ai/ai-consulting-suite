import { CHANNEL, type KnownFacts, type Purpose } from "../../../Agents/Content & Social Planner/src/types.ts";
import type { WrittenPost } from "./stages.ts";

/**
 * THE BAR, AND WHOSE IT IS.
 *
 * Raj, 2026-09-16: whoever sets the bar sets it for everything we write, and it
 * is not this tool's judgement.
 *
 * There is no single Cagan for content and pretending there is would be the
 * fabrication this product exists to avoid. Content splits into three questions
 * with three different best answers, so each check below carries the name of the
 * person whose rule it is, and a check with no name attached does not belong in
 * this file.
 *
 *   Is it worth posting at all?   Jay Baer, Youtility
 *   Is it written like a person?  Ann Handley, Everybody Writes
 *   Is the month shaped right?    Gary Vaynerchuk, Jab, Jab, Jab, Right Hook
 *
 * ORDER OF AUTHORITY, from `CLAUDE.md` 6c
 * Measured evidence about this business beats all of it. These are the default
 * for a business we have no evidence about, which is every business on day one.
 * This tool's own taste is never a rule.
 *
 * WHAT IS NOT HERE
 * Vaynerchuk's ratio and platform fit are checked already, in `MIX` and in the
 * per-channel word targets, and they were checked before anyone named him.
 * Repeating them here would be two copies of one rule.
 */

/** A failed check, named for the person whose rule it is. */
export type BarProblem = { whose: string; rule: string; why: string };

/* ── Baer: useful to somebody who never buys ──────────────────────────────── */

/**
 * A useful post has to give something away.
 *
 * Youtility's test is whether the content would be worth paying for. That is not
 * mechanical. What is mechanical is the half of it that fails most often: a post
 * whose purpose is `useful` that says nothing a reader could act on without
 * buying, because it is an advertisement wearing a useful label.
 *
 * So the check is for a fact off their own pages: a price, a time, an address, a
 * phone number, or one of their own services named. Present means it clears the
 * checkable half. Absent means it does not, whatever it says about itself.
 */
const A_PRICE = /£\s?\d/;
const A_TIME = /\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}\s?(am|pm)\b/i;
const A_PHONE = /\b0\d{3,4}\s?\d{5,6}\b/;
const A_PLACE = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/;

export function givesSomethingAway(post: WrittenPost, known: KnownFacts): boolean {
  const text = post.words;
  if (A_PRICE.test(text) || A_TIME.test(text) || A_PHONE.test(text) || A_PLACE.test(text)) return true;
  return known.services.some((s) => s.length > 3 && text.toLowerCase().includes(s.toLowerCase()));
}

/* ── Handley: written the way a person writes ─────────────────────────────── */

/**
 * The sentence-level half, which is the half that can be measured.
 *
 * Handley's bar is clear and concrete. Clarity is not countable; sentence length
 * is, and a very long sentence is the most reliable sign that nobody said this
 * out loud. The limit is deliberately generous: this refuses the sentence nobody
 * would speak, not every sentence with a clause in it.
 */
export const LONGEST_SENTENCE = 45;

export function longestSentence(text: string): number {
  return Math.max(
    0,
    ...String(text)
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim().split(/\s+/).filter(Boolean).length),
  );
}

/* ── The check that runs ──────────────────────────────────────────────────── */

/**
 * Everything the named bar refuses, or an empty list.
 *
 * Returned rather than thrown, and named rather than scored: "too salesy" tells
 * nobody anything, and a score hides which rule was broken behind a number.
 */
export function belowTheBar(post: WrittenPost, known: KnownFacts): BarProblem[] {
  const problems: BarProblem[] = [];

  if (post.purpose === ("useful" as Purpose) && !givesSomethingAway(post, known)) {
    problems.push({
      whose: "Jay Baer, Youtility",
      rule: "useful to a reader who never buys",
      why: "it gives them nothing they could use without booking",
    });
  }

  const longest = longestSentence(post.words);
  if (longest > LONGEST_SENTENCE) {
    problems.push({
      whose: "Ann Handley, Everybody Writes",
      rule: "written the way a person writes",
      why: `a sentence of ${longest} words, which nobody would say out loud`,
    });
  }

  /* Vaynerchuk's platform fit, at the level of the single post. The month's
     ratio is MIX's job and is checked there. */
  const cap = CHANNEL[post.channel].capChars;
  if (post.words.length > cap) {
    problems.push({
      whose: "Gary Vaynerchuk, Jab, Jab, Jab, Right Hook",
      rule: "written for the platform it is going on",
      why: `${post.words.length} characters where ${CHANNEL[post.channel].label} takes ${cap}`,
    });
  }

  return problems;
}

/** What the owner is told, which never names a book or a rule of ours. */
export const sayBar = (p: BarProblem): string => p.why;
