import {
  buildSearchTerms,
  candidatesFromSearch,
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
  listingPages?: ReadPage[];
  card?: Battlecard;
  /**
   * The two columns at the top of the screen. Kept beside the battlecard rather
   * than inside it, because Battlecard is the agent's type and a screen wanting
   * a new field is not a reason to change the shape the guards check.
   */
  standing?: { winning: Side[]; losing: Side[] };
  /** Why it failed, in words a customer reads. */
  reason?: string;
};

export type Side = { point: string; detail: string };

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

      // A host the playbook already trusts counts as a listing even if the url
      // shape is one we have not seen, because platforms change their paths and
      // the playbook is evidence that this one lists this trade.
      const trusted = knownHosts.some((h) => url.includes(h));

      if ((isListing || trusted) && isOurs && url.includes(town)) wanted.add(r.url);
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
        "not a place name. If it is not a listing, return nothing.",
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
  const learned = pages
    .filter((p) => p.ok)
    .map((p) => ({
      host: hostOf(p.url),
      example: p.url,
      named: names.length,
    }))
    .filter((p) => p.host);

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

function choose(state: RunState, business: Business): Step {
  const { profile, seen } = state;
  if (!profile || !seen) return stop(state, "Lost the search results. Run it again.");

  const already = state.competitors ?? [];
  const raw = candidatesFromSearch(seen, profile, already.map((c) => c.name));

  const candidates = raw.filter((c) => {
    const where = `${c.url} ${c.name}`;
    if (NEVER_A_BUSINESS.some((host) => c.url.toLowerCase().includes(host))) return false;
    if (WRONG_COUNTRY.test(where)) return false;
    // A page whose title announces it is a list is a list, however many
    // businesses are named on it.
    if (/\b(best|top|10|ten|near me|directory|guide)\b/i.test(c.name)) return false;
    return true;
  });

  // Listing names first: they are businesses in this town on a platform this
  // town's customers actually use. Search candidates fill any space left.
  const fromListing = (state.fromListings ?? []).filter(
    (n) => !NEVER_A_BUSINESS.some((h) => n.toLowerCase().includes(h)) && !WRONG_COUNTRY.test(n),
  );

  /**
   * Rank rather than take the first five.
   *
   * Seventy came back for Shrewsbury and the run kept whichever the page
   * printed first, which is the platform's sort order and nothing to do with
   * this business. Proximity, review volume, how recently reviewed, price
   * overlap, then rating. See rank.ts for why each one earns its weight.
   */
  const listed = (state.listed ?? []).filter(
    (r) => !NEVER_A_BUSINESS.some((h) => r.name.toLowerCase().includes(h)),
  );

  const picked = listed.length
    ? rank(
        listed,
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

  const competitors = refreshSet(
    // A competitor the owner named survives every weekly run, for ever. That is
    // what addedByCustomer means, and it is also the guarantee that a run
    // produces something even when discovery finds nobody.
    business.knownCompetitor
      ? [
          { name: business.knownCompetitor, addedByCustomer: true, claims: {} },
          ...already.filter((c) => c.name !== business.knownCompetitor),
        ]
      : already,
    [
      ...picked.map((p) => p.name),
      ...fromListing,
      ...candidates.map((c) => c.name),
    ],
    profile.name,
  );

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
        `### Everyone in ${profile.town}, from ${p.url} (read ${p.fetchedOn})\n` +
        `This page lists many businesses with their prices, ratings and review counts.\n\n` +
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

  const built = (await ctx.think({
    hard: true,
    system: BATTLECARD_RULES,
    prompt:
      `The business: ${profile.name}, a ${profile.trade} in ${profile.town}.\n` +
      `Their website: ${business.website}\n\n` +
      `Everything we read:\n\n${evidence}`,
    shape: BATTLECARD_SHAPE,
    maxTokens: 16_000,
  })) as {
    competitors?: unknown;
    actions?: unknown;
    where_you_win?: Side[];
    where_they_win?: Side[];
  };

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

  // The agent's own guards, over the card and over the words it would show.
  const problems = validateBattlecard(card, asText(card), new Date());

  const broken = Object.entries(problems).filter(([, v]) =>
    Array.isArray(v) ? v.length > 0 : v === true,
  );

  if (broken.length) {
    // Refused rather than shown with a warning. A battlecard that breaks its own
    // rules is exactly the thing this product exists not to produce, and a
    // warning on it is us knowing it is wrong and showing it anyway.
    return stop(
      state,
      `We built it and then refused it: ${broken.map(([k]) => readable(k)).join(", ")}. ` +
        `Nothing is shown rather than something we do not trust.`,
    );
  }

  return {
    stage: "done",
    state,
    progress: `Done. ${card.competitors.length} businesses, ${card.sources.length} pages`,
  };
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
  const lines = [card.business];
  for (const c of card.competitors) {
    lines.push(c.name);
    for (const claims of Object.values(c.claims)) {
      for (const claim of claims ?? []) lines.push(claim.text);
    }
  }
  for (const a of card.actions) {
    lines.push(a.headline, a.why, ...a.evidence.map((e) => e.text));
    if (a.deferred) lines.push(a.deferred);
  }
  for (const u of card.unreadable) lines.push(`${u.name}: ${u.reason}`);
  return lines.join("\n");
}

/**
 * The customer is not one of their own competitors.
 *
 * They were being included in the list, which made six where the rule is five,
 * and the guard refused the whole card for it. Battlecard.business is the field
 * that holds them, and the screen reads it from there.
 */
function shapeCompetitors(raw: unknown, known: Competitor[], own: string): Competitor[] {
  if (!Array.isArray(raw)) return known;
  const byName = new Map(known.map((c) => [c.name.toLowerCase(), c]));
  const isOwn = (n: string) =>
    n.toLowerCase().replace(/[^a-z0-9]/g, "") === own.toLowerCase().replace(/[^a-z0-9]/g, "");
  return raw
    .filter((r: Record<string, unknown>) => !isOwn(String(r.name ?? "")))
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

THE THREE ACTIONS are the point of the whole thing. Each one attacks a weakness
you have evidence for, is something the owner could start this week, and carries
the claims it rests on.

EVERY CLAIM YOU USE AS EVIDENCE FOR AN ACTION MUST HAVE A REAL VALUE AND A REAL
SOURCE. A claim whose value is null means we looked and could not see it, and an
action built on one is an action built on a hole. Those claims still belong in
the competitor list, where "they publish no prices" is worth knowing. They do not
belong under an action.

DO NOT INCLUDE THE CUSTOMER IN THE LIST OF COMPETITORS. They are not one of
their own competitors, and there is a separate field for them. Rank them by what would change the most. If the obvious
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
    required: ["competitors", "where_you_win", "where_they_win", "actions"],
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
