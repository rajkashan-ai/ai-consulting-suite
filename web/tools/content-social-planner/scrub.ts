import {
  findBuildDetail,
  findFeedbackPrompts,
  findInventedClaims,
  findLocalAssumptions,
  findOverdueLanguage,
} from "../../../Agents/Content & Social Planner/src/guards.ts";
import type { KnownFacts } from "../../../Agents/Content & Social Planner/src/types.ts";
import { findPromisedResults } from "../../../Agents/Content & Social Planner/src/recommend.ts";
import type { Page } from "./sources.ts";
import type { WrittenPost } from "./stages.ts";

/**
 * Take off the page anything we cannot stand behind.
 *
 * The guards already know how to spot an invented client, a promised result, a
 * feedback prompt and language that marks a post overdue. They were written to
 * run over a plan, and the plan they ran over was a fixture: a guard nobody
 * calls is decoration, and that is the single lesson this tool's own memory
 * repeats most. So they run here, over what the model actually returned,
 * before any of it reaches a screen.
 *
 * DROPPED, NEVER REWORDED
 * A post that says "we saved a client forty per cent" is not badly worded. It
 * is a claim nobody gave us, and there is no rewrite that makes it sourced. The
 * owner posts this under their own name, so an invention here becomes their lie
 * rather than ours. The same goes for a post with no page behind it at all.
 *
 * A shorter week is a state this tool already has and already reads well.
 */

/* ── House style, which is not a matter of taste ──────────────────────────── */

/**
 * Words that tell a reader nobody wrote this.
 *
 * `base-prompt.md` has said "no jargon, no buzzwords, no em dashes" since its
 * first version and nothing ever checked it, so the first live run put eight em
 * dashes and three en dashes into two posts. The rule was written, agreed and
 * called by nothing: the same shape as a guard that exists and is never wired.
 *
 * Bounded on both sides, because "elevate" is a word about a barber's chair and
 * "unlocking" is what a locksmith does. Narrow the context, never the keyword.
 */
const HOUSE: [RegExp, string][] = [
  [/\bleverag(e|ing|ed)\b/i, "leverage"],
  [/\bseamless(ly)?\b/i, "seamless"],
  [/\bat scale\b/i, "at scale"],
  [/\bunlock(s|ing)? (?:the |your |a )?(?:potential|value|power|growth)\b/i, "unlock"],
  [/\brobust\b/i, "robust"],
  [/\bsupercharg(e|ing|ed)\b/i, "supercharge"],
  [/\bdelve\b/i, "delve"],
  [/\belevate your\b/i, "elevate your"],
  [/\bgame[- ]chang(er|ing)\b/i, "game changer"],
  [/\bin today'?s (?:fast[- ]paced|digital|modern)\b/i, "in today's fast-paced world"],
  [/\bnestled\b/i, "nestled"],
  [/\bboasts?\b/i, "boasts"],
  [/\blook no further\b/i, "look no further"],
  [/\bthe perfect blend of\b/i, "the perfect blend of"],
  [/\bcutting[- ]edge\b/i, "cutting edge"],
  [/\btake it to the next level\b/i, "the next level"],

  /**
   * Added 2026-09-18 against the content standard.
   *
   * Every one of these is a phrase a model reaches for and a person does not,
   * and every one is checked below against real captions so it cannot fire on
   * somebody's actual writing. The test for this list is the one that matters:
   * a false positive throws away a good post and the owner never learns why.
   */
  [/\btestament\b/i, "testament"],
  [/\ba tapestry of\b/i, "a tapestry of"],
  [/\bwe(?:'ve| have) got you covered\b/i, "we have got you covered"],
  [/\bone[- ]stop shop\b/i, "one-stop shop"],
  [/\bthe go[- ]to\b/i, "the go-to"],
  [/\brest assured\b/i, "rest assured"],
  [/\bembark on\b/i, "embark on"],
  [/\bin the world of\b/i, "in the world of"],
  /**
   * The manufactured upbeat ending, which is the one this product is most
   * likely to write. Not the call to book: "book online or give us a call" is
   * the point of the post and stays. What goes is the sentence that sounds
   * like an ending and says nothing.
   */
  [/\bthe possibilities are endless\b/i, "the possibilities are endless"],
  [/\bthe sky(?:'s| is) the limit\b/i, "the sky is the limit"],
  [/\bat the end of the day\b/i, "at the end of the day"],
  [/\bone thing is (?:for )?certain\b/i, "one thing is certain"],
];

/**
 * Hashtags come off. They do not do what people think they do.
 *
 * Adam Mosseri, who runs Instagram, on the record: hashtags are not a way to
 * get more reach. LinkedIn removed hashtag following and hashtag pages in late
 * 2024, and vendor measurement since puts posts without them slightly ahead.
 * Both platforms now read the caption itself for topic.
 *
 * So a trailing block of hashtags is 2019's tactic taking up the end of every
 * post, and the thing that replaced it is plain keywords in the sentence. That
 * is a change to how we write, not something a guard can add, and it is in the
 * writing prompt.
 *
 * Stripped rather than refused, on the same reasoning as the dash: it is a
 * keystroke, not a claim, and dropping a finished post over one costs the owner
 * a post to fix nothing. A tag written into a sentence ("book your #skinfade")
 * keeps its word and loses its hash, because removing the word would change
 * what the sentence says.
 */
export function unTag(text: string): string {
  return String(text)
    /* A block of them at the end, which is where they nearly always sit. */
    .replace(/(?:\s*#[A-Za-z0-9_]+)+\s*$/g, "")
    /* A line that is nothing but tags. */
    .replace(/^\s*(?:#[A-Za-z0-9_]+\s*)+$/gm, "")
    /* One inside a sentence keeps the word: the sentence needs it. */
    .replace(/#([A-Za-z][A-Za-z0-9_]*)/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A hashtag that survived. After unTag this should never be true. */
export const hasTag = (text: string): boolean => /#[A-Za-z][A-Za-z0-9_]*/.test(text);

/**
 * Put back what a person would have typed.
 *
 * Deterministic, and nothing but the mark changes. A dash closing a sentence
 * becomes a full stop, one joining a clause becomes a comma, and one between
 * digits stays a dash because "8:45-17:00" is how opening hours are written.
 *
 * Repaired rather than refused, because a dash is a keystroke and dropping a
 * finished post over a typographic mark costs the owner a post to fix nothing.
 * A word is not a keystroke, which is why the list above is refused instead.
 */
export function unDash(text: string): string {
  return String(text)
    .replace(/(\d)\s*[\u2014\u2013]\s*(\d)/g, "$1-$2")
    .replace(/\s*[\u2014\u2013]\s+(?=[A-Z])/g, ". ")
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+([,.])/g, "$1");
}

/** Which house-style word this text uses, or null when it uses none. */
export function houseStyle(text: string): string | null {
  for (const [shape, name] of HOUSE) if (shape.test(text)) return name;
  return null;
}

/** A dash that survived the repair. After unDash this should never be true. */
export const hasDash = (text: string): boolean => /[\u2014\u2013]/.test(text);

/**
 * Why this post cannot go on the page, or null when it can.
 *
 * `findPastOccasions` is deliberately not here. It reads the `occasion` field
 * off a slot, nothing in this pipeline sets one, so calling it would be a guard
 * that cannot fire: green, reassuring and proving nothing. It goes in the day
 * occasions are set, with a test that watches it fire.
 */
export function unsafe(post: WrittenPost, pages: Page[], known: KnownFacts): string | null {
  const text = `${post.words} ${post.shot} ${post.why}`;

  /**
   * No page behind it, no post. This is the check that makes the numbered
   * pages worth anything: a page number the model invented expanded to null on
   * the way in, and this is where a null stops being ignored.
   */
  if (!post.source?.url) return "nothing on your own site backs it up";
  if (!pages.some((p) => p.url === post.source?.url)) {
    return "it cites a page we did not read";
  }

  const invented = findInventedClaims(post.words, known);
  if (invented.length) return `a claim nobody gave us (${invented.map((c) => c.text).join(", ")})`;

  const promised = findPromisedResults(text);
  if (promised.length) return `a promise about results (${promised.join(", ")})`;

  /**
   * A feedback prompt inside a post is our app furniture in a document that
   * leaves the app and goes to their customers.
   */
  const prompts = findFeedbackPrompts(post.words);
  if (prompts.length) return "a question meant for us, not for their customers";

  const build = findBuildDetail(post.words);
  if (build.length) return "something about how we work, which their customers cannot use";

  /** A day carries a reason, never a deadline. */
  const overdue = findOverdueLanguage(post.words);
  if (overdue.length) return "language that marks them late";

  const local = findLocalAssumptions(post.words, known);
  if (local.length) return "an assumption that their customers are local";

  /* A word nobody says out loud. Refused rather than repaired: "leverage" is
     not a worse way of saying something true, it is the sentence a person would
     not have written, and rewriting it here would be us guessing what they
     meant. Any dash is already gone, repaired on the way in. */
  const house = houseStyle(text);
  if (house) return `a word nobody would say out loud ("${house}")`;

  if (hasDash(text)) return "a dash we could not put right";
  if (hasTag(text)) return "a hashtag we could not put right";

  return null;
}

/**
 * What the screen says after checking, in the owner's units.
 *
 * Never "4 of 5 passed the guards": a guard is our machinery and the reader
 * cannot see one (CLAUDE.md 1.4a, Nielsen 2). What they can see is how many
 * posts they have.
 */
export function keep(kept: number, dropped: number): string {
  const posts = `${kept} post${kept === 1 ? "" : "s"} ready`;
  if (!dropped) return posts;
  return `${posts}. ${dropped} put aside because your site does not say it`;
}
