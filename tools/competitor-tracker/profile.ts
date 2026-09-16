import type { SearchProfile } from "../../../Agents/Competitor Tracker/src/search-visibility.ts";
import { displayName } from "../../../Agents/Competitor Tracker/src/normalise.ts";
import type { Business } from "../types.ts";

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
  const missing = [
    !business.trade && "what they do",
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
    trade: business.trade!,
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
