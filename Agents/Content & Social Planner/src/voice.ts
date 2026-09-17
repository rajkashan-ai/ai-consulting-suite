/**
 * The critique loop: what happens when the owner says a post is wrong.
 *
 * CLAUDE.md section 5. The draft's version rewrote every later post on every
 * click. One click, twenty-six rewrites, none of them asked for, and the posts
 * the owner had already fixed by hand went with them. This is the version that
 * keeps the good idea and drops that.
 */
import type { Critique, Plan, Post, VoiceNote } from './types.ts';
import { CRITIQUES } from './types.ts';

/* ── The part that outlives the month ─────────────────────────────────────── */

/**
 * A critique changes the voice note, not just this plan.
 *
 * This is the whole value of the loop. A correction made in September has to
 * still hold in January, and it has to hold in the other five tools, which is
 * why the note lives on the business profile and not inside a plan.
 */
export function applyCritique(note: VoiceNote, critique: Critique): VoiceNote {
  return { read: note.read, corrections: [...note.corrections, critique] };
}

/** The note as prose, for the next run's prompt. Their words last, and verbatim. */
export function voiceNoteAsText(note: VoiceNote): string {
  const lines = [note.read.trim()];
  const kinds = new Set(note.corrections.map(c => c.kind));
  for (const kind of kinds) lines.push(`They have told us, about at least one post: ${CRITIQUES[kind]}.`);
  for (const c of note.corrections) if (c.inTheirWords?.trim()) lines.push(`In their words: "${c.inTheirWords.trim()}"`);
  return lines.join('\n');
}

/* ── What a rewrite may touch ─────────────────────────────────────────────── */

/**
 * Their words beat ours. This is the one rule in the tool with no exception.
 *
 * A post the owner has edited is theirs now. A post they have approved is one
 * they have moved on from, and changing it behind them is how they stop
 * trusting the page. Everything after the post they criticised, and nothing
 * else, is in scope.
 */
export function rewriteSet(plan: Plan, critique: Critique): Post[] {
  const from = anchor(plan, critique);
  if (from === -1) return [];
  return plan.posts.slice(from).filter(p => !p.editedByOwner && !p.approved);
}

/**
 * Which post they were looking at.
 *
 * A post has no id today, so a critique points at a date. Two posts on one day
 * makes that ambiguous, and the first version took the first match, so a
 * critique aimed at the second post swept the first one into the rewrite. Where
 * the date is ambiguous we take the LAST match: under-reaching only skips a
 * rewrite, over-reaching takes words off a post the owner never pointed at.
 *
 * `validateShape` already rejects two posts on one day, so this is the second
 * line rather than the first. The real fix is an id on a post, which arrives
 * when plans are stored in a database.
 */
function anchor(plan: Plan, critique: Critique): number {
  return plan.posts.map(p => p.date).lastIndexOf(critique.postDate);
}

export interface RewritePlan {
  willRewrite: number;
  keptBecauseEdited: number;
  keptBecauseApproved: number;
  total: number;
  /** The sentence shown before anything changes. */
  sentence: string;
}

/** It says how many it will change, before it changes them. */
export function describeRewrite(plan: Plan, critique: Critique): RewritePlan {
  const from = anchor(plan, critique);
  const after = from === -1 ? [] : plan.posts.slice(from);
  const willRewrite = rewriteSet(plan, critique).length;
  const keptBecauseEdited = after.filter(p => p.editedByOwner).length;
  const keptBecauseApproved = after.filter(p => !p.editedByOwner && p.approved).length;

  const parts = [`This will rewrite ${willRewrite} of the ${plan.posts.length} posts.`];
  if (keptBecauseEdited) parts.push(`The ${keptBecauseEdited} you have edited stay as they are.`);
  if (keptBecauseApproved) parts.push(`So do the ${keptBecauseApproved} you have marked done.`);
  if (!willRewrite) parts[0] = 'There is nothing left to rewrite. Every post from here is one you have edited or marked done.';

  return { willRewrite, keptBecauseEdited, keptBecauseApproved, total: plan.posts.length, sentence: parts.join(' ') };
}

/* ── Proving the rule held ────────────────────────────────────────────────── */

export interface Overwrite { date: string; was: string; now: string }

/**
 * Run over the plan before and after a rewrite. Anything this returns is the
 * tool having taken words off an owner who wrote them.
 */
export function findOverwrites(before: Plan, after: Plan): Overwrite[] {
  const bad: Overwrite[] = [];
  before.posts.forEach((was, i) => {
    if (!was.editedByOwner && !was.approved) return;
    // Position first, date second. With two posts on one day, matching by date
    // alone compares the wrong pair and can report an overwrite that never
    // happened, or miss one that did.
    const atIndex = after.posts[i];
    const now = atIndex?.date === was.date ? atIndex : after.posts.find(p => p.date === was.date);
    if (!now) { bad.push({ date: was.date, was: was.words, now: '(the post is gone)' }); return; }
    if (now.words !== was.words) bad.push({ date: was.date, was: was.words, now: now.words });
  });
  return bad;
}

/**
 * One batched rewrite, never one call per click.
 *
 * Cost. `most days` is twenty-two posts at a flat price, and a rewrite of the
 * lot on every click is the case that makes the price a loss.
 *
 * This takes the number of API calls the run actually made, because the
 * previous version returned `critiques.length === 0 ? 0 : 1` and so could only
 * ever report the intention back to itself. It observed nothing and could not
 * go red. Found on 14 September by an independent pass. The caller has to count
 * the calls and hand them in.
 */
export function checkRewriteCalls(critique: Critique, callsMade: number): RewriteCallProblem[] {
  const problems: RewriteCallProblem[] = [];
  if (callsMade > 1) problems.push({ kind: 'one-call-per-post', critique: critique.kind, callsMade });
  if (callsMade < 1) problems.push({ kind: 'nothing-ran', critique: critique.kind });
  return problems;
}

export type RewriteCallProblem =
  | { kind: 'one-call-per-post'; critique: string; callsMade: number }
  | { kind: 'nothing-ran'; critique: string };
