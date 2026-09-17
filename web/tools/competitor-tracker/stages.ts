import type { Watch } from "@/lib/watchdog";
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
import { confidence, exhausted, isDeadEnd, type Playbook } from "./playbook.ts";
import { whereToLook } from "./where.ts";
import { ageOf, enoughToUse, type Kept } from "./remember.ts";
import { dropBad, sayDropped, stillWrong, worthShowing } from "./dropActions.ts";
import { sayMoved, sayStill, whatMoved, type Move } from "./changed.ts";
import { BATTLECARD_RULES, MEND_RULES, REPAIR_RULES } from "./prompts.ts";
import {
  AREA_MEANS,
  BATTLECARD_SHAPE,
  GRID_AREAS,
  GRID_SHAPE,
  NARRATIVE_SHAPE,
  REPAIR_SHAPE,
  gridShapeFor,
  type GridArea,
} from "./shapes.ts";

/**
 * Re-exported, so nothing outside this folder has to know the file layout.
 *
 * The same reason index.ts re-exports RunState. Moving a declaration between
 * files in here is ours to do; it should not be a change every caller has to
 * follow.
 */
export { GRID_AREAS, type GridArea };
import {
  NAMES_SHAPE,
  askFor,
  distinct,
  judge,
  searchFor,
  type Checked,
  type Judged,
  type Named,
} from "./naming.ts";
import { rank, type Found, type Scored } from "./rank.ts";
import { notYou, oneEach, rightTrade, sift } from "./sift.ts";
import { areasMissing, shortfall, type Funnel } from "./shortfall.ts";
import { enough, nextToTry, refusals, type Attempt } from "./retry.ts";
import { displayName, normaliseName } from "../../../Agents/Competitor Tracker/src/normalise.ts";
import { scrubGrid, scrubHeadline, scrubStanding } from "./scrub.ts";
import { rankActions } from "./rankActions.ts";
import { plainly } from "../../lib/plainly.ts";
import {
  cite,
  citeRules,
  dropMisattributed,
  dropMisattributedClaims,
  numberPages,
  type Page,
} from "./sources.ts";
import {
  droppable,
  find,
  read as readSentence,
  write as replaceSentence,
  type Spot,
} from "./mend.ts";
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
  | "naming"
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
  /** Competitors a model named and a search then confirmed exist. */
  namedThenChecked?: Checked[];
  /** Every name proposed, and why each was accepted or refused. */
  judged?: Judged[];
  /** The searches that checked those names, kept apart from the crawler's. */
  nameChecks?: { term: string; results: { url: string; title: string }[] }[];
  /** The set we already had before this run started. Skips discovery. */
  kept?: Kept[];
  /** How old that set is, said out loud rather than implied. */
  setAge?: string | null;
  /** Said on the document when an action was left out for want of evidence. */
  actionsDropped?: string;
  /** Last run's comparison, and when it was built, so this one can say what moved. */
  lastGrid?: Grid[];
  lastOn?: string | null;
  /** What moved since, worked out once the new grid exists. */
  moved?: Move[];
  movedSay?: string;
  /** Asking has had its turn. Stops the two discovery routes looping. */
  triedNaming?: boolean;
  /** Every host the four tiers offered, best evidence first. */
  knownHosts?: string[];
  /** Hosts we searched for on purpose, so a blank one can be counted. */
  targetedHosts?: string[];
  /** Of those, the ones that gave us no listing. Folded back in at the end. */
  blankHosts?: string[];
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
  /** What the watchdog has seen. See lib/watchdog.ts. */
  watch?: Watch;
  /** How many businesses survived each step. See shortfall.ts. */
  funnel?: Funnel;
  /** Said on the page when the town genuinely has fewer than we wanted. */
  shortfallSay?: string;
  /** Kept for us when a short list was our own fault. Never shown. */
  shortfallWhy?: string;
  /** Said on the page when one of the four comparisons could not be built. */
  areasSay?: string;
  /** The one thing worth knowing, above everything else. Dropped if unsafe. */
  headline?: string;
  /** Places that turned us away while looking for competitors. Shown. */
  refusedSources?: { name: string; reason: string }[];
};

/**
 * One of the two columns at the top of the screen.
 *
 * `source` was added on 2026-09-16. Until then this was the only thing in the
 * whole document with no source field at all: four statements about the
 * owner's business, first on the page, with nothing behind them by design.
 * Everything else on the card had carried a source since the first version.
 */
export type Side = { point: string; detail: string; source?: Source | null };

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
    cells: {
      value: string | null;
      /** Only when the value misleads without it. "from", "under 12s". */
      note?: string | null;
      source: { url: string; fetchedOn: string } | null;
    }[];
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

/**
 * How many sentences may be mended before the card is refused.
 *
 * One per pass, so a fix cannot break something else. Five is more than any run
 * has ever needed: the worst today refused four sentences across its whole life
 * and only ever one or two at a time.
 */
/**
 * How many times a refused card may be rewritten.
 *
 * Cut to 1 on 2026-09-16 to save tokens, and put back the same hour. The mend
 * loop is not a rewrite of the whole card: it takes one refused sentence at a
 * time and drops the claim when a rewrite is no better. Cutting the passes
 * means a card with two refused sentences can never settle, so it is refused
 * whole. That spends everything it took to build the card and shows nothing,
 * which is more waste, not less.
 *
 * The ceiling on spend belongs in the watchdog, where it stops any stage
 * running away, rather than here where it breaks the thing that rescues cards.
 */
const MAX_MENDS = 5;

export async function advance(
  stage: Stage,
  state: RunState,
  business: Business,
  ctx: ToolContext,
): Promise<Step> {
  /**
   * A stage that throws fails the run. It does not throw at whoever called us.
   *
   * The engine had a catch around this and that was the only thing standing
   * between an exception and the customer's screen. Anything else that drives
   * the pipeline, a test, a scheduled tick, a second caller written next month,
   * got a raw exception and had to remember to translate it. Catching here
   * means the pipeline has one answer for a failure whoever is asking.
   *
   * The run's reason is written in the owner's words; the real text is on the
   * error and the engine keeps it.
   */
  try {
    return await run(stage, state, business, ctx);
  } catch (e) {
    /**
     * Both halves, or the next failure is undiagnosable.
     *
     * This threw away `why` and kept only `say`. A real run failed on
     * 2026-09-16, the owner got "something went wrong at our end", and there
     * was nothing anywhere to say what: not in the run, not in the log,
     * because catching it is exactly what stops it being logged. I built the
     * two readers rule and then applied half of it.
     */
    const plain = plainly(e);
    const watch = { ...(state.watch ?? {}), stopped: `${stage}: ${plain.why}` };
    return { ...stop(state, plain.say), state: { ...state, reason: plain.say, watch } };
  }
}

async function run(
  stage: Stage,
  state: RunState,
  business: Business,
  ctx: ToolContext,
): Promise<Step> {
  switch (stage) {
    case "naming":
      return name(state, business, ctx);

    /**
     * A new run arrives here, because "searching" is the database default and
     * that default is shared with every other tool. So this is the front door,
     * and asking is what happens behind it.
     *
     * `triedNaming` is set when asking came up short and handed over, so the
     * crawler runs once and the two cannot pass a run back and forth.
     */
    case "searching":
      return state.triedNaming ? search(state, business, ctx) : name(state, business, ctx);
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

/**
 * Ask who competes, then check that each one exists.
 *
 * This is the first stage now. `searching` and `listings` are still here and
 * still work, and a run falls back to them when this comes up short, because
 * a model that has never heard of a village plumber is a real case and the
 * crawler does find those.
 */
async function name(state: RunState, business: Business, ctx: ToolContext): Promise<Step> {
  const profile = profileFor(business);
  if (!isProfile(profile)) {
    return stop(
      state,
      `We do not know ${profile.missing.join(" or ")} for this business, and ` +
        `everything here depends on it. Put it in on Your business and run it again.`,
    );
  }

  /**
   * We already know who they are up against. Do not go and find out again.
   *
   * This is the saving the whole change is for. Discovery was 8 minutes 41
   * seconds and 35,000 tokens on the St Albans run, answering a question whose
   * answer is the same as last time. A salon's rivals do not change weekly.
   * Their prices do, and reading five known pages takes about five seconds.
   */
  const kept = state.kept ?? [];
  if (enoughToUse(kept)) {
    return {
      stage: "reading",
      state: {
        ...state,
        profile,
        setAge: ageOf(kept, new Date()),
        competitors: kept.map((k) => ({
          name: k.name,
          addedByCustomer: k.source === "owner",
          claims: {},
        })),
        /**
         * The same queue the normal route builds, so reading is one path and
         * not two. A kept competitor with no url is still in the comparison; it
         * just has no fresh page this week.
         *
         * The owner's own site goes first, exactly as it does on the long
         * route. Leaving it out was a real bug in the first version of this:
         * the comparison's first column is the customer, every row is anchored
         * to what they charge, and with their page unread every cell in the
         * table lost its source and was blanked. A full grid came back empty
         * and the week-on-week diff then found nothing to report.
         */
        queue: [
          ...(business.website ? [{ name: "you", url: business.website }] : []),
          ...kept.filter((k) => k.url).map((k) => ({ name: k.name, url: k.url! })),
        ],
      },
      progress: `Checking the ${kept.length} we compare you against`,
    };
  }

  const answered = (await ctx.think({
    system:
      "You are naming local competitors for a UK small business. Trading names " +
      "only, no commentary, no directories, no listing sites.",
    prompt: askFor(profile),
    shape: NAMES_SHAPE,
    maxTokens: 1_000,
  })) as { competitors?: Named[] };

  const proposed = (answered.competitors ?? [])
    .filter((c) => c?.name && normaliseName(c.name) !== normaliseName(profile.name))
    .slice(0, 8);

  if (!proposed.length) {
    // Nothing to check. The crawler is the fallback, not the failure.
    return {
      stage: "searching",
      state: { ...state, profile, triedNaming: true },
      progress: "Looking them up",
    };
  }

  /**
   * One search per name, all at once, and a name with nothing behind it goes.
   *
   * This is the whole reason asking a model is allowed. Its recall is a
   * candidate and nothing more: it goes stale, and a salon that shut last year
   * is still in there. A name that no page confirms never reaches the customer.
   */
  const seen = await ctx.search(
    proposed.map((c) => searchFor(c, profile.town, profile.trade)),
    searchToolConfig(profile, proposed.length),
  );

  const checked: Checked[] = [];
  const judged: Judged[] = [];

  for (const [i, c] of proposed.entries()) {
    const { found, verdict } = judge(c, seen[i]?.results ?? [], profile.town);
    judged.push({ name: c.name, verdict, url: found?.url });
    if (found) checked.push(found);
  }

  const confirmed = distinct(checked);

  /**
   * Fewer than three and we have not really answered the question.
   *
   * A comparison against one business is not a comparison, and the crawler is
   * still there and still works. Falling back costs the searches we have just
   * made, which is a few pence, and it is the difference between a thin card
   * and no card.
   */
  if (confirmed.length < 3) {
    return {
      stage: "searching",
      state: {
        ...state,
        profile,
        namedThenChecked: confirmed,
        judged,
        /**
         * The name checks are kept apart from `seen`, which the crawler is
         * about to overwrite with its own searches.
         *
         * On 2026-09-17 a run fell back and the record of what we had searched
         * for, and what came back, was gone by the time anybody looked. Asked
         * why only one name of eight had verified, nothing in the run could
         * answer, so the whole question was guesswork.
         */
        nameChecks: seen,
        triedNaming: true,
      },
      progress: "Looking them up",
    };
  }

  return {
    stage: "choosing",
    state: {
      ...state,
      profile,
      seen,
      namedThenChecked: confirmed,
      judged,
      nameChecks: seen,
      // choose() ranks whatever is in `listed`. These carry no review counts or
      // prices, which is correct: those come off their own pages in `reading`,
      // and inventing them here is the thing the whole product refuses to do.
      listed: confirmed.map((c) => ({
        name: c.name,
        reviews: null,
        rating: null,
        reviewedDaysAgo: null,
        area: null,
        price: null,
        url: c.url,
      })),
      fromListings: confirmed.map((c) => c.name),
    },
    progress: `Found ${confirmed.length} to compare`,
  };
}

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
  /**
   * Four tiers: what the owner said, what a past run measured, what the seeded
   * list says for this trade, and the general floor. See where.ts for why that
   * order. The floor is what stops a trade nobody has run before starting with
   * nowhere to look, which is how the bakery run died.
   */
  const look = whereToLook(business.trade, state.playbook ?? null, platformsFrom(business.foundVia));
  const known = look.hosts;

  /**
   * Tried everywhere, three towns over, and found nothing every time.
   *
   * Searching again is not research at this point, it is a habit, and it costs
   * the owner money to be told the same nothing a fourth time. Saying so is
   * more use than another empty grid.
   */
  if (exhausted(state.playbook ?? null)) {
    return stop(
      state,
      `We have looked for other ${profile.trade}s in three different towns now ` +
        `and found no list of them anywhere. There may not be one. Tell us a ` +
        `competitor by name on Your business and we will work from that instead.`,
    );
  }

  /**
   * The targeted searches AND the broad ones, always.
   *
   * It used to be one or the other. With a playbook holding a single host that
   * meant exactly one search, and when that search came back without a listing
   * page the run died with "we could only find 0 other barbers" while the real
   * listing sat there. A good playbook should make us faster, not put the whole
   * run on one throw.
   *
   * The targeted ones go first so the useful results are found early. The broad
   * ones are the floor: they are what worked before any playbook existed, and
   * they cost a few pence against a run that otherwise fails entirely.
   */
  const targetedHosts = known.slice(0, 2);
  const targeted = targetedHosts.map((host) => ({
    term: `${profile.trade} ${profile.town} site:${host}`,
    why:
      look.from[host] === "playbook"
        ? `${host} listed this trade on a previous run`
        : look.from[host] === "owner"
          ? `${host} is where this owner says customers find them`
          : `${host} is recorded as listing this trade`,
  }));

  const terms = [...targeted, ...buildSearchTerms(profile)].slice(0, 5);

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
      `We could not find any other ${profile.trade ?? "business"}s in ` +
        `${profile.town ?? "your area"}. That usually means the trade or the town ` +
        `we have for you is wrong. Check them and try again.`,
    );
  }

  return {
    stage: "listings",
    // Kept so listings can tell a host that gave us nothing from one that
    // simply never came up. Only a host we asked for counts as a blank.
    state: { ...state, profile, terms, seen: withResults, targetedHosts, knownHosts: known },
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

  /**
   * Hosts a listing is accepted from without the /en-gb/ marker.
   *
   * Was the playbook alone. Now the seeded list too, for the same reason: a
   * source we have recorded as listing this trade in the UK is one whose
   * addresses we have reason to trust. The country test below still applies,
   * so this buys a shape, not a pass.
   */
  const knownHosts = state.knownHosts ?? [];

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

      /**
       * Trusted is about the page being a listing. It is not about the country.
       *
       * This was `(isOurs || trusted)`, so a known platform skipped the country
       * test altogether, and a real run read
       * booksy.com/en-us/s/barber-shop/28689_shrewsbury: Shrewsbury in the
       * United States. We paid to read it and fed its businesses into a
       * Shropshire comparison.
       *
       * Both have to hold. Being Booksy's list of everybody does not make it
       * everybody here, and "shrewsbury" is in the address of both towns.
       */
      const clearlyNotOurs = /\/en-us\/|\/us\/|\.com\/us|\/en-au\/|\/en-ca\//.test(url);

      /**
       * What the playbook is still for, now that it cannot vouch for a country.
       *
       * It knows which platforms have actually named businesses for this trade,
       * learned from every run before this one. That earns a known platform one
       * thing: its listing is accepted even when the address does not carry the
       * /en-gb/ marker, because a platform we have read a real UK listing from
       * before is a platform whose addresses we have seen work.
       *
       * It does not earn anything about the country. An address that says
       * plainly it is somewhere else is refused whoever serves it.
       */
      const ours = isOurs || (trusted && !clearlyNotOurs);

      if (looksLikeAListing && ours && !clearlyNotOurs && url.includes(town)) {
        wanted.add(r.url);
      }
    }
  }

  if (!wanted.size) {
    // No listing anywhere. Carry on with whatever the searches turned up: for a
    // trade whose businesses have their own websites that is often enough, and
    // for one that lives on a platform the next stage will say so plainly.
    return {
      stage: "choosing",
      state,
      progress: `No list of ${profile.trade}s in ${profile.town}. Working from the searches`,
    };
  }

  const names: string[] = [];
  const rows: Found[] = [];
  const pages: ReadPage[] = [];

  /**
   * Keep looking until we have enough names or have run out of places.
   *
   * This used to take the first two and stop, whatever came back. If one
   * platform returned 403 and the other timed out, the run carried on with
   * nothing off either and said nothing about it, and a thin result was
   * indistinguishable from a thin market. The job of this tool is to find the
   * best competitor data there is, and stopping after two tries is not that.
   *
   * A settled refusal moves us to the next platform. A timeout is asked again
   * once, because it is the one failure where asking again is the right answer.
   * See retry.ts for which is which.
   */
  const places = [...wanted];
  const tried: Attempt[] = [];

  while (!enough(names, places, tried)) {
    const batch = nextToTry(places, tried);
    if (!batch.length) break;

    // Different hosts, so there is never a reason to wait for one before
    // asking the other.
    const fetched = await Promise.all(batch.map((u) => ctx.read(u)));

    for (const got of fetched) {
      tried.push({ url: got.url, ok: got.ok, note: got.note });

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
      /**
       * A town listing names thirty or more businesses, each with a name, a
       * rating, a review count, an area, a price and an address. That does not
       * fit in the four thousand token default, and a real run died here: the
       * answer was cut off, which we correctly refuse to accept, so the whole
       * run failed at the first listing.
       */
      maxTokens: 12_000,
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

  /**
   * Hosts we asked for by name and got no listing from.
   *
   * Only the ones we searched for on purpose. A host that never came up in the
   * results is not evidence that it has stopped listing the trade, it is
   * evidence that we did not ask. Counting those would slowly empty a good
   * playbook for no reason.
   *
   * Two of these in a row and playbook.ts drops the platform.
   */
  const blankHosts = (state.targetedHosts ?? []).filter(
    (host) => !learned.some((p) => p.host === host),
  );

  return {
    stage: "choosing",
    state: {
      ...state,
      fromListings: names,
      listed: rows,
      listingPages: pages,
      learned,
      blankHosts,
      // Every place that turned us away, shown on the page. A source we could
      // not read is a fact about the run and the owner is entitled to it.
      refusedSources: refusals(tried),
    },
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

  /**
   * Keep the numbers, so a short list can be explained rather than apologised
   * for. They existed at each of these steps and were thrown away.
   */
  const allNames = new Set([
    ...(state.fromListings ?? []),
    ...(state.listed ?? []).map((r) => r.name),
    ...candidates.map((c) => c.name),
  ]);
  const beforeSift = [...allNames].map((name) => ({ name }));
  const afterYou = notYou(beforeSift, profile.name);
  const afterTrade = rightTrade(afterYou, business.trade);
  const distinct = oneEach(afterTrade);

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

  const funnel: Funnel = {
    found: beforeSift.length,
    notYou: afterYou.length,
    rightTrade: afterTrade.length,
    distinct: distinct.length,
    compared: real.length,
  };

  /**
   * A short list that is our fault stops the run rather than reaching a page.
   *
   * If there were five or more distinct businesses and we compared fewer, we
   * discarded them, and nothing legitimate does that. Shown to the owner it
   * reads as a fact about their market, which is the worst way for one of our
   * bugs to arrive: they might price against it.
   */
  const verdict = shortfall(funnel, business.trade, profile.town);
  if (verdict.kind === "ours") {
    return {
      ...stop(
        state,
        "We found more businesses to compare than we managed to compare. " +
          "Rather than show you a short list as if it were the whole market, " +
          "we have stopped. Start it again.",
      ),
      state: { ...state, funnel, shortfallWhy: verdict.why },
    };
  }

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
    state: {
      ...state,
      competitors,
      visibility,
      queue,
      picked,
      pages: {},
      funnel: {
        ...funnel,
        searches: (seen ?? []).length,
        links: (seen ?? []).reduce((n, x) => n + x.results.length, 0),
        listings: (state.listingPages ?? []).filter((p) => p.ok).length,
      },
      // Said on the page when the town is genuinely small, so a short list
      // reads as a finding rather than as something missing.
      shortfallSay: verdict.kind === "town" ? verdict.say : undefined,
    },
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
   * Number every page once, before anything is written.
   *
   * The numbers are the only way a fact is attributed from here on, so the
   * list shown in the prompt and the list used to expand the answer must be
   * the same list in the same order. Built once, above both calls, because two
   * lists that drift apart by one attribute every price to the wrong business.
   *
   * The listing pages go first so the market context keeps the low numbers
   * whatever else was read.
   */
  const readable = (list: ReadPage[]) => list.filter((p) => p.ok);

  /**
   * Every page remembers the business it was read for.
   *
   * The listing pages are market wide and carry null: one Booksy page prints
   * every barber in the town, so it can honestly source a fact about any of
   * them. A competitor's own page carries their name and cannot source a fact
   * about anybody else.
   *
   * The customer's own page is queued under "you", because that is what the
   * reading step calls it, while the grid column is their real name. Mapped
   * here, once, or their own prices are judged against a name nothing matches
   * and every one of their own cells is blanked.
   */
  const numbered: Page[] = numberPages([
    ...readable(state.listingPages ?? []).map((p) => ({
      url: p.url,
      fetchedOn: p.fetchedOn,
      about: null,
    })),
    ...Object.entries(pages).flatMap(([name, list]) =>
      readable(list).map((p) => ({
        url: p.url,
        fetchedOn: p.fetchedOn,
        about: name === "you" ? profile.name : name,
      })),
    ),
  ]);

  const numberOf = (url: string) => numbered.findIndex((p) => p.url === url) + 1;

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
  const listingEvidence = readable(state.listingPages ?? []).map(
    (p) =>
      `### [${numberOf(p.url)}] MARKET CONTEXT ONLY\n` +
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
            ? `### [${numberOf(p.url)}] ${name}\n${p.text}`
            : `### ${name} — could not be read: ${p.note}`,
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

  /**
   * One call per area, all four at once.
   *
   * The grid was the slowest thing in the product by a distance: 223 seconds of
   * a 302 second run, because it alone wrote twenty six thousand output tokens
   * and output tokens are the runtime, at about a hundred a second.
   *
   * Four areas in one call are written one after another whatever we do, since
   * that is what generating text is. Four calls are written at the same time,
   * so the grid now costs what its longest area costs rather than the sum of
   * all four. The evidence is sent four times, which costs input tokens, but
   * input is not what the clock is waiting for.
   *
   * An area that fails is dropped rather than taking the others with it. A grid
   * of three areas is a worse card; a grid of none is no card at all, and
   * before this one bad area was all four.
   */
  const settled = await Promise.allSettled(
    GRID_AREAS.map((area) =>
      ctx.think({
        hard: true,
        system: BATTLECARD_RULES,
        prompt:
          `${evidencePrompt}\n\nBuild the comparison grid for ONE area only: ${area}.\n` +
          `${AREA_MEANS[area]}\n\n` +
          `At most six rows. Only rows you have real data for. A row every ` +
          `business leaves blank is a row worth cutting: it tells the reader ` +
          `nothing and it crowds out the ones that do. If this area has nothing ` +
          `worth a table, return no rows: that is an honest answer.`,
        shape: gridShapeFor(area),
        maxTokens: 9_000,
      }),
    ),
  );

  const comparison: Grid[] = [];
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status !== "fulfilled") continue;
    const one = (outcome.value as { comparison?: Grid[] }).comparison ?? [];
    for (const g of one) {
      if (g?.rows?.length) comparison.push({ ...g, area: GRID_AREAS[i] });
    }
  }

  const missingAreas = areasMissing(GRID_AREAS, comparison.map((g) => g.area));

  if (!comparison.length) {
    return stop(
      state,
      "We read the pages and could not build a comparison from them. Nothing " +
        "is shown rather than an empty table.",
    );
  }

  // The numbers become urls here, once, before anything downstream reads them.
  const grid = { comparison: cite(comparison, numbered) };

  /**
   * The narrative is written from the grid, not from the pages again.
   *
   * Both calls used to carry the whole evidence pile, which doubled the input
   * of every run: 53,000 tokens became 196,000 and two minutes became ten. The
   * grid already holds every fact that was worth extracting, with its sources,
   * so the second call reads that instead. A claim it cannot support from the
   * grid is a claim it should not be making.
   */
  const builtRaw = (await ctx.think({
    hard: true,
    system: BATTLECARD_RULES,
    prompt:
      `The business: ${profile.name}, a ${profile.trade} in ${profile.town}.\n` +
      `${yourOwn}\n` +
      `THE COMPARISON IS ABOUT THESE ${theFive.length} AND NOBODY ELSE:\n` +
      theFive.map((n) => `  - ${n}`).join("\n") +
      `\n\nThis is everything that was found, already checked and sourced. Write ` +
      `the per-business claims, the two columns and the three actions from it. ` +
      `Do not repeat the grid itself.\n\n` +
      JSON.stringify(grid.comparison ?? []),
    shape: NARRATIVE_SHAPE,
    maxTokens: 20_000,
  })) as {
    headline?: { said?: string; source?: Source | null };
    competitors?: unknown;
    actions?: unknown;
    where_you_win?: Side[];
    where_they_win?: Side[];
  };

  // Same expansion as the grid. Claims and action evidence both cite by number.
  const built = cite(builtRaw, numbered);

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

  const unreadable = [
    ...Object.entries(pages).flatMap(([name, list]) =>
      list.filter((p) => !p.ok).map((p) => ({ name, reason: reasonFor(p.note) })),
    ),
    /**
     * Places that turned us away while we were looking for who to compare.
     *
     * These used to be lost entirely: the listing step took two platforms, and
     * if both refused, the run carried on with nothing and said nothing. The
     * owner saw a thin comparison and no reason for it, which reads as a thin
     * market rather than as a door we could not get through.
     */
    ...(state.refusedSources ?? []).map((r) => ({
      name: r.name,
      reason: reasonFor(r.reason),
    })),
  ];

  const card: Battlecard = {
    business: profile.name,
    ranAt: new Date().toISOString(),
    competitors: shapeCompetitors(built.competitors, competitors, profile.name),
    actions: shapeActions(built.actions, competitors.length),
    sources,
    unreadable,
  };

  // What the searches showed, which is a fact about us and not about them.
  if (visibility?.length) {
    const own = card.competitors.find((c) => c.name === profile.name);
    const claims = summarise(visibility, profile, competitors.map((c) => c.name), readOn);
    if (own) own.claims.channels = [...(own.claims.channels ?? []), ...claims];
  }

  /**
   * Nothing is sourced to somebody else's page.
   *
   * Run after shaping, because shaping is what puts each cell in a column, and
   * a cell only has a business to be checked against once it is in one.
   */
  const checked = dropMisattributed(
    shapeGrid(grid.comparison, profile.name, competitors.map((c) => c.name)),
    numbered,
  );
  const claimsChecked = dropMisattributedClaims(card.competitors, numbered);
  card.competitors = claimsChecked.competitors;

  /**
   * And nothing goes on the page that we cannot stand behind.
   *
   * The guards knew how to spot an invented traffic figure and a Google
   * ranking, and ran over text built from the card alone, while the grid and
   * the standing columns are built beside it. Dropped rather than reworded:
   * mending fixes a sentence that says a true thing badly, and there is no
   * rewrite that makes an invented number sourced.
   */
  /**
   * The text of every page we read, so a price can be checked against the page
   * it cites rather than only against the fact that the page exists.
   */
  const textOf = new Map<string, string>();
  for (const p of readable(state.listingPages ?? [])) textOf.set(p.url, p.text);
  for (const p of readable(Object.values(pages).flat())) textOf.set(p.url, p.text);

  /**
   * The customer's own prices were read from their own site at sign up, not by
   * this run, so they are not in the page this run fetched. Without this, the
   * money check would blank their entire column: a safety check destroying good
   * data, with the page still looking finished and only their side empty.
   *
   * Added to the text of their own page because that is honestly where the
   * prices came from. The real Shrewsbury page is appointment only, opening
   * hours and a phone number, with no prices on it at all.
   */
  if (business.website && business.services.length) {
    const own = [...textOf.keys()].find((u) => u.includes(new URL(business.website).hostname));
    const list = business.services.map((x) => `${x.name} ${x.price ?? ""}`).join("\n");
    if (own) textOf.set(own, `${textOf.get(own) ?? ""}\n${list}`);
  }

  const cleanGrid = scrubGrid(checked.grids, (url) => textOf.get(url) ?? null);
  const cleanHeadline = scrubHeadline(built.headline);

  const cleanStanding = scrubStanding({
    winning: (built.where_you_win ?? []).slice(0, 4),
    losing: (built.where_they_win ?? []).slice(0, 4),
  });

  /**
   * What moved since last week, worked out from the two grids.
   *
   * This is the question the product exists to answer, and until the competitor
   * set was stored it was unaffordable: every run found different businesses,
   * so there was nothing stable to compare week to week. Five known names make
   * it arithmetic on two documents we already hold.
   */
  const since = state.lastOn ? new Date(state.lastOn).toLocaleDateString("en-GB") : null;
  const moved = whatMoved(state.lastGrid, cleanGrid.grids);

  return {
    stage: "checking",
    state: {
      ...state,
      card,
      moved,
      // Nothing moved is a real answer, not an empty space. An owner who reads
      // it has learned they are not behind.
      movedSay: state.lastGrid?.length
        ? (sayMoved(moved, since) ?? sayStill(since))
        : undefined,
      grid: cleanGrid.grids,
      standing: cleanStanding.standing,
      areasSay: missingAreas ?? undefined,
      headline: cleanHeadline.headline ?? undefined,
    },
    progress: "Checking it",
  };
}

// ---------------------------------------------------------------------------

function check(state: RunState, business: Business): Step {
  let card = state.card;
  if (!card) return stop(state, "Nothing was built. Run it again.");

  let found = validateBattlecard(
    card,
    asText(card, { grid: state.grid, standing: state.standing }),
    new Date(),
  );

  /**
   * An unsupported action is dropped, not a reason to bin the card.
   *
   * The guards were a gate: one action resting on a number nobody could source
   * and the comparison, the two columns and the other two actions went in the
   * bin with it, all built and paid for. That happened to the bakery twice on
   * 2026-09-16, on a different rule each time, and the owner saw nothing both
   * times.
   *
   * The bad action still never reaches anybody. What changes is that the rest
   * of the page survives it.
   */
  const actionProblems = Array.isArray(found.actions) ? found.actions : [];
  const cut = dropBad(card.actions ?? [], actionProblems);

  if (cut.dropped.length && worthShowing(cut)) {
    const leaner = { ...card, actions: cut.kept };
    const after = validateBattlecard(
      leaner,
      asText(leaner, { grid: state.grid, standing: state.standing }),
      new Date(),
    );

    // Only carry on down this path if dropping actually fixed the actions.
    // Something still wrong with them after a drop is a real problem and goes
    // to the mender like anything else.
    if (!stillWrong(Array.isArray(after.actions) ? after.actions : [], true).length) {
      found = { ...after, actions: [] } as typeof found;
      state = { ...state, card: leaner, actionsDropped: sayDropped(cut) ?? undefined };
      card = leaner;
    }
  }

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
  if ((state.repairs ?? 0) < MAX_MENDS) {
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
    // Not a url we can parse. Expected: these come off pages we did not
    // write, and showing the raw string is the right answer.
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
/**
 * Mend one refused sentence. Not the card.
 *
 * The old version handed over the whole battlecard and asked for the refused
 * parts to be reworded. It rewrote sixty sentences to fix one, and the rewrite
 * introduced a fault somewhere else, so the next check refused a different
 * sentence and the run died. Six runs failed that way today. It cannot
 * converge: every attempt is a fresh chance to break something.
 *
 * So: find the sentence, reword that sentence, put it back, and leave every
 * other word alone. If the new words are no better, drop the claim carrying
 * them. A shorter true card beats a refused one, and dropping is a floor that
 * always terminates.
 */
async function fix(state: RunState, ctx: ToolContext): Promise<Step> {
  const card = state.card;
  const problems = state.problems ?? [];
  if (!card || !problems.length) {
    return { stage: "checking", state, progress: "Checking it" };
  }

  // One sentence per pass. The first that can actually be found in the card.
  let spot: Spot | undefined;
  let sentence = "";
  let rule = "";

  for (const p of problems) {
    for (const s of p.sentences) {
      const where = find(card, s);
      if (where.length) {
        spot = where[0];
        sentence = s;
        rule = p.rule;
        break;
      }
    }
    if (spot) break;
  }

  if (!spot) {
    // The complaint is about the card's shape rather than a sentence: too many
    // competitors, the wrong number of actions. Nothing here can mend that.
    return {
      stage: "checking",
      state: { ...state, repairs: MAX_MENDS, problems: undefined },
      progress: "Checking it",
    };
  }

  const before = readSentence(card, spot) ?? sentence;

  const answer = (await ctx.think({
    system: MEND_RULES,
    prompt:
      `This sentence was refused:\n\n    ${before}\n\n` +
      `${WHY_REFUSED[rule] ?? rule}\n\n` +
      `Rewrite that one sentence. Keep every number, name, date and price in it ` +
      `exactly as they are. If it cannot be said without inventing something, ` +
      `say so and it will be cut.`,
    shape: {
      name: "reworded",
      description: "The one sentence, rewritten, or nothing if it cannot be.",
      input_schema: {
        type: "object",
        properties: {
          sentence: {
            type: ["string", "null"],
            description: "The rewritten sentence, or null to cut it.",
          },
        },
        required: ["sentence"],
      },
    },
    maxTokens: 1000,
  })) as { sentence?: string | null };

  const words = typeof answer.sentence === "string" ? answer.sentence.trim() : null;

  // No better, or it gave up: drop the claim if that is allowed, otherwise keep
  // what we had and let the next check decide.
  const useful = words && words.length > 5 && words !== before;
  const next = useful
    ? replaceSentence(card, spot, words)
    : droppable(card, spot)
      ? replaceSentence(card, spot, null)
      : card;

  return {
    stage: "checking",
    state: {
      ...state,
      card: next,
      repairs: (state.repairs ?? 0) + 1,
      problems: undefined,
    },
    progress: "Checking it",
  };
}

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
export function asText(
  card: Battlecard,
  also?: { grid?: Grid[]; standing?: { winning: Side[]; losing: Side[] } },
): string {
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

  /**
   * The grid and the two columns, which are most of what an owner reads.
   *
   * They were checked by nothing. Every guard in the file ran over this text,
   * and this text was built from the card alone, while the grid and the
   * standing are assembled beside the card and stored alongside it. So a
   * competitor's Google ranking, a made up visitor count and a reviewer's real
   * name all reached a stored document with eleven guards watching and none of
   * them looking at the right thing.
   *
   * Found by an independent test pass on 2026-09-16.
   */
  for (const g of also?.grid ?? []) {
    if (g.note) lines.push(ended(g.note));
    for (const row of g.rows ?? []) {
      for (const cell of row.cells ?? []) {
        if (cell?.value != null) lines.push(ended(`${row.attribute}: ${cell.value}`));
      }
    }
  }

  for (const side of [...(also?.standing?.winning ?? []), ...(also?.standing?.losing ?? [])]) {
    lines.push(ended(side.point), ended(side.detail));
  }

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
  const columns = [own, ...five].map(displayName);

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
          cells: where.map((i) =>
            i >= 0 && cells[i] ? cells[i] : { value: null, note: null, source: null },
          ),
        };
      }),
    };
  });
}

function shapeCompetitors(raw: unknown, known: Competitor[], own: string): Competitor[] {
  // Names come off other people's listing pages, so they are somebody else's
  // text. Stripped of the reordering controls before they become headings.
  if (!Array.isArray(raw)) return known;
  const byName = new Map(known.map((c) => [c.name.toLowerCase(), c]));
  const isOwn = (n: string) =>
    n.toLowerCase().replace(/[^a-z0-9]/g, "") === own.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Anything not in the agreed five is dropped, not trusted. Instructions are
  // guidance; this is the part that cannot be talked out of.
  const agreed = new Set(known.map((c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, "")));
  const key = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");

  const written = raw
    .filter((r: Record<string, unknown>) => !isOwn(String(r.name ?? "")))
    .filter((r: Record<string, unknown>) => {
      if (!agreed.size) return true;
      const k = key(String(r.name ?? ""));
      // Either the same name, or one contains the other: "HINCES" and "HINCES
      // Barber" are the same shop and refusing one of them loses the evidence.
      return [...agreed].some((a) => a === k || a.includes(k) || k.includes(a));
    })
    .slice(0, 5);

  /**
   * The businesses we chose are the businesses on the card.
   *
   * This used to return whatever the model wrote about, so a write up that
   * covered one of the five left the other four out of the card entirely, and
   * the run still said done. Their pages had been found, fetched and paid for,
   * and the grid still carried them as columns, so the card and the table
   * disagreed about who was being compared.
   *
   * Starting from the five we chose and folding the write up into them means a
   * business the model skipped appears with nothing said about it, which is
   * honest and visible, rather than disappearing, which is neither.
   *
   * Found by an independent test pass on 2026-09-16: "the ranking picked five,
   * the model wrote about one, nothing objects."
   */
  const saidAbout = new Map<string, Record<string, unknown>>();
  for (const r of written as Record<string, unknown>[]) {
    saidAbout.set(key(String(r.name ?? "")), r);
  }

  const chosen = known.filter((c) => !isOwn(c.name));
  if (!chosen.length) {
    return written.map((r: Record<string, unknown>) => ({
      name: String(r.name ?? ""),
      addedByCustomer: byName.get(String(r.name ?? "").toLowerCase())?.addedByCustomer ?? false,
      claims: (r.claims ?? {}) as Competitor["claims"],
    }));
  }

  return chosen.slice(0, 5).map((c) => {
    const k = key(c.name);
    const r =
      saidAbout.get(k) ??
      [...saidAbout.entries()].find(([o]) => o.includes(k) || k.includes(o))?.[1];

    return {
      name: c.name,
      addedByCustomer: c.addedByCustomer ?? false,
      claims: (r?.claims ?? {}) as Competitor["claims"],
    };
  });
}

/**
 * The three actions, ranked by us rather than by the model.
 *
 * `rank` used to be whatever came back, ordered by an unprompted judgement of
 * "strongest" that nothing defined and nothing checked. It is the size of the
 * gap each action closes now, counted off the grid and verified against it.
 * See rankActions.ts for why that proxy and not another.
 */
function shapeActions(raw: unknown, competitors: number) {
  if (!Array.isArray(raw)) return [];

  const given = raw.slice(0, 3).map((r: Record<string, unknown>) => ({
    area: r.area as never,
    headline: String(r.headline ?? ""),
    why: String(r.why ?? ""),
    effect: r.effect ? String(r.effect) : undefined,
    gap: (r.gap ?? null) as { theyDo: number; outOf: number } | null,
    evidence: (Array.isArray(r.evidence) ? r.evidence : []) as never,
    ...(r.deferred ? { deferred: String(r.deferred) } : {}),
  }));

  return rankActions(given, competitors).actions;
}
