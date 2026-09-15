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
import { refreshSet } from "../../../Agents/Competitor Tracker/src/competitor-set.ts";
import { validateBattlecard } from "../../../Agents/Competitor Tracker/src/guards.ts";
import type {
  Battlecard,
  Competitor,
  Source,
} from "../../../Agents/Competitor Tracker/src/types.ts";
import type { Business, ToolContext } from "../types.ts";
import { isProfile, profileFor } from "./profile.ts";

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
  terms?: { term: string; why: string }[];
  seen?: { term: string; results: SearchResult[] }[];
  visibility?: Visibility[];
  competitors?: Competitor[];
  /** Pages still to fetch. Drained a few at a time so no tick runs too long. */
  queue?: { name: string; url: string }[];
  pages?: Record<string, ReadPage[]>;
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

/** How many pages one call will fetch. Each has a pause before it, so this is
 *  the knob that keeps a single tick inside any hosting time limit. */
const PAGES_PER_STEP = 4;

export async function advance(
  stage: Stage,
  state: RunState,
  business: Business,
  ctx: ToolContext,
): Promise<Step> {
  switch (stage) {
    case "searching":
      return search(state, business, ctx);
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

  const terms = buildSearchTerms(profile);

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
    stage: "choosing",
    state: { ...state, profile, terms, seen: withResults },
    progress: `Searched ${withResults.length} of the ${terms.length} things a customer would type`,
  };
}

// ---------------------------------------------------------------------------

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

  // refreshSet keeps anyone the customer named, for ever, and fills the rest.
  const competitors = refreshSet(
    already,
    candidates.map((c) => c.name),
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
      const hit = candidates.find((k) => k.name === c.name);
      return hit ? { name: c.name, url: hit.url } : null;
    })
    .filter(Boolean) as { name: string; url: string }[];

  if (business.website) queue.unshift({ name: "you", url: business.website });

  return {
    stage: "reading",
    state: { ...state, competitors, visibility, queue, pages: {} },
    progress: `Found ${competitors.length} to look at. Reading their pages`,
  };
}

// ---------------------------------------------------------------------------

async function read(state: RunState, ctx: ToolContext): Promise<Step> {
  const queue = state.queue ?? [];
  const pages = { ...(state.pages ?? {}) };

  const batch = queue.slice(0, PAGES_PER_STEP);
  const rest = queue.slice(PAGES_PER_STEP);

  for (const item of batch) {
    const got = await ctx.read(item.url);
    (pages[item.name] ??= []).push({
      url: got.url,
      ok: got.ok,
      title: got.title,
      // Enough to understand the page, not a copy of it. Rule 5.
      text: got.text.slice(0, 12_000),
      fetchedOn: got.fetchedAt.slice(0, 10),
      note: got.note,
    });
  }

  const done = Object.values(pages).flat().length;
  const total = done + rest.length;

  if (rest.length) {
    return {
      stage: "reading",
      state: { ...state, queue: rest, pages },
      progress: `Read ${done} of ${total} pages`,
    };
  }

  const readable = Object.values(pages).flat().filter((p) => p.ok).length;
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

  const evidence = Object.entries(pages)
    .map(([name, list]) =>
      list
        .map((p) =>
          p.ok
            ? `### ${name} — ${p.url} (read ${p.fetchedOn})\n${p.text}`
            : `### ${name} — ${p.url}: ${p.note}`,
        )
        .join("\n\n"),
    )
    .join("\n\n---\n\n");

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

  const sources: Source[] = Object.values(pages)
    .flat()
    .filter((p) => p.ok)
    .map((p) => ({ url: p.url, fetchedOn: p.fetchedOn }));

  const unreadable = Object.entries(pages).flatMap(([name, list]) =>
    list.filter((p) => !p.ok).map((p) => ({ name, reason: reasonFor(p.note) })),
  );

  const card: Battlecard = {
    business: profile.name,
    ranAt: new Date().toISOString(),
    competitors: shapeCompetitors(built.competitors, competitors),
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

function shapeCompetitors(raw: unknown, known: Competitor[]): Competitor[] {
  if (!Array.isArray(raw)) return known;
  const byName = new Map(known.map((c) => [c.name.toLowerCase(), c]));
  return raw.slice(0, 6).map((r: Record<string, unknown>) => {
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
the claims it rests on. Rank them by what would change the most. If the obvious
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
