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
