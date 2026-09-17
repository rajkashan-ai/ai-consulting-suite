/**
 * Is this competitor still trading, and how busy are they right now?
 *
 * WHY THIS EXISTS, AND THE MISTAKE IT CORRECTS
 * The screen said we could not tell whether a competitor was still active,
 * because Instagram and Facebook do not let us read post dates. Raj challenged
 * it. The block was real but the conclusion was not: a post date is one way to
 * answer that question and it is not the only one, nor the best one.
 *
 * Booksy venue pages carry schema.org Review markup with `datePublished`, they
 * are allowed by robots.txt, and we already read them for prices. A dated review
 * beats a dated post, because a review means somebody paid and walked in.
 *
 * THE LESSON, WHICH IS WORTH MORE THAN THIS FILE
 * An uncheck must name the question, not the method. "We cannot read post dates"
 * is a fact about a method. "We cannot tell whether they are still active" was a
 * claim about the question, and it was wrong. Write the question, then go
 * looking for any route to it.
 *
 * WHAT WE MAY NOT SAY
 * A venue page shows a sample of reviews, not all of them. The newest date is
 * reliable. A count over a window is a floor and says so.
 */
import type { Claim, Source } from './types.ts';

/** schema.org first. A bare date somewhere in the page is a weaker fallback. */
export function reviewDatesFrom(html: string): string[] {
  const schema = [...html.matchAll(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/g)].map(m => m[1]);
  if (schema.length > 0) return [...new Set(schema)].sort();
  const loose = [...html.matchAll(/\b(20\d\d-\d\d-\d\d)\b/g)].map(m => m[1]);
  return [...new Set(loose)].sort();
}

export interface Activity {
  /** ISO date of the newest review we could see, or null if there are none. */
  lastReviewOn: string | null;
  daysSince: number | null;
  /** How many of the reviews ON THE PAGE fall in the window. A floor, never a total. */
  inWindow: number;
  windowDays: number;
  /** How many dated reviews the page showed us, so the floor can be read properly. */
  sampleSize: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function activityFrom(dates: string[], now: Date, windowDays = 30): Activity {
  const valid = dates
    .map(d => ({ iso: d, t: Date.parse(d) }))
    .filter(d => !Number.isNaN(d.t) && d.t <= now.getTime())   // a future review is not a review
    .sort((a, b) => a.t - b.t);

  if (valid.length === 0) {
    return { lastReviewOn: null, daysSince: null, inWindow: 0, windowDays, sampleSize: 0 };
  }
  const newest = valid[valid.length - 1];
  const cutoff = now.getTime() - windowDays * DAY;
  return {
    lastReviewOn: newest.iso,
    daysSince: Math.floor((now.getTime() - newest.t) / DAY),
    inWindow: valid.filter(d => d.t >= cutoff).length,
    windowDays,
    sampleSize: valid.length,
  };
}

/** Beyond this, a business that lives on reviews has probably gone quiet. */
export const QUIET_AFTER_DAYS = 60;

export type Verdict = 'busy' | 'ticking over' | 'trading' | 'quiet' | 'unknown';

export function verdict(a: Activity): Verdict {
  if (a.daysSince === null) return 'unknown';
  if (a.daysSince > QUIET_AFTER_DAYS) return 'quiet';
  // "Busy" is a claim about a rate, so it needs enough reviews to be a rate.
  // With a sample of two, all we honestly know is that they are still trading.
  if (a.sampleSize < MEANINGFUL_SAMPLE) return 'trading';
  return a.inWindow >= 5 ? 'busy' : 'ticking over';
}

/**
 * The claim, written so the sample is visible in the sentence.
 *
 * "13 reviews in the last 30 days" would be a total we do not have. "13 of the
 * reviews on their page are from the last 30 days" is what we read.
 */
export function describeActivity(name: string, a: Activity, source: Source): Claim {
  if (a.lastReviewOn === null) {
    return {
      text: `${name}: no reviews anywhere we can see, so nothing here says whether they are busy`,
      value: null,
      source: null,
    };
  }
  const ago = a.daysSince === 0 ? 'today' : a.daysSince === 1 ? 'yesterday' : `${a.daysSince} days ago`;
  // A Booksy page carries two dated reviews in its markup. "2 of 2 are from the
  // last 30 days" is arithmetic on a sample of two, which is noise dressed as a
  // finding. Below the floor, the date stands on its own.
  const rate = a.sampleSize >= MEANINGFUL_SAMPLE
    ? `, and ${a.inWindow} of the ${a.sampleSize} reviews on their page are from the last ${a.windowDays} days`
    : '';
  return { text: `${name}: last review ${ago}${rate}`, value: a.daysSince, source };
}

/** Below this many dated reviews, a rate over a window says nothing. */
export const MEANINGFUL_SAMPLE = 5;

/* ── Is the website being kept up? ────────────────────────────────────────── */

/**
 * A sitemap's `lastmod` says when a page was last changed. It is a weaker signal
 * than a review and a real one: a site untouched for two years is a business
 * that has stopped thinking about its website.
 */
export function newestLastmod(sitemapXml: string): string | null {
  const dates = [...sitemapXml.matchAll(/<lastmod>\s*(\d{4}-\d{2}-\d{2})/g)].map(m => m[1]).sort();
  return dates.length > 0 ? dates[dates.length - 1] : null;
}
