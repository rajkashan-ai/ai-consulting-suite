/**
 * The shape of the month: how many posts, on what days, in what mix, and what
 * stops them all reading the same.
 *
 * None of this is a judgement call, which is why none of it is left to the
 * prompt. CLAUDE.md 3a.
 */
import type { Cadence, Channel, Plan, Post, Purpose } from './types.ts';
import { ANGLES, ANGLE_MAX_PER_MONTH, MIX, OFFERS_MAX, OFFERS_MIN, isWritten } from './types.ts';

export const PLAN_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

/**
 * Which days of the window each cadence posts on.
 *
 * `most-days` is five days a week, not seven. Nobody who runs a business posts
 * on a Sunday for thirty days, and a plan that assumes they will is the plan
 * that sits there reproaching them.
 */
export function postDays(cadence: Cadence): number[] {
  const days: number[] = [];
  if (cadence === 'weekly') for (const d of [0, 7, 14, 21]) days.push(d);
  else if (cadence === 'twice-weekly') for (const d of [0, 3, 7, 10, 14, 17, 21, 24, 28]) days.push(d);
  else for (let d = 0; d < PLAN_DAYS; d++) if (d % 7 < 5) days.push(d);
  return days;
}

/** How many posts this cadence gets. The mix has to add up to it. */
export function postCount(cadence: Cadence): number {
  const m = MIX[cadence];
  return m.useful + m.question + m.offer;
}

/**
 * The shape of the whole month: every slot's day and which week it falls in.
 *
 * This exists in full from the first run and costs nothing, which is the whole
 * reason the mix and the no-repeat rule still hold for weeks nobody has written
 * (CLAUDE.md 3). The words arrive a week at a time on top of this.
 */
export function weekOf(dayOffset: number): number {
  return Math.floor(dayOffset / 7) + 1;
}

export const WEEKS = 5;   // 30 days spans five part-weeks, the last a short one

/** Which week each slot of this cadence belongs to, in slot order. */
export function slotWeeks(cadence: Cadence): number[] {
  return postDays(cadence).map(weekOf);
}

/** The dates the plan runs on, as ISO days, starting the day after the run. */
export function planDates(cadence: Cadence, ranAt: string): string[] {
  const start = Date.parse(ranAt);
  if (Number.isNaN(start)) throw new Error(`planDates: ${ranAt} is not a date`);
  const day0 = new Date(start + DAY);
  return postDays(cadence).map(d => new Date(day0.getTime() + d * DAY).toISOString().slice(0, 10));
}

/* ── What can be wrong with a month ───────────────────────────────────────── */

export type ShapeProblem =
  | { kind: 'wrong-count'; want: number; got: number }
  | { kind: 'wrong-mix'; purpose: Purpose; want: number; got: number }
  | { kind: 'no-offer' }
  | { kind: 'too-many-offers'; got: number }
  | { kind: 'angle-twice-running'; angle: string; date: string }
  | { kind: 'angle-overused'; angle: string; used: number }
  | { kind: 'angle-not-in-the-set'; angle: string; date: string }
  | { kind: 'channel-not-theirs'; channel: Channel; date: string }
  | { kind: 'channel-unused'; channel: Channel }
  | { kind: 'date-in-the-past'; date: string }
  | { kind: 'date-out-of-window'; date: string }
  | { kind: 'dates-out-of-order'; date: string }
  | { kind: 'two-posts-one-day'; date: string }
  | { kind: 'words-in-an-unwritten-week'; date: string; week: number }
  | { kind: 'no-words-in-a-written-week'; date: string; week: number }
  | { kind: 'wrong-week'; date: string; says: number; is: number }
  | { kind: 'week-outside-the-month'; date: string; week: number };

export function validateShape(plan: Plan): ShapeProblem[] {
  const problems: ShapeProblem[] = [];
  const { posts, cadence } = plan;

  const want = postCount(cadence);
  if (posts.length !== want) problems.push({ kind: 'wrong-count', want, got: posts.length });

  /* The mix, in whole posts. */
  const mix = MIX[cadence];
  for (const purpose of ['useful', 'question', 'offer'] as Purpose[]) {
    const got = posts.filter(p => p.purpose === purpose).length;
    if (got !== mix[purpose]) problems.push({ kind: 'wrong-mix', purpose, want: mix[purpose], got });
  }
  const offers = posts.filter(p => p.purpose === 'offer').length;
  if (offers < OFFERS_MIN) problems.push({ kind: 'no-offer' });
  if (offers > OFFERS_MAX) problems.push({ kind: 'too-many-offers', got: offers });

  /* Angles: never twice running, never more than three times in a month. */
  const used = new Map<string, number>();
  posts.forEach((post, i) => {
    // ANGLES existed and nothing read it, so an invented angle was unguarded.
    if (!ANGLES.includes(post.angle)) {
      problems.push({ kind: 'angle-not-in-the-set', angle: post.angle, date: post.date });
    }
    used.set(post.angle, (used.get(post.angle) ?? 0) + 1);
    if (i > 0 && posts[i - 1].angle === post.angle) {
      problems.push({ kind: 'angle-twice-running', angle: post.angle, date: post.date });
    }
  });
  for (const [angle, n] of used) {
    if (n > ANGLE_MAX_PER_MONTH) problems.push({ kind: 'angle-overused', angle, used: n });
  }

  /* Channels: theirs, and all of them. Confirming a channel and then never
     writing for it is the tool quietly deciding something it was not asked to. */
  for (const post of posts) {
    if (!plan.channels.includes(post.channel)) {
      problems.push({ kind: 'channel-not-theirs', channel: post.channel, date: post.date });
    }
  }
  if (posts.length >= plan.channels.length) {
    for (const channel of plan.channels) {
      if (!posts.some(p => p.channel === channel)) problems.push({ kind: 'channel-unused', channel });
    }
  }

  problems.push(...validateDates(plan));
  problems.push(...validateWeeks(plan));
  return problems;
}

/**
 * The words arrive a week at a time, so a slot has words if and only if its
 * week has been written.
 *
 * `weeksWritten` undefined means the old all-at-once behaviour, where every
 * slot carries words. Left working on purpose: a plan written before
 * 15 September is still a valid plan.
 */
export function validateWeeks(plan: Plan): ShapeProblem[] {
  const problems: ShapeProblem[] = [];
  const weeks = slotWeeks(plan.cadence);

  plan.posts.forEach((post, i) => {
    const should = weeks[i];
    if (should !== undefined && post.week !== undefined && post.week !== should) {
      problems.push({ kind: 'wrong-week', date: post.date, says: post.week, is: should });
    }
    if (post.week !== undefined && (post.week < 1 || post.week > WEEKS)) {
      problems.push({ kind: 'week-outside-the-month', date: post.date, week: post.week });
    }
    if (plan.weeksWritten === undefined) return;
    const week = post.week ?? should ?? 1;
    const hasWords = isWritten(post);
    if (week <= plan.weeksWritten && !hasWords) {
      problems.push({ kind: 'no-words-in-a-written-week', date: post.date, week });
    }
    if (week > plan.weeksWritten && hasWords) {
      problems.push({ kind: 'words-in-an-unwritten-week', date: post.date, week });
    }
  });
  return problems;
}

/**
 * Dates.
 *
 * A post dated before the run is the easiest failure in the tool to ship and
 * the hardest for an owner to forgive, because they find it by pasting it.
 */
export function validateDates(plan: Plan): ShapeProblem[] {
  const problems: ShapeProblem[] = [];
  const ran = Date.parse(plan.ranAt);
  const last = ran + (PLAN_DAYS + 1) * DAY;
  const seen = new Set<string>();
  let previous = -Infinity;

  for (const post of plan.posts) {
    const when = Date.parse(post.date);
    if (Number.isNaN(when) || when < ran) { problems.push({ kind: 'date-in-the-past', date: post.date }); continue; }
    if (when > last) problems.push({ kind: 'date-out-of-window', date: post.date });
    if (when < previous) problems.push({ kind: 'dates-out-of-order', date: post.date });
    if (seen.has(post.date)) problems.push({ kind: 'two-posts-one-day', date: post.date });
    seen.add(post.date);
    previous = when;
  }
  return problems;
}

/** Which posts are which, for the screen. Never used to force a shape. */
export function countByPurpose(posts: Post[]): Record<Purpose, number> {
  return {
    useful: posts.filter(p => p.purpose === 'useful').length,
    question: posts.filter(p => p.purpose === 'question').length,
    offer: posts.filter(p => p.purpose === 'offer').length,
  };
}
