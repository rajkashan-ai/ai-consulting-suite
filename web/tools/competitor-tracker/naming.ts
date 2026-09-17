import type { SearchResult } from "../../../Agents/Competitor Tracker/src/search-visibility.ts";
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
export function judge(
  n: Named,
  results: SearchResult[],
  town: string,
): { found: Checked | null; verdict: Verdict } {
  const want = normaliseName(n.name);
  if (!want || want.length < 3) return { found: null, verdict: "nothing found" };

  const here = town.toLowerCase().replace(/[^a-z]/g, "");

  // The closest any result got, so a refusal can say which wall it hit.
  let closest: Verdict = results.length ? "not in a title" : "nothing found";

  for (const r of results) {
    const title = normaliseName(r.title ?? "");
    const url = (r.url ?? "").toLowerCase();

    // Somebody else's country, whatever the name and the town say.
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
    const rightPlace =
      url.includes(here) ||
      title.includes(here) ||
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
