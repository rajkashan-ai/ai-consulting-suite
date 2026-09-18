import type { SearchResult } from "../../../Agents/Competitor Tracker/src/search-visibility.ts";
import { resultCountry } from "../../../Agents/Competitor Tracker/src/search-visibility.ts";
import { townInUrl, townSquashed } from "../place.ts";
import { normaliseName } from "../../../Agents/Competitor Tracker/src/normalise.ts";

/**
 * Who competes with this business, asked rather than crawled.
 *
 * WHY THIS REPLACED A CRAWLER
 * Finding five competitors used to mean five web searches, fetching listing
 * pages, extracting every business named on them, and paying a model to sort
 * 192 salons down to five. On 2026-09-16 that took 8 minutes 41 seconds, spent
 * 35,000 tokens before a single useful word was written, and failed twice.
 * Asked directly, a model named the same salons in two seconds, and every one
 * checked out.
 *
 * THE RULE THIS DOES NOT BREAK
 * A model's recall is a candidate, never a fact. It goes stale, and a salon
 * that shut last year is still in there. So nothing it says reaches a customer
 * unverified: every name is searched for, and a name with no independent page
 * behind it is dropped. That is the whole reason asking is allowed at all.
 *
 * What we gain is that verifying five names is cheap and discovering five names
 * was not.
 */

export type Named = {
  name: string;
  /** Why the model thinks they compete. Never shown as fact, used for ordering. */
  why: string;
};

export type Checked = Named & {
  /** A page that proves they exist, found by searching for the name. */
  url: string;
  /** The title of that page, as evidence of what was matched. */
  title: string;
};

/** The shape the model must answer in. Asked for by schema, not by prose. */
export const NAMES_SHAPE = {
  name: "competitors",
  description: "The local businesses that compete, and one line each on why.",
  input_schema: {
    type: "object",
    properties: {
      competitors: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            name: { type: "string", maxLength: 80 },
            why: { type: "string", maxLength: 160 },
          },
          required: ["name", "why"],
        },
      },
    },
    required: ["competitors"],
  },
} as const;

export function askFor(profile: { name: string; trade: string; town: string }): string {
  return (
    `Name the businesses that compete with ${profile.name}, a ${profile.trade} ` +
    `in ${profile.town}, United Kingdom.\n\n` +
    `Independent local businesses of the same trade in the same town. Up to ` +
    `eight, best first. Not directories, not listing sites, not national ` +
    `chains unless they have a branch in this town.\n\n` +
    `Give the trading name as a customer would say it, and one short line on ` +
    `why they compete. If you are not reasonably confident a business exists, ` +
    `leave it out: every name is checked against the web afterwards and a name ` +
    `that cannot be found is discarded, so guessing costs us a search and ` +
    `gains nothing.`
  );
}

/** One search per name. Cheap, and it is what turns a recollection into a fact. */
export const searchFor = (n: Named, town: string, trade: string): string =>
  `"${n.name}" ${town} ${trade}`;

/**
 * The same business, asked for on the platforms that print prices.
 *
 * Only used when the plain search came back with nowhere that could carry a
 * price. A competitor picked off Fresha's listing arrives with no link, because
 * that page publishes a name and a postal address and nothing else, so the only
 * way to their prices is to go and find their booking profile.
 *
 * Sites come from the source registry, so this asks for what we have recorded
 * as reachable and price-carrying rather than a list written here. An empty
 * list returns null, and the caller does not search: a second search with no
 * sites in it is the first search again, at the same cost and no new answer.
 */
export const searchOnPriceSites = (
  n: Named,
  town: string,
  sites: readonly string[],
): string | null =>
  sites.length ? `"${n.name}" ${town} (${sites.map((s) => `site:${s}`).join(" OR ")})` : null;

/**
 * Does a search result actually show this business?
 *
 * Deliberately strict about the name and forgiving about everything else. The
 * question is only "does this exist", and a page that names the business is
 * enough for that. What it charges and how it is reviewed are read later, off
 * its own pages, the same as they always were.
 */
/**
 * Towns share names across the Atlantic, and the title says so.
 *
 * Shrewsbury is in Shropshire, Pennsylvania, Massachusetts and New Jersey. A
 * fixture check caught this: "The Barbers At Shrewsbury - 308 N Main St C,
 * Shrewsbury, PA 17361" satisfies both the name and the town, and would have
 * verified a Pennsylvania barber into a Shropshire comparison. The same regex
 * already guards the crawler's candidates; asking needed it too.
 */
const WRONG_COUNTRY =
  /\b(MA|PA|NJ|NY|CA|TX|FL|Massachusetts|Pennsylvania|New Jersey|Missouri)\b/;

const NOT_OURS = /\/en-us\/|\/us\/|\.com\/us|\/en-au\/|\/en-ca\//;

/**
 * Why a proposed name was not accepted.
 *
 * Kept because the alternative is what happened on 2026-09-17: a run proposed
 * eight names, accepted one, and recorded nothing about the other seven. Asked
 * why the cheap path had failed, the honest answer was that nobody could know,
 * and every improvement anybody suggested including mine was a guess.
 *
 * Four outcomes, and they need different fixes. Nothing found means the model
 * invented it or it has closed. Somewhere else means our town matching is
 * wrong or the model picked a branch in another town. Another country is the
 * Shrewsbury Pennsylvania problem. Not in a title means the business is real
 * and our proof is too strict, which is the one we can act on directly.
 */
export type Verdict = "matched" | "nothing found" | "somewhere else" | "another country" | "not in a title";

export type Judged = { name: string; verdict: Verdict; url?: string };

export function proves(n: Named, results: SearchResult[], town: string): Checked | null {
  return judge(n, results, town).found;
}

/**
 * The same decision, with its reasoning kept.
 *
 * `proves` is this with the reasoning thrown away, so the two can never drift
 * apart and disagree about the same name.
 */
/**
 * The villages inside a town's area, taken from an address we already hold.
 *
 * "19-20 High St, Redbourn, St Albans" gives "redbourn". Not a list of places:
 * the listing told us where this business is, so a page naming that place is a
 * page about this business.
 *
 * Five letters or more, which drops "high", "road", "west" and keeps Redbourn,
 * Markyate and Colney. A four letter street word appears in half the urls on
 * the web; a village name does not.
 */
const placesIn = (area: string | null, town: string): string[] => {
  if (!area) return [];
  const skip = new Set([townSquashed(town), ...town.toLowerCase().split(/\s+/)]);
  return area
    .toLowerCase()
    .split(/[,\s]+/)
    .map((w) => w.replace(/[^a-z]/g, ""))
    .filter((w) => w.length >= 5 && !skip.has(w));
};

export function judge(
  n: Named,
  results: SearchResult[],
  town: string,
  /** Their address as the listing printed it, when we have one. */
  knownArea: string | null = null,
): { found: Checked | null; verdict: Verdict } {
  const want = normaliseName(n.name);
  if (!want || want.length < 3) return { found: null, verdict: "nothing found" };

  // The same rule the listings gate uses, with the separators taken out. It
  // was `[^a-z]`, a third private copy of a question that has one answer, and
  // the copy that mattered was the one that was wrong. See tools/place.ts.
  /**
   * Both spellings, because a url hyphenates and this squashed.
   *
   * "St. Albans" squashed is "stalbans", and a Fresha profile at
   * fresha.com/a/atelier-st-albans-abc was refused for naming the town in the
   * form every platform actually writes. Same fault as the listings gate had
   * this morning, in a second place, which is what tools/place.ts exists to
   * stop: both forms come from there.
   */
  const here = townSquashed(town);
  const hyphenated = townInUrl(town);
  const alsoHere = placesIn(knownArea, town);

  // The closest any result got, so a refusal can say which wall it hit.
  let closest: Verdict = results.length ? "not in a title" : "nothing found";

  for (const r of results) {
    const title = normaliseName(r.title ?? "");
    const url = (r.url ?? "").toLowerCase();

    /**
     * Somebody else's country, whatever the name and the town say.
     *
     * resultCountry is the one function that knows the shapes a platform
     * writes a country in, and this had its own weaker pair of patterns. With
     * the town check loosened to accept a business's own village, that gap let
     * a Melbourne url through in testing: NOT_OURS does not know
     * fresha.com/a/...-melbourne-... and the title carried no marker.
     *
     * Asked of the shared rule first, then the old patterns, so this is
     * strictly tighter than it was.
     */
    const says = resultCountry(url);
    if (says !== null && says !== "GB") {
      if (title.includes(want)) closest = "another country";
      continue;
    }
    if (NOT_OURS.test(url) || WRONG_COUNTRY.test(r.title ?? "")) {
      if (title.includes(want)) closest = "another country";
      continue;
    }

    // The name has to be in the title, not merely somewhere on a page that
    // listed forty businesses. A directory page mentioning them proves they
    // are listed, which is not the same as proving what we say about them.
    if (!title.includes(want)) continue;

    // Named, so from here any refusal is about where it is, not whether it is.
    if (closest === "not in a title") closest = "somewhere else";

    /**
     * Somewhere in the right country, at least.
     *
     * Shrewsbury is also in Pennsylvania. The town appearing in the url or the
     * title is the strong signal; a .co.uk is the weak one. Either will do,
     * because the model was asked for this town and the name already matched.
     */
    /**
     * The village they are actually in counts as the right place.
     *
     * 2026-09-17. Atelier Salon & Spa's own Fresha profile came back top of the
     * search and was refused:
     *
     *   fresha.com/lvp/atelier-salon-spa-high-street-redbourn-PV1x3b
     *
     * because the url says Redbourn and we had searched St. Albans. The listing
     * had already told us where she is, "19-20 High St, Redbourn, St Albans",
     * so we knew and did not use it. We read a Yelp page instead of a profile
     * carrying her prices and rating.
     *
     * Matched in the url and not the title. A platform writes the url slug;
     * anyone writes a title. A profile url like fresha.com/a/<slug> carries no
     * country marker at all, so resultCountry cannot place it, and the place
     * words are the only thing standing between us and a salon of the same
     * name somewhere else. Testing this with a Melbourne url and a Redbourn
     * title took it, which is exactly the hole a title can open.
     */
    const rightPlace =
      url.includes(here) ||
      url.includes(hyphenated) ||
      title.includes(here) ||
      alsoHere.some((p) => url.includes(p)) ||
      url.includes(".co.uk") ||
      url.includes("/en-gb/");
    if (!rightPlace) continue;

    return {
      found: { ...n, url: r.url, title: r.title ?? n.name },
      verdict: "matched",
    };
  }
  return { found: null, verdict: closest };
}

/** Two names for the same business, which a model does produce. */
export function distinct(list: Checked[]): Checked[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = normaliseName(c.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The names out of a reply that was allowed to search.
 *
 * A call carrying the web search tool cannot also be given a forced shape, so
 * the answer arrives as text rather than as a filled-in schema. One name per
 * line was asked for; this is what enforces it, because a length or a format
 * requested in prose is one that wanders.
 *
 * Deliberately forgiving about decoration and strict about what a name is. A
 * model writing a list adds bullets, numbers and the occasional "and", and
 * refusing the whole reply over a hyphen would throw away eight good names to
 * punish one character.
 */
export function namesFrom(reply: string, own: string): Named[] {
  const mine = normaliseName(own);

  return reply
    .split("\n")
    .map((line) =>
      line
        // Bullets, numbering and the leading punctuation a list picks up.
        .replace(/^\s*(?:[-*•–—]|\d+[.)])\s*/, "")
        // Anything after a dash or a bracket is commentary, not the name.
        .split(/\s[–—-]\s|\s\(/)[0]
        .replace(/\*\*/g, "")
        .trim(),
    )
    .filter((name) => {
      if (name.length < 3 || name.length > 80) return false;
      // A sentence is not a name. Six words is generous for a trading name.
      if (name.split(/\s+/).length > 6) return false;
      // Their own name, however it is spelled.
      if (normaliseName(name) === mine) return false;
      // Lines that are plainly prose rather than a listed business.
      if (/^(here|these|i |the following|based on|search|note)/i.test(name)) return false;
      return true;
    })
    .slice(0, 12)
    .map((name) => ({ name, why: "named from a search result" }));
}
