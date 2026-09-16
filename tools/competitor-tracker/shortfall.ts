/**
 * Fewer than five competitors: is that the town, or is it us?
 *
 * The question came from Raj on 2026-09-16, and it is the right one. A run that
 * compares one business could mean two completely different things:
 *
 *   the town      there really is only one other barber within reach
 *   us            there were fifteen and our own code threw fourteen away
 *
 * On the page those look identical, and the owner is told the same thing either
 * way. So a bug in our research reads to the customer as a fact about their
 * market, and they may act on it.
 *
 * That is not hypothetical. On 2026-09-16 the rule that removes the customer
 * from their own competitor list was matching on "is my name inside theirs",
 * and a barber trading as "Cuts" lost both "Cuts Above" and "Precision Cuts".
 * They would have been told their town had fewer barbers in it than it has.
 *
 * The numbers to tell those apart already existed and were thrown away. The
 * whole of this file is keeping them and saying which happened.
 *
 * For scale, the one real run we have: 36 names off the listing pages, 34 after
 * the wrong trades went, 15 distinct businesses, 5 compared. Five is a cap, not
 * a ceiling. For a run to come back with one, something of ours would have had
 * to discard fourteen.
 */

/** What survived each step, in order. */
export type Funnel = {
  /** Names read off listing pages and search results, before any filtering. */
  found: number;
  /** After the customer's own business was removed. */
  notYou: number;
  /** After businesses in a different trade were removed. */
  rightTrade: number;
  /** Distinct businesses, after the same shop under two names was merged. */
  distinct: number;
  /** What was actually compared. */
  compared: number;
  /** How many things a customer might type that we searched for. */
  searches?: number;
  /** How many links those searches returned, before any were opened. */
  links?: number;
  /** How many town listings we actually read. */
  listings?: number;
};

export const WANTED = 5;

export type Verdict =
  | { kind: "full" }
  /** Fewer than we wanted, and the town genuinely has no more. */
  | { kind: "town"; say: string }
  /** Fewer than we wanted, and we had more and lost them. Our bug. */
  | { kind: "ours"; why: string };

/**
 * Which of the two happened.
 *
 * The test is simple and it is the whole point: if there were at least as many
 * distinct businesses as we wanted and we compared fewer, the shortfall is
 * ours. Nothing legitimate discards a business between having it and comparing
 * it. If there were fewer distinct businesses than we wanted, that is the town,
 * and it is a finding worth printing rather than a gap worth apologising for.
 */
export function shortfall(f: Funnel, trade: string | null, town: string | null): Verdict {
  if (f.compared >= WANTED) return { kind: "full" };

  if (f.distinct >= WANTED) {
    return {
      kind: "ours",
      why:
        `compared ${f.compared} of ${f.distinct} distinct businesses when ${WANTED} were wanted. ` +
        `found ${f.found}, ${f.notYou} after removing the customer, ${f.rightTrade} after ` +
        `removing the wrong trade, ${f.distinct} after merging duplicates`,
    };
  }

  const what = trade ? `${trade}s` : "businesses";
  const where = town ? ` in ${town}` : "";

  return {
    kind: "town",
    say:
      f.compared === 1
        ? `We compared the one other ${trade ?? "business"}${where} we could find and read. ` +
          `That is all there are, which is worth knowing on its own.`
        : `We compared ${f.compared} other ${what}${where}. ` +
          `That is all we could find and read, rather than a shortened list.`,
  };
}

/**
 * The same question for the four areas of the comparison.
 *
 * Each area is built by its own call and an area that fails is dropped rather
 * than taking the others with it, which is right: three tables beat none. What
 * was wrong is that the page said nothing, so a missing reviews table could
 * equally mean nobody publishes reviews or that our call fell over. The owner
 * could not tell, and neither could we.
 */
export function areasMissing(asked: readonly string[], got: string[]): string | null {
  const missing = asked.filter((a) => !got.includes(a));
  if (!missing.length) return null;

  const list =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;

  return `We could not build the ${list} comparison this time. Everything else here is unaffected.`;
}


/**
 * The narrowing, in one line.
 *
 * The page showed the eight pages we read and nothing else, so a reader could
 * not see that thirty two names became five, or that we looked at forty eight
 * links to get there. Raj: "What did we check to understand possible
 * competitors, then narrow down? We must have checked others."
 *
 * It is the work, and the work is most of the reason to believe the answer.
 */
export function funnelReads(f: Funnel): string | null {
  if (!f.searches && !f.links && !f.found) return null;

  const bits: string[] = [];
  if (f.searches) bits.push(`ran ${f.searches} ${f.searches === 1 ? "search" : "searches"}`);
  if (f.links) bits.push(`looked at ${f.links} results`);
  if (f.listings) bits.push(`read ${f.listings} town ${f.listings === 1 ? "listing" : "listings"}`);
  if (f.found) bits.push(`found ${f.found} businesses`);

  const last = f.distinct && f.distinct !== f.compared
    ? `narrowed them to ${f.distinct} separate businesses, and compared the ${f.compared} closest to you`
    : `compared ${f.compared}`;

  return `We ${bits.join(", ")}, ${last}.`;
}
