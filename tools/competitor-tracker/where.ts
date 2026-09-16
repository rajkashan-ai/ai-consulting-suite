import { EVERY, sourcesFor } from "../sources/uk-directories.ts";
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

  const tiers: [Tier, string[]][] = [
    ["owner", ownWords.map(host)],
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
