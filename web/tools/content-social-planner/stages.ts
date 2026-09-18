import type { Watch } from "@/lib/watchdog";
import { plainly } from "../../lib/plainly.ts";
import type { Business, ToolContext } from "../types.ts";
import {
  CADENCE_LABEL,
  CHANNEL,
  type Cadence,
  type Channel,
  type KnownFacts,
  type Recommendation,
  type Slot,
} from "../../../Agents/Content & Social Planner/src/types.ts";
import { planDates, slotWeeks, validateShape } from "../../../Agents/Content & Social Planner/src/plan-shape.ts";
import {
  recommendCadence,
  validateRecommendation,
} from "../../../Agents/Content & Social Planner/src/recommend.ts";
import { cite, citeRules, numberPages, type Cited, type Page } from "./sources.ts";
import { pagesFrom } from "../../lib/research/sitemap.ts";
import { shapeMonth } from "./shape.ts";
import { belowTheBar, sayBar } from "./bar.ts";
import { houseStyle, keep, unDash, unTag, unsafe } from "./scrub.ts";
import { POST_RULES, VOICE_RULES } from "./prompts.ts";
import { personaFor, type Persona, type StyleId } from "./persona.ts";
import { fetchable } from "../identity.ts";

/**
 * A month of posts, a step at a time.
 *
 * The whole run is minutes, mostly the model writing, and nothing about it is
 * worth losing to a closed laptop. So each call does a little and hands back
 * where it got to, and something else decides when to call again.
 *
 * Every step is safe to run twice. A tick that dies after reading a page but
 * before saving loses that page, not the run.
 *
 * WHAT THIS TOOL DOES NOT DO
 * It never researches a competitor: that is the Tracker's job, it costs a
 * second research run, and two tools answering one question is two answers
 * (`Agents/Content & Social Planner/CLAUDE.md` 6.9). Everything here is read
 * off the customer's own site.
 */

export type Stage =
  | "reading"
  | "voice"
  | "shaping"
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

/** A post once it has words. `source` is where its facts came from. */
export type WrittenPost = Slot & {
  words: string;
  shot: string;
  why: string;
  /** Only on YouTube, where an upload with no title cannot be published. */
  title?: string;
  source?: Cited | null;
};

export type PlannedPost = Slot | WrittenPost;
export const isWrittenPost = (p: PlannedPost): p is WrittenPost =>
  typeof (p as WrittenPost).words === "string" && (p as WrittenPost).words.length > 0;

export type WeekRow = { week: string; about: string; channels: Channel[]; posts: number };

/** What we suggested last time, so this time is not the same. */
export type Before = { angles: string[]; openings: string[] };

export type RunState = {
  /** The last plan, narrowed. Null when there has not been one. */
  before?: Before | null;
  /** Where they told us they post. Undefined means nobody has asked. */
  told?: string[];
  /** A cadence they pressed. Beats the recommendation outright. */
  chose?: Cadence;
  /** Pages actually read, numbered, in the order the model is shown them. */
  pages?: Page[];
  read?: ReadPage[];
  /** Pages still to read. Worked out once, then drained one a tick. */
  queue?: string[];
  /** Their voice, read off their own copy. Sourced like anything else. */
  voice?: { words: string; source: Cited | null };
  /** The voice they chose, put on the run by the screen. See Brand Persona. */
  persona?: Persona | null;
  style?: StyleId;
  channels?: Channel[];
  recommendation?: Recommendation;
  cadence?: Cadence;
  /** Every slot in the month. Arithmetic, so it exists from the first run. */
  slots?: Slot[];
  posts?: PlannedPost[];
  weeks?: WeekRow[];
  /** How many claims were taken off because nothing supported them. */
  dropped?: { what: string; why: string }[];
  /** Why the run stopped, in the owner's words. */
  reason?: string;
  watch?: Watch;
};

export type Step = { stage: Stage; state: RunState; progress: string };

/**
 * A string with no em dash and no en dash in it, for a JSON schema.
 *
 * Written as a lookahead over the whole string because a schema pattern is
 * matched against the value, and "must not contain" has to be expressed as
 * "starts with something that is not followed by one anywhere".
 */
const NO_DASH = "^(?![\\s\\S]*[\\u2014\\u2013])[\\s\\S]*$";

/** Pages worth asking for beyond the home page, best first. */
const WORTH = /price|pricing|cost|service|treatment|menu|what-we-do|rates|package|book|about/i;
const SKIP = /privacy|terms|cookie|policy|login|account|cart|basket|\.(jpg|png|pdf|css|js)$/i;

/** How many of their own pages one run reads. Their site, not the web. */
const MAX_PAGES = 5;

/**
 * How many of them one step fetches.
 *
 * The watchdog allows six steps in `reading`, sized for a tool that fetches
 * eight pages a step. Three keeps a five page site inside two steps of reading
 * with room to spare, and still saves after each one, which is the promise that
 * matters: a closed laptop loses a step, never the run.
 */
const PER_STEP = 3;

/** Weeks written on the first run. The rest is shaped and arrives weekly. */
const WEEKS_WRITTEN = 1;

export async function advance(
  stage: Stage,
  state: RunState,
  business: Business,
  ctx: ToolContext,
): Promise<Step> {
  /**
   * A stage that throws fails the run rather than throwing at whoever called.
   * Both halves are kept: the owner's words on the run, the real text on the
   * watch, or the next failure is undiagnosable.
   */
  try {
    return await run(stage, state, business, ctx);
  } catch (e) {
    const plain = plainly(e);
    const watch = { ...(state.watch ?? {}), stopped: `${stage}: ${plain.why}` };
    return {
      stage: "failed",
      state: { ...state, reason: plain.say, watch },
      progress: plain.say,
    };
  }
}

async function run(
  stage: Stage,
  state: RunState,
  business: Business,
  ctx: ToolContext,
): Promise<Step> {
  switch (stage) {
    case "reading":
      return reading(state, business, ctx);
    case "voice":
      return voice(state, business, ctx);
    case "shaping":
      return shaping(state, business, ctx);
    case "writing":
      return writing(state, business, ctx);
    case "checking":
      return checking(state, business, ctx);
    default:
      return { stage, state, progress: "" };
  }
}

const fail = (state: RunState, say: string): Step => ({
  stage: "failed",
  state: { ...state, reason: say },
  progress: say,
});

// ---------------------------------------------------------------------------
// 1. Reading their own site
// ---------------------------------------------------------------------------

/**
 * Read their home page, then the pages the site itself says it has.
 *
 * Not the links in the page text. `lib/research/fetch.ts` hands back visible
 * text, and `visibleText` strips `<nav>`, `<header>` and `<footer>` before
 * anything else, because a nav repeated on twenty-four pages crowds out the
 * page's own words. A small business keeps its whole navigation in exactly
 * those three elements. Read live through the real reader, this barber's home
 * page is 1,419 characters with no link to its own price list in it, so
 * following links would have read one page and written a month of posts with
 * no prices in them. The fixture said otherwise because the fixture was
 * captured with a plain fetch rather than through the reader the tool uses.
 *
 * `lib/research/sitemap.ts` is the sanctioned answer and says so in its own
 * first line: a sitemap is a site telling us its own pages, and guessing is
 * what you do when there is not one. So: sitemap, then guesses, then whatever
 * addresses survived in the text.
 */
async function reading(state: RunState, business: Business, ctx: ToolContext): Promise<Step> {
  const already = state.read ?? [];

  /**
   * The home page and the list of what to read next, in one step.
   *
   * These were two steps and the second read nothing, which cost a tick to
   * produce no page. `lib/watchdog.ts` allows six steps in `reading` and says
   * why in a comment: the Competitor Tracker fetches eight pages a step. This
   * tool fetched one, so a site with a real sitemap needed seven steps and the
   * watchdog stopped it, correctly, having read five pages and used none.
   */
  if (!already.length) {
    const home = await ctx.read(business.website);
    if (!home.ok) {
      return fail(state, "We could not open your website, so there is nothing to write from yet.");
    }
    const first = asRead(home);

    /**
     * Guarded. `new URL()` throws on an address with no protocol, and on
     * 2026-09-17 five Tracker runs died on exactly that: the address had been
     * stored as a comparison key rather than as something fetchable. Found here
     * by the test that was written after, before it had a chance to bite.
     */
    const site = fetchable(first.url);
    if (!site) {
      return fail(state, "We could not open your website, so there is nothing to write from yet.");
    }
    const queue = await worthReading(new URL(site).origin, first, ctx);
    ctx.progress("Read your home page");
    return {
      stage: "reading",
      state: { ...state, read: [first], queue },
      progress: "1 page of your site read",
    };
  }

  const seen = (u: string) => u.replace(/\/+$/, "");
  const done = new Set(already.map((p) => seen(p.url)));
  const next = (state.queue ?? []).filter((u) => !done.has(seen(u))).slice(0, PER_STEP);

  if (!next.length || already.length >= MAX_PAGES) {
    const pages = numberPages(
      already
        .filter((p) => p.ok && p.text.trim().length > 40)
        .map((p) => ({ url: p.url, fetchedOn: p.fetchedOn, what: p.title ?? "" })),
    );
    if (!pages.length) return fail(state, "We could not read anything on your website.");
    return {
      stage: "voice",
      state: { ...state, pages },
      progress: `${pages.length} page${pages.length === 1 ? "" : "s"} of your site read`,
    };
  }

  /**
   * Several a step, saved together.
   *
   * One a step was a tick per page, which a five page site cannot finish inside
   * the cap. `lib/research/fetch.ts` still queues per host with a pause between,
   * so this is no less polite; it is the same requests reported in fewer saves.
   * A tick that dies loses these three rather than the run.
   */
  const got = await Promise.all(next.map((u) => ctx.read(u)));
  const read = [...already, ...got.map(asRead)];
  ctx.progress(`Read ${read.length} pages of your site`);
  return { stage: "reading", state: { ...state, read }, progress: `${read.length} pages of your site read` };
}

const asRead = (r: Awaited<ReturnType<ToolContext["read"]>>): ReadPage => ({
  url: r.url,
  ok: r.ok,
  title: r.title,
  text: r.text,
  fetchedOn: r.fetchedAt.slice(0, 10),
  note: r.note,
});

/**
 * Addresses in whatever came back, tags or no tags.
 *
 * A sitemap is `<loc>https://...</loc>`, and `lib/research/fetch.ts` hands back
 * visible text with the tags taken out, so a parser looking for `<loc>` found
 * nothing on every real site and the run fell through to guessing paths. It
 * worked in the test because the fake handed back raw xml, which is the fixture
 * being easier to satisfy than the thing it stands in for, for the third time
 * in this tool.
 *
 * The addresses survive either way, so match those.
 */
export function urlsIn(text: string): string[] {
  return [...new Set((String(text).match(/https?:\/\/[^\s<>"')]+/g) ?? []).map((u) => u.replace(/[.,;]+$/, "")))];
}

/** The pages of their own site worth reading, best first. */
export async function worthReading(
  origin: string,
  home: ReadPage,
  ctx: ToolContext,
): Promise<string[]> {
  const out: string[] = [];

  const read = async (u: string) => {
    const got = await ctx.read(u);
    return { ok: got.ok, text: got.text };
  };

  /**
   * Ask robots.txt where the sitemap is, before assuming.
   *
   * `lib/research/sitemap.ts` tries `/sitemap.xml`, which is right for most
   * sites and wrong for WordPress, where it is `/wp-sitemap.xml`. A Hertfordshire
   * salon on WordPress therefore fell through to guessing, and four of the five
   * guesses were 404s fetched one at a time with a pause between.
   *
   * robots.txt is where a site is supposed to declare it, and reading that
   * costs one request and works whatever the site is built with. The default
   * still runs after it, because plenty of sites publish a sitemap and never
   * mention it in robots.
   */
  const robots = await ctx.read(`${origin}/robots.txt`);
  const declared = robots.ok
    ? [...robots.text.matchAll(/sitemap:\s*(\S+)/gi)].map((m) => m[1].replace(/[.,;]+$/, ""))
    : [];

  for (const url of declared.slice(0, 2)) {
    try {
      if (new URL(url).origin !== origin) continue;
    } catch {
      // A sitemap entry that is not a url. Expected: skipping it is right, and
      // one bad line must not lose the rest of the sitemap.
      continue;
    }
    const map = await ctx.read(url);
    if (!map.ok) continue;
    const locs = urlsIn(map.text);
    /* One level of nesting, the same as pagesFrom allows: a sitemap index
       pointing at other sitemaps is the common WordPress shape. */
    for (const loc of locs.slice(0, 8)) {
      if (!/\.xml(\?|$)/i.test(loc)) {
        out.push(loc);
        continue;
      }
      const child = await ctx.read(loc);
      if (child.ok) {
        for (const u of urlsIn(child.text)) if (!/\.xml(\?|$)/i.test(u)) out.push(u);
      }
    }
  }

  if (!out.length) out.push(...(await pagesFrom(origin, read, MAX_PAGES)));

  /* Guessing is a claim about a site nobody has read, so it comes second and
     never instead. */
  if (!out.length) {
    for (const path of ["/prices", "/price-menu", "/price-list", "/services", "/menu", "/about"]) {
      out.push(origin + path);
    }
  }

  /* Addresses that survived in the text, which `visibleText` keeps beside the
     words they belonged to. Same site only: this tool reads nobody else's. */
  for (const m of home.text.matchAll(/\((https?:\/\/[^)\s]+)\)/g)) {
    try {
      const u = new URL(m[1]);
      const host = (h: string) => h.replace(/^www\./, "");
      if (host(u.host) === host(new URL(origin).host)) out.push(u.origin + u.pathname);
    } catch {
      /* Not an address we can use. */
    }
  }

  /* One page, one entry. A sitemap listing /services-price-list/ and a link
     to /services-price-list is the same page twice, and reading it twice costs
     a request and puts the same facts in front of the model under two
     numbers. */
  const once = new Map<string, string>();
  for (const u of out) {
    const key = u.replace(/\/+$/, "").toLowerCase();
    if (!once.has(key)) once.set(key, u);
  }

  return [...once.values()]
    .filter((u) => {
      // One unparseable link on their page should cost that link, not the run.
      const usable = fetchable(u);
      if (!usable) return false;

      const path = new URL(usable).pathname;
      return path.replace(/\/+$/, "") !== "" && !SKIP.test(path) && WORTH.test(path);
    })
    .sort((a, b) => Number(/price|cost|rate|menu/i.test(b)) - Number(/price|cost|rate|menu/i.test(a)))
    .slice(0, MAX_PAGES);
}

// ---------------------------------------------------------------------------
// 2. Their voice, in their own words
// ---------------------------------------------------------------------------

/**
 * What they already sound like, named back to them.
 *
 * Not a personality quiz result and not our invention: it is read off the copy
 * they wrote, and it carries the page it was read from like every other claim.
 * It lives on the business profile afterwards so the other five tools get it
 * too, which is the whole reason it is worth building.
 */
async function voice(state: RunState, business: Business, ctx: ToolContext): Promise<Step> {
  const pages = state.pages ?? [];
  const text = (state.read ?? [])
    .filter((p) => p.ok)
    .map((p) => `[${pages.findIndex((x) => x.url === p.url) + 1}] ${p.title ?? ""}\n${p.text.slice(0, 6000)}`)
    .join("\n\n");

  const got = (await ctx.think({
    system: VOICE_RULES,
    prompt:
      `${citeRules(pages)}\n\nTHE PAGES\n\n${text}\n\n` +
      `In two sentences, say how ${business.name ?? "this business"} sounds, so a writer could ` +
      `match it: the tone they take, and the kind of words they reach for. Write it to them, ` +
      `about themselves.`,
    shape: {
      name: "voice",
      description: "How this business already sounds, in two sentences, written to them.",
      input_schema: {
        type: "object",
        properties: {
          /**
           * Two sentences, capped in the shape.
           *
           * At 420 this came back as a paragraph of criticism with six quotes
           * in it: what the copy "allows itself", what it is "by contrast".
           * Raj, 2026-09-16: a summary, more generic, never rude. A length
           * asked for in prose drifts, so it is the schema that holds it, and
           * a short cap is what stops it becoming an assessment.
           */
          words: { type: "string", minLength: 40, maxLength: 260, pattern: NO_DASH },
          from: { type: "integer", description: "The page number this was read off." },
        },
        required: ["words", "from"],
      },
    },
    maxTokens: 300,
  })) as { words?: string; from?: unknown };

  const cited = cite(got, pages) as { words?: string; source?: Cited | null };
  if (!cited.words?.trim() || !cited.source) {
    return fail(state, "We could not read enough of your website to tell how you write.");
  }

  /* The voice note is on the screen and goes on the profile, so it lives under
     the same house rules as a post: the dash repaired, the word refused. */
  const words = unDash(cited.words.trim());
  const house = houseStyle(words);
  if (house) {
    return fail(state, "We could not describe how you write in words we would stand behind.");
  }

  ctx.progress("Read how you write");
  return {
    stage: "shaping",
    state: { ...state, voice: { words, source: cited.source } },
    progress: "Read how you write",
  };
}

// ---------------------------------------------------------------------------
// 3. The shape of the month. Arithmetic, no model.
// ---------------------------------------------------------------------------

/**
 * Every slot, its date, channel and angle, for the whole month.
 *
 * No model call: this is the mix table and the no-repeat rule, both already in
 * the agent folder and both already tested there. Doing it in arithmetic is
 * what makes the rules hold across weeks nobody has written yet, and it costs
 * nothing, so the shape exists from the first run.
 */
async function shaping(state: RunState, business: Business, ctx: ToolContext): Promise<Step> {
  const channels = channelsFor(business, state);
  if (!channels.length) {
    return fail(
      state,
      "We do not know where you post yet. Tell us on this page and we will write the month.",
    );
  }

  const rec = recommendCadence(
    knownFacts(business) as never,
    /* Their choice if they made one, and our default if not. Never both: a
       chosen cadence that we then second-guess is not a choice. */
    state.chose ? { chose: state.chose } : { hoursAWeek: 2 },
    channels,
  );
  const problems = validateRecommendation(rec);
  if (problems.promised.length) {
    // A recommendation that promises a result is the one thing 6.8 forbids
    // outright, and there is no rewrite that makes it sourced.
    return fail(state, "We could not put a recommendation together we would stand behind.");
  }

  const slots = shapeMonth(rec.cadence, new Date().toISOString(), channels, state.before?.angles ?? []);
  /* The whole plan, not just the posts: validateShape also checks that every
     channel they confirmed actually gets written for, and it cannot check that
     against a plan with no channels on it. */
  const shapeProblems = validateShape({ posts: slots, cadence: rec.cadence, channels } as never);
  if (shapeProblems.length) {
    return fail(state, "We could not lay the month out correctly.");
  }

  /**
   * One row per week, not one per post.
   *
   * `slotWeeks` returns a week number for every slot, so mapping over it gave
   * a row per slot: the screen listed "Week 2, 2 posts" twice, then Week 3
   * twice, then Week 4 twice. Nine slots, nine rows, in a section whose whole
   * job is to show four weeks at a glance.
   */
  const weeks: WeekRow[] = [...new Set(slots.map((s) => s.week))]
    .sort((a, b) => a - b)
    .map((w) => ({
      week: `Week ${w}`,
      about: "",
      channels: [...new Set(slots.filter((s) => s.week === w).map((s) => s.channel))],
      posts: slots.filter((s) => s.week === w).length,
    }));

  ctx.progress(`${slots.length} posts laid out across ${channels.length} of your accounts`);
  return {
    stage: "writing",
    state: { ...state, channels, recommendation: rec, cadence: rec.cadence, slots, weeks },
    progress: `${slots.length} posts laid out`,
  };
}

/**
 * What we hold about them, in the shape the guards read.
 *
 * Built in one place and used by both the recommendation and the checking, so
 * a post cannot be judged against a different set of facts than the plan was
 * built from. The empty lists are honest: we hold no accreditation, award or
 * named client for anybody, which is exactly why a post mentioning one is an
 * invention.
 */
/**
 * The prices the writer may state, said before it writes rather than after.
 *
 * 2026-09-17. A Cut Above publishes twelve prices from 35.00 to 78.00. The
 * writer produced two posts for week one and the guard dropped both:
 *
 *   a claim nobody gave us (20%, £24.00)
 *   a claim nobody gave us (£126.00, £89.00)
 *
 * 126.00 is two of their prices added together. Nothing was left, the plan was
 * refused, and fourteen minutes and 11,699 tokens produced no document.
 *
 * knownFacts is what `unsafe` checks a price against and the prompt never
 * carried it, so the writer was told to cite a page and never told which prices
 * it was allowed to say. Two halves of one question disagreeing, and the
 * customer paying for the disagreement.
 *
 * Listed and closed: a list on its own reads as a hint, and the fault was
 * arithmetic on real prices rather than invention from nothing.
 */
export function priceRules(business: Business): string {
  const prices = Object.entries(knownFacts(business).prices);
  if (!prices.length) {
    return (
      `THEIR PRICES\nThey publish none that we could read. Write no price at all, ` +
      `and no discount or offer either.\n\n`
    );
  }
  return (
    `THEIR PRICES, AND NO OTHER PRICE MAY APPEAR\n` +
    prices.map(([name, price]) => `  ${price} ${name}`).join("\n") +
    `\n\nState one of these exactly as written or state none. Never add two ` +
    `together, never give a range they do not publish, never a discount or an ` +
    `offer or a percentage: we have no way to know they are running one.\n\n`
  );
}

export function knownFacts(business: Business): KnownFacts {
  return {
    services: business.services.map((s) => s.name),
    prices: Object.fromEntries(
      business.services.filter((s) => s.price).map((s) => [s.name.toLowerCase(), s.price as string]),
    ),
    accreditations: [],
    awards: [],
    namedClients: [],
    counts: {},
    reviewThemes: [],
    /**
     * Never assume they are local (CLAUDE.md 6.3). A studio competing
     * nationally told to write "your local studio" is wrong about the one
     * thing its customers would notice, and they told us their reach at
     * sign-up, so there is no need to guess. An unanswered reach is treated as
     * not local: writing "local" to somebody who is not is the worse mistake,
     * and it is the one that happens by default.
     */
    servesAnArea: ["nearby", "town", "county"].includes(business.reach ?? ""),
  };
}

/**
 * The accounts to plan for.
 *
 * Their own words, not their links. The links are gone by the time we see the
 * page: `visibleText` strips `<footer>`, and a footer is where a small business
 * keeps its social icons. What survives on this barber's home page is the
 * sentence "you can also contact us via social media through Facebook and
 * Instagram", which is them telling us, in their own copy, where they are.
 *
 * `business.foundVia` is deliberately not used here. It looks like the right
 * field and is not: its values are `social`, `booking`, `trades`,
 * `marketplace` and `unknown` — how customers find them, not where they post.
 * Reading it as a channel list would have quietly produced no channels at all
 * for everybody, which is the kind of wrong that looks like working.
 *
 * WHAT THIS IS NOT
 * It is not a confirmation. CLAUDE.md 2 wants these detected and then shown
 * back for one press, and the screen to do that does not exist yet, so a
 * business whose copy never names a platform gets an honest stop rather than a
 * guess. Telling someone to start a channel is a claim about their market with
 * nothing behind it.
 */
export function channelsFor(_business: Business, state: RunState): Channel[] {
  /**
   * What they told us, if anyone has ever asked.
   *
   * Carried on the run's own state rather than on `Business`, because the
   * engine builds `Business` and `lib/engine.ts` is read-only to a tool
   * (CLAUDE.md 1.4b). The screen reads the column and puts it on the run when
   * it starts one, which needs no shared file changed at all.
   *
   * `undefined` means nobody asked. An empty array means they were asked and
   * post nowhere, which is a different thing and must not fall back to a guess.
   */
  if (state.told) return state.told.filter((c): c is Channel => c in CHANNEL);

  return detectChannels((state.read ?? []).filter((p) => p.ok).map((p) => p.text).join("\n"));
}

/**
 * What their own copy says, as a suggestion to put in front of them.
 *
 * Their words, not their links: the links are gone by the time we see the page,
 * because `visibleText` strips the footer and a footer is where a small
 * business keeps its social icons. What survives on this barber's home page is
 * "you can also contact us via social media through Facebook and Instagram".
 *
 * `business.foundVia` is deliberately not used. It looks like the right field
 * and is not: its values are `social`, `booking`, `trades`, `marketplace` and
 * `unknown`, which is how customers find them, not where they post.
 */
export function detectChannels(text: string): Channel[] {
  /* Word boundaries both sides. "Tik tok" is two words on a page about clocks,
     and a bare "tok" is not a platform. */
  const named: [Channel, RegExp][] = [
    ["instagram", /\binstagram\b/i],
    ["facebook", /\bfacebook\b/i],
    ["linkedin", /\blinkedin\b/i],
    ["tiktok", /\btiktok\b|\btik tok\b/i],
    ["youtube", /\byoutube\b/i],
  ];
  return named.filter(([, shape]) => shape.test(text)).map(([channel]) => channel);
}

// ---------------------------------------------------------------------------
// 4. The words. One call for the week.
// ---------------------------------------------------------------------------

/**
 * Write this week's posts, in their voice, off their own pages.
 *
 * One batched call, never one per post: cost is the line item that decides
 * whether a flat price works, and `most days` is twenty two posts against
 * `once a week`'s four (`build-notes.md`).
 */
async function writing(state: RunState, business: Business, ctx: ToolContext): Promise<Step> {
  const pages = state.pages ?? [];
  const slots = (state.slots ?? []).filter((s) => s.week <= WEEKS_WRITTEN);
  if (!slots.length) return fail(state, "There were no posts to write this week.");

  const text = (state.read ?? [])
    .filter((p) => p.ok)
    .map((p) => `[${pages.findIndex((x) => x.url === p.url) + 1}] ${p.text.slice(0, 8000)}`)
    .join("\n\n");

  const brief = slots
    .map(
      (s, i) =>
        `  ${i + 1}. ${s.date}, ${CHANNEL[s.channel].label}, ${s.angle}, ${s.purpose}. ` +
        `${CHANNEL[s.channel].words[0]} to ${CHANNEL[s.channel].words[1]} words. ` +
        `They supply a ${CHANNEL[s.channel].medium === "video" ? "short video" : "photograph"}.`,
    )
    .join("\n");

  const got = (await ctx.think({
    system: POST_RULES,
    prompt:
      `${citeRules(pages)}\n\nTHEIR PAGES\n\n${text}\n\n` +
      /* The voice they chose, where they have chosen one. Falls back to the
         two sentences this run read, so nothing that worked before stops. */
      (state.persona
        ? personaFor(state.persona, state.style ?? "original")
        : `HOW THEY SOUND\n${state.voice?.words ?? ""}\n\n`) +
      (state.before?.openings?.length
        ? `WHAT WE WROTE FOR THEM LAST MONTH, WHICH MUST NOT BE WRITTEN AGAIN\n` +
          state.before.openings.map((o) => `  ${o}`).join("\n") +
          `\n\nSame facts are fine, the same post is not. If the only thing left to say ` +
          `about a subject is what we said last month, write about something else on their pages.\n\n`
        : "") +
      priceRules(business) +
      `WRITE THESE POSTS\n${brief}\n\n` +
      `Each post is finished words, ready to paste, not a theme and an opening line. ` +
      `Each carries one line saying what to ${
        slots.some((s) => CHANNEL[s.channel].medium === "video") ? "film or photograph" : "photograph"
      }, which they can do on their phone this week, and one line saying why this post.`,
    shape: {
      name: "posts",
      description: "This week's finished posts, one per brief, in order.",
      input_schema: {
        type: "object",
        properties: {
          posts: {
            type: "array",
            minItems: slots.length,
            maxItems: slots.length,
            items: {
              type: "object",
              properties: {
                /* No dash, refused by the shape rather than asked for nicely.
                   A ban asked for in prose drifts (CLAUDE.md 1.4a), and an em
                   dash is the clearest tell that a person did not write it. */
                words: { type: "string", minLength: 80, maxLength: 1400, pattern: NO_DASH },
                shot: { type: "string", minLength: 20, maxLength: 180, pattern: NO_DASH },
                why: { type: "string", minLength: 10, maxLength: 140, pattern: NO_DASH },
                from: { type: "integer", description: "The page its facts came off." },
              },
              required: ["words", "shot", "why", "from"],
            },
          },
        },
        required: ["posts"],
      },
    },
    hard: true,
    maxTokens: 400 * slots.length + 600,
  })) as { posts?: unknown[] };

  const written = cite(got.posts ?? [], pages) as {
    words?: string;
    shot?: string;
    why?: string;
    source?: Cited | null;
  }[];

  if (written.length !== slots.length) {
    return fail(state, "We did not get a full week of posts back, so we have not written a half one.");
  }

  const posts: PlannedPost[] = (state.slots ?? []).map((slot) => {
    const at = slots.indexOf(slot);
    if (at < 0) return slot;
    const w = written[at];
    /* The dash goes before anything else looks at the words, so the checking
       stage never has to decide whether a keystroke is worth a whole post. */
    const out: WrittenPost = {
      ...slot,
      words: unTag(unDash((w.words ?? "").trim())),
      shot: unDash((w.shot ?? "").trim()),
      why: unDash((w.why ?? "").trim()),
      source: w.source ?? null,
    };
    const cap = CHANNEL[slot.channel].titleChars;
    if (cap) out.title = firstLine(out.words, cap);
    return out;
  });

  ctx.progress(`${slots.length} posts written`);
  return { stage: "checking", state: { ...state, posts }, progress: `${slots.length} posts written` };
}

/** The opening sentence, inside `max`, never broken mid word. */
export function firstLine(words: string, max: number): string {
  const first = String(words)
    .split(/(?<=[.!?])\s/)[0]
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (first.length <= max) return first;
  const cut = first.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : first.slice(0, max)).replace(/[,.;:-]$/, "").trim();
}

// ---------------------------------------------------------------------------
// 5. Taking off anything we cannot stand behind
// ---------------------------------------------------------------------------

/**
 * Drop, never reword.
 *
 * A post claiming a result is not badly worded, it is a claim nobody gave us,
 * and there is no rewrite that makes it sourced. The same goes for a post with
 * no page behind it at all. What is left is a shorter week, which is a state
 * this tool already has and already reads well.
 */
async function checking(state: RunState, business: Business, ctx: ToolContext): Promise<Step> {
  const dropped: { what: string; why: string }[] = [];
  const known = knownFacts(business);

  const posts = (state.posts ?? []).map((p) => {
    if (!isWrittenPost(p)) return p;
    /* Two different questions, in order. `unsafe` asks whether we can stand
       behind it at all; the bar asks whether it is worth their while. A post
       nobody can source is refused before anyone judges whether it is good. */
    const why = unsafe(p, state.pages ?? [], known) ?? sayBelow(p, known);
    if (!why) return p;
    dropped.push({ what: p.date, why });
    const { words: _w, shot: _s, why: _y, title: _t, source: _src, ...slot } = p;
    return slot as Slot;
  });

  /**
   * The work done here goes into the state whether it ends well or not.
   *
   * This failed with the original state, so a run that dropped every post
   * stored the posts it had dropped, invented client and all, and stored none
   * of the reasons. The one thing checking is for was thrown away at the
   * moment it mattered most. The engine's own notes record the same shape:
   * a failure reason written and then overwritten one line later.
   */
  const checked: RunState = { ...state, posts, dropped };

  const left = posts.filter(isWrittenPost);
  if (!left.length) {
    return fail(
      checked,
      "Nothing we wrote this week was backed by your own pages, so we have not kept any of it.",
    );
  }

  ctx.progress(keep(left.length, dropped.length));
  return { stage: "done", state: checked, progress: keep(left.length, dropped.length) };
}

/**
 * Why this post is below the bar, in the owner's words, or null.
 *
 * The rule's owner is named in the code and never on the screen: "Jay Baer says
 * so" is our machinery, and the reader cannot see Jay Baer. They see what is
 * wrong with the post.
 */
function sayBelow(post: WrittenPost, known: KnownFacts): string | null {
  const [first] = belowTheBar(post, known);
  return first ? sayBar(first) : null;
}

/** What the run shows while it is going, in the owner's units. */
export function progressFor(stage: Stage, state: RunState): string {
  switch (stage) {
    case "reading":
      return `${(state.read ?? []).length} pages of your site read`;
    case "voice":
      return "Reading how you write";
    case "shaping":
      return "Laying out the month";
    case "writing":
      return `Writing ${(state.slots ?? []).filter((s) => s.week <= WEEKS_WRITTEN).length} posts`;
    case "checking":
      return "Checking every line against your own pages";
    default:
      return "";
  }
}

export { CADENCE_LABEL, WEEKS_WRITTEN };
