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
import { shapeMonth } from "./shape.ts";
import { keep, unsafe } from "./scrub.ts";

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

export type RunState = {
  /** Pages actually read, numbered, in the order the model is shown them. */
  pages?: Page[];
  read?: ReadPage[];
  /** Their voice, read off their own copy. Sourced like anything else. */
  voice?: { words: string; source: Cited | null };
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

/** Pages worth asking for beyond the home page, best first. */
const WORTH = /price|pricing|cost|service|treatment|menu|what-we-do|rates|package|book|about/i;
const SKIP = /privacy|terms|cookie|policy|login|account|cart|basket|\.(jpg|png|pdf|css|js)$/i;

/** How many of their own pages one run reads. Their site, not the web. */
const MAX_PAGES = 5;

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
 * Read their home page, then the pages it links that carry prices and services.
 *
 * Their own navigation rather than a guessed list of paths. A guessed path is a
 * claim about a site nobody has read: the barber's prices are at /price-menu
 * and the dog groomer's are at /dog-grooming/, and guessing found one and
 * missed the other entirely.
 */
async function reading(state: RunState, business: Business, ctx: ToolContext): Promise<Step> {
  const already = state.read ?? [];

  if (!already.length) {
    const home = await ctx.read(business.website);
    if (!home.ok) {
      return fail(state, "We could not open your website, so there is nothing to write from yet.");
    }
    ctx.progress("Read your home page");
    return {
      stage: "reading",
      state: { ...state, read: [asRead(home)] },
      progress: "1 page of your site read",
    };
  }

  const origin = new URL(already[0].url).origin;
  const done = new Set(already.map((p) => p.url));
  const next = linked(already[0].text ? already[0] : already[0], origin).find((u) => !done.has(u));

  if (!next || already.length >= MAX_PAGES) {
    const pages = numberPages(
      already.filter((p) => p.ok).map((p) => ({ url: p.url, fetchedOn: p.fetchedOn, what: p.title ?? "" })),
    );
    if (!pages.length) return fail(state, "We could not read anything on your website.");
    return {
      stage: "voice",
      state: { ...state, pages },
      progress: `${pages.length} page${pages.length === 1 ? "" : "s"} of your site read`,
    };
  }

  const got = await ctx.read(next);
  ctx.progress(`Read ${already.length + 1} pages of your site`);
  return {
    stage: "reading",
    state: { ...state, read: [...already, asRead(got)] },
    progress: `${already.length + 1} pages of your site read`,
  };
}

const asRead = (r: Awaited<ReturnType<ToolContext["read"]>>): ReadPage => ({
  url: r.url,
  ok: r.ok,
  title: r.title,
  text: r.text,
  fetchedOn: r.fetchedAt.slice(0, 10),
  note: r.note,
});

/** Same-origin links worth reading, best first. Exported so a test can reach it. */
export function linked(page: { text: string; url: string }, origin: string): string[] {
  const out: string[] = [];
  /**
   * The href, then whatever follows it. Not `<a ...>text</a>`.
   *
   * Requiring the closing tag within 120 characters found three links on a real
   * Wix site and missed the price list, because the anchor wraps four nested
   * divs and the `</a>` is hundreds of characters away. The link text is a
   * hint; the href is the fact. Read the fact, and treat the next couple of
   * hundred characters as the hint.
   */
  for (const m of page.text.matchAll(/<a\b[^>]*\shref="([^"]+)"[^>]*>/gi)) {
    /* The window is read, never consumed. Capturing 200 characters after the
       tag put the next three links inside this match, and matchAll resumes
       after a match, so they were skipped entirely. On the test page that lost
       /book; on a real page it loses whatever follows the first link. */
    const after = page.text.slice(m.index + m[0].length, m.index + m[0].length + 200);
    let u: URL;
    try {
      u = new URL(m[1], origin);
    } catch {
      continue;
    }
    // www and the apex are one site. A site that redirects www to the apex and
    // links the apex looked, to an earlier version of this, like a different
    // site entirely, and one page of it was read.
    const host = (h: string) => h.replace(/^www\./, "");
    if (host(u.host) !== host(new URL(origin).host)) continue;
    if (SKIP.test(u.pathname) || u.pathname === "/") continue;
    const text = after.replace(/<[^>]+>/g, " ");
    if (WORTH.test(u.pathname) || WORTH.test(text)) out.push(u.origin + u.pathname);
  }
  return [...new Set(out)].sort(
    (a, b) => Number(/price|cost|rate/i.test(b)) - Number(/price|cost|rate/i.test(a)),
  );
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
    system:
      "You read a small business's own website and say how they sound, so that anything written " +
      "for them later sounds like them. You never flatter and you never invent.",
    prompt:
      `${citeRules(pages)}\n\nTHE PAGES\n\n${text}\n\n` +
      `Say how ${business.name ?? "this business"} sounds, in two or three sentences, using their ` +
      `own words where you can. Describe what is there. If the copy is plain, say it is plain.`,
    shape: {
      name: "voice",
      description: "How this business already sounds, read off their own pages.",
      input_schema: {
        type: "object",
        properties: {
          // Capped in the schema, not asked for in the prose. A length asked
          // for politely drifts: CLAUDE.md 1.4a.
          words: { type: "string", maxLength: 420 },
          from: { type: "integer", description: "The page number this was read off." },
        },
        required: ["words", "from"],
      },
    },
    maxTokens: 400,
  })) as { words?: string; from?: unknown };

  const cited = cite(got, pages) as { words?: string; source?: Cited | null };
  if (!cited.words?.trim() || !cited.source) {
    return fail(state, "We could not read enough of your website to tell how you write.");
  }

  ctx.progress("Read how you write");
  return {
    stage: "shaping",
    state: { ...state, voice: { words: cited.words.trim(), source: cited.source } },
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
      "We could not tell which accounts you post from, so there is nowhere to plan for yet.",
    );
  }

  const rec = recommendCadence(knownFacts(business) as never, { hoursAWeek: 2 }, channels);
  const problems = validateRecommendation(rec);
  if (problems.promised.length) {
    // A recommendation that promises a result is the one thing 6.8 forbids
    // outright, and there is no rewrite that makes it sourced.
    return fail(state, "We could not put a recommendation together we would stand behind.");
  }

  const slots = shapeMonth(rec.cadence, new Date().toISOString(), channels);
  /* The whole plan, not just the posts: validateShape also checks that every
     channel they confirmed actually gets written for, and it cannot check that
     against a plan with no channels on it. */
  const shapeProblems = validateShape({ posts: slots, cadence: rec.cadence, channels } as never);
  if (shapeProblems.length) {
    return fail(state, "We could not lay the month out correctly.");
  }

  const weeks: WeekRow[] = slotWeeks(rec.cadence).map((w: number) => ({
    week: `Week ${w}`,
    about: "",
    channels,
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

/** The accounts to plan for: what they told us, else what their site links. */
export function channelsFor(business: Business, state: RunState): Channel[] {
  const told = (business.foundVia ?? []).filter((c): c is Channel => c in CHANNEL);
  if (told.length) return told;

  const html = (state.read ?? []).map((p) => p.text).join("\n");
  const found: Channel[] = [];
  const shapes: [Channel, RegExp][] = [
    ["instagram", /instagram\.com\/[A-Za-z0-9_.]{2,30}/i],
    ["facebook", /facebook\.com\/[A-Za-z0-9_.\-]{2,60}/i],
    ["linkedin", /linkedin\.com\/(?:company|in)\/[A-Za-z0-9_.\-]{2,60}/i],
    ["tiktok", /tiktok\.com\/@[A-Za-z0-9_.]{2,30}/i],
    ["youtube", /youtube\.com\/(?:@|c\/|channel\/|user\/)[A-Za-z0-9_.\-]{2,60}/i],
  ];
  for (const [channel, shape] of shapes) {
    const m = html.match(shape);
    if (m && !/sharer|share\.php|intent|plugins/i.test(m[0])) found.push(channel);
  }
  return found;
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
    system:
      "You write social posts as a small business owner, in their own voice. The owner posts what " +
      "you write under their own name, so anything you invent becomes their lie. You never invent " +
      "a client, a result, a percentage, a timescale, a qualification, an award, a review, a " +
      "number of years, or a number of customers. Where a post needs something only they know, " +
      "you leave a square bracket saying exactly what to put in it.",
    prompt:
      `${citeRules(pages)}\n\nTHEIR PAGES\n\n${text}\n\n` +
      `HOW THEY SOUND\n${state.voice?.words ?? ""}\n\n` +
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
                words: { type: "string", minLength: 80, maxLength: 1400 },
                shot: { type: "string", minLength: 20, maxLength: 180 },
                why: { type: "string", minLength: 10, maxLength: 140 },
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
    const out: WrittenPost = {
      ...slot,
      words: (w.words ?? "").trim(),
      shot: (w.shot ?? "").trim(),
      why: (w.why ?? "").trim(),
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
    const why = unsafe(p, state.pages ?? [], known);
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
