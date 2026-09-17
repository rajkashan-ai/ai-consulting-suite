/**
 * Trying again, and trying elsewhere.
 *
 * The job of this tool is to find the best competitor data there is. Until now
 * it took the first two listing platforms it recognised, read them, and carried
 * on with whatever came back. If Checkatrade returned 403 and the other one
 * timed out, the run continued with nothing off either, told the owner nothing,
 * and the thin result looked exactly like a thin market.
 *
 * Two different failures were being treated the same way, and they are not the
 * same at all:
 *
 *   settled     403, robots, behind a login, page not there. Asking again gets
 *               the same answer. Asking twice is rude and wastes the run.
 *   transient   a timeout, an empty body, their server having a bad minute.
 *               Asking again is exactly the right thing to do.
 *
 * So: a settled refusal moves us to the next platform, a transient one is
 * retried once, and we keep going until we have enough names or have run out of
 * places to look. Whatever refused us is recorded and shown, because a source
 * we could not read is a fact about the run that the owner is entitled to.
 *
 * No clock, no network. It is given what has happened and says what to do next.
 */

import { rightTrade } from "./sift.ts";

export type Attempt = { url: string; ok: boolean; note: string };

/**
 * Worth asking again. Deliberately narrow: anything not recognised is treated
 * as settled, so a note nobody anticipated costs one attempt rather than
 * hammering somebody's server.
 */
const TRANSIENT =
  /timeout|timed out|did not answer|nothing in it|empty|temporar|\b5\d\d\b|again later|reset|ECONNRESET/i;

/**
 * Settled, whatever else the note says. Checked first, because a 403 page whose
 * body happens to contain the word "temporary" is still a 403.
 */
const SETTLED =
  /refused|forbid|403|robots|login|sign in|not there|does not resolve|404|not found|blocked/i;

export function worthRetrying(note: string): boolean {
  if (!note) return false;
  if (SETTLED.test(note)) return false;
  return TRANSIENT.test(note);
}

/** Different hosts, so there is never a reason to wait for one before asking another. */
export const AT_ONCE = 2;

/**
 * The ceiling on how many fetches one round of looking may cost.
 *
 * A bound, not a target. Without one, a trade whose every platform times out
 * would keep the run going until the watchdog stopped it, and the owner would
 * wait ten minutes to be told nothing.
 */
export const MOST_TRIES = 6;

/** Names off a listing before we stop looking for more places to look. */
export const ENOUGH_NAMES = 10;

/**
 * Rows carrying a price or a rating before we stop looking for more.
 *
 * Five, because five is what a comparison is built from. Fewer than that and
 * the grid has columns with nothing in them, which is what the owner is shown
 * and what she is asked to price against.
 */
export const ENOUGH_PRICED = 5;

/**
 * What to fetch next.
 *
 * Untried places first, because a different platform is a better bet than the
 * same one twice. Then anything transient that has only been asked once.
 */
export function nextToTry(wanted: string[], tried: Attempt[]): string[] {
  const attempts = new Map<string, Attempt[]>();
  for (const a of tried) {
    attempts.set(a.url, [...(attempts.get(a.url) ?? []), a]);
  }

  if (tried.length >= MOST_TRIES) return [];

  const touched = new Set(tried.map((a) => hostOf(a.url)));
  const untried = wanted
    .filter((u) => !attempts.has(u))
    // A platform we have not looked at at all before a second page of one we
    // have. Different platforms list different businesses; two pages of the
    // same one mostly list the same businesses twice.
    .sort((a, b) => Number(touched.has(hostOf(a))) - Number(touched.has(hostOf(b))));

  const askAgain = wanted.filter((u) => {
    const mine = attempts.get(u) ?? [];
    if (!mine.length || mine.length > 1) return false;   // never tried, or already retried
    if (mine.some((a) => a.ok)) return false;            // it worked
    return worthRetrying(mine[0].note);
  });

  return [...untried, ...askAgain].slice(0, Math.min(AT_ONCE, MOST_TRIES - tried.length));
}

/**
 * Have we finished looking?
 *
 * Enough names is not the same as enough coverage, and treating them as the
 * same cost us a whole platform. A real run searched Booksy and Fresha, got
 * twelve Fresha results, read Booksy first, found thirty two names, decided
 * that was plenty and stopped. Every barber who is on Fresha and not on Booksy
 * was invisible, and nothing on the page said so.
 *
 * So: one page from each platform we found, before the name count is allowed
 * to end the search. Different platforms list different businesses, which is
 * the entire reason we look at more than one.
 */
export function enough(
  rows: { name: string; url?: string | null; price?: number | null; rating?: number | null }[],
  wanted: string[],
  tried: Attempt[],
  trade: string | null = null,
): boolean {
  // The ceiling, and it was already here: nextToTry returns nothing once
  // MOST_TRIES pages have been read, so this can never dig past six however
  // little it finds. The stage cap and its token budget sit behind it.
  if (nextToTry(wanted, tried).length === 0) return true;

  const seen = new Set(tried.map((a) => hostOf(a.url)));
  const all = new Set(wanted.map(hostOf));
  const platformsLeft = [...all].some((h) => !seen.has(h));
  if (platformsLeft) return false;

  /**
   * Rows we could actually build a comparison from, not names.
   *
   * On 2026-09-17 this counted names and stopped at 58 of them, leaving
   * fresha.com/lp/en/bt/hair-salons/in/gb-st-albans unopened: 40 salon profile
   * links, 38 ratings and 34 prices. Of the 58 names it had, 13 carried a price
   * or a rating and every one of those 13 was a barber, filtered out for a
   * hairdresser. So the run compared five salons with nothing published against
   * any of them and reported that as a finding about her market.
   *
   * A name with no price and no rating fills a column and says nothing, and
   * nothing about a name tells you whether the next page is the one with the
   * numbers on it. Count what a comparison needs instead.
   */
  const usable = rightTrade(rows, trade).filter(
    (r) => r.price != null || r.rating != null,
  ).length;

  return usable >= ENOUGH_PRICED;
}

/**
 * What to tell the owner about a place we could not read.
 *
 * Every refusal is shown. A source that turned us away is a fact about the run,
 * and hiding it is how a thin result passes for a thin market.
 */
export function refusals(tried: Attempt[]): { name: string; reason: string }[] {
  const worst = new Map<string, Attempt>();

  for (const a of tried) {
    if (a.ok) {
      worst.delete(hostOf(a.url));
      continue;
    }
    // One line per place, not per attempt: an owner does not need to know we
    // asked twice.
    if (!worst.has(hostOf(a.url))) worst.set(hostOf(a.url), a);
  }

  return [...worst.entries()].map(([host, a]) => ({ name: host, reason: a.note }));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // Not a url we can parse. Expected: these come off pages we did not
    // write, and showing the raw string is the right answer.
    return url;
  }
}
