/**
 * The shape of a 30-day plan, as CLAUDE.md sections 3, 3a and 5 define it.
 *
 * Everything here is deliberately boring data. The prose the tool writes is
 * graded by `evals/cases.ts`; this file is the part a plain equality test can
 * check, and it is where every rule that must never break is made checkable.
 */

/* ── Cadence: the one question that changes the size of the output ────────── */

export type Cadence = 'weekly' | 'twice-weekly' | 'most-days';

export const CADENCES: readonly Cadence[] = ['weekly', 'twice-weekly', 'most-days'];

/** What we call each one on screen. One wording, so the plan and the question match. */
export const CADENCE_LABEL: Record<Cadence, string> = {
  'weekly': 'Once a week',
  'twice-weekly': 'A couple of times a week',
  'most-days': 'Most days',
};

/* ── The mix, in whole posts (CLAUDE.md 3a) ───────────────────────────────── */

export type Purpose = 'useful' | 'question' | 'offer';

export interface Mix { useful: number; question: number; offer: number }

/**
 * Counts, not percentages.
 *
 * The draft set a strict 70/20/10. Seventy per cent of four posts is 2.8 posts,
 * and four posts is what a weekly cadence means, so the ratio was arithmetic
 * that could never be satisfied. These are whole posts and they add up.
 *
 * At four a month the question post is the one that goes: a poll is what you can
 * least afford when you only get four. The offer never goes, because a month
 * with no ask in it has failed at the job the tool exists to do.
 */
export const MIX: Record<Cadence, Mix> = {
  'weekly':       { useful: 3,  question: 0, offer: 1 },
  'twice-weekly': { useful: 6,  question: 2, offer: 1 },
  'most-days':    { useful: 15, question: 5, offer: 2 },
};

export const OFFERS_MIN = 1;
export const OFFERS_MAX = 2;

/* ── Angles: what stops a month of posts reading as one post ──────────────── */

/**
 * The draft called repetition the biggest risk in a 30-day plan and it was
 * right. Its fix was to document a "twist" inside the plan, which puts our
 * working in the customer's export. So the angle is data, it is checked in
 * code, and it is never named to the customer.
 */
export type Angle =
  | 'how-it-works'    // explain one thing in their trade
  | 'what-it-costs'   // the price, and what sits behind it
  | 'the-mistake'     // what people get wrong
  | 'before-after'    // the work itself, shown
  | 'asked-a-lot'     // a question they answer at the counter every week
  | 'this-week'       // what actually happened
  | 'not-for-you'     // who this is not for, said kindly
  | 'the-timing'      // the season, the month, the deadline
  | 'ask-them'        // a question put to the reader
  | 'the-ask';        // the offer

export const ANGLES: readonly Angle[] = [
  'how-it-works', 'what-it-costs', 'the-mistake', 'before-after', 'asked-a-lot',
  'this-week', 'not-for-you', 'the-timing', 'ask-them', 'the-ask',
];

/** No angle twice in a row, and none more than this many times in one month. */
export const ANGLE_MAX_PER_MONTH = 3;

import { CAPS, TITLES } from './platform.ts';

/* ── Channels, and how long a post is on each ─────────────────────────────── */

export type Channel = 'instagram' | 'facebook' | 'linkedin' | 'google-business' | 'tiktok' | 'youtube';

/**
 * `words` is our editorial choice and is the rule the tool is held to.
 *
 * `words` and `medium` are ours. `capChars` and `titleChars` are facts about
 * someone else's product, so they are not written here: they come from
 * `platform.ts`, where each one carries its source and the date it was checked,
 * and four of them are marked unverified rather than given a date nobody earned.
 *
 * `medium` is not decoration. Every post in this tool carries an instruction for
 * the thing the owner has to supply, and "a photo of the boiler before and
 * after, taken on your phone in daylight" is wrong advice for TikTok. Telling a
 * barber to photograph something they cannot post is worse than saying nothing.
 *
 * `titleChars` is set only where the platform makes the post unpostable without
 * one. A YouTube upload needs a title; you cannot paste a description into an
 * empty form and be finished, and "finished posts, not hooks" (CLAUDE.md 3) is
 * the promise. Instagram and the rest have no title field at all.
 *
 * TikTok: sources disagree, 2,200 characters against 4,000, as at 15 September
 * 2026. The lower one is used because a cap that is too low never produces an
 * unpostable caption and a cap that is too high does. Only the first ~125
 * characters show before "more", which is what the word target is set by.
 */
export const CHANNEL: Record<Channel, {
  label: string; words: [number, number]; capChars: number;
  medium: 'photo' | 'video'; titleChars?: number;
}> = {
  'instagram':       { label: 'Instagram',               words: [40, 120],  capChars: CAPS.instagram.value,         medium: 'photo' },
  'facebook':        { label: 'Facebook',                words: [40, 120],  capChars: CAPS.facebook.value,          medium: 'photo' },
  'linkedin':        { label: 'LinkedIn',                words: [120, 250], capChars: CAPS.linkedin.value,          medium: 'photo' },
  'google-business': { label: 'Google Business Profile', words: [25, 80],   capChars: CAPS['google-business'].value, medium: 'photo' },
  'tiktok':          { label: 'TikTok',                  words: [20, 60],   capChars: CAPS.tiktok.value,            medium: 'video' },
  'youtube':         { label: 'YouTube',                 words: [60, 200],  capChars: CAPS.youtube.value,           medium: 'video', titleChars: TITLES.youtube.value },
};

/* ── What we recommend, and what we are allowed to say (CLAUDE.md 2b) ─────── */

/**
 * Where a reason came from. A recommendation is a claim, so every line of it
 * carries its source, the same way a Competitor Tracker claim does.
 *
 * There is no 'benchmark' and no 'their-posting-history' member, on purpose.
 * We cannot read either (`recommendation.md`), and a type that cannot express
 * them is a stronger guard than a rule saying not to.
 */
export type ReasonSource =
  | 'our-arithmetic'    // posts, photographs, channels. Ours to compute
  | 'they-told-us'      // their own answer about their time, quoted back
  | 'their-channels'    // a channel they own, and whether it is quiet
  | 'last-month'        // how much of our own last plan they marked done
  /**
   * What is already on their account. Only legitimate once an account is
   * connected, because there is no other way to read it: this member did not
   * exist until 15 September, when connecting accounts was approved. A reason
   * carrying it must also carry the reading it came from.
   */
  | 'their-history';

export interface Reason { text: string; from: ReasonSource }

/** From month two. The only measured evidence in the feature. */
export interface LastMonth { written: number; done: number }

export interface Capacity {
  /** Hours a week they said they have. One question, and we take it seriously. */
  hoursAWeek?: number;
  lastMonth?: LastMonth;
  /**
   * A cadence they picked on the screen. Beats everything else here.
   *
   * CLAUDE.md 2b: we recommend one and show the arithmetic, and their choice
   * always wins. It cannot win if it is sent as an approximate number of hours
   * and turned back into a cadence by a rule that also reads how many channels
   * they have.
   */
  chose?: Cadence;
}

export interface Recommendation {
  cadence: Cadence;
  /** Why, in whole sentences, each one sourced. */
  because: Reason[];
  /** The next cadence up, in cost and coverage. Never in results. */
  stepUp?: { to: Cadence; costs: string; covers: string };
  /** Set when we moved them down, so the screen can say it kindly. */
  steppedDownFrom?: Cadence;
}

/* ── A slot, and a written post ───────────────────────────────────────────── */

/**
 * The shape of the month exists in full from the first run. The words arrive a
 * week at a time (CLAUDE.md 3), so a Slot is what the mix and the no-repeat
 * rule are checked against, and it is what makes them hold for weeks nobody has
 * written yet.
 */
export interface Slot {
  /** ISO date. A recommendation, never a deadline. */
  date: string;
  /** Which week of the month, 1-based. */
  week: number;
  /** Why this day, in a few words: "you are not on the tools on a Tuesday". */
  dayBecause?: string;
  channel: Channel;
  angle: Angle;
  purpose: Purpose;
}

/** The words, once they exist. */
export interface Written {
  words: string;
  /** The upload's title, where the platform will not accept a post without one. */
  title?: string;
  shot: string;
  why: string;
  /** True once the owner has changed the words. Never overwritten after that. */
  editedByOwner?: true;
  /** True once the owner has marked it done. Never overwritten after that. */
  approved?: true;
  /**
   * A thing in the world this post is tied to, and the day it stops making
   * sense. A post about half term is wrong in November; a post about beard
   * sculpting is fine whenever they get to it.
   */
  occasion?: { name: string; endsOn: string };
}

/** A slot, plus its words if the week it belongs to has been written. */
export type Post = Slot & Partial<Written> & {
  /** @deprecated shape-only fields live on Slot. Kept so older code compiles. */
  words?: string;
};

/** True when the week this slot belongs to has been written. */
export function isWritten(post: Post): boolean {
  return typeof post.words === 'string' && post.words.trim() !== '';
}

export interface WeekRow { week: string; about: string; channels: Channel[] }

export interface Plan {
  business: string;
  cadence: Cadence;
  /** What we suggested and why, before they changed anything. */
  recommendation?: Recommendation;
  /** Weeks whose words have been written. The shape covers all of them. */
  weeksWritten?: number;
  /** Per channel: whether it is connected, and what has gone out. */
  tracking?: ChannelTracking[];
  /** Everything we know and must not learn twice. Applied to every run. */
  learnings?: Learning[];
  /** ISO timestamp of the run that produced this. */
  ranAt: string;
  /** The channels we found and they confirmed. We plan for these and no others. */
  channels: Channel[];
  /** "What you sound like", read back to them. */
  voice: string;
  weeks: WeekRow[];
  posts: Post[];
}

/* ── What we are allowed to say about them (CLAUDE.md 4) ──────────────────── */

/**
 * Everything the business has actually told us or we read on their own site.
 * A claim in a post that is not in here is an invention, and an invention here
 * becomes their lie rather than ours, because they post it under their name.
 */
export interface KnownFacts {
  services: string[];
  /** Service name to price as written, e.g. "classic cut" -> "£15". */
  prices: Record<string, string>;
  /** Only if they said so. Undefined means we may not mention how long they have traded. */
  yearsTrading?: number;
  accreditations: string[];
  awards: string[];
  /** Clients we may name, because they gave us permission and the detail. */
  namedClients: string[];
  /** Any counted thing they gave us: customers, jobs, followers. */
  counts: Record<string, number>;
  /** Reviews they gave us, verbatim, that we may quote as themes. */
  reviewThemes: string[];
  /** Do they serve an area, or sell beyond their doorstep? Decides "local". */
  servesAnArea: boolean;
}

/* ── Tracking a post once it is out (CLAUDE.md 6a, tracking.md) ───────────── */

/** Where a number came from, and when we read it. Never optional. */
export interface Reading { readAt: string; from: 'instagram' | 'facebook' | 'linkedin' | 'google-business' }

/**
 * What the platform told us. Every field optional, because a connected account
 * is not a promise that every number exists: a new post has no insights for a
 * few hours, and permissions vary by account type.
 *
 * `null` means we asked and it was not there. `undefined` means we never asked.
 * They are different and the screen says which.
 */
export interface Metrics {
  reached?: number | null;
  likes?: number | null;
  comments?: number | null;
  saves?: number | null;
  read: Reading;
}

/** The owner told us it went out, and where. This needs no connected account. */
export interface Published {
  /** ISO timestamp they pressed Posted. */
  at: string;
  /** The live post. Tokenless oEmbed reads its caption back from this. */
  url: string;
  /** The caption as actually published, read back. Undefined until we read it. */
  publishedWords?: string;
  metrics?: Metrics;
}

export type ConnectionState =
  | { state: 'connected'; account: string; tokenExpires: string }
  | { state: 'not-connected' }
  /** A personal account cannot give insights at all. Meta's rule, not ours. */
  | { state: 'ineligible'; because: 'personal-account' | 'no-linked-page' }
  | { state: 'expired'; account: string };

export interface ChannelTracking {
  channel: Channel;
  connection: ConnectionState;
  /** Posts that went out through this tool, oldest first. */
  published: Published[];
  /**
   * What is already on their account, read from a connected one.
   *
   * A business with an active Instagram has been posting for years, and a top
   * section that says "0 posted" because it counts only our own is both wrong
   * and insulting. Undefined until an account is connected: we cannot read this
   * logged out, which is the same wall the Competitor Tracker hit on 14
   * September.
   */
  history?: { posts: number; lastPostedOn: string | null; read: Reading };
}

/* ── What we have learned, and must not ask again (tracking.md) ───────────── */

export type LearningSource =
  | 'caption-diff'    // what they published against what we wrote
  | 'never-posted'    // a kind of post they skip every time
  | 'edited'          // a critique, or an edit to our words
  | 'completion';     // how many of a month they finished

/**
 * One thing we know about this business that we must never have to learn twice.
 *
 * `evidence` is what it rests on, in their terms. `retiredOn` is set only when
 * it stopped being true, never to tidy up: a learning that quietly disappears
 * is the regression Raj asked us to prevent.
 */
export interface Learning {
  id: string;
  learnedOn: string;
  from: LearningSource;
  /** What we now do differently, as an instruction to the writer. */
  rule: string;
  /** What it rests on. At least one, and each one a thing that happened. */
  evidence: string[];
  retiredOn?: string;
  retiredBecause?: string;
}

/* ── The critique loop (CLAUDE.md 5) ──────────────────────────────────────── */

export type CritiqueKind =
  | 'too-salesy' | 'too-formal' | 'not-how-i-talk' | 'too-long' | 'not-about-me';

export const CRITIQUES: Record<CritiqueKind, string> = {
  'too-salesy': 'Too salesy',
  'too-formal': 'Too formal',
  'not-how-i-talk': 'Not how I talk',
  'too-long': 'Too long',
  'not-about-me': 'I would not say that about myself',
};

export interface Critique {
  kind: CritiqueKind;
  /** Which post they were looking at when they said it. */
  postDate: string;
  /** Their own words, if they added any. Goes into the voice note verbatim. */
  inTheirWords?: string;
}

/** Lives on the business profile, not inside a plan, so it outlives the month. */
export interface VoiceNote {
  /** Our read of their own website copy, confirmed or corrected by them. */
  read: string;
  /** Every critique, in order. This is the part that gets better over time. */
  corrections: Critique[];
}
