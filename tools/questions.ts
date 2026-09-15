/**
 * The three things only the owner knows.
 *
 * Everything else about a business is read off their website. These cannot be,
 * and each one fixes something that was otherwise a guess.
 *
 * There were four. "Why do people pick you over them?" was dropped: it is an
 * owner's guess about their own market, telling them that is what they are
 * paying for, and asking would have biased the research toward confirming what
 * they already believed.
 */

export type Reach = "nearby" | "town" | "county" | "uk" | "world";

export const REACH: { id: Reach; label: string }[] = [
  { id: "nearby", label: "Right nearby, they walk past or live close" },
  { id: "town", label: "Around this town" },
  { id: "county", label: "Across the county or region" },
  { id: "uk", label: "Anywhere in the UK" },
  { id: "world", label: "Anywhere in the world" },
];

/**
 * How much being near you counts, by how far your customers come.
 *
 * One scale instead of asking separately about trading online, because
 * "anywhere in the UK" is the online answer and asking both would be asking the
 * same thing twice.
 *
 * At uk and world it is zero, not small. For a marketing agency, a competitor
 * sharing their street is a coincidence, and letting it count at all would rank
 * the office next door above the firm actually taking their customers.
 */
export const PROXIMITY_WEIGHT: Record<Reach, number> = {
  nearby: 4.0,
  town: 3.0,
  county: 1.5,
  uk: 0,
  world: 0,
};

export const FOUND_VIA: { id: string; label: string; platforms: string[] }[] = [
  { id: "word-of-mouth", label: "Word of mouth", platforms: [] },
  { id: "google", label: "Google", platforms: [] },
  /**
   * No platforms against social, deliberately.
   *
   * Where customers find you is not the same as where your competitors are
   * listed, and Facebook and Instagram have no page listing every barber in a
   * town. Searching them for one returned individual profiles, the listing
   * stage found nothing, and a run failed with "we could only find 0 other
   * barbers" while the real Booksy listing sat there untouched.
   *
   * It is still worth asking and worth recording. It just does not tell us
   * where to look for a comparison.
   */
  { id: "social", label: "Facebook or Instagram", platforms: [] },
  { id: "booking", label: "A booking site like Booksy, Fresha or Treatwell", platforms: ["booksy.com", "fresha.com", "treatwell.co.uk"] },
  { id: "trades", label: "Checkatrade, MyBuilder or similar", platforms: ["checkatrade.com", "mybuilder.com", "ratedpeople.com"] },
  { id: "marketplace", label: "A marketplace or directory", platforms: ["yell.com", "bark.com", "trustpilot.com"] },
  { id: "unknown", label: "We honestly do not know", platforms: [] },
];

/**
 * Platforms to look at first, because the owner says customers arrive from them.
 *
 * This is evidence for the trade's playbook from somebody who actually knows. A
 * barber saying "Booksy" is a better signal about where barbers are listed than
 * any number of searches, and it costs nothing.
 */
export function platformsFrom(chosen: string[] | null | undefined): string[] {
  if (!chosen?.length) return [];
  return [...new Set(chosen.flatMap((id) => FOUND_VIA.find((f) => f.id === id)?.platforms ?? []))];
}

export const reachLabel = (id: string | null | undefined): string =>
  REACH.find((r) => r.id === id)?.label ?? "Not set";

/** Unknown reach behaves like the town: the commonest answer, and the safest
 *  to be wrong about, because it neither ignores distance nor obsesses over it. */
export const proximityWeight = (reach: string | null | undefined): number =>
  PROXIMITY_WEIGHT[(reach as Reach) ?? "town"] ?? PROXIMITY_WEIGHT.town;
