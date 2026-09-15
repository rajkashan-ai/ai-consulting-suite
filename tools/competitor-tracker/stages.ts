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
  /** Why it failed, in words a customer reads. */
  reason?: string;
};

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

  // One call, the search tool, and the model does the searching. The config
  // comes from the agent because it carries user_location, without which a
  // search for "barber Shrewsbury" returns Pennsylvania and Massachusetts.
  const answer = (await ctx.think({
    system:
      "You are running searches a customer would run, and reporting exactly what came back. " +
      "Do not judge, rank, summarise or recommend. Report every result you saw, with its real " +
      "URL and its real title. Never invent a result and never repair a URL you are unsure of.",
    prompt:
      `Run each of these searches and list what came back.\n\n` +
      terms.map((t) => `- ${t.term}`).join("\n"),
    tools: [searchToolConfig(profile, terms.length)],
    shape: {
      name: "results",
      description: "What each search returned, exactly as it came back.",
      input_schema: {
        type: "object",
        properties: {
          searches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                term: { type: "string" },
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { url: { type: "string" }, title: { type: "string" } },
                    required: ["url", "title"],
                  },
                },
              },
              required: ["term", "results"],
            },
          },
        },
        required: ["searches"],
      },
    },
    maxTokens: 8000,
  })) as { searches?: { term: string; results: SearchResult[] }[] };

  const seen = (answer.searches ?? []).filter((s) => s.results?.length);
  if (!seen.length) {
    return stop(
      state,
      `Nothing came back for "${terms[0]?.term}". That usually means the trade or ` +
        `the town is wrong for this business.`,
    );
  }

  return {
    stage: "choosing",
    state: { ...state, profile, terms, seen },
    progress: `Searched ${seen.length} of the ${terms.length} things a customer would type`,
  };
}

// ---------------------------------------------------------------------------

function choose(state: RunState, business: Business): Step {
  const { profile, seen } = state;
  if (!profile || !seen) return stop(state, "Lost the search results. Run it again.");

  const already = state.competitors ?? [];
  const candidates = candidatesFromSearch(seen, profile, already.map((c) => c.name));

  // refreshSet keeps anyone the customer named, for ever, and fills the rest.
  const competitors = refreshSet(
    already,
    candidates.map((c) => c.name),
    profile.name,
  );

  if (!competitors.length) {
    return stop(
      state,
      `We could not find another ${profile.trade} in ${profile.town} that we are ` +
        `allowed to read. Add one yourself and we will track them.`,
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
  })) as { competitors?: unknown; actions?: unknown };

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

  return { stage: "checking", state: { ...state, card }, progress: "Checking it" };
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
    required: ["competitors", "actions"],
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
