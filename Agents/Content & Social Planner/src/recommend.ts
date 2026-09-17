/**
 * Recommending a cadence, and refusing to sell it.
 *
 * CLAUDE.md 2b, method in `recommendation.md`. Raj, 15 September: the tool
 * should recommend how often to post rather than ask. The instinct is right and
 * the evidence is thinner than it looks, so most of this file is about what we
 * are allowed to say.
 *
 * We cannot count what they post now. Instagram's robots.txt names ClaudeBot
 * with Disallow: / and Facebook returns 400 to a logged-out read (recorded
 * 14 September). And we have bought no benchmark. So every reason here is
 * arithmetic, their own answer, a channel we can see, or our own last plan.
 */
import type {
  Cadence, Capacity, Channel, KnownFacts, LastMonth, Reason, Recommendation,
} from './types.ts';
import { CADENCE_LABEL, CADENCES, MIX, CHANNEL } from './types.ts';
import { postCount } from './plan-shape.ts';

/** Once a week is the floor. Below it the tool has stopped being worth opening. */
const LADDER: readonly Cadence[] = CADENCES;

const up = (c: Cadence): Cadence | undefined => LADDER[LADDER.indexOf(c) + 1];
const down = (c: Cadence): Cadence | undefined => LADDER[LADDER.indexOf(c) - 1];

/** They finished nearly all of it, so they can take more. */
export const STEP_UP_AT = 0.8;
/** They finished half or less. Move them down, and never by more than one. */
export const STEP_DOWN_AT = 0.5;

export function recommendCadence(
  known: KnownFacts,
  capacity: Capacity,
  channels: Channel[],
): Recommendation {
  const because: Reason[] = [];

  /* Month two onward. The only measured evidence we have, and it is about them. */
  if (capacity.lastMonth && capacity.lastMonth.written > 0) {
    return fromLastMonth(capacity.lastMonth, capacity, channels);
  }

  /* Run one. Arithmetic and their own answer, and it says so rather than
     implying a measurement: "based on your posting history" is a lie here. */
  let cadence: Cadence = channels.length >= 2 ? 'twice-weekly' : 'weekly';

  /**
   * They chose. Their choice wins outright, and says so.
   *
   * It used to be sent as a number of hours and turned back into a cadence
   * here, which is lossy: the starting point depends on how many channels they
   * have, so with one channel the two-hour answer never reached twice a week
   * and the button labelled "a couple of times a week" rebuilt the month as
   * once a week. A control that does not do what it says is worse than no
   * control, and CLAUDE.md 2b says their choice always wins.
   */
  if (capacity.chose) {
    const chosen = capacity.chose;
    because.push({ from: 'they-told-us', text: `You asked for ${CADENCE_LABEL[chosen].toLowerCase()}.` });
    because.push(cost(chosen, channels));
    because.push({
      from: 'their-channels',
      text: channels.length === 1
        ? `Everything goes on ${CHANNEL_NAME(channels[0])}.`
        : `Split across ${list(channels.map(CHANNEL_NAME))}.`,
    });
    return { cadence: chosen, because, stepUp: stepUp(chosen, known, channels) };
  }

  if (capacity.hoursAWeek !== undefined) {
    if (capacity.hoursAWeek < 1) cadence = 'weekly';
    else if (capacity.hoursAWeek >= 4) cadence = 'most-days';
    because.push({
      from: 'they-told-us',
      text: `You said you have about ${hours(capacity.hoursAWeek)} a week for this.`,
    });
  }

  because.push(cost(cadence, channels));
  because.push({
    from: 'their-channels',
    text: channels.length === 1
      ? `Everything goes on ${CHANNEL_NAME(channels[0])}.`
      : `Split across ${list(channels.map(CHANNEL_NAME))}.`,
  });

  return { cadence, because, stepUp: stepUp(cadence, known, channels) };
}

function fromLastMonth(last: LastMonth, capacity: Capacity, channels: Channel[]): Recommendation {
  const rate = last.done / last.written;
  const was = cadenceOf(last.written);
  const because: Reason[] = [{
    from: 'last-month',
    text: `You marked ${last.done} of ${last.written} done last month.`,
  }];

  if (rate <= STEP_DOWN_AT) {
    const to = down(was) ?? was;
    because.push(cost(to, channels));
    // Never a telling-off, and never more than one notch.
    if (to !== was) because.push({ from: 'our-arithmetic', text: `${postCount(to)} is a number you will finish.` });
    return { cadence: to, because, steppedDownFrom: to === was ? undefined : was };
  }

  if (rate >= STEP_UP_AT && up(was)) {
    const to = up(was)!;
    because.push(cost(to, channels));
    return { cadence: to, because, stepUp: undefined };
  }

  because.push(cost(was, channels));
  return { cadence: was, because, stepUp: stepUp(was, undefined, channels) };
}

/** Always safe: it is our own arithmetic about our own plan. */
function cost(cadence: Cadence, channels: Channel[]): Reason {
  const n = postCount(cadence);
  return {
    from: 'our-arithmetic',
    /* "9 photographs" is wrong the moment one of their channels is video, and
       it is the line that tells them what the month costs them in work. */
    text: `${CADENCE_LABEL[cadence]} is ${n} post${n === 1 ? '' : 's'} and ${n} ${supply(channels, n)} over the next 30 days.`,
  };
}

/**
 * The step up, in cost and coverage. Never in results.
 *
 * "Covers" has to point at something checkable: a channel they own and are not
 * posting to, or a subject our own plan cannot fit at this cadence. Anything
 * about what happens next is refused by `findPromisedResults`.
 */
function stepUp(from: Cadence, known: KnownFacts | undefined, channels: Channel[]) {
  const to = up(from);
  if (!to) return undefined;
  const extra = postCount(to) - postCount(from);
  const services = known?.services ?? [];
  const covers = services.length > 2
    ? `Your ${services[1]} work gets one post a month at ${CADENCE_LABEL[from].toLowerCase()}. At ${CADENCE_LABEL[to].toLowerCase()} it gets its own thread.`
    : `${extra} more posts to spread across ${list(channels.map(CHANNEL_NAME))}.`;
  return {
    to,
    costs: `${extra} more posts, and ${extra} more ${supply(channels, extra)}, over the same 30 days.`,
    covers,
  };
}

/** Which cadence a month of this many posts was. */
export function cadenceOf(posts: number): Cadence {
  let best: Cadence = 'weekly';
  for (const c of CADENCES) {
    if (Math.abs(postCount(c) - posts) < Math.abs(postCount(best) - posts)) best = c;
  }
  return best;
}

/**
 * A channel's name as it reads in a sentence.
 *
 * This used to be a second hand-written list of the same four channels that
 * `CHANNEL` already holds. Adding TikTok and YouTube left it stale, and the
 * recommendation read "Split across Instagram, Facebook,  and undefined" on a
 * customer screen. One list, with an override only where the prose needs a
 * possessive.
 */
const IN_PROSE: Partial<Record<Channel, string>> = { 'google-business': 'your Google Business Profile' };
const CHANNEL_NAME = (c: Channel) => IN_PROSE[c] ?? CHANNEL[c].label;

/** What they have to supply, named for the channels they are actually on. */
function supply(channels: Channel[], n: number): string {
  const mediums = new Set(channels.map((c) => CHANNEL[c].medium));
  const plural = n === 1 ? '' : 's';
  if (mediums.has('photo') && mediums.has('video')) return `photograph${plural} or clip${plural}`;
  return mediums.has('video') ? `clip${plural}` : `photograph${plural}`;
}

function list(items: string[]): string {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function hours(h: number): string {
  return h < 1 ? 'under an hour' : `${h} hour${h === 1 ? '' : 's'}`;
}

/* ── The guard this whole feature turns on ────────────────────────────────── */

/**
 * We never promise a result.
 *
 * This is the easiest sentence in the feature to write and we have no source
 * for any version of it. It catches the polite forms too, because "tends to"
 * and "should help" are the same claim with a hedge in front, and the owner
 * acts on it either way.
 */
const PROMISE = [
  /\b(?:more|extra|additional|increased?|higher|better|improved?)\s+(?:enquir|custom|client|booking|sale|lead|follower|reach|engagement|visibilit|traffic|attention|business|work|revenue)/i,
  /\b(?:will|would|should|tends? to|helps? to|helps? you|often|typically|usually|proven to|shown to)\s+(?:get|bring|win|grow|boost|increase|drive|generate|convert|lead to|result in|attract|reach)/i,
  /\b(?:grow|boost|supercharge|maximis|maximiz|double|triple)\s+(?:your|the)\b/i,
  /\b\d+(?:\.\d+)?\s*(?:%|per ?cent|x\b|times)\s*(?:more|better|higher|increase|uplift|growth)/i,
  /\b(?:see|expect|get)\s+(?:a\s+)?(?:lift|uplift|bump|jump|spike|boost|return)/i,
  /\bbusinesses (?:that|who) post\b/i,
];

export function findPromisedResults(text: string): string[] {
  const found: string[] = [];
  for (const re of PROMISE) {
    const m = text.match(re);
    if (m) found.push(m[0].trim());
  }
  return found;
}

/**
 * Every reason carries a source, and the sources we can actually stand behind
 * are the four in `ReasonSource`. This catches a reason that arrived empty, or
 * one whose text quietly claims a measurement we never took.
 */
const CLAIMS_A_MEASUREMENT =
  /\b(?:you (?:currently |normally |usually )?post(?:ed)?|your posting|posting history|we (?:counted|measured|analysed|analyzed)|your (?:last|recent) posts|industry (?:average|standard|benchmark)|benchmark)\b/i;

export function findUnsourcedReasons(rec: Recommendation): string[] {
  const bad: string[] = [];
  for (const r of rec.because) {
    if (!r.text.trim()) { bad.push('(empty reason)'); continue; }
    // Only 'last-month' may speak about what they actually posted, because only
    // our own previous plan gives us that number.
    if (CLAIMS_A_MEASUREMENT.test(r.text) && r.from !== 'last-month') bad.push(r.text);
  }
  if (rec.stepUp) bad.push(...findPromisedResults(`${rec.stepUp.costs} ${rec.stepUp.covers}`));
  bad.push(...findPromisedResults(rec.because.map(r => r.text).join(' ')));
  return bad;
}

/**
 * One pass over a recommendation, so both guards above actually run.
 *
 * They had no aggregator until 15 September, which is the same defect the
 * Competitor Tracker found in `findRankClaims`: written, tested, documented,
 * and called by nothing. A unit test proves a guard works. It cannot prove the
 * guard is plugged in, and nothing about a green suite says otherwise.
 */
export function validateRecommendation(rec: Recommendation) {
  return {
    unsourced: findUnsourcedReasons(rec),
    promised: findPromisedResults(
      [...rec.because.map(r => r.text), rec.stepUp?.costs, rec.stepUp?.covers].filter(Boolean).join(' '),
    ),
    noReasons: rec.because.length === 0,
  };
}
