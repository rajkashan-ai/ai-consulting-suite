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
};

export type Playbook = {
  trade: string;
  platforms: Platform[];
  publishes: string[];
  deadEnds: { host: string; why: string }[];
  evidence: { url: string; on: string; what: string }[];
  timesUsed: number;
  builtFrom: string | null;
};

export const EMPTY: Omit<Playbook, "trade"> = {
  platforms: [],
  publishes: [],
  deadEnds: [],
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
  },
): Playbook {
  const platforms = new Map(before.platforms.map((p) => [p.host, p]));
  for (const p of learned.platforms) platforms.set(p.host, p);

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
  };
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
  if (playbook.timesUsed < 3) {
    return {
      level: "one town",
      say: `Worked out from ${playbook.builtFrom ?? "one town"}, and not confirmed elsewhere yet.`,
    };
  }
  return {
    level: "confirmed",
    say: `Used ${playbook.timesUsed} times across different towns.`,
  };
}
