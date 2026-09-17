/**
 * What went out, where, and how it did.
 *
 * Raj, 15 September: count the posts per channel with the last date, show the
 * metrics for a post, let the owner paste the live link and press Posted.
 *
 * Two different things reach this file by two different routes, and keeping
 * them apart is the whole job.
 *
 *   The link they paste  -> the caption they actually published, via oEmbed,
 *                           which since 15 June 2026 needs no token and no app
 *                           review. No metrics, ever: oEmbed returns the embed
 *                           and nothing about engagement.
 *   A connected account  -> reach, likes, comments, saves. Needs a Business or
 *                           Creator account joined to a Facebook Page, OAuth,
 *                           and a 60-day token. A personal account cannot give
 *                           these at all, which is Meta's rule and not ours.
 *
 * So the screen has to be honest about three states, not two: connected,
 * not connected yet, and cannot be connected.
 */
import type {
  Channel, ChannelTracking, ConnectionState, Metrics, Published,
} from './types.ts';
import { CHANNEL } from './types.ts';

/* ── The top section: what has gone out, per channel ──────────────────────── */

export interface ChannelSummary {
  channel: Channel;
  label: string;
  /** Posts that went out through this tool. Never the whole picture. */
  throughUs: number;
  /** Everything on the account, when we can see it. Null when we cannot. */
  onTheAccount: number | null;
  /** The line the screen shows, which says which of the two it is counting. */
  countSays: string;
  /** ISO date of the most recent one we know of, or null. */
  lastPostedOn: string | null;
  connection: ConnectionState;
  /** The best post we can honestly name, or null. See `bestBy`. */
  best: Best | null;
  /** Why there are no numbers, in the customer's terms. Null when there are. */
  noMetricsBecause: string | null;
}

export function summarise(tracking: ChannelTracking[]): ChannelSummary[] {
  return tracking.map(t => {
    const throughUs = t.published.length;
    const ours = throughUs ? t.published[throughUs - 1].at.slice(0, 10) : null;
    const onTheAccount = t.history ? t.history.posts : null;
    const theirs = t.history?.lastPostedOn ?? null;
    const last = [ours, theirs].filter(Boolean).sort().pop() ?? null;
    return {
      channel: t.channel,
      label: CHANNEL[t.channel].label,
      throughUs,
      onTheAccount,
      countSays: countSays(throughUs, onTheAccount),
      lastPostedOn: last,
      connection: t.connection,
      best: bestBy(t.published),
      noMetricsBecause: whyNoMetrics(t),
    };
  });
}

/**
 * What the count is actually counting, said so nobody has to guess.
 *
 * "3 posted" next to an Instagram account they have run for four years reads as
 * a claim about their whole history, and it is wrong. Raj caught it on the
 * screen. Until an account is connected the only honest phrasing names the
 * boundary: three went out through here, and we cannot see the rest.
 */
export function countSays(throughUs: number, onTheAccount: number | null): string {
  if (onTheAccount === null) {
    return throughUs === 0
      ? 'Nothing through here yet. We cannot see what is already on your account.'
      : `${throughUs} through here. We cannot see the rest of your account yet.`;
  }
  return `${onTheAccount} on the account, ${throughUs} of them through here.`;
}

/**
 * The reason a channel shows no numbers, said the way a customer would hear it.
 *
 * Never "not checked" on its own: the base prompt's rule is that a gap carries
 * its reason or the reader assumes there was nothing to find.
 */
export function whyNoMetrics(t: ChannelTracking): string | null {
  const c = t.connection;
  if (c.state === 'ineligible') {
    return c.because === 'personal-account'
      ? 'These numbers only exist for a business or creator account. Yours is a personal one, and switching it over is free and takes a minute.'
      : 'These numbers need your account joined to a Facebook page. Ours is not, and that is the only thing missing.';
  }
  if (c.state === 'not-connected') return 'Connect the account and we can show how each post did.';
  if (c.state === 'expired') return 'The connection lapsed. Reconnect and the numbers come back.';
  if (!t.published.some(p => p.metrics)) return 'Nothing has gone out yet with the connection in place.';
  return null;
}

/**
 * The best post, by the one number we actually read.
 *
 * Reach first because it is the only one that is not a popularity contest, then
 * whatever else exists. Returns null rather than picking from nothing, and
 * never compares a post that has a number against one that does not.
 */
export interface Best {
  url: string; on: string; metric: string; value: number;
  /** How many posts had this number. The denominator, never dropped. */
  outOf: number;
  /** How many went out in total. `outOf` is usually smaller. */
  ofPosted: number;
  /** The sentence, bounded by construction so no caller has to remember. */
  says: string;
}

const METRIC_WORD: Record<string, string> = {
  reached: 'reached', likes: 'likes', saves: 'saves', comments: 'comments',
};

export function bestBy(published: Published[]): Best | null {
  const order: (keyof Omit<Metrics, 'read'>)[] = ['reached', 'likes', 'saves', 'comments'];
  for (const metric of order) {
    const withIt = published.filter(p => typeof p.metrics?.[metric] === 'number');
    if (withIt.length < 2) continue;   // "best of one" is not a finding
    const top = withIt.reduce((a, b) => (b.metrics![metric]! > a.metrics![metric]! ? b : a));
    const value = top.metrics![metric] as number;
    const on = top.at.slice(0, 10);
    /* THE DENOMINATOR IS PART OF THE CLAIM.
       "the most this month" over four posts when we could only read two of them
       is the unbounded count the Competitor Tracker found on its own screen on
       15 September, in our code and in this file's own worked example. A
       superlative without its denominator asserts past what was read, which is
       the one thing this product exists not to do. */
    const says = withIt.length === published.length
      ? `${value} ${METRIC_WORD[metric]} on ${on}, the most of your ${published.length}.`
      : `${value} ${METRIC_WORD[metric]} on ${on}, the most of the ${withIt.length} we have numbers for, out of ${published.length} posted.`;
    return { url: top.url, on, metric, value, outOf: withIt.length, ofPosted: published.length, says };
  }
  return null;
}

/**
 * A superlative with no denominator.
 *
 * "the most this month", "your best post", "highest reach" are all claims about
 * a set, and the set is never every post: it is the posts we could read. The
 * sentence has to say which. `bestBy` builds a bounded one so nothing downstream
 * has to remember, and this catches anything that does not come from there.
 */
const SUPERLATIVE = /\b(?:the (?:most|best|highest|lowest|fewest|worst)|your best|your worst|best[- ]performing|top[- ]performing|highest|record)\b/i;
const METRIC_CONTEXT = /\b(?:reach|reached|likes?|saves?|comments?|views?|posts?|performing|engagement)\b|\d/i;
const BOUNDED = /\b(?:of (?:the |your |all )?\d+|out of \d+|of the \d+ we|we have numbers for|we could read)\b/i;

export function findUnboundedSuperlatives(shown: string): string[] {
  const bad: string[] = [];
  for (const sentence of shown.split(/(?<=[.!?])\s+|\n+/)) {
    /* A superlative is only a claim about our data when it sits beside our
       data. "He is the best in the chair on a busy Saturday" is colour and
       names no metric; "That was your best post" and "your highest reach" both
       do, with no number in either, which is why requiring a digit was too
       strict and let the vaguest version through. */
    if (!METRIC_CONTEXT.test(sentence)) continue;
    const m = sentence.match(SUPERLATIVE);
    // Sentence-scoped on purpose: these lines are read alone, one in a tile and
    // one in a row, so a denominator in the next sentence does not rescue this
    // one. Same reasoning the Tracker recorded for its own unbounded counts.
    if (m && !BOUNDED.test(sentence)) bad.push(sentence.trim());
  }
  return bad;
}

/* ── What we may say about a number ───────────────────────────────────────── */

/**
 * WE REPORT WHAT HAPPENED. WE NEVER SAY WHY.
 *
 * At nine posts a month, engagement is decided by the time of day, the follower
 * count and whether the algorithm surfaced it. "Before-and-afters do better" off
 * nine points with no control is the invented benchmark again, wearing our own
 * data as a disguise, and the owner will act on it.
 *
 * "Your 22 September post reached 412, the most this month" is a fact with a
 * source and a date. "Because it had a before-and-after" is a claim no amount of
 * this data supports. The line is not a threshold to be tuned upward later: it
 * is the difference between a reading and an inference.
 */
const INFERENCE = [
  /* "since" is out. It is causal in "since it had a photo" and temporal in
     "anything you have told us since", and the screen uses the second. A guard
     that fires on a clean screen is one nobody reads by the third week, and
     then it protects nothing. The causal senses that matter are all still
     here, and the verb patterns below catch the shape anyway. */
  /\b(?:because|due to|thanks to|driven by|down to|on account of)\b/i,
  /* 'more' and 'fewer' are out of THIS pattern: "what to do more of" is a
     barber writing to his customers. */
  /\b(?:do|does|did|perform|performs|performed|work|works|worked)\s+(?:better|worse|best|well|badly)\b/i,
  /* But taking them out lost "Your carousels get more saves", which is the
     single sentence this guard exists to stop. Narrow the context, not the
     keyword: it is a claim when the thing being compared is a number we read. */
  /\b(?:get|gets|got|getting|bring|brings|earn|earns)\s+(?:more|fewer|less|better)\s+(?:reach|likes|saves|comments|views|engagement|attention|bookings|enquiries)\b/i,
  /\b(?:post more|try more|stick to|lean into|double down|focus on|you should post)\b/i,
  /\b(?:tend to|tends to|typically|usually|generally|consistently)\b/i,
  /\b(?:outperform|outperforms|outperformed|beats?|beat)\b/i,
  /\bthe reason\b/i,
];

export function findUnearnedInference(text: string): string[] {
  const found: string[] = [];
  for (const re of INFERENCE) {
    const m = text.match(re);
    if (m) found.push(m[0].trim());
  }
  return found;
}

/** A number we state must say where it came from and when we read it. */
export function findUnsourcedMetrics(tracking: ChannelTracking[], now: Date): string[] {
  const bad: string[] = [];
  for (const t of tracking) {
    for (const p of t.published) {
      if (!p.metrics) continue;
      const read = p.metrics.read;
      if (!read || !read.readAt || !read.from) { bad.push(`${p.url}: a number with no source`); continue; }
      const when = Date.parse(read.readAt);
      if (Number.isNaN(when) || when > now.getTime()) bad.push(`${p.url}: read on ${read.readAt}`);
    }
  }
  return bad;
}

/**
 * A metric we never asked for is not a zero.
 *
 * `undefined` means we did not ask, `null` means we asked and it was not there.
 * Rendering either as 0 is the same defect as treating an unread field as a
 * finding, and it is the one an owner spots immediately.
 */
export function findZeroedGaps(published: Published[]): string[] {
  const bad: string[] = [];
  for (const p of published) {
    if (!p.metrics) continue;
    for (const [k, v] of Object.entries(p.metrics)) {
      if (k === 'read') continue;
      if (v === 0) bad.push(`${p.url}: ${k} is 0, which has to be a real zero and not a missing one`);
    }
  }
  return bad;
}

/* ── The paste-a-link route ───────────────────────────────────────────────── */

export type LinkProblem = 'empty' | 'not-a-url' | 'wrong-channel' | 'not-a-post';

/** A pasted link has to be a post on the channel the slot was written for. */
export function checkLink(url: string, channel: Channel): LinkProblem[] {
  const problems: LinkProblem[] = [];
  const trimmed = url.trim();
  if (!trimmed) return ['empty'];
  let parsed: URL;
  try { parsed = new URL(trimmed); } catch { return ['not-a-url']; }
  if (parsed.protocol !== 'https:') problems.push('not-a-url');

  const host = parsed.hostname.replace(/^www\./, '');
  const expected: Record<Channel, string[]> = {
    instagram: ['instagram.com'],
    facebook: ['facebook.com', 'fb.com'],
    linkedin: ['linkedin.com'],
    'google-business': ['google.com', 'business.google.com', 'maps.google.com', 'g.co'],
  };
  if (!expected[channel].some(h => host === h || host.endsWith(`.${h}`))) problems.push('wrong-channel');
  // A profile is not a post, and pasting one is the easy mistake.
  if (channel === 'instagram' && !/\/(p|reel|tv)\//.test(parsed.pathname)) problems.push('not-a-post');
  return problems;
}

/**
 * Never imply access we do not ask for.
 *
 * The connect copy is read at the moment someone decides whether to trust us
 * with their account, and it sits next to Meta's own permission screen, which
 * lists exactly what we asked for. A sentence here that promises more than that
 * list is caught out one click later, and there is no recovering it.
 *
 * We read posts and their numbers. We cannot post, message, or see followers.
 */
const OVERCLAIM = [
  /\bpost(?:s|ing)? (?:for|as) you\b/i,
  /\b(?:we|it) (?:can|will) post\b/i,
  /\bschedul(?:e|es|ing)\b/i,
  /\bmanage your (?:account|page|profile)\b/i,
  /\b(?:your|their) (?:followers|audience|dms|messages|inbox)\b/i,
  /\bfull access\b/i,
  /\btake over\b/i,
  /\bwe handle (?:it|everything|your)\b/i,
];

function sentenceOf(text: string, index: number): string {
  const start = Math.max(0, Math.max(text.lastIndexOf('.', index), text.lastIndexOf('\n', index)) + 1);
  const rest = text.slice(index).search(/[.\n]/);
  return text.slice(start, rest === -1 ? text.length : index + rest);
}

export function findOverclaimedAccess(connectCopy: string): string[] {
  const found: string[] = [];
  for (const re of OVERCLAIM) {
    // "We cannot post as you" is the sentence that prevents the problem, so a
    // denial is not a breach of the rule it exists to state.
    for (const m of connectCopy.matchAll(new RegExp(re.source, 'gi'))) {
      // The denial is checked across the whole sentence, not the words just
      // before. "We cannot post as you, read your messages, or see who follows
      // you" is one "cannot" governing three clauses, and a 30-character
      // lookback cleared the first and flagged the other two.
      if (/\b(?:cannot|can't|never|do not|don't|will not|won't)\b/i.test(sentenceOf(connectCopy, m.index!))) continue;
      found.push(m[0].trim());
    }
  }
  return found;
}

/** One pass over everything the tracking section shows. */
export function validateTracking(tracking: ChannelTracking[], shown: string, now = new Date()) {
  return {
    unsourced: findUnsourcedMetrics(tracking, now),
    inference: findUnearnedInference(shown),
    overclaimed: findOverclaimedAccess(shown),
    unbounded: findUnboundedSuperlatives(shown),
    zeroedGaps: tracking.flatMap(t => findZeroedGaps(t.published)),
    summaries: summarise(tracking),
  };
}
