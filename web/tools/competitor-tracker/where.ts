import { EVERY, GENERAL, SPECIALIST, blockedHosts, sourcesFor } from "../sources/uk-directories.ts";
import type { Business } from "../types.ts";
import { startWith, type Playbook } from "./playbook.ts";

/**
 * Where to look for this trade, and why.
 *
 * Four tiers, tried in order, and the first one that has anything wins. The
 * point of the order is that measured evidence beats curated evidence, and
 * curated beats nothing, but nothing is never the answer: a run that reaches
 * tier three still has somewhere to go.
 *
 * WHAT THIS FIXES
 * A trade nobody had run before started with an empty list, because the only
 * source of hosts was a playbook that is written by successful runs. That is a
 * deadlock: no run, no playbook, and no playbook, no run. A bakery run on
 * 2026-09-15 failed in 79 seconds having read no listing at all.
 *
 * WHY THE SEEDED LIST IS TIER TWO AND NOT TIER ONE
 * A platform that actually named seventy barbers in a real town is better
 * evidence than a platform a research pass said lists barbers. The seeded list
 * is a floor for trades we have never done, not a replacement for what we have
 * measured. The risk this accepts is that one bad run poisons a trade, which is
 * what the blank count in playbook.ts is for.
 */

export type Tier = "owner" | "playbook" | "seeded" | "floor";

export type Where = {
  /** Hosts to search first, best evidence first, deduplicated. */
  hosts: string[];
  /** Which tier each host came from, for the run's own record. */
  from: Record<string, Tier>;
  /** The best tier that produced anything. */
  best: Tier | null;
};

const host = (raw: string) => raw.toLowerCase().replace(/^www\./, "").trim();

/**
 * Hosts from the seeded list: the specialists that name this exact trade.
 *
 * The general directories are separated out rather than mixed in, because a
 * specialist carries prices and services and a general directory carries a
 * name and a star. Telling them apart is what lets a run say it is on the
 * floor rather than pretending it has a lead.
 */
export function seeded(trade: string | null): { specialists: string[]; floor: string[] } {
  const open = sourcesFor(trade);
  return {
    specialists: open.filter((d) => !d.covers.includes(EVERY)).map((d) => host(d.host)),
    floor: open.filter((d) => d.covers.includes(EVERY)).map((d) => host(d.host)),
  };
}

export function whereToLook(
  trade: string | null,
  playbook: Playbook | null,
  ownWords: string[],
): Where {
  const { specialists, floor } = seeded(trade);

  /**
   * The owner's answer is evidence, and it still cannot send us somewhere that
   * refuses us.
   *
   * "A marketplace or directory" maps to Yell, which returns a Cloudflare
   * challenge, and "Checkatrade, MyBuilder or similar" leads with Checkatrade,
   * which 403s. The seeded tiers filter these out through sourcesFor; this tier
   * did not, so the owner's honest answer bought a targeted search of a site we
   * cannot read and pushed a readable one out of the two we make.
   */
  const blocked = new Set(blockedHosts());

  const tiers: [Tier, string[]][] = [
    ["owner", ownWords.map(host).filter((h) => !blocked.has(h))],
    ["playbook", startWith(playbook).map(host)],
    ["seeded", specialists],
    ["floor", floor],
  ];

  const hosts: string[] = [];
  const from: Record<string, Tier> = {};
  let best: Tier | null = null;

  for (const [tier, list] of tiers) {
    for (const h of list) {
      if (!h || from[h]) continue;
      from[h] = tier;
      hosts.push(h);
      best ??= tier;
    }
  }

  return { hosts, from, best };
}

/**
 * The words to search with, when the category does not say.
 *
 * "Something else" is a real choice in the dropdown and its id is `other`, so
 * the broad searches became "other shrewsbury" and "best other shrewsbury".
 * That is not a near miss, it is a search for the word other.
 *
 * So for an unmatched business we use what it said about itself instead. Their
 * own sentence and their own service names are better than our category list
 * by definition: the list not having them is why we are here.
 *
 * No trade at all is a different thing and gets nothing. Setup asks for one and
 * will not finish without it, so a blank means setup did not finish, and the
 * run should stop and say which detail is missing rather than guess from a
 * marketing sentence. Only "Something else" earns the fallback: that is a
 * customer telling us they are not on the list.
 */
export function wordsFor(business: Business): string | null {
  if (!business.trade) return null;
  if (business.trade !== "other") return business.trade;

  const fromServices = business.services?.[0]?.name?.trim();
  if (fromServices) return fromServices.toLowerCase();

  // The first clause of their own sentence. A whole sentence is not a search
  // term, and the first clause is where a business says what it is.
  const line = business.oneLiner?.split(/[.,;:]| - | and /)[0]?.trim();
  if (line && line.length >= 3 && line.split(/\s+/).length <= 6) return line.toLowerCase();

  return null;
}

/**
 * The key this business's learning is stored under.
 *
 * An unmatched business must never read or write the bare `other` row: every
 * unmatched business in the country would share it, so a scaffolder would be
 * sent where a wedding cake maker had been. Keying on their own wording keeps
 * them apart and, as a side effect, tells us which real trades are hiding
 * inside "Something else".
 *
 * Null means learn nothing. A business we cannot name is one we cannot file.
 */
export function playbookKey(business: Business): string | null {
  if (!business.trade) return null;
  if (business.trade !== "other") return business.trade;

  const words = wordsFor(business);
  if (!words) return null;
  return `other:${words.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}`;
}

/** An unmatched business, filed under its own words rather than a trade. */
export const isUnmatched = (key: string | null) => !!key?.startsWith("other:");

/**
 * Which page to read about a business, when a search offers several.
 *
 * 2026-09-17. Five competitors were chosen and two were readable. For Atelier
 * Salon & Spa the lookup took a Cylex directory page, which refused us and gave
 * nothing; for Jenna-lou Lashes it took a Facebook page, which robots.txt asks
 * us not to read. Meanwhile the listing had already handed us
 * fresha.com/a/a-j-studio-... for another of the five, and that read cleanly at
 * 12,000 characters with prices and a rating on it.
 *
 * Three tiers, and the first two come from the source registry rather than a
 * list written here, so a platform that starts carrying prices is promoted by
 * editing the fact rather than this function:
 *
 *   1  a booking platform's own profile, which carries prices and ratings
 *   2  the business's own site, which is anything the registry does not know
 *   3  a directory or a social page, last resort
 *
 * A ranking, not a gate: tier 3 is still used when nothing better verifies. So
 * a host we have misjudged costs a worse page, never a missing competitor,
 * which is the failure direction to prefer.
 */
const SOCIAL = ["facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com"];

export function tierOf(url: string): 1 | 2 | 3 {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return 3; // not a url we can place, so never preferred
  }

  if (SOCIAL.some((s) => host.endsWith(s))) return 3;

  const known = [...GENERAL, ...SPECIALIST].find(
    (d) => host === d.host.toLowerCase().replace(/^www\./, "") ||
      host.endsWith(`.${d.host.toLowerCase().replace(/^www\./, "")}`),
  );

  // Not a source we know: their own site.
  if (!known) return 2;

  // A platform that publishes what a comparison needs, and that we can reach.
  const rich = known.carries.includes("prices") || known.carries.includes("ratings");
  if (rich && known.reachable.state !== "blocked") return 1;

  return 3;
}

/** The same results, best page first. Stable, so equal tiers keep search order. */
export const bestFirst = <T extends { url: string }>(results: T[]): T[] =>
  results.map((r, i) => ({ r, i })).sort((a, b) => tierOf(a.r.url) - tierOf(b.r.url) || a.i - b.i)
    .map(({ r }) => r);

/**
 * The hosts that publish a price and that we can actually reach.
 *
 * WHY A SECOND SEARCH EXISTS AT ALL
 * A competitor picked off a listing often arrives with no link. Fresha's
 * listing page is the case that proved it: its server HTML carries schema.org
 * JSON-LD with a name and a postal address for each business and nothing else.
 * No venue link, and the string "price" does not appear in the page at all.
 * Checked by fetching it on 2026-09-18: 300 anchors, none pointing at a venue.
 *
 * So `fetchable()` correctly stores no url, and the only route to that
 * business's prices is to go and find their page on a platform that prints
 * them. The general search by name is a lottery: it returned a Cylex directory
 * that refused us for one of these five, and a booking profile that read
 * cleanly at 12,000 characters for another.
 *
 * Read off the registry rather than typed here, so adding a platform to
 * `uk-directories.ts` is the only edit needed, and a platform we have recorded
 * as blocked is never searched for.
 */
export function sitesThatPublishPrices(): string[] {
  return [...GENERAL, ...SPECIALIST]
    .filter((d) => d.carries.includes("prices") && d.reachable.state !== "blocked")
    .map((d) => d.host.replace(/^www\./, "").toLowerCase())
    .filter((h, i, all) => all.indexOf(h) === i);
}

/**
 * Whether a search gave us anywhere that could carry a price.
 *
 * Tier one is exactly "a source that carries prices or ratings and is not
 * blocked", so this asks the question `tierOf` already answers rather than
 * inventing a second definition of a good result.
 */
export const hasAPricedSource = (results: readonly { url: string }[]): boolean =>
  results.some((r) => tierOf(r.url) === 1);
