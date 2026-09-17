/**
 * A town, written the way a booking platform writes it into a url.
 *
 * ONE PLACE, BECAUSE THE FIRST VERSION WAS THREE
 *
 * The listings gate built its own key with `.replace(/\s+/g, "-")`, naming.ts
 * squashed to `[^a-z]`, and search-visibility used normaliseName. Three rules
 * in three files for one question, and the one that mattered most was the one
 * that was wrong: a salon recorded as "St. Albans" produced "st.-albans", which
 * refused every UK listing and accepted an American one, because Fresha's US
 * path writes the stop and ours do not. That put five salons in Queens in front
 * of a Hertfordshire owner.
 *
 * Replacing the whitespace rule with "hyphenate anything that is not a letter
 * or a digit" fixed St Albans and Stoke-on-Trent and still failed four of ten
 * real towns:
 *
 *   Bishop's Stortford  ->  bishop-s-stortford   platforms write bishops-stortford
 *   King's Lynn         ->  king-s-lynn          kings-lynn
 *   Ynys Môn            ->  ynys-m-n             ynys-mon
 *
 * An apostrophe disappears, it does not become a separator, and an accented
 * letter becomes its plain letter. Both are how every platform does it, and
 * neither is a special case for a particular town.
 */

/** Café -> Cafe, Môn -> Mon. The letter without its mark. */
const plainLetters = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * The town as it appears inside a url: "St. Albans" and "St Albans" both
 * become "st-albans", "King's Lynn" becomes "kings-lynn".
 *
 * Note the order. Apostrophes go before anything else is considered a
 * separator, or "King's" splits into two words and gains a hyphen nobody
 * writes.
 */
export function townInUrl(town: string | null | undefined): string {
  if (!town) return "";
  return plainLetters(town)
    .toLowerCase()
    .replace(/['‘’ʼ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The same town with the separators taken out, for matching against running
 * text where nobody agrees on hyphens.
 *
 * Derived from the url form rather than written again, so the two can never
 * drift apart. That drift is what this file exists to stop.
 */
export const townSquashed = (town: string | null | undefined): string =>
  townInUrl(town).replace(/-/g, "");
