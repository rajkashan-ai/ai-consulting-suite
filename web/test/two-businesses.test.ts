import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { advance, type RunState, type Stage } from "../tools/competitor-tracker/stages.ts";
import { competitorTracker } from "../tools/competitor-tracker/index.ts";
import { buildBody, hollow } from "../tools/competitor-tracker/document.ts";
import { aBusiness, fakeContext, type Recorded } from "./fake.ts";
import type { Business } from "../tools/types.ts";
import { sourceOf } from "./tool-source.ts";
import { ASK_FIRST } from "../tools/competitor-tracker/stages.ts";

const ASKING_OFF = { skip: ASK_FIRST ? false : "asking is off: see ASK_FIRST in stages.ts" };

/**
 * The whole change, end to end, on the two businesses it was built for.
 *
 * A barber in Shrewsbury, where the old crawler worked, and a hairdresser in
 * St Albans, where it did not: 192 salons, 8 minutes 41 seconds of discovery,
 * 434,033 tokens and two failures on 2026-09-16.
 *
 * These run the real stages against recorded pages. What they prove is the
 * shape of the run, not the quality of the writing, which is what a live run is
 * for.
 */

/**
 * Two fixtures, and the difference between them matters.
 *
 * `shrewsbury.json` was captured from a run that crawled, so its grid cites the
 * Booksy listing page. The asking route never fetches that page, and a claim
 * citing a page we did not read is correctly dropped, so it produces an empty
 * comparison here. That is the attribution guard working, not a fault.
 *
 * `asked.json` is the same recorded pages with the grid's citations pointing at
 * the pages this route does read: each competitor's own verified page.
 */
const recorded = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "shrewsbury.json"), "utf8"),
) as Recorded;

const asked = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "asked.json"), "utf8"),
) as Recorded & { askedUrls: string[] };

/**
 * St Albans. The names, urls and titles are real search results verified on
 * 2026-09-16, not invented. The Shrewsbury fixture cannot stand in for this:
 * its names are barbershops, and a hairdresser's trade filter rightly refuses
 * them, which is the correct behaviour rather than a fault to work around.
 */
type Cell = { value: string | null; source: { url: string; fetchedOn: string } | null };
type FixtureGrid = { area: string; columns: string[]; rows: { attribute: string; cells: Cell[] }[] };

const stAlbans = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "stalbans.json"), "utf8"),
) as Recorded & { grid: FixtureGrid[] };

const theBarber = aBusiness();

const theSalon: Business = aBusiness({
  id: "w2",
  website: "https://acutabovestalbans.co.uk",
  name: "A Cut Above St Albans",
  trade: "hairdresser",
  town: "St Albans",
  address: "19 High Street, St Albans AL3 4EH",
  headlinePrice: 57,
  services: [{ name: "Ladies Cut & Finish", price: "£57" }],
  foundVia: [],
});

/** The names in the recorded results, so verification has something real. */
const named = (names: string[]): Recorded => ({
  ...asked,
  competitors: { competitors: names.map((name) => ({ name, why: "Same town, same trade" })) },
});

const REAL = ["ARMANDO Barbershop", "The Fade Inn Barbershop", "Medeiros"];

async function runFrom(
  business: Business,
  rec: Recorded,
  start: RunState = {},
  stopAt: Stage = "done",
) {
  const { ctx, calls } = fakeContext(rec);
  let stage: Stage = "searching";
  let state: RunState = start;
  const seen: Stage[] = [];

  for (let i = 0; i < 30; i++) {
    const step = await advance(stage, state, business, ctx);
    stage = step.stage;
    state = step.state;
    seen.push(stage);
    if (stage === stopAt || stage === "failed" || stage === "done") break;
  }
  return { stage, state, calls, seen };
}

/** A stored set, as prepare() would load it. */
const storedSet = (names: string[]) =>
  names.map((name, i) => ({
    name,
    url: `https://booksy.com/en-gb/${i}_${name.toLowerCase().replace(/\W+/g, "-")}`,
    why: "Same town",
    source: "asked",
    found_at: new Date().toISOString(),
  }));

function fakeDb(competitors: Record<string, unknown>[] = [], lastBody: unknown = null) {
  const saved: Record<string, unknown>[][] = [];
  const db = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === "documents" && lastBody
              ? { body: lastBody, created_at: "2026-09-09T09:00:00.000Z" }
              : null,
          }),
          is: async () => ({ data: table === "competitors" ? competitors : [] }),
        }),
      }),
      upsert: async (rows: Record<string, unknown> | Record<string, unknown>[]) => {
        if (table === "competitors") saved.push(rows as Record<string, unknown>[]);
        return null;
      },
    }),
  };
  return { db: db as never, saved };
}

// ---------------------------------------------------------------------------
// The barber
// ---------------------------------------------------------------------------

test("the barber: first run asks, checks the names, and produces a card", ASKING_OFF, async () => {
  const { stage, state, calls } = await runFrom(theBarber, named(REAL));

  assert.equal(stage, "done", `ended at ${stage}: ${state.reason ?? ""}`);

  const body = buildBody(state);
  assert.equal(hollow(body), null, "the card was not worth storing");
  assert.ok(body!.competitors.length > 0);
  assert.ok(body!.grid?.length, "no comparison");

  // Discovery is one model call and one round of name checks. No listing pages.
  assert.equal(calls.search.length, 1, "more than one round of searching");
  assert.equal(state.triedNaming, undefined, "it fell back to the crawler");
});

test("the barber: second run reads the known five and never goes looking", async () => {
  const { db } = fakeDb(storedSet(REAL));
  const prepared = (await competitorTracker.prepare!({}, theBarber, db)) as RunState;

  const { stage, state, calls } = await runFrom(theBarber, recorded, prepared);

  assert.equal(stage, "done", `ended at ${stage}: ${state.reason ?? ""}`);
  assert.equal(calls.search.length, 0, "it searched despite knowing who they are");
  assert.equal(state.competitors?.length, 3);

  // The saving, stated as the test's whole point: no discovery calls at all.
  const discovery = calls.think.filter((t) => t.shape === "competitors");
  assert.equal(discovery.length, 0, "it asked who competes, having been told");
});

// ---------------------------------------------------------------------------
// The hairdresser
// ---------------------------------------------------------------------------

test("the hairdresser: the run that failed twice now finishes", async () => {
  /**
   * St Albans is the case that broke. The old route read two listing pages,
   * pulled 192 salons off them and paid a model to sort them, which took 334
   * seconds in one step and blew every limit. Asking skips all of it.
   */
  const { stage, state, calls } = await runFrom(theSalon, stAlbans);

  assert.equal(stage, "done", `ended at ${stage}: ${state.reason ?? ""}`);
  assert.equal(hollow(buildBody(state)), null);

  assert.ok(!calls.read.some((u) => /\/s\/|\/lp\/|\/browse\//.test(u)),
    `a listing page was still fetched: ${calls.read.join(", ")}`);
});

test("the hairdresser: what it read is its competitors' pages, nothing else", async () => {
  const { state, calls } = await runFrom(theSalon, stAlbans);
  assert.ok(calls.read.length > 0);
  assert.ok((state.competitors?.length ?? 0) <= 5, "more than five to compare");
});

// ---------------------------------------------------------------------------
// Week two
// ---------------------------------------------------------------------------

/**
 * Last week's comparison, identical to this week's except for one number.
 *
 * It moves a review count, not a price, and that is not arbitrary. A money
 * figure has to appear in the text of the page it cites before it survives
 * verification, and this fixture's page bodies are borrowed from Shrewsbury, so
 * every price in it is correctly blanked on the way through. Review counts are
 * not money and survive. Using a price here would test the fixture, not the
 * diff, and would pass by finding nothing.
 */
function lastWeekWith(reviews: string) {
  const before = JSON.parse(JSON.stringify(stAlbans.grid)) as FixtureGrid[];
  const reviewsArea = before.find((g) => g.area === "reviews")!;
  reviewsArea.rows[0].cells[1].value = reviews;
  return { grid: before };
}

/** The set as prepare() would load it, taken from the fixture's own columns. */
const setFromFixture = () =>
  stAlbans.grid[0].columns.slice(1).map((name, i) => ({
    name,
    url: stAlbans.grid[0].rows[0].cells[i + 1].source!.url,
    why: "Same town",
    source: "asked",
    found_at: new Date().toISOString(),
  }));

test("week two names the one thing that moved, and nothing else", async () => {
  const { db } = fakeDb(setFromFixture(), lastWeekWith("180"));

  const prepared = (await competitorTracker.prepare!({}, theSalon, db)) as RunState;
  assert.ok(prepared.lastGrid?.length, "last week's comparison was not loaded");

  const { stage, state } = await runFrom(theSalon, stAlbans, prepared);
  assert.equal(stage, "done", `ended at ${stage}: ${state.reason ?? ""}`);

  assert.equal(state.moved?.length, 1, `moves: ${JSON.stringify(state.moved)}`);
  assert.equal(state.moved![0].who, "Studio 10 Hair");
  assert.equal(state.moved![0].what, "Reviews");
  assert.equal(state.moved![0].from, "180");
  assert.equal(state.moved![0].to, "210");
  assert.match(state.movedSay ?? "", /Studio 10 Hair changed one thing/);

  // No model call was needed to work any of that out.
  assert.ok(state.moved![0].source?.url, "a move arrived without the page it was read on");
});

test("a week where nothing moved says so, rather than showing a blank", async () => {
  const { db } = fakeDb(setFromFixture(), { grid: stAlbans.grid });

  const prepared = (await competitorTracker.prepare!({}, theSalon, db)) as RunState;
  const { state } = await runFrom(theSalon, stAlbans, prepared);

  assert.deepEqual(state.moved, []);
  assert.match(state.movedSay ?? "", /Nothing we can see has changed/);
});

test("the first run never claims anything changed", async () => {
  // Nothing to compare against. Every figure is new and none of it is news.
  const { db } = fakeDb(storedSet(REAL), null);
  const prepared = (await competitorTracker.prepare!({}, theSalon, db)) as RunState;
  const { state } = await runFrom(theSalon, stAlbans, prepared);

  assert.equal(state.movedSay, undefined, "a first run announced changes");
  assert.deepEqual(state.moved ?? [], []);
});

test("both businesses have their set written down for next time", ASKING_OFF, async () => {
  for (const business of [theBarber, theSalon]) {
    const { state } = await runFrom(business, named(REAL));
    const { db, saved } = fakeDb();
    await competitorTracker.learn!(state, business, db);

    assert.equal(saved.length, 1, `${business.name}: the set was not stored`);
    assert.equal(saved[0][0].workspace_id, business.id);
  }
});

/**
 * Every proposed name, and what happened to it, survives the run.
 *
 * Including the fallback to the crawler, which is the case that lost it: the
 * crawler's searches overwrote `seen`, so by the time anybody asked why only
 * one name of eight had verified, the searches and their results were gone.
 */
test("the verdicts survive, even when the run falls back to the crawler", ASKING_OFF, async () => {
  // Names the recorded results cannot confirm, so it drops below the threshold
  // and hands over, which is exactly when the record used to disappear.
  const cannotVerify: Recorded = {
    ...recorded,
    competitors: {
      competitors: [
        { name: "Definitely Not A Real Salon", why: "invented" },
        { name: "Another Invented One", why: "invented" },
        { name: "A Third That Does Not Exist", why: "invented" },
      ],
    },
  };

  const { ctx } = fakeContext(cannotVerify);
  let stage: Stage = "searching";
  let state: RunState = {};
  for (let i = 0; i < 6; i++) {
    const step = await advance(stage, state, theBarber, ctx);
    stage = step.stage;
    state = step.state;
    if (stage === "listings" || stage === "failed") break;
  }

  assert.equal(state.triedNaming, true, "it should have fallen back");
  assert.equal(state.judged?.length, 3, "the proposals were not kept");
  assert.ok(
    state.judged!.every((j) => j.verdict !== "matched"),
    "these cannot verify against the recorded pages",
  );
  assert.ok(state.nameChecks?.length, "the name checks were lost to the crawler's searches");
});

test("a verdict says which wall the name hit, not just that it failed", ASKING_OFF, async () => {
  // Four outcomes need four different fixes. "No such business" and "our proof
  // is too strict" look identical in a count and are not the same problem.
  const mixed: Recorded = {
    ...asked,
    competitors: {
      competitors: [
        { name: "ARMANDO Barbershop", why: "real, and in the recorded results" },
        { name: "Definitely Not A Real Salon", why: "invented" },
        { name: "The Fade Inn Barbershop", why: "real" },
        { name: "Medeiros", why: "real" },
      ],
    },
  };

  const { ctx } = fakeContext(mixed);
  const step = await advance("searching", {}, theBarber, ctx);

  const verdicts = Object.fromEntries((step.state.judged ?? []).map((j) => [j.name, j.verdict]));
  assert.equal(verdicts["ARMANDO Barbershop"], "matched");
  assert.equal(verdicts["Definitely Not A Real Salon"], "nothing found");
});

/**
 * The call that asks who competes is allowed to search before it answers.
 *
 * It was not, and asked a model to recall local salons from training data. One
 * of eight could be confirmed. Anthropic's documentation puts "organizations
 * that might have changed" in the search list and stable facts in the answer
 * list, and we were asking the first as though it were the second.
 */
test("the naming call searches rather than recalling", ASKING_OFF, async () => {
  const { ctx, calls } = fakeContext(named(REAL));
  await advance("searching", {}, theBarber, ctx);

  const naming = calls.think[0];
  assert.ok(naming, "no model call was made at all");
  assert.equal(naming.searched, true, "it asked from memory");
  assert.equal(naming.shape, undefined, "a forced shape stops it searching before it answers");
});

test("the system prompt tells it its memory is out of date", () => {
  // The steer matters: the documentation says triggering is steerable through
  // the system prompt, and a model that is not told will sometimes answer from
  // what it remembers because that is faster.
  const tool = sourceOf("competitor-tracker");
  assert.match(tool, /Search before you answer/i);
  assert.match(tool, /what you remember is out of date/i);
});
