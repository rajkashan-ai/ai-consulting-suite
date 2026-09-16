import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { advance, type RunState, type Stage } from "../tools/competitor-tracker/stages.ts";
import { competitorTracker } from "../tools/competitor-tracker/index.ts";
import type { Playbook } from "../tools/competitor-tracker/playbook.ts";
import { aBusiness, fakeContext, type Recorded } from "./fake.ts";
import type { Business } from "../tools/types.ts";

/**
 * Is the fallback actually wired in?
 *
 * where.ts and playbook.ts are covered on their own, and passing unit tests
 * were exactly the state the seeded source list was already in: 60 sources,
 * every one tested, imported by a test file and a script and by nothing that
 * runs. A tool can be entirely correct and entirely disconnected.
 *
 * So these run the real stages and the real contract hooks, and assert on what
 * the run did rather than on what a function returns.
 */

const recorded = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "shrewsbury.json"), "utf8"),
) as Recorded;

async function runTo(
  finish: Stage,
  business: Business = aBusiness(),
  start: RunState = {},
) {
  const { ctx, calls } = fakeContext(recorded);
  let stage: Stage = "searching";
  let state: RunState = start;
  for (let i = 0; i < 25; i++) {
    const step = await advance(stage, state, business, ctx);
    stage = step.stage;
    state = step.state;
    if (stage === finish || stage === "failed" || stage === "done") break;
  }
  return { stage, state, calls };
}

const playbook = (over: Partial<Playbook> = {}): Playbook => ({
  trade: "barber", platforms: [], publishes: [], deadEnds: [], evidence: [],
  timesUsed: 0, builtFrom: null, nothingIn: [], towns: [], ...over,
});

/**
 * Records what the contract hooks actually asked the database for.
 *
 * Three tables now: `playbooks`, keyed on the trade, and `competitors` and
 * `documents`, keyed on the workspace. Kept apart here so a test can say which one it means, because
 * a double that lumps them together would have let a competitor row be filed
 * as a playbook and nothing would have noticed.
 */
function fakeDb(competitors: Record<string, unknown>[] = []) {
  const asked: {
    key: string | null;
    upserted: Record<string, unknown> | null;
    saved: Record<string, unknown>[] | null;
  } = { key: null, upserted: null, saved: null };

  const db = {
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, val: unknown) => ({
          maybeSingle: async () => {
            // Only the playbook is keyed on the trade. Competitors and the last
            // document are keyed on the workspace, and recording those here
            // made a workspace id look like a playbook key.
            if (table === "playbooks") asked.key = val as string;
            return { data: null };
          },
          // "where rejected_at is null", which is how a soft delete is read.
          is: async () => ({ data: table === "competitors" ? competitors : [] }),
        }),
      }),
      upsert: async (row: Record<string, unknown> | Record<string, unknown>[]) => {
        if (table === "competitors") asked.saved = row as Record<string, unknown>[];
        else asked.upserted = row as Record<string, unknown>;
        return null;
      },
    }),
  };
  return { db: db as never, asked };
}

// ---------------------------------------------------------------------------
// The deadlock
// ---------------------------------------------------------------------------

/**
 * The bakery run died in 79 seconds having read no listing. The playbook is
 * written by successful runs and read by every run, so a trade nobody has done
 * had nowhere to start and there was no way out of it.
 */
test("a trade with no playbook still searches somewhere specific", async () => {
  // foundVia empty on purpose. The fixture business answers "booking", which
  // supplies Booksy at the owner tier, so with it this passed even with the
  // seeded tier ripped out. A test that cannot fail is not a test.
  const { calls, state } = await runTo("choosing", aBusiness({ foundVia: [] }), { playbook: null });

  const terms = calls.search[0] ?? [];
  const targeted = terms.filter((t) => t.includes("site:"));
  assert.ok(targeted.length > 0, "no playbook meant no targeted search at all");
  assert.ok(
    targeted.some((t) => t.includes("booksy.com")),
    `the seeded list was not used: ${terms.join(" | ")}`,
  );
  assert.ok((state.knownHosts ?? []).length > 0, "the tiers produced no hosts");
});

test("a trade with no specialist still gets the floor, not an empty list", async () => {
  // Retail has no specialist we have evidence for. It must still run.
  const { state, stage } = await runTo("choosing", aBusiness({ trade: "shop" }), { playbook: null });
  assert.notEqual(stage, "failed");
  assert.ok((state.knownHosts ?? []).includes("freeindex.co.uk"));
});

test("what a run measured is searched before what the seed claims", async () => {
  // foundVia empty, or the owner tier answers first and this tests nothing.
  const { calls } = await runTo(
    "choosing",
    aBusiness({ foundVia: [] }),
    { playbook: playbook({ platforms: [{ host: "treatwell.co.uk", example: "x", named: 70 }] }) },
  );
  const first = (calls.search[0] ?? []).find((t) => t.includes("site:"));
  assert.ok(first?.includes("treatwell.co.uk"), `measured evidence came second: ${first}`);
});

test("what the owner said is searched before what a run measured", async () => {
  const { calls } = await runTo(
    "choosing",
    aBusiness({ foundVia: ["booking"] }),
    { playbook: playbook({ platforms: [{ host: "freeindex.co.uk", example: "x", named: 70 }] }) },
  );
  const first = (calls.search[0] ?? []).find((t) => t.includes("site:"));
  assert.ok(first?.includes("booksy.com"), `the owner's own answer came second: ${first}`);
});

/**
 * The owner's answer is evidence and still cannot send us somewhere that
 * refuses us. "A marketplace or directory" maps to Yell, which returns a
 * Cloudflare challenge, and "Checkatrade, MyBuilder or similar" leads with
 * Checkatrade, which 403s. Both bought a targeted search of a site we cannot
 * read and pushed a readable one out of the two we make.
 */
test("the owner cannot send us to a site that refuses us", async () => {
  for (const [answer, blocked] of [
    ["marketplace", "yell.com"],
    ["trades", "checkatrade.com"],
  ] as const) {
    const { calls, state } = await runTo(
      "choosing",
      aBusiness({ trade: "plumber", foundVia: [answer] }),
      { playbook: null },
    );
    assert.ok(!(state.knownHosts ?? []).includes(blocked), `${blocked} offered`);
    for (const t of calls.search[0] ?? []) {
      assert.ok(!t.includes(blocked), `searched a blocked site: ${t}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Something else
// ---------------------------------------------------------------------------

/**
 * "Something else" is a real choice in the dropdown and its id is `other`, so
 * the broad searches were "other shrewsbury" and "best other shrewsbury".
 */
test("an unmatched business is never searched for as the word other", async () => {
  const { calls, stage } = await runTo(
    "choosing",
    aBusiness({ trade: "other", services: [{ name: "Scaffolding hire", price: null }] }),
    { playbook: null },
  );

  assert.notEqual(stage, "failed");
  const terms = calls.search[0] ?? [];
  assert.ok(terms.length > 0);
  for (const t of terms) {
    assert.ok(!/\bother\b/i.test(t), `searched for the word other: ${t}`);
  }
  assert.ok(terms.some((t) => /scaffolding/i.test(t)), `own words unused: ${terms.join(" | ")}`);
});

test("an unmatched business with nothing to go on stops and asks", async () => {
  const { stage } = await runTo(
    "choosing",
    aBusiness({ trade: "other", services: [], oneLiner: null }),
    { playbook: null },
  );
  assert.equal(stage, "failed", "better to ask than to search for nothing");
});

// ---------------------------------------------------------------------------
// The three-town rules, as the run sees them
// ---------------------------------------------------------------------------

test("a trade that found nothing in three towns stops before spending a search", async () => {
  const { calls, stage } = await runTo("choosing", aBusiness(), {
    playbook: playbook({ nothingIn: ["Shrewsbury", "Ludlow", "Hereford"] }),
  });

  assert.equal(stage, "failed");
  assert.equal(calls.search.length, 0, "it searched anyway, which is what this exists to stop");
});

test("a trade with somewhere that works is never stopped, however many empty towns", async () => {
  const { stage } = await runTo("choosing", aBusiness(), {
    playbook: playbook({
      platforms: [{ host: "booksy.com", example: "x", named: 70 }],
      nothingIn: ["a", "b", "c", "d"],
    }),
  });
  assert.notEqual(stage, "failed");
});

/**
 * Only a host we asked for by name can be blank. A host that simply did not
 * come up is not evidence that it has stopped listing the trade.
 */
test("a host we searched for and got nothing from is carried back as blank", async () => {
  /**
   * The owner says "a marketplace", so we search Bark by name. The recorded
   * results hold a Booksy listing and nothing from Bark, which is exactly the
   * case this counts: asked for, came back with nothing.
   *
   * Written against the default business first, where every targeted host
   * happened to work, so the assertion could never fail whatever the code did.
   */
  const { state } = await runTo(
    "choosing",
    aBusiness({ foundVia: ["marketplace"] }),
    { playbook: null },
  );

  assert.deepEqual(state.targetedHosts, ["bark.com", "trustpilot.com"]);
  assert.deepEqual(state.blankHosts, ["bark.com", "trustpilot.com"]);
});

test("a host that gave us a listing is never counted blank", async () => {
  const { state } = await runTo("choosing", aBusiness({ foundVia: [] }), { playbook: null });

  const learned = (state.learned ?? []).map((p) => p.host);
  assert.ok(learned.includes("booksy.com"), `the listing was not learned: ${learned.join()}`);
  assert.deepEqual(state.blankHosts, [], "a host that worked was counted against itself");
});

// ---------------------------------------------------------------------------
// The contract hooks
// ---------------------------------------------------------------------------

test("a matched trade is read and written under its own id", async () => {
  const { db, asked } = fakeDb();
  await competitorTracker.prepare!({}, aBusiness({ trade: "plumber" }), db);
  assert.equal(asked.key, "plumber");
});

/**
 * Every unmatched business in the country would share one `other` row, so a
 * scaffolder would be sent where a wedding cake maker had been.
 */
test("an unmatched business never reads or writes the bare other row", async () => {
  const { db, asked } = fakeDb();
  const scaffolder = aBusiness({
    trade: "other", services: [{ name: "Scaffolding hire", price: null }],
  });

  await competitorTracker.prepare!({}, scaffolder, db);
  assert.notEqual(asked.key, "other");
  assert.equal(asked.key, "other:scaffolding-hire");

  await competitorTracker.learn!(
    { learned: [{ host: "freeindex.co.uk", example: "x", named: 9 }],
      seen: [{ term: "scaffolding hire Shrewsbury", results: [] }] } as unknown as RunState,
    scaffolder,
    db,
  );
  assert.equal(asked.upserted?.trade, "other:scaffolding-hire");
});

test("a business we cannot name is not filed at all", async () => {
  const { db, asked } = fakeDb();
  const nameless = aBusiness({ trade: "other", services: [], oneLiner: null });

  await competitorTracker.prepare!({}, nameless, db);
  assert.equal(asked.key, null, "it looked one up anyway");

  await competitorTracker.learn!(
    { learned: [{ host: "freeindex.co.uk", example: "x", named: 9 }],
      seen: [{ term: "x", results: [] }] } as unknown as RunState,
    nameless,
    db,
  );
  assert.equal(asked.upserted, null, "it wrote into a row that mixes trades");
});

test("the town and the empty result reach the database, not just the platforms", async () => {
  const { db, asked } = fakeDb();
  await competitorTracker.prepare!({}, aBusiness(), db);
  await competitorTracker.learn!(
    { learned: [], listed: [], blankHosts: [],
      seen: [{ term: "barber Shrewsbury", results: [] }] } as unknown as RunState,
    aBusiness(),
    db,
  );

  assert.ok(asked.upserted, "a run that found nothing wrote nothing down");
  assert.deepEqual(asked.upserted?.nothing_in, ["Shrewsbury"]);
  assert.deepEqual(asked.upserted?.towns, ["Shrewsbury"]);
});

test("a blank host reaches the database so it can be counted towards being dropped", async () => {
  const { db, asked } = fakeDb();
  await competitorTracker.learn!(
    {
      playbook: playbook({ platforms: [{ host: "fresha.com", example: "x", named: 5 }] }),
      learned: [],
      listed: [{ name: "x" }],
      blankHosts: ["fresha.com"],
      seen: [{ term: "barber Shrewsbury", results: [] }],
    } as unknown as RunState,
    aBusiness(),
    db,
  );

  const platforms = asked.upserted?.platforms as { host: string; blanks?: number }[];
  assert.equal(platforms[0].blanks, 1, "the blank was dropped on the floor");
});


/**
 * "We found nothing" is a claim about the trade, and only a run that searched
 * has earned the right to make it.
 *
 * On 2026-09-16 the API credit ran out. Six runs died in under two seconds
 * having fetched no page and spent no token, and one filed "nothing in
 * Shrewsbury" against a barber playbook holding two platforms that name 185
 * barbers between them. Three of those and the trade would have been stopped
 * permanently by a problem that had nothing to do with barbers.
 */
test("a run that fell over before searching teaches the playbook nothing", async () => {
  for (const dead of [
    {},
    { seen: [] },
    { learned: [], listed: [] },
  ]) {
    const { db, asked } = fakeDb();
    await competitorTracker.learn!(dead as RunState, aBusiness(), db);
    assert.equal(
      asked.upserted,
      null,
      `a run with ${JSON.stringify(dead)} wrote to the playbook`,
    );
  }
});

test("a run that searched and found nothing does teach the playbook", async () => {
  // The other side of it. An honest empty result is exactly what we want kept.
  const { db, asked } = fakeDb();
  await competitorTracker.learn!(
    { seen: [{ term: "bakery Ware", results: [] }], learned: [], listed: [] } as unknown as RunState,
    aBusiness({ trade: "bakery", town: "Ware" }),
    db,
  );
  assert.deepEqual(asked.upserted?.nothing_in, ["Ware"]);
});

// ---------------------------------------------------------------------------
// Remembering the five
// ---------------------------------------------------------------------------

/**
 * Discovery is the most expensive and slowest part of a run, and its answer is
 * the one that barely changes. Rediscovering it weekly is the mistake.
 */
test("who they compete with is saved, so the next run does not pay to find out", async () => {
  const { db, asked } = fakeDb();
  await competitorTracker.learn!(
    {
      seen: [{ term: "x", results: [] }],
      namedThenChecked: [
        { name: "ARMANDO Barbershop", why: "Same street", url: "https://booksy.com/a", title: "t" },
        { name: "The Fade Inn", why: "Town centre", url: "https://booksy.com/b", title: "t" },
      ],
    } as unknown as RunState,
    aBusiness(),
    db,
  );

  assert.ok(asked.saved, "the set was found and then thrown away");
  assert.equal(asked.saved!.length, 2);
  assert.equal(asked.saved![0].workspace_id, "w1");
  assert.equal(asked.saved![0].name, "ARMANDO Barbershop");
  assert.equal(asked.saved![0].source, "asked");
});

test("a run that already has the set does no discovery at all", async () => {
  const stored = [
    { name: "ARMANDO Barbershop", url: "https://booksy.com/a", why: "x", source: "asked",
      found_at: new Date().toISOString() },
    { name: "The Fade Inn Barbershop", url: "https://booksy.com/b", why: "x", source: "asked",
      found_at: new Date().toISOString() },
    { name: "Medeiros", url: "https://treatwell.co.uk/c", why: "x", source: "asked",
      found_at: new Date().toISOString() },
  ];
  const { db } = fakeDb(stored);

  const prepared = await competitorTracker.prepare!({}, aBusiness(), db);
  assert.equal((prepared as RunState).kept?.length, 3, "the stored set was not loaded");

  const { ctx, calls } = fakeContext(recorded);
  const step = await advance("searching", prepared as RunState, aBusiness(), ctx);

  assert.equal(step.stage, "reading", "it went looking despite already knowing");
  assert.equal(calls.think.length, 0, "it asked a model who competes, having been told");
  assert.equal(calls.search.length, 0, "it searched, having been told");
  assert.equal(step.state.queue?.length, 3, "the known pages are not queued to read");
});

test("too few stored is not a set, and discovery runs", async () => {
  // A comparison against one business is not a comparison.
  const { db } = fakeDb([
    { name: "ARMANDO Barbershop", url: "https://booksy.com/a", why: "x", source: "asked",
      found_at: new Date().toISOString() },
  ]);

  const prepared = await competitorTracker.prepare!({}, aBusiness(), db);
  const { ctx, calls } = fakeContext(recorded);
  const step = await advance("searching", prepared as RunState, aBusiness(), ctx);

  assert.notEqual(step.stage, "reading");
  assert.ok(calls.think.length > 0 || calls.search.length > 0, "it gave up instead of looking");
});

test("how old the set is gets said, not implied", async () => {
  const old = new Date(Date.now() - 95 * 86_400_000).toISOString();
  const { db } = fakeDb(
    ["a", "b", "c"].map((n) => ({
      name: `Salon ${n}`, url: `https://x.co.uk/${n}`, why: "x", source: "asked", found_at: old,
    })),
  );

  const prepared = await competitorTracker.prepare!({}, aBusiness(), db);
  const { ctx } = fakeContext(recorded);
  const step = await advance("searching", prepared as RunState, aBusiness(), ctx);

  assert.match(step.state.setAge ?? "", /months ago/);
  assert.match(step.state.setAge ?? "", /look again/, "an old set must say it can be refreshed");
});

test("a competitor the owner added is marked as theirs", async () => {
  const { db } = fakeDb([
    { name: "Their Pick", url: "https://x.co.uk/1", why: null, source: "owner",
      found_at: new Date().toISOString() },
    { name: "Salon B", url: "https://x.co.uk/2", why: "x", source: "asked",
      found_at: new Date().toISOString() },
    { name: "Salon C", url: "https://x.co.uk/3", why: "x", source: "asked",
      found_at: new Date().toISOString() },
  ]);

  const prepared = await competitorTracker.prepare!({}, aBusiness(), db);
  const { ctx } = fakeContext(recorded);
  const step = await advance("searching", prepared as RunState, aBusiness(), ctx);

  const theirs = step.state.competitors?.find((c) => c.name === "Their Pick");
  assert.equal(theirs?.addedByCustomer, true, "the owner's own pick lost its mark");
});
