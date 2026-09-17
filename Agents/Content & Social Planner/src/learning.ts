/**
 * What we know about this business, and must never have to learn twice.
 *
 * Raj, 15 September: "Ensure solid learnings do not have to be repeated. Do not
 * regress." That is not a feature, it is a property, and a property needs a
 * guard rather than good intentions. Everything here exists to make one of four
 * failures fail a test instead of reaching a customer:
 *
 *   1. A learning is made and never applied to the next run.
 *   2. The same thing is learned twice, which means 1 already happened.
 *   3. A learning disappears with nobody deciding it should.
 *   4. We ask for something we were already told.
 *
 * The learnings live on the business profile beside the voice note, not inside
 * a plan, because a plan is thrown away every month and this must not be.
 */
import type { Learning } from './types.ts';

/** Everything still in force. A retired learning stays on the record for ever. */
export function live(learnings: Learning[]): Learning[] {
  return learnings.filter(l => !l.retiredOn);
}

/* ── 1. Every live learning reaches the writer ────────────────────────────── */

/**
 * The writing instruction we send has to carry every live rule, verbatim.
 *
 * Checked against the built prompt rather than trusted, because the failure is
 * silent: the plan still writes, it is just wrong in the way they already told
 * us about, and the owner has to say it a second time.
 */
export function findUnappliedLearnings(learnings: Learning[], instruction: string): Learning[] {
  return live(learnings).filter(l => !instruction.includes(l.rule));
}

/* ── 2. The same thing learned twice means the first one never landed ─────── */

/** Same rule, two entries. A duplicate is evidence of a failure, not a tidy-up. */
export function findRepeatedLearnings(learnings: Learning[]): string[] {
  const seen = new Map<string, number>();
  for (const l of live(learnings)) {
    const key = normalise(l.rule);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen].filter(([, n]) => n > 1).map(([rule]) => rule);
}

function normalise(rule: string): string {
  return rule.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
}

/* ── 3. Nothing disappears without a decision ─────────────────────────────── */

export type Regression =
  | { kind: 'vanished'; id: string; rule: string }
  | { kind: 'retired-without-a-reason'; id: string; rule: string }
  | { kind: 'evidence-removed'; id: string; rule: string }
  | { kind: 'rule-rewritten'; id: string; was: string; now: string };

/**
 * Run over the learnings before and after any change. Anything here is the tool
 * forgetting something it was told, which is the regression Raj named.
 */
export function findRegressions(before: Learning[], after: Learning[]): Regression[] {
  const out: Regression[] = [];
  const now = new Map(after.map(l => [l.id, l]));
  for (const was of before) {
    const is = now.get(was.id);
    if (!is) { out.push({ kind: 'vanished', id: was.id, rule: was.rule }); continue; }
    if (is.rule !== was.rule) out.push({ kind: 'rule-rewritten', id: was.id, was: was.rule, now: is.rule });
    if (is.evidence.length < was.evidence.length) {
      out.push({ kind: 'evidence-removed', id: was.id, rule: was.rule });
    }
    if (is.retiredOn && !is.retiredBecause?.trim()) {
      out.push({ kind: 'retired-without-a-reason', id: was.id, rule: was.rule });
    }
  }
  return out;
}

/** A learning with nothing under it is a preference we invented for them. */
export function findUnevidencedLearnings(learnings: Learning[]): Learning[] {
  return learnings.filter(l => l.evidence.length === 0 || l.evidence.some(e => !e.trim()));
}

/* ── 4. Never ask for something we were already told ──────────────────────── */

/**
 * `base-prompt.md`: once something is confirmed it is remembered, never ask
 * twice for the same fact. This is that rule made checkable.
 */
const NOISE = new Set(['they', 'them', 'this', 'that', 'with', 'from', 'your', 'ours', 'have', 'been', 'what', 'when', 'stop', 'keep', 'more', 'than', 'every', 'time', 'once', 'like', 'make', 'want', 'would', 'should', 'could', 'about', 'their', 'there']);

/**
 * Overlap, not containment.
 *
 * The first version asked that every word of the rule appear in the question,
 * which meant it could never fire: "Stop writing a closing line" shares two
 * words with "should we write a closing line for you", and needed seven. A
 * guard that cannot match is the same as no guard, and it looks like one that
 * works. It is a heuristic and it is meant to over-match rather than under: the
 * cost of a false positive is one question we skip, and the cost of a miss is
 * the customer telling us something for the second time.
 */
export function alreadyKnown(learnings: Learning[], question: string): Learning | null {
  const words = (s: string) => new Set(normalise(s).split(' ').filter(w => w.length > 3 && !NOISE.has(w)));
  const q = words(question);
  if (q.size === 0) return null;
  for (const l of live(learnings)) {
    let shared = 0;
    for (const w of words(l.rule)) if (q.has(w)) shared++;
    if (shared >= 2) return l;
  }
  return null;
}

/* ── Where a learning comes from: what they published, not how it did ─────── */

export interface CaptionDiff { date: string; ours: string; theirs: string }

export type DiffKind = 'cut-the-last-line' | 'cut-the-ask' | 'rewrote-the-opener' | 'shortened' | 'unchanged';

const ASK = /\b(book|booking|call|message|get in touch|drop us|pop in|come in)\b/i;

/** What they changed on the way to posting it. Their edit, not our guess. */
export function classifyDiff(d: CaptionDiff): DiffKind {
  const ours = d.ours.trim(), theirs = d.theirs.trim();
  if (ours === theirs) return 'unchanged';
  const ourLines = ours.split(/\n+/), theirLines = theirs.split(/\n+/);
  if (ourLines.length > theirLines.length && ours.startsWith(theirLines[0])) return 'cut-the-last-line';
  if (ASK.test(ours) && !ASK.test(theirs)) return 'cut-the-ask';
  if (ourLines[0] !== theirLines[0] && ourLines.slice(1).join('') === theirLines.slice(1).join('')) return 'rewrote-the-opener';
  if (theirs.length < ours.length * 0.7) return 'shortened';
  return 'unchanged';
}

/** Three times is a habit. Twice is a coincidence, and once is a Tuesday. */
export const A_PATTERN_IS = 3;

const RULE: Record<Exclude<DiffKind, 'unchanged'>, string> = {
  'cut-the-last-line': 'Stop writing a closing line. They cut it every time.',
  'cut-the-ask': 'Keep the ask to the posts marked as the ask. They remove it from the others.',
  'rewrote-the-opener': 'Open plainly. They rewrite our first line.',
  'shortened': 'Write shorter than the channel allows. They cut roughly a third.',
};

/**
 * A learning from what they actually published.
 *
 * This is behaviour, not engagement, which is why three is enough: they did the
 * same deliberate thing three times. No metric is involved and none is needed.
 */
export function learnFromDiffs(diffs: CaptionDiff[], on: string): Learning[] {
  const counts = new Map<DiffKind, CaptionDiff[]>();
  for (const d of diffs) {
    const kind = classifyDiff(d);
    if (kind === 'unchanged') continue;
    counts.set(kind, [...(counts.get(kind) ?? []), d]);
  }
  const out: Learning[] = [];
  for (const [kind, hits] of counts) {
    if (hits.length < A_PATTERN_IS) continue;
    out.push({
      id: `diff-${kind}`,
      learnedOn: on,
      from: 'caption-diff',
      rule: RULE[kind as Exclude<DiffKind, 'unchanged'>],
      evidence: hits.map(h => `${h.date}: they posted it ${kind.replace(/-/g, ' ')}`),
    });
  }
  return out;
}

/** One pass over the learning store. */
export function validateLearnings(learnings: Learning[], instruction: string) {
  return {
    unapplied: findUnappliedLearnings(learnings, instruction),
    repeated: findRepeatedLearnings(learnings),
    unevidenced: findUnevidencedLearnings(learnings),
    liveCount: live(learnings).length,
  };
}
