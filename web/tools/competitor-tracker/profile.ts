import type { SearchProfile } from "../../../Agents/Competitor Tracker/src/search-visibility.ts";
import { displayName } from "../../../Agents/Competitor Tracker/src/normalise.ts";
import type { Business } from "../types.ts";
import { wordsFor } from "./where.ts";

/**
 * What the workspace knows about a business, in the shape the agent expects.
 *
 * The trade is the load-bearing field. Everything downstream turns on it: a
 * barber and a plumber need different searches, different platforms, and
 * different ideas of what counts as a competitor. If it is missing we stop and
 * say so rather than searching for "business in Shrewsbury", which returns
 * nothing useful and costs the same as a real search.
 */
export function profileFor(business: Business): SearchProfile | { missing: string[] } {
  /**
   * The words we search with, not the category id.
   *
   * These are the same for every trade but one. "Something else" is a real
   * choice in the dropdown and its id is `other`, so this used to search for
   * "other shrewsbury" and "best other shrewsbury", which is a search for the
   * word other. For those, wordsFor falls back to what the business said about
   * itself, and when it said nothing we stop and ask rather than guess.
   */
  const words = wordsFor(business);

  const missing = [
    !words && "what they do",
    !business.town && "what town they are in",
  ].filter(Boolean) as string[];

  if (missing.length) return { missing };

  return {
    /**
     * Stripped of the characters that reorder a line rather than appear in it.
     *
     * The profile's name becomes the card's title and the first column of every
     * grid, so this is the point where the customer's own name enters
     * everything they read. normaliseName dropped these already, but only for
     * comparing names: the one we print kept them.
     */
    name: displayName(business.name ?? business.website),
    trade: words!,
    town: business.town!,
    // GB is not a guess about this business: the whole product is sold to UK
    // small businesses, and the search tool needs a country or it returns the
    // American Shrewsbury ahead of the Shropshire one.
    country: "GB",
    timezone: "Europe/London",
    services: [],
    website: business.website,
  };
}

export const isProfile = (v: SearchProfile | { missing: string[] }): v is SearchProfile =>
  !("missing" in v);
