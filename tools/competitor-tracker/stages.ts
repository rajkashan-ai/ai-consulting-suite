import {
  buildSearchTerms,
  candidatesFromSearch,
  isVenuePage,
  measure,
  searchToolConfig,
  summarise,
  type SearchProfile,
  type SearchResult,
  type Visibility,
} from "../../../Agents/Competitor Tracker/src/search-visibility.ts";
import { MAX_COMPETITORS, refreshSet } from "../../../Agents/Competitor Tracker/src/competitor-set.ts";
import { validateBattlecard } from "../../../Agents/Competitor Tracker/src/guards.ts";
import type {
  Battlecard,
  Competitor,
  Source,
} from "../../../Agents/Competitor Tracker/src/types.ts";
import type { Business, ToolContext } from "../types.ts";
import { isProfile, profileFor } from "./profile.ts";
import { confidence, isDeadEnd, startWith, type Playbook } from "./playbook.ts";
import { rank, type Found, type Scored } from "./rank.ts";
import { sift } from "./sift.ts";
import { milesBetween, positionsFor, postcodeIn } from "../../lib/research/distance.ts";
import { platformsFrom, proximityWeight } from "../questions.ts";

/**
 * A Competitor Tracker run, in steps that can each stop and be picked up later.
 *
 * WHY IT IS SHAPED LIKE THIS AND NOT AS ONE FUNCTION
 * One function would be easier to read and impossible to run. A run takes one
 * to three minutes, hosting kills a request that takes minutes, and Raj asked
 * for it to survive a closed laptop. So each call does a little and hands back
 * where it got to. Something else decides when to call again: the open page
 * while you watch, a scheduled tick when you do not.
 *
 * Every step is safe to run twice. A tick that dies after fetching but before
 * saving loses one page, not the run.
 */

export type Stage =
  | "searching"
  | "listings"
  | "choosing"
  | "reading"
  | "writing"
  | "checking"
  | "fixing"
  | "done"
  | "failed";

export type ReadPage = {
  url: string;
  ok: boolean;
  title: string | null;
  text: string;
  fetchedOn: string;
  note: string;
};

export type RunState = {
  profile?: SearchProfile;
  /** What we already know about researching this trade. Null the first time. */
  playbook?: Playbook | null;
  /** Platforms this run found that the playbook did not have. */
  learned?: { host: string; example: string; named: number }[];
  terms?: { term: string; why: string }[];
  seen?: { term: string; results: SearchResult[] }[];
  visibility?: Visibility[];
  competitors?: Competitor[];
  /** Pages still to fetch. Drained a few at a time so no tick runs too long. */
  queue?: { name: string; url: string }[];
  pages?: Record<string, ReadPage[]>;
  /** Names read off a local listing page, which for a local trade is where the
   *  competitors actually are. See the listings stage. */
  fromListings?: string[];
  /** The same businesses with what the listing printed beside them, which is
   *  what the ranking runs on. */
  listed?: Found[];
  /** The five that were picked, and why each one. */
  picked?: Scored[];
  /** The comparison as a grid, one row per thing and one column per business. */
  grid?: Grid[];
  listingPages?: ReadPage[];
  card?: Battlecard;
  /**
   * The two columns at the top of the screen. Kept beside the battlecard rather
   * than inside it, because Battlecard is the agent's type and a screen wanting
   * a new field is not a reason to change the shape the guards check.
   */
  standing?: { winning: Side[]; losing: Side[] };
  /** What the guards objected to, on its way to being reworded. */
  problems?: { rule: string; sentences: string[] }[];
  /** Repair attempts spent. One is allowed. */
  repairs?: number;
  /** Why it failed, in words a customer reads. */
  reason?: string;
};

export type Side = { point: string; detail: string };

/**
 * The comparison, as a grid rather than a list per business.
 *
 * A row of bullet points under each name cannot be compared: to find out who is
 * cheapest you read six paragraphs and hold them in your head. One row per
 * thing, one column per business, and the answer is a glance.
 *
 * Kept beside the agent's Battlecard rather than inside it, for the same reason
 * `standing` is: Battlecard is their type and the guards check it, and a screen
 * wanting a different arrangement is not a reason to change the shape they
 * validate. The same facts appear in both.
 */
export type Grid = {
  area: string;
  /** Businesses, the customer first. The customer is not in `competitors`. */
  columns: string[];
  rows: {
    /** "Classic cut", "Reviews", "Opens". One comparable thing. */
    attribute: string;
    /** One per column, in the same order. Null where nothing was published. */
    cells: { value: string | null; source: { url: string; fetchedOn: string } | null }[];
  }[];
  /** Said under the table. One line, the thing the table shows. */
  note?: string;
};

export type Step = {
  stage: Stage;
  state: RunState;
  /** In the customer's units. "3 of 5 competitors read", never "step 4". */
  progress: string;
};

/**
 * How many pages one call will fetch.
 *
 * They go out together now, so this is the width of one step rather than its
 * length. Kept modest anyway: a step still has to finish inside the time limit
 * hosting puts on a request, and one slow site should not drag twenty others
 * past it.
 */
const PAGES_PER_STEP = 8;

export async function advance(
  stage: Stage,
  state: RunState,
  business: Business,
  ctx: ToolContext,
): Promise<Step> {
  switch (stage) {
    case "searching":
      return search(state, business, ctx);
    case "listings":
      return listings(state, ctx);
    case "choosing":
      return choose(state, business);
    case "reading":
      return read(state, ctx);
    case "writing":
      return write(state, business, ctx);
    case "checking":
      return check(state, business);
    case "fixing":
      return fix(state, ctx);
    default:
      return { stage, state, progress: "" };
  }
}

// ---------------------------------------------------------------------------

async function search(state: RunState, business: Business, ctx: ToolContext): Promise<Step> {
  const profile = profileFor(business);
  if (!isProfile(profile)) {
    return stop(
      state,
      `We do not know ${profile.missing.join(" or ")} for this business, and ` +
        `everything here depends on it. Put it in on Your business and run it again.`,
    );
  }

  /**
   * Where to look, if we have ever researched this trade before.
   *
   * With a playbook, one targeted search finds this town's page on a platform we
   * already know lists this trade. Without one, three broad searches, which for
   * a small local trade come back mostly as other countries and directories.
   *
   * The town's own url cannot be guessed: Booksy carries a numeric town id
   * (1227928_shrewsbury) that means nothing anywhere else. So the playbook says
   * which platform, and one search finds the page on it.
   */
  /**
   * Where to look, best evidence first.
   *
   * What the owner said beats the playbook, and the playbook beats guessing. A
   * barber telling us customers arrive from Booksy is a better signal about
   * where barbers are listed than any number of searches, and it is free.
   */
  const known = [
    ...platformsFrom(business.foundVia),
    ...startWith(state.playbook ?? null),
  ].filter((v, i, all) => all.indexOf(v) === i);

  const terms = known.length
    ? known.slice(0, 3).map((host) => ({
        term: `${profile.trade} ${profile.town} site:${host}`,
        why: `${host} lists this trade, from a previous run`,
      }))
    : buildSearchTerms(profile);

  // The search tool config comes from the agent because it carries
  // user_location. Without it this same search returns Shrewsbury Pennsylvania
  // and Shrewsbury Massachusetts ahead of the Shropshire one, which is measured
  // in search-visibility.ts and was measured again here on 15 September.
  const seen = await ctx.search(
    terms.map((t) => t.term),
    searchToolConfig(profile, terms.length),
  );

  const withResults = seen.filter((s) => s.results.length);
  if (!withResults.length) {
    return stop(
      state,
      `Nothing came back for "${terms[0]?.term}". That usually means the trade or ` +
        `the town is wrong for this business.`,
    );
  }

  return {
    stage: "listings",
    state: { ...state, profile, terms, seen: withResults },
    progress: `Searched ${withResults.length} of the ${terms.length} things a customer would type`,
  };
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

/**
 * Get the competitors off the local listing page.
 *
 * WHY THIS STAGE EXISTS, WRITTEN ON THE DAY IT WAS NEEDED
 * The first two real runs found nobody. Three searches returned twenty-seven
 * results: Shrewsbury Pennsylvania, Shrewsbury Massachusetts, Shrewsbury New
 * Jersey, two Wikipedia articles, and the customer's own site. The only other
 * UK entries were two listing pages, Booksy's "barbers in Shrewsbury" and
 * Fresha's.
 *
 * Which is what the Competitor Tracker's own memory already said: one Booksy
 * page gave prices, ratings and review counts for twelve Shrewsbury barbers,
 * and it was the source that made the manual test work. Discovery got built on
 * search results anyway, and search results for a small local trade are mostly
 * other countries and directories.
 *
 * So a listing is no longer something to discard. For a local business it is
 * the page that names everybody.
 */
async function listings(state: RunState, ctx: ToolContext): Promise<Step> {
  const { profile, seen } = state;
  if (!profile || !seen) return stop(state, "Lost the search results. Run it again.");

  const town = profile.town.toLowerCase().replace(/\s+/g, "-");
  const wanted = new Set<string>();

  const knownHosts = startWith(state.playbook ?? null);

  for (const { results } of seen) {
    for (const r of results) {
      const url = r.url.toLowerCase();

      // Somewhere a previous run already found to be useless. Not fetching is
      // real time saved: every page costs a pause, by our own rule.
      if (isDeadEnd(state.playbook ?? null, url)) continue;

      // A listing, for this country, for this town. All three, or it is
      // somebody else's town or somebody else's country.
      const isListing = /\/(s|lp|search|browse)\//.test(url) || /\/in\/gb-/.test(url);
      const isOurs = url.includes("/en-gb/") || url.includes("/gb-") || url.includes(".co.uk");

      /**
       * A trusted host still has to serve a listing.
       *
       * This used to accept any page on a known host, so a single shop's venue
       * page was read as "every barber in Shrewsbury". It named one business,
       * and that one page then overwrote the playbook's record of where the
       * real listing was.
       *
       * Being on Booksy is not the same as being Booksy's list of everybody.
       */
      const trusted = knownHosts.some((h) => url.includes(h));

      // Their isVenuePage, not a pattern of my own. Mine flagged the real
      // Booksy listing as a venue, because /s/barber/1227928_shrewsbury also
      // carries digits. Theirs checks for the search path first, which is the
      // whole difference, and it is written down in their file with the reason.
      const looksLikeAListing = isListing && !isVenuePage(r.url);

      if (looksLikeAListing && (isOurs || trusted) && url.includes(town)) wanted.add(r.url);
    }
  }

  if (!wanted.size) {
    // No listing found. Carry on with whatever search turned up, which can
    // still be enough for a trade whose businesses have their own websites.
    return { stage: "choosing", state, progress: "Looking at who came up" };
  }

  const names: string[] = [];
  const rows: Found[] = [];
  const pages: ReadPage[] = [];

  // Booksy and Fresha are always different hosts, so there is never a reason to
  // wait for one before asking the other.
  const fetched = await Promise.all([...wanted].slice(0, 2).map((u) => ctx.read(u)));

  for (const got of fetched) {
    pages.push({
      url: got.url,
      ok: got.ok,
      title: got.title,
      text: got.text.slice(0, 20_000),
      fetchedOn: got.fetchedAt.slice(0, 10),
      note: got.note,
    });
    if (!got.ok) continue;

    const found = (await ctx.think({
      system:
        "You are reading a booking platform's listing page for one town and writing down " +
        "the businesses named on it. Copy each name exactly as printed. Take nothing that " +
        "is not a business on this page: not the platform, not a category, not a heading, " +
        "not a place name. If it is not a listing, return nothing.\n\n" +
        "Links are written in the text as: the words, then the address in round " +
        "brackets. When a business name carries one, copy that address into its url " +
        "field exactly. It is how we read their own page rather than only this listing, " +
        "and a business with no url is one we can say much less about. Never repair or " +
        "shorten an address, and never invent one: a made-up address is a made-up source.",
      prompt: `Town: ${profile.town}. Trade: ${profile.trade}.\n\n${got.text.slice(0, 20_000)}`,
      shape: {
        name: "businesses",
        description:
          "Each business named on this listing, with whatever the page prints beside it.",
        input_schema: {
          type: "object",
          properties: {
            businesses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  // Null everywhere the page does not print it. Never guessed:
                  // a missing number scores zero in the ranking, and an invented
                  // one would quietly decide who the customer competes with.
                  reviews: { type: ["integer", "null"] },
                  rating: { type: ["number", "null"] },
                  reviewed_days_ago: { type: ["integer", "null"] },
                  area: {
                    type: ["string", "null"],
                    description: "Street or district as printed. Never a full postcode.",
                  },
                  price: {
                    type: ["number", "null"],
                    description: "Their cheapest or headline price as a number.",
                  },
                  url: { type: ["string", "null"] },
                },
                required: ["name", "reviews", "rating", "reviewed_days_ago", "area", "price", "url"],
              },
            },
          },
          required: ["businesses"],
        },
      },
    })) as { businesses?: Record<string, never>[] };

    for (const b of found.businesses ?? []) {
      const clean = String(b.name ?? "").trim();
      if (clean.length < 3 || clean.length > 60) continue;
      names.push(clean);
      rows.push({
        name: clean,
        reviews: num(b.reviews),
        rating: num(b.rating),
        reviewedDaysAgo: num(b.reviewed_days_ago),
        area: str(b.area),
        price: num(b.price),
        url: str(b.url),
      });
    }
  }

  // What this run found that the playbook did not have. Folded back in at the
  // end, so the next business in this trade starts from it.
  /**
   * A platform is only learned when a page on it actually named several
   * businesses.
   *
   * It used to record every page it read, with the run's total against each,
   * so a venue page naming one shop was filed as a listing naming eighteen and
   * the playbook sent the next run to the wrong page. Three is the fewest that
   * makes something a list rather than a shop.
   */
  const learned =
    rows.length >= 3
      ? pages
          .filter((p) => p.ok)
          .map((p) => ({ host: hostOf(p.url), example: p.url, named: rows.length }))
          .filter((p) => p.host)
      : [];

  return {
    stage: "choosing",
    state: { ...state, fromListings: names, listed: rows, listingPages: pages, learned },
    progress: names.length
      ? `Found ${names.length} ${profile.trade}s in ${profile.town}`
      : "Looking at who came up",
  };
}


/**
 * Places that are never a competitor, whatever the search says.
 *
 * Found on the first real run, 15 September. "barber Shrewsbury" returned the
 * Wikipedia page for Sir Henry Barber, 1st Baronet, a Victorian property
 * developer, and it passed every filter because the relevance test asks whether
 * the trade word appears anywhere and "Barber" is his surname.
 */
const NEVER_A_BUSINESS = [
  "wikipedia.org", "wikimedia.org", "britannica.com", "linkedin.com/in/",
  "reddit.com", "quora.com", "youtube.com", "pinterest.", "amazon.",
  "gov.uk", "companieshouse", "indeed.com", "glassdoor",
];

/**
 * A result for a town of the same name in another country.
 *
 * Shrewsbury is in Shropshire, Pennsylvania, Massachusetts and New Jersey. The
 * search tool is given a location and still returns the American ones, so the
 * results have to be filtered as well as the search steered. The agent's
 * resultCountry catches an explicit /en-us/ or a .co.uk; this catches the far
 * more common case, which is a US state named in the title.
 */
const WRONG_COUNTRY =
  /\b(MA|PA|NJ|NY|CA|TX|FL|Massachusetts|Pennsylvania|New Jersey|Missouri)\b/;

async function choose(state: RunState, business: Business): Promise<Step> {
  const { profile, seen } = state;
  if (!profile || !seen) return stop(state, "Lost the search results. Run it again.");

  const already = state.competitors ?? [];
  const raw = candidatesFromSearch(seen, profile, already.map((c) => c.name));

  /**
   * Everything the search said about this business, not just its name.
   *
   * WRONG_COUNTRY was being tested against the extracted name alone, and the
   * country is almost never in the name. It is in the result's title: "The
   * Barbers At Shrewsbury | Shrewsbury PA | Facebook". So a Pennsylvania barber
   * arrived in a Shropshire battlecard with nothing to catch it, which is the
   * exact failure the whole location effort exists to prevent.
   */
  const saidAbout = (name: string): string => {
    const key = name.toLowerCase();
    const bits: string[] = [];
    for (const { results } of seen) {
      for (const r of results) {
        const hay = `${r.title} ${r.url}`.toLowerCase();
        if (hay.includes(key)) bits.push(`${r.title} ${r.url}`);
      }
    }
    return bits.join(" ");
  };

  const candidates = raw.filter((c) => {
    const where = `${c.url} ${c.name} ${saidAbout(c.name)}`;
    if (NEVER_A_BUSINESS.some((host) => c.url.toLowerCase().includes(host))) return false;
    if (WRONG_COUNTRY.test(where)) return false;
    // A page whose title announces it is a list is a list, however many
    // businesses are named on it.
    if (/\b(best|top|10|ten|near me|directory|guide)\b/i.test(c.name)) return false;
    return true;
  });

  // Listing names first: they are businesses in this town on a platform this
  // town's customers actually use. Search candidates fill any space left.
  const fromListing = sift(
    (state.fromListings ?? [])
      .filter((n) => !NEVER_A_BUSINESS.some((h) => n.toLowerCase().includes(h)))
      .filter((n) => !WRONG_COUNTRY.test(`${n} ${saidAbout(n)}`))
      .map((name) => ({ name })),
    { you: profile.name, trade: business.trade },
  ).map((r) => r.name);

  /**
   * Rank rather than take the first five.
   *
   * Seventy came back for Shrewsbury and the run kept whichever the page
   * printed first, which is the platform's sort order and nothing to do with
   * this business. Proximity, review volume, how recently reviewed, price
   * overlap, then rating. See rank.ts for why each one earns its weight.
   */
  /**
   * Everything that should never have been on the list, gone before ranking.
   *
   * On the first real run three of the five slots went to noise: the customer
   * themselves, HINCES twice under two names, and a hair and beauty clinic.
   * Each one was a quarter of the whole comparison.
   */
  const listed = sift(
    (state.listed ?? []).filter(
      (r) => !NEVER_A_BUSINESS.some((h) => r.name.toLowerCase().includes(h)),
    ),
    { you: profile.name, trade: business.trade },
  );

  /**
   * How far away each of them actually is.
   *
   * One request for every postcode at once. The postcodes themselves are not
   * kept: they go to the lookup, come back as positions, and only the distance
   * survives. A full UK postcode identifies a household, and for a sole trader
   * working from home that is their home.
   */
  const yours = postcodeIn(business.address);
  const theirs = listed.map((r) => postcodeIn(r.area));
  const positions = await positionsFor([yours, ...theirs].filter(Boolean) as string[]);
  const here = yours ? positions.get(yours) : undefined;

  const withMiles = listed.map((r, i) => {
    const p = theirs[i] ? positions.get(theirs[i]!) : undefined;
    return { ...r, miles: here && p ? milesBetween(here, p) : null };
  });

  const picked = withMiles.length
    ? rank(
        withMiles,
        {
          // Their street, falling back to the town. Handing it the town alone
          // meant every business in the town matched and the heaviest factor
          // separated nobody.
          area: business.address ?? business.town,
          town: business.town,
          price: business.headlinePrice,
          proximityWeight: proximityWeight(business.reach),
        },
        MAX_COMPETITORS,
      )
    : [];

  const competitors = sift(
    refreshSet(
      // A competitor the owner named survives every weekly run, for ever. That
      // is what addedByCustomer means, and it is the guarantee that a run
      // produces something even when discovery finds nobody.
      business.knownCompetitor
        ? [
            { name: business.knownCompetitor, addedByCustomer: true, claims: {} },
            ...already.filter((c) => c.name !== business.knownCompetitor),
          ]
        : already,
      [...picked.map((p) => p.name), ...fromListing, ...candidates.map((c) => c.name)],
      profile.name,
    ),
    { you: profile.name, trade: business.trade },
  ).slice(0, MAX_COMPETITORS);

  // Two is the fewest that makes a comparison worth reading. Below that we stop
  // rather than write a battlecard about nobody, which is what happened on the
  // first real run: two junk candidates, and a card full of remarks about our
  // own research because there was nothing else to say.
  const real = competitors.filter((c) => c.name !== profile.name);
  if (real.length < 2) {
    return stop(
      state,
      `We could only find ${real.length} other ${profile.trade}${real.length === 1 ? "" : "s"} ` +
        `in ${profile.town} that we are allowed to read, which is not enough to compare ` +
        `anything against. Add competitors yourself and we will track them.`,
    );
  }

  const visibility = seen.map((s) =>
    measure(s.term, s.results, profile, competitors.map((c) => c.name)),
  );

  // One page each to start. Their own site if the search found it, otherwise
  // the platform page, which for a barber is where the prices actually are.
  const queue = competitors
    .map((c) => {
      const fromRank = picked.find((p) => p.name === c.name && p.url);
      if (fromRank?.url) return { name: c.name, url: fromRank.url };
      const hit = candidates.find((k) => k.name === c.name);
      return hit ? { name: c.name, url: hit.url } : null;
    })
    .filter(Boolean) as { name: string; url: string }[];

  if (business.website) queue.unshift({ name: "you", url: business.website });

  return {
    stage: "reading",
    state: { ...state, competitors, visibility, queue, picked, pages: {} },
    progress: `Found ${competitors.length} to look at. Reading their pages`,
  };
}

// ---------------------------------------------------------------------------

async function read(state: RunState, ctx: ToolContext): Promise<Step> {
  const queue = state.queue ?? [];
  const pages = { ...(state.pages ?? {}) };

  const batch = queue.slice(0, PAGES_PER_STEP);
  const rest = queue.slice(PAGES_PER_STEP);

  /**
   * All at once. The politeness is owed per site, not overall.
   *
   * CLAUDE.md 1.5 rule 4 is one request at a time per site, with a pause, and
   * `queued()` in lib/research/fetch.ts already enforces exactly that: one
   * promise chain per hostname. Reading Booksy and a barber's own website at the
   * same moment slows neither of them down.
   *
   * This loop used to await each page before starting the next, so five
   * competitors on five different domains were read one after another, each
   * waiting out a pause owed to a site it had nothing to do with. The fetcher
   * was built for this and the caller threw it away.
   *
   * Two pages on the same host still queue behind each other, because the
   * fetcher decides that and not this loop. Nothing here can make us rude by
   * accident.
   */
  const got = await Promise.all(batch.map((item) => ctx.read(item.url)));

  batch.forEach((item, i) => {
    const page = got[i];
    (pages[item.name] ??= []).push({
      url: page.url,
      ok: page.ok,
      title: page.title,
      // Enough to understand the page, not a copy of it. Rule 5.
      text: page.text.slice(0, 12_000),
      fetchedOn: page.fetchedAt.slice(0, 10),
      note: page.note,
    });
  });

  const done = Object.values(pages).flat().length;
  const total = done + rest.length;

  if (rest.length) {
    return {
      stage: "reading",
      state: { ...state, queue: rest, pages },
      progress: `Read ${done} of ${total} pages`,
    };
  }

  const readable =
    Object.values(pages).flat().filter((p) => p.ok).length +
    (state.listingPages ?? []).filter((p) => p.ok).length;
  if (!readable) {
    return stop(
      state,
      "Every page we tried refused us or could not be reached. There is nothing " +
        "to compare, and we do not work around a block.",
    );
  }

  return {
    stage: "writing",
    state: { ...state, queue: [], pages },
    progress: `Read ${readable} pages. Writing it up`,
  };
}

// ---------------------------------------------------------------------------

async function write(state: RunState, business: Business, ctx: ToolContext): Promise<Step> {
  const { profile, competitors, pages, visibility } = state;
  if (!profile || !competitors || !pages) {
    return stop(state, "Lost what we read. Run it again.");
  }

  const readOn = new Date().toISOString().slice(0, 10);

  /**
   * The listing page is evidence, not scaffolding.
   *
   * It was being read to get names out of it and then thrown away, which is
   * how a run ended up writing a battlecard from one page. That page is where
   * the prices, the ratings and the review counts are: one Booksy page gave all
   * three for twelve Shrewsbury barbers in the manual test, and it is the
   * reason that test worked at all. For a local trade it is often the only
   * place any of it is published.
   */
  const listingEvidence = (state.listingPages ?? [])
    .filter((p) => p.ok)
    .map(
      (p) =>
        `### MARKET CONTEXT ONLY, from ${p.url} (read ${p.fetchedOn})\n` +
        `Every ${profile.trade} in ${profile.town}, with prices, ratings and review\n` +
        `counts. Use this ONLY for statements about the town as a whole, such as what\n` +
        `a cut typically costs here. Do NOT add any of these businesses to the\n` +
        `comparison: that list is fixed and is given below.\n\n` +
        p.text,
    );

  const evidence = [
    ...listingEvidence,
    ...Object.entries(pages).map(([name, list]) =>
      list
        .map((p) =>
          p.ok
            ? `### ${name} — ${p.url} (read ${p.fetchedOn})\n${p.text}`
            : `### ${name} — ${p.url}: ${p.note}`,
        )
        .join("\n\n"),
    ),
  ].join("\n\n---\n\n");

  /**
   * The five are fixed before the writing starts.
   *
   * They were being chosen by ranking and then quietly re-chosen by the model,
   * which read the listing page and wrote about whoever it found interesting.
   * The first real run ranked NO.1, HINCES, Branded Barbers and Golden Scissors
   * and produced a battlecard about Fade Inn, Darwin's and Barbering AJ. All the
   * ranking work was decoration.
   *
   * The listing stays, because the most useful line on the page is often a
   * market-wide one: what a cut actually costs in this town. That is a different
   * job from the comparison, and it is now labelled as a different job.
   */
  const theFive = competitors.map((c) => c.name);

  /**
   * Two calls, not one.
   *
   * One call had to return the competitors, a comparison grid, both columns and
   * three actions. It ran out of output partway through and came back with no
   * actions at all, so the card failed on "wrong count" and the repair, handed
   * a card with nothing to repair, failed the same way. Raj saw two refusals in
   * a row whose real cause was a token budget.
   *
   * The grid is the big one and it is structured data. The narrative is the
   * part that needs judgement. Splitting them means neither can crowd out the
   * other, and a failure in one does not lose the other.
   */
  /**
   * What the customer publishes, put in front of the writing step.
   *
   * It was read off their own site at sign-up and stored, and then never handed
   * to the tool. So the comparison had five competitors' prices and "Not
   * published" down the customer's own column, on a business whose price menu
   * we had already read in full. The one column we always have was the one
   * column that was empty.
   */
  const yourOwn = business.services.length
    ? `What ${profile.name} publishes, read from their own site:\n` +
      business.services.map((s) => `  - ${s.name}${s.price ? ` ${s.price}` : " (no price shown)"}`).join("\n") +
      `\n${business.address ? `  Address: ${business.address}\n` : ""}`
    : `${profile.name} publishes no prices on their own site that we could read.\n`;

  const evidencePrompt =
      `The business: ${profile.name}, a ${profile.trade} in ${profile.town}.\n` +
      `Their website: ${business.website}\n\n` +
      `${yourOwn}\n` +
      `THE COMPARISON IS ABOUT THESE ${theFive.length} AND NOBODY ELSE:\n` +
      theFive.map((n) => `  - ${n}`).join("\n") +
      `\n\nAnything else in the pages below is the town, not the comparison.\n\n` +
      `Everything we read:\n\n${evidence}`;

  const grid = (await ctx.think({
    hard: true,
    system: BATTLECARD_RULES,
    prompt: `${evidencePrompt}\n\nBuild the comparison grid only.`,
    shape: GRID_SHAPE,
    maxTokens: 20_000,
  })) as { comparison?: Grid[] };

  const built = (await ctx.think({
    hard: true,
    system: BATTLECARD_RULES,
    prompt:
      `${evidencePrompt}\n\n` +
      `The comparison grid is already written and is below. Do not repeat it. ` +
      `Write the per-business claims, the two columns and the three actions.\n\n` +
      JSON.stringify(grid.comparison ?? []),
    shape: NARRATIVE_SHAPE,
    maxTokens: 20_000,
  })) as {
    competitors?: unknown;
    actions?: unknown;
    where_you_win?: Side[];
    where_they_win?: Side[];
  };

  // Three actions is the shape of this product. None means the writing failed,
  // and saying so beats letting the guards report "wrong count" for a fault
  // that has nothing to do with the words.
  if (!Array.isArray(built.actions) || built.actions.length === 0) {
    return stop(
      state,
      "We read the pages and could not turn them into anything worth doing. " +
        "Nothing is shown rather than half a battlecard.",
    );
  }

  const sources: Source[] = [...Object.values(pages).flat(), ...(state.listingPages ?? [])]
    .filter((p) => p.ok)
    .map((p) => ({ url: p.url, fetchedOn: p.fetchedOn }));

  const unreadable = Object.entries(pages).flatMap(([name, list]) =>
    list.filter((p) => !p.ok).map((p) => ({ name, reason: reasonFor(p.note) })),
  );

  const card: Battlecard = {
    business: profile.name,
    ranAt: new Date().toISOString(),
    competitors: shapeCompetitors(built.competitors, competitors, profile.name),
    actions: shapeActions(built.actions),
    sources,
    unreadable,
  };

  // What the searches showed, which is a fact about us and not about them.
  if (visibility?.length) {
    const own = card.competitors.find((c) => c.name === profile.name);
    const claims = summarise(visibility, profile, competitors.map((c) => c.name), readOn);
    if (own) own.claims.channels = [...(own.claims.channels ?? []), ...claims];
  }

  return {
    stage: "checking",
    state: {
      ...state,
      card,
      grid: shapeGrid(grid.comparison, profile.name, competitors.map((c) => c.name)),
      standing: {
        winning: (built.where_you_win ?? []).slice(0, 4),
        losing: (built.where_they_win ?? []).slice(0, 4),
      },
    },
    progress: "Checking it",
  };
}

// ---------------------------------------------------------------------------

function check(state: RunState, business: Business): Step {
  const card = state.card;
  if (!card) return stop(state, "Nothing was built. Run it again.");

  const found = validateBattlecard(card, asText(card), new Date());

  const problems = Object.entries(found)
    .map(([rule, v]) => ({
      rule,
      sentences: Array.isArray(v)
        ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
        : v === true
          ? ["the card itself"]
          : [],
    }))
    .filter((p) => p.sentences.length > 0);

  if (!problems.length) {
    return {
      stage: "done",
      state,
      progress: `Done. ${card.competitors.length} businesses, ${card.sources.length} pages`,
    };
  }

  /**
   * One repair, then a refusal.
   *
   * The guards were a gate: any breach and the whole card was thrown away. Over
   * four real runs they refused four cards for four different sentences, every
   * one a phrasing problem in an otherwise sound battlecard, and every one sent
   * me back to tune the prompt against a fault that appeared somewhere else the
   * next time.
   *
   * The guards already know exactly what is wrong and where. Handing that back
   * to be reworded is better than tuning a prompt against a moving target, and
   * far better for the customer than being shown nothing.
   *
   * Once only. A second failure means the fault is in the facts rather than the
   * words, and a loop that keeps asking spends real money getting nowhere.
   */
  if ((state.repairs ?? 0) < 1) {
    return {
      stage: "fixing",
      state: { ...state, problems },
      progress: "Checking it, and fixing anything that does not read right",
    };
  }

  return stop(
    state,
    `We built it and then refused it: ${problems.map((p) => readable(p.rule)).join(", ")}. ` +
      `Nothing is shown rather than something we do not trust.`,
  );
}

// ---------------------------------------------------------------------------

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Reword exactly what the guards objected to, and nothing else.
 *
 * The facts are already gathered and already sourced, so this is a wording pass.
 * It is told to change the words and leave every number, name, date and source
 * where it is.
 */
async function fix(state: RunState, ctx: ToolContext): Promise<Step> {
  const card = state.card;
  const problems = state.problems ?? [];
  if (!card || !problems.length) return { stage: "checking", state, progress: "Checking it" };

  const complaints = problems
    .map(
      (p) =>
        `${WHY_REFUSED[p.rule] ?? p.rule}\n` +
        p.sentences.map((x) => `    ${x}`).join("\n"),
    )
    .join("\n\n");

  const reworded = (await ctx.think({
    system: REPAIR_RULES,
    prompt:
      `These parts of the battlecard were refused by the check:\n\n${complaints}\n\n` +
      `Here is the whole thing. Return it with those parts reworded and everything ` +
      `else identical.\n\n` +
      JSON.stringify({
        competitors: card.competitors,
        actions: card.actions,
        where_you_win: state.standing?.winning ?? [],
        where_they_win: state.standing?.losing ?? [],
      }),
    shape: BATTLECARD_SHAPE,
    maxTokens: 16_000,
  })) as {
    competitors?: unknown;
    comparison?: Grid[];
    actions?: unknown;
    where_you_win?: Side[];
    where_they_win?: Side[];
  };

  const stillThere = <T,>(fresh: T[] | undefined, before: T[]): T[] =>
    Array.isArray(fresh) && fresh.length ? fresh : before;

  return {
    stage: "checking",
    state: {
      ...state,
      /**
       * A repair may improve the wording and may never lose a part of the card.
       *
       * On its first real outing it came back with no actions, the card failed
       * on "wrong count" and Raj saw a refusal caused by the thing sent to fix
       * a different refusal. Three actions in, fewer than three out, keep what
       * we had.
       */
      card: {
        ...card,
        competitors: keepBetter(
          shapeCompetitors(reworded.competitors, card.competitors, card.business),
          card.competitors,
        ),
        actions: keepBetter(shapeActions(reworded.actions), card.actions),
      },
      repairs: (state.repairs ?? 0) + 1,
      standing: {
        winning: stillThere(reworded.where_you_win, state.standing?.winning ?? []),
        losing: stillThere(reworded.where_they_win, state.standing?.losing ?? []),
      },
      problems: undefined,
    },
    progress: "Checking it",
  };
}

/** A rewrite that came back shorter than it went in is a rewrite that lost
 *  something, and the thing it lost is worth more than the wording. */
function keepBetter<T>(fresh: T[], before: T[]): T[] {
  return fresh.length >= before.length ? fresh : before;
}

/** What each guard is actually complaining about, said so it can be acted on. */
const WHY_REFUSED: Record<string, string> = {
  unboundedCounts:
    "A count or an absence with no boundary. The check accepts these exact " +
    "forms and nothing else, so use one of them inside the same sentence:\n" +
    "      ... on Booksy      ... on Fresha      ... that we read\n" +
    "      ... we looked at      ... we read      ... we checked\n" +
    "      ... on any site we read      ... on the sites we read\n" +
    "      ... we could not read      ... we have not checked\n" +
    "      ... 4 of 9      ... none of the five\n" +
    'So "Your homepage carries no reviews" is refused and "No rating appears on ' +
    'any site we read" is fine. Same fact, and only one of them can be checked.',
  traffic: "A claim about how much traffic somebody gets. Nobody publishes it. Cut it.",
  rankClaims:
    "A claim about where somebody ranks on Google. We cannot see that. Say who appears, never in what order.",
  feedback: "A request for feedback inside the document. That belongs in the app around it.",
  unsourced: "A claim with no source. Every fact carries the page it came from.",
  impossibleDates: "A date that cannot be right.",
  stale: "A fact too old to state as current. Say when it was read.",
  namedReviewers: "A named reviewer. Themes and counts only, never who wrote one.",
  unexplainedGaps: "A blank with no reason. Say what was looked at and not found.",
  buildDetail:
    "A remark about how this product works, or about what we could not read. The customer is not buying that.",
  actions:
    "An action not supported by its evidence, or one recommending a price move. We do not know their costs, so a pricing action says what to publish and never what to charge.",
  tooManyCompetitors: "More than five businesses in the comparison.",
};

const REPAIR_RULES = `You are rewording parts of a finished battlecard that an automatic check
refused. The facts are right and already sourced.

Change only what the check objected to. Every number, name, date, price and
source stays exactly as it is. Do not add a fact, do not remove one, and do not
improve anything nobody complained about.

If a sentence cannot be fixed without inventing something, cut the sentence. A
shorter true card beats a longer refused one.`;

const stop = (state: RunState, reason: string): Step => ({
  stage: "failed",
  state: { ...state, reason },
  progress: reason,
});

/** Guard names are for us. These are for whoever is reading the screen. */
function readable(key: string): string {
  const words: Record<string, string> = {
    traffic: "it claimed to know someone's traffic",
    rankClaims: "it claimed a search position",
    unboundedCounts: "it counted something without saying out of what",
    feedback: "it asked for feedback inside the document",
    unsourced: "a claim had no source",
    impossibleDates: "a date was impossible",
    stale: "a fact was too old to state plainly",
    namedReviewers: "it named a reviewer",
    unexplainedGaps: "a blank had no reason",
    buildDetail: "it talked about how the product is built",
    actions: "an action was not supported by its evidence",
    tooManyCompetitors: "more than five competitors",
  };
  return words[key] ?? key;
}

function reasonFor(note: string) {
  const n = note.toLowerCase();
  if (n.includes("robots")) return "robots-disallowed" as const;
  if (n.includes("refused")) return "forbidden" as const;
  if (n.includes("not there")) return "not-found" as const;
  if (n.includes("time")) return "timeout" as const;
  if (n.includes("reach")) return "not-found" as const;
  return "empty-body" as const;
}

/** Everything the screen would show, as plain words, for the guards to scan. */
export function asText(card: Battlecard): string {
  /**
   * Every line ends in a full stop.
   *
   * THIS IS NOT TIDINESS. The guards split text into sentences at a full stop,
   * question mark or exclamation mark. Claims do not end in one, so joining
   * them with line breaks handed the guards a single sentence five claims long.
   * One of them mentioned an absence, so the whole blob was refused, and the
   * rewrite could never fix it because the fault was in how it was handed over,
   * not in anything the model wrote.
   *
   * Raj had four failed runs behind this.
   */
  const ended = (line: string) => {
    const t = line.trim();
    if (!t) return "";
    return /[.!?]$/.test(t) ? t : `${t}.`;
  };

  const lines = [ended(card.business)];

  for (const c of card.competitors) {
    lines.push(ended(c.name));
    for (const claims of Object.values(c.claims)) {
      for (const claim of claims ?? []) lines.push(ended(claim.text));
    }
  }

  for (const a of card.actions) {
    lines.push(ended(a.headline), ended(a.why));
    for (const e of a.evidence) lines.push(ended(e.text));
    if (a.deferred) lines.push(ended(a.deferred));
  }

  for (const u of card.unreadable) lines.push(ended(`${u.name}: ${u.reason}`));

  return lines.filter(Boolean).join("\n");
}

/**
 * The grid, with the columns forced to the right businesses.
 *
 * The customer goes first and is never one of the competitors. The screen used
 * to take the first competitor as the customer, which put SY1 Hair's opening
 * hours under the heading "You" on a real battlecard Raj was reading.
 */
function shapeGrid(raw: unknown, own: string, five: string[]): Grid[] {
  if (!Array.isArray(raw)) return [];
  const columns = [own, ...five];

  return raw.slice(0, 4).map((g: Record<string, unknown>) => {
    const given = Array.isArray(g.columns) ? (g.columns as string[]) : [];
    // Where each of our columns sits in what came back, so a reordering or a
    // renamed column moves the cells with it instead of shifting the table.
    const where = columns.map((name) =>
      given.findIndex(
        (c) => c.toLowerCase().replace(/[^a-z0-9]/g, "") === name.toLowerCase().replace(/[^a-z0-9]/g, ""),
      ),
    );

    return {
      area: String(g.area ?? "pricing"),
      columns,
      note: typeof g.note === "string" ? g.note : undefined,
      rows: (Array.isArray(g.rows) ? g.rows : []).slice(0, 8).map((r: Record<string, unknown>) => {
        const cells = Array.isArray(r.cells) ? (r.cells as Grid["rows"][0]["cells"]) : [];
        return {
          attribute: String(r.attribute ?? ""),
          cells: where.map((i) => (i >= 0 && cells[i] ? cells[i] : { value: null, source: null })),
        };
      }),
    };
  });
}

function shapeCompetitors(raw: unknown, known: Competitor[], own: string): Competitor[] {
  if (!Array.isArray(raw)) return known;
  const byName = new Map(known.map((c) => [c.name.toLowerCase(), c]));
  const isOwn = (n: string) =>
    n.toLowerCase().replace(/[^a-z0-9]/g, "") === own.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Anything not in the agreed five is dropped, not trusted. Instructions are
  // guidance; this is the part that cannot be talked out of.
  const agreed = new Set(known.map((c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, "")));
  const key = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");

  return raw
    .filter((r: Record<string, unknown>) => !isOwn(String(r.name ?? "")))
    .filter((r: Record<string, unknown>) => {
      if (!agreed.size) return true;
      const k = key(String(r.name ?? ""));
      // Either the same name, or one contains the other: "HINCES" and "HINCES
      // Barber" are the same shop and refusing one of them loses the evidence.
      return [...agreed].some((a) => a === k || a.includes(k) || k.includes(a));
    })
    .slice(0, 5)
    .map((r: Record<string, unknown>) => {
    const name = String(r.name ?? "");
    return {
      name,
      addedByCustomer: byName.get(name.toLowerCase())?.addedByCustomer ?? false,
      claims: (r.claims ?? {}) as Competitor["claims"],
    };
  });
}

function shapeActions(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3).map((r: Record<string, unknown>, i) => ({
    rank: Number(r.rank ?? i + 1),
    area: r.area as never,
    headline: String(r.headline ?? ""),
    why: String(r.why ?? ""),
    evidence: (Array.isArray(r.evidence) ? r.evidence : []) as never,
    ...(r.deferred ? { deferred: String(r.deferred) } : {}),
  }));
}

const BATTLECARD_RULES = `You are writing a competitor battlecard for a small business owner from pages
that have already been read for you. You have no other knowledge of these
businesses and you must not use any.

EVERY CLAIM CARRIES ITS SOURCE. The url and the date are given above each page.
A claim you cannot point at a page for does not go in. If you looked for a
price and the page does not print one, that is a claim with value null and it
is worth saying: "they publish no prices" is a finding.

NEVER SAY ANY OF THESE, they are not in the pages and cannot be:
  - how much traffic anyone gets, or what anyone spends
  - where anyone ranks on Google, or that they are "top" or "first"
  - what anyone is advertising
  - the name of anyone who wrote a review

REVIEWS ARE THEMES AND COUNTS. "4 of 9 name their barber rather than the shop"
is allowed. Naming that barber is not, ever.

A PRICING ACTION SAYS WHAT TO PUBLISH, NEVER WHAT TO CHARGE.

We do not know their costs, so we cannot tell them to raise, lower, match or
beat anybody, and we cannot tell them they need not either. Both are opinions
about a price and we have not earned one.

Keep those words out of the headline and the reason entirely: raise, lower,
increase, reduce, match, charge more, charge less, bump, go to. Even "you do not
have to match anyone" is refused, and rightly, because a check cannot tell a
recommendation from its opposite and should not have to guess.

  No.   You do not have to match anyone, just publish something.
  No.   Consider raising your classic cut towards the town average.
  Yes.  Publish a cut price, a beard price and an under 12s price.
  Yes.  Put what you charge where a customer can read it before they ring.

What the town charges is a fact and belongs in the evidence, where it is a
number with a source. It does not belong in the reason, where it reads as a
nudge.

THE THREE ACTIONS are the point of the whole thing. Each one attacks a weakness
you have evidence for, is something the owner could start this week, and carries
the claims it rests on.

SAYING SOMETHING IS ABSENT MEANS SAYING WHERE YOU LOOKED, IN THE SAME SENTENCE.

"Your website shows none" gets refused, and rightly: a reader cannot tell
whether we checked one page or twenty. Name the sources inside the sentence.

  No.   None. / They have no reviews. / Your website shows none.
  Yes.  We looked at Booksy, Fresha and your own site, and found no reviews.
  Yes.  None of the five publishes a price.
  Yes.  4 of the 9 reviews we read name the barber.
  Yes.  No price appears on any page we read.

The same goes for every number. "Most of them" and "several" are not countable.
Write "4 of 5", or do not write it.

EVERY CLAIM YOU USE AS EVIDENCE FOR AN ACTION MUST HAVE A REAL VALUE AND A REAL
SOURCE. A claim whose value is null means we looked and could not see it, and an
action built on one is an action built on a hole. Those claims still belong in
the competitor list, where "they publish no prices" is worth knowing. They do not
belong under an action.

DO NOT INCLUDE THE CUSTOMER IN THE LIST OF COMPETITORS. They are not one of
their own competitors, and there is a separate field for them.

THE COMPARISON COVERS EXACTLY THE BUSINESSES NAMED IN THE PROMPT, AND NO OTHERS.
They were chosen on how near they are, how many public reviews they hold, how
recently they were reviewed and whether they charge what this business charges.
A business you find interesting in a listing is not one of them.

The listing of everyone in the town is for market statements only: what a cut
typically costs here, how many shops publish a price, what the range is. Those
are worth saying and often the most useful line on the page. Naming a business
from that listing inside the comparison is not. Rank them by what would change the most. If the obvious
move is a price change, say so but mark it deferred: you do not know their costs
and cannot tell them to cut a price.

NEVER WRITE ABOUT THE RESEARCH ITSELF. Not what we could and could not read,
not that a page blocked us, not that a search returned little. The owner is
paying for findings about their market, and a finding about our own difficulties
is not one. If there is not enough to say, say less.

Write like a person talking to the owner. No jargon. No em dashes.`;

const BATTLECARD_SHAPE = {
  name: "battlecard",
  description: "What each business does, and the three things to do about it.",
  input_schema: {
    type: "object",
    properties: {
      competitors: {
        type: "array",
        description: "The businesses, with the customer's own first.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            claims: {
              type: "object",
              description: "Facts by area. Empty areas are fine and honest.",
              properties: {
                pricing: { type: "array", items: { $ref: "#/$defs/claim" } },
                channels: { type: "array", items: { $ref: "#/$defs/claim" } },
                reviews: { type: "array", items: { $ref: "#/$defs/claim" } },
                blindspots: { type: "array", items: { $ref: "#/$defs/claim" } },
              },
            },
          },
          required: ["name", "claims"],
        },
      },
      comparison: {
        type: "array",
        description:
          "One grid per area. A row is one comparable thing and a cell is what each " +
          "business publishes about it. This is what the customer reads to compare.",
        items: {
          type: "object",
          properties: {
            area: { type: "string", enum: ["pricing", "channels", "reviews", "blindspots"] },
            columns: {
              type: "array",
              description: "The customer's name first, then the competitors, exactly as named.",
              items: { type: "string" },
            },
            rows: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  attribute: {
                    type: "string",
                    description: "One comparable thing: 'Classic cut', 'Reviews', 'Opens'.",
                  },
                  cells: {
                    type: "array",
                    description: "One per column, same order. Null where nothing is published.",
                    items: {
                      type: "object",
                      properties: {
                        value: { type: ["string", "null"] },
                        source: {
                          type: ["object", "null"],
                          properties: {
                            url: { type: "string" },
                            fetchedOn: { type: "string" },
                          },
                          required: ["url", "fetchedOn"],
                        },
                      },
                      required: ["value", "source"],
                    },
                  },
                },
                required: ["attribute", "cells"],
              },
            },
            note: { type: ["string", "null"] },
          },
          required: ["area", "columns", "rows"],
        },
      },
      where_you_win: {
        type: "array",
        description:
          "Up to four things this business does better than the others, each from a page we read. Empty is an honest answer.",
        items: {
          type: "object",
          properties: { point: { type: "string" }, detail: { type: "string" } },
          required: ["point", "detail"],
        },
      },
      where_they_win: {
        type: "array",
        description: "Up to four things the others do better, each from a page we read.",
        items: {
          type: "object",
          properties: { point: { type: "string" }, detail: { type: "string" } },
          required: ["point", "detail"],
        },
      },
      actions: {
        type: "array",
        description: "Exactly three, strongest first.",
        items: {
          type: "object",
          properties: {
            rank: { type: "integer" },
            area: { type: "string", enum: ["pricing", "channels", "reviews", "blindspots"] },
            headline: { type: "string" },
            why: { type: "string" },
            evidence: { type: "array", items: { $ref: "#/$defs/claim" } },
            deferred: { type: ["string", "null"] },
          },
          required: ["rank", "area", "headline", "why", "evidence"],
        },
      },
    },
    required: ["competitors", "comparison", "where_you_win", "where_they_win", "actions"],
    $defs: {
      claim: {
        type: "object",
        properties: {
          text: { type: "string" },
          value: { type: ["string", "number", "null"] },
          source: {
            type: ["object", "null"],
            properties: { url: { type: "string" }, fetchedOn: { type: "string" } },
            required: ["url", "fetchedOn"],
          },
        },
        required: ["text", "value", "source"],
      },
    },
  },
};

/**
 * What the repair is allowed to return: the words, and nothing else.
 *
 * It used to be handed the whole battlecard shape. Once the comparison grid was
 * added to that shape, a rewrite had to regenerate the grid as well, ran out of
 * output tokens partway, and came back with no actions at all. The card then
 * failed on "wrong-count" — a fault introduced by the thing sent to fix a
 * different fault.
 *
 * The grid is structured data and cannot trip a guard that reads prose, so
 * there was never a reason to rewrite it.
 */
const REPAIR_SHAPE = {
  name: "reworded",
  description: "The same battlecard with the refused wording changed and nothing else.",
  input_schema: {
    type: "object",
    properties: {
      competitors: BATTLECARD_SHAPE.input_schema.properties.competitors,
      actions: BATTLECARD_SHAPE.input_schema.properties.actions,
      where_you_win: BATTLECARD_SHAPE.input_schema.properties.where_you_win,
      where_they_win: BATTLECARD_SHAPE.input_schema.properties.where_they_win,
    },
    required: ["competitors", "actions", "where_you_win", "where_they_win"],
    $defs: BATTLECARD_SHAPE.input_schema.$defs,
  },
};

/** The grid alone: the big, structured half. */
const GRID_SHAPE = {
  name: "comparison",
  description: "One grid per area, a row per comparable thing and a column per business.",
  input_schema: {
    type: "object",
    properties: { comparison: BATTLECARD_SHAPE.input_schema.properties.comparison },
    required: ["comparison"],
  },
};

/** The words: what each business is, where you stand, and what to do. */
const NARRATIVE_SHAPE = {
  name: "battlecard",
  description: "The claims per business, the two columns, and the three actions.",
  input_schema: {
    type: "object",
    properties: {
      competitors: BATTLECARD_SHAPE.input_schema.properties.competitors,
      where_you_win: BATTLECARD_SHAPE.input_schema.properties.where_you_win,
      where_they_win: BATTLECARD_SHAPE.input_schema.properties.where_they_win,
      actions: BATTLECARD_SHAPE.input_schema.properties.actions,
    },
    required: ["competitors", "where_you_win", "where_they_win", "actions"],
    $defs: BATTLECARD_SHAPE.input_schema.$defs,
  },
};
