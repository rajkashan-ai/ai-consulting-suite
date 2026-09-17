/**
 * When two things a customer typed are the same thing.
 *
 * On 2026-09-16 one salon was entered twice, as
 * "https://acutabovestalbans.co.uk" and "acutabovestalbans.co.uk", and became
 * two businesses. Both then read the same website at sign-up, so the same four
 * pages were fetched twice and paid for twice, and the competitor set each one
 * learns is invisible to the other.
 *
 * The same day, the same salon's town was stored as "St Albans" on one and
 * "St. Albans" on the other. A playbook counts distinct towns before it trusts
 * itself, and the three-town rule would have counted one town as two.
 *
 * Neither is a hard error. Both are the kind that never announces itself: the
 * product carries on and quietly does the work twice.
 */

/**
 * A web address reduced to the thing that identifies the business.
 *
 * Protocol, www, trailing slash and case all go. What is left is the host and
 * path, which is what a person means when they say "their website".
 *
 * Deliberately not a URL parse into a host: a customer who types a page rather
 * than a homepage has told us something, and throwing the path away would make
 * two different shops in one directory look like one business.
 */
export function sameSite(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

/**
 * A town name reduced for comparing, never for showing.
 *
 * "St. Albans", "St Albans" and "st albans" are one town. What the customer
 * typed is what we print back to them: this is only ever the key.
 */
export function sameTown(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Is this town already in the list, however it was spelled last time? */
export const townKnown = (towns: string[], town: string): boolean =>
  towns.some((t) => sameTown(t) === sameTown(town));

/** Add a town, keeping the spelling we already had rather than a second one. */
export function addTown(towns: string[], town: string): string[] {
  if (!town.trim() || townKnown(towns, town)) return towns;
  return [...towns, town];
}
