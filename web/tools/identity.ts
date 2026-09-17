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


/**
 * A web address we can actually fetch.
 *
 * `sameSite` is a key for comparing, the way `sameTown` is, and that file says
 * so about towns in as many words. On 2026-09-17 I used the site key as the
 * stored value, so every workspace created after that held
 * "acutabovestalbans.co.uk" with no protocol. `new URL()` throws on that, and
 * five of the next eleven runs died with "one of the addresses we were given
 * could not be read". The bakery, created before the change, kept working.
 *
 * So: one function decides what two addresses mean the same thing, and a
 * different one decides what we store and fetch. Confusing the two cost a day
 * of runs.
 *
 * Returns "" when it cannot be made into a url, which is a caller's problem to
 * handle and not a reason to throw from inside a helper.
 */
export function asAddress(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    // A host with no dot is not a domain: "localhost", or somebody's typo.
    if (!url.hostname.includes(".")) return "";
    return url.href.replace(/\/$/, "");
  } catch {
    // Not a web address. Expected: this is whatever a person typed into a box.
    // ERROR-HANDLING.md rule 1, fourth case.
    return "";
  }
}

/** The address as something to fetch, or null when it cannot be one. */
export const fetchable = (raw: string | null | undefined): string | null =>
  asAddress(raw) || null;
