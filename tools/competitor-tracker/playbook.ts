/**
 * What we know about researching one trade, learned by doing it.
 *
 * THE RULE THIS FOLLOWS
 * Nothing in a playbook is asserted. Every platform in it is there because a
 * search for that trade actually returned it and a read of it actually named
 * businesses. A hand-written "barbers are on Booksy" would be right today,
 * wrong in two years, and silent about the trades nobody thought of.
 *
 * WHAT IT CHANGES
 * The first barber we research works out that Booksy lists seventy of them in a
 * town. Every barber after that starts there instead of starting with three
 * searches that return Shrewsbury Pennsylvania.
 */

export type Platform = {
  /** booksy.com, fresha.com, checkatrade.com */
  host: string;
  /** The listing url that worked, so the shape can be reused for a new town. */
  example: string;
  /** How many businesses it actually named. Two is not seventy. */
  named: number;
  /**
   * Consecutive targeted searches of this host that came back with nothing.
   *
   * A platform that stops listing a trade does not announce it. Its count
   * would sit in the playbook at whatever it was on the day it last worked,
   * and every run after that would keep spending a search on it. Two in a row
   * is the point where it stops being bad luck.
   *
   * Only counted when we deliberately searched for this host, so a platform
   * that simply did not come up is not punished for it.
   */
  blanks?: number;
};

export type Playbook = {
  trade: string;
  platforms: Platform[];
  publishes: string[];
  deadEnds: { host: string; why: string }[];
  evidence: { url: string; on: string; what: string }[];
  timesUsed: number;
  builtFrom: string | null;
  /**
   * The distinct towns this has been used in.
   *
   * `timesUsed` counts runs, and three runs can all be the same town, so
   * `confidence` saying "used 3 times across different towns" was a claim the
   * data could not support. This is the thing it was always describing.
   */
  towns: string[];
  /**
   * Towns where every tier was tried and nothing was found.
   *
   * Kept because finding nothing is a fact about the trade, not a failure of
   * the run, and the next business in it should not pay to discover the same
   * nothing. One town settles nothing: a trade invisible in Ludlow may be all
   * over Manchester. Three different towns is the same bar `confidence` uses
   * before it trusts a playbook, so the system has one idea of enough.
   */
  nothingIn: string[];
};

export const EMPTY: Omit<Playbook, "trade"> = {
  platforms: [],
  publishes: [],
  deadEnds: [],
  nothingIn: [],
  towns: [],
  evidence: [],
  timesUsed: 0,
  builtFrom: null,
};

/**
 * Where to look first for this trade, best first.
 *
 * "Best" is how many businesses a platform actually named, not how well known
 * it is. A platform everyone has heard of that lists two barbers in a town is
 * worth less than one nobody mentions that lists seventy.
 */
export function startWith(playbook: Playbook | null): string[] {
  if (!playbook) return [];
  return [...playbook.platforms]
    .sort((a, b) => b.named - a.named)
    .map((p) => p.host);
}

/** Somewhere already known not to work, with the reason. */
export function isDeadEnd(playbook: Playbook | null, url: string): string | null {
  if (!playbook) return null;
  const host = url.toLowerCase();
  return playbook.deadEnds.find((d) => host.includes(d.host))?.why ?? null;
}

/**
 * Fold what this run learned back in.
 *
 * Counts are replaced rather than averaged. A platform that named seventy
 * barbers last week and two today has changed, and the recent number is the
 * true one. Averaging would hide a platform quietly dying.
 */
export function learn(
  before: Playbook,
  learned: {
    platforms: Platform[];
    publishes: string[];
    deadEnds: { host: string; why: string }[];
    evidence: { url: string; on: string; what: string }[];
    town: string;
    /** Hosts we searched for on purpose that gave us no listing. */
    blank?: string[];
    /** True when the whole run found nothing anywhere. */
    foundNothing?: boolean;
  },
): Playbook {
  const platforms = new Map(before.platforms.map((p) => [p.host, p]));
  // A host that worked is back to zero. Coming good wipes the record, because
  // the count is meant to catch a platform that has stopped, not one that had
  // a bad week.
  for (const p of learned.platforms) platforms.set(p.host, { ...p, blanks: 0 });

  for (const host of learned.blank ?? []) {
    const had = platforms.get(host);
    if (!had || learned.platforms.some((p) => p.host === host)) continue;
    const blanks = (had.blanks ?? 0) + 1;
    if (blanks >= BLANKS_BEFORE_DROPPED) platforms.delete(host);
    else platforms.set(host, { ...had, blanks });
  }

  const deadEnds = new Map(before.deadEnds.map((d) => [d.host, d]));
  for (const d of learned.deadEnds) {
    // A platform that worked this time is no longer a dead end, whatever it did
    // before. Sites come back, and a permanent blacklist from one bad afternoon
    // is how a tool slowly stops finding anything.
    if (!platforms.has(d.host)) deadEnds.set(d.host, d);
  }
  for (const host of platforms.keys()) deadEnds.delete(host);

  return {
    trade: before.trade,
    platforms: [...platforms.values()],
    publishes: [...new Set([...before.publishes, ...learned.publishes])],
    deadEnds: [...deadEnds.values()],
    // Keep the last thirty, newest first. A playbook carrying every url it has
    // ever seen becomes a log nobody reads and a row nobody can load.
    evidence: [...learned.evidence, ...before.evidence].slice(0, 30),
    timesUsed: before.timesUsed + 1,
    builtFrom: before.builtFrom ?? learned.town,
    towns: [...new Set([...(before.towns ?? []), learned.town].filter(Boolean))],
    nothingIn: learned.foundNothing
      ? [...new Set([...(before.nothingIn ?? []), learned.town])]
      : (before.nothingIn ?? []),
  };
}

/** Two in a row. One is a bad search, two is a platform that has stopped. */
export const BLANKS_BEFORE_DROPPED = 2;

/** Three towns, the same bar `confidence` uses before it trusts a playbook. */
export const TOWNS_BEFORE_SETTLED = 3;

/**
 * Has this trade been tried enough times, in enough places, to stop?
 *
 * Not a permanent verdict. It is the point where spending another open search
 * on a trade that has come back empty in three separate towns stops being
 * research and starts being a habit. What the customer is told is that we
 * could not find comparable businesses, which is true and is more use than a
 * fifth empty grid.
 */
export function exhausted(playbook: Playbook | null): boolean {
  if (!playbook || playbook.platforms.length) return false;
  return (playbook.nothingIn ?? []).length >= TOWNS_BEFORE_SETTLED;
}

/**
 * Is this worth trusting yet?
 *
 * One town is one town. Shrewsbury having every barber on Booksy does not make
 * that true of Bristol. Said out loud rather than hidden, because a playbook
 * built once and treated as settled is how a wrong assumption spreads to every
 * customer in a trade.
 */
export function confidence(playbook: Playbook | null): {
  level: "none" | "one town" | "confirmed";
  say: string;
} {
  if (!playbook || !playbook.platforms.length) {
    return { level: "none", say: "We have not researched this trade before." };
  }
  const towns = playbook.towns ?? [];
  if (towns.length < TOWNS_BEFORE_SETTLED) {
    return {
      level: "one town",
      say: `Worked out from ${playbook.builtFrom ?? "one town"}, and not confirmed elsewhere yet.`,
    };
  }
  return {
    level: "confirmed",
    say: `Confirmed in ${towns.length} different towns.`,
  };
}


/**
 * Trades hiding inside "Something else", and how often we have seen them.
 *
 * An unmatched business is filed under its own words rather than a trade, so
 * these rows are a record of what the category list is missing. Once the same
 * wording turns up in three different towns it is not one odd business, it is a
 * trade, and it should be added to categories.ts and TRADE_GROUP so it gets a
 * dropdown entry and a group. Both, or you recreate the bug where a category
 * exists with no group and gets the general floor only.
 *
 * Three towns again: one evidence rule, applied everywhere.
 */
export function needsATrade(all: Playbook[]): { words: string; towns: string[] }[] {
  return all
    .filter((p) => p.trade.startsWith("other:"))
    .filter((p) => (p.towns ?? []).length >= TOWNS_BEFORE_SETTLED)
    .map((p) => ({ words: p.trade.slice("other:".length).replace(/-/g, " "), towns: p.towns }))
    .sort((a, b) => b.towns.length - a.towns.length);
}
