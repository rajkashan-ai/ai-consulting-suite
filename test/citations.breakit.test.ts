import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { advance, GRID_AREAS, type RunState } from "../tools/competitor-tracker/stages.ts";
import { buildBody, hollow } from "../tools/competitor-tracker/document.ts";
import { expand } from "../tools/competitor-tracker/sources.ts";
import { aBusiness, fakeContext, type Recorded } from "./fake.ts";

/**
 * Written by an independent tester against the product requirement, not against
 * the code. Every assertion here is what the requirement says must be true.
 * Where one fails, the finding is in the report, not in this file.
 *
 * The requirement being tested:
 *   - Never state a fact it cannot point at a real page for. Every claim carries
 *     a source url and the date the page was read.
 *   - Never attribute a fact to the wrong business.
 *   - Never store a document that looks finished but is hollow.
 */

const recorded = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "shrewsbury.json"), "utf8"),
) as Recorded;

const anAction = (rank: number) => ({
  rank,
  area: "pricing",
  headline: `Publish a price for job ${rank}`,
  why: "Four of the five publish one and you do not.",
  evidence: [
    {
      text: "Four of the five publish a classic cut price on Booksy",
      value: 4,
      source: { url: "https://booksy.com/en-gb/s/barber/1227928_shrewsbury", fetchedOn: "2026-09-15" },
    },
  ],
});

const cleanNarrative = {
  competitors: [{ name: "ARMANDO Barbershop", claims: {} }],
  where_you_win: [],
  where_they_win: [],
  actions: [1, 2, 3].map(anAction),
};

/** Run the whole pipeline offline with the model answering however a test wants. */
async function run(think: Record<string, unknown>, business = aBusiness()) {
  const { ctx } = fakeContext(recorded, { think });
  let state: RunState = {};
  let stage = "searching" as never;
  for (let i = 0; i < 30; i++) {
    const step = await advance(stage, state, business, ctx);
    stage = step.stage as never;
    state = step.state;
    if (stage === "done" || stage === "failed") break;
  }
  return { stage, state };
}

/** The numbered page list, rebuilt the way the writing stage builds it. */
function numberedFrom(state: RunState) {
  const ok = (p: { ok: boolean }) => p.ok;
  const all = [
    ...(state.listingPages ?? []).filter(ok),
    ...Object.values(state.pages ?? {}).flat().filter(ok),
  ];
  const seen = new Set<string>();
  return all.filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)));
}

// ---------------------------------------------------------------------------
// A page number that was never handed out must not become a url.
// ---------------------------------------------------------------------------

test("breakit: only a real page number expands to a url", () => {
  const pages = [
    { url: "https://a.example/one", fetchedOn: "2026-09-15" },
    { url: "https://b.example/two", fetchedOn: "2026-09-15" },
  ];

  // These are the ones the requirement cares about: nothing invented.
  assert.equal(expand(pages, 3), null, "a number past the end became a url");
  assert.equal(expand(pages, 0), null);
  assert.equal(expand(pages, -1), null);
  assert.equal(expand(pages, 1.5), null);
  assert.equal(expand(pages, null), null);
  assert.equal(expand(pages, undefined), null);
  assert.equal(expand(pages, "https://c.example/three"), null, "a url the model typed was trusted");

  // A value that is not a page number at all must not be coerced into one.
  assert.equal(expand(pages, true), null, "the boolean true became page 1");
  assert.equal(expand(pages, [2]), null, "an array became page 2");
  assert.equal(expand(pages, { valueOf: () => 2 }), null, "an object became page 2");
});

// ---------------------------------------------------------------------------
// The worst failure this product can have: a real url, the wrong business.
// ---------------------------------------------------------------------------

test("breakit: a cited page belongs to the business the cell is about", async () => {
  // First pass, only to learn which page got which number in this run.
  const first = await run({ comparison: { comparison: [] }, battlecard: cleanNarrative });
  const pages = numberedFrom(first.state);
  assert.ok(pages.length >= 3, `only ${pages.length} pages were read, cannot set this up`);

  // Which page belongs to whom, as the run itself recorded it.
  const owner = new Map<string, string>();
  for (const [name, list] of Object.entries(first.state.pages ?? {})) {
    for (const p of list) if (p.ok) owner.set(p.url, name);
  }
  const listing = new Set((first.state.listingPages ?? []).filter((p) => p.ok).map((p) => p.url));

  const columns = [
    "The Barber Shop Shrewsbury",
    ...(first.state.competitors ?? []).map((c) => c.name),
  ];

  // Pick a page that belongs to ONE named competitor, not a listing. Pointing
  // every cell at a listing page would be a test that cannot fail: the listing
  // legitimately covers everybody.
  // "you" is the customer's own page, which belongs under column 0.
  const nameFor = (key: string) => (key === "you" ? columns[0] : key);
  const mineIndex = pages.findIndex(
    (p) => !listing.has(p.url) && owner.get(p.url) && owner.get(p.url) !== "you",
  );
  assert.ok(mineIndex >= 0, "no competitor-owned page in the numbered list");
  const number = mineIndex + 1;
  const belongsTo = nameFor(owner.get(pages[mineIndex].url)!);
  assert.ok(
    columns.filter((c) => c !== belongsTo).length > 1,
    "need at least two other columns for this to mean anything",
  );

  // Point EVERY cell at that one competitor's page, whoever the column is
  // about. A model that miscounts does exactly this, and it is not a crash: it
  // is a real url under the wrong name.
  const { state } = await run({
    comparison: {
      comparison: [
        {
          area: "pricing",
          columns,
          rows: [
            { attribute: "Classic cut", cells: columns.map(() => ({ value: "£18", from: number })) },
          ],
        },
      ],
    },
    battlecard: cleanNarrative,
  });

  const grid = state.grid?.[0];
  assert.ok(grid, "no grid was built");

  for (const row of grid!.rows) {
    row.cells.forEach((cell, i) => {
      if (!cell.value || !cell.source) return;
      const about = grid!.columns[i];
      const from = cell.source.url;
      const belongs = listing.has(from) || nameFor(owner.get(from) ?? "") === about;
      assert.ok(
        belongs,
        `"${row.attribute}" for ${about} is sourced to ${from}, which was read for ` +
          `${nameFor(owner.get(from) ?? "nobody")}`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Every fact on the page carries its source.
// ---------------------------------------------------------------------------

test("breakit: a grid cell with a value always carries a source url and a date", async () => {
  const columns = [
    "The Barber Shop Shrewsbury",
    "ARMANDO Barbershop",
    "Brotherhood Barbers",
    "The Fade Inn Barbershop",
    "Barbering AJ",
    "NO.1 BARBERS",
  ];

  // 99 was never handed out, so it expands to nothing. The value stays.
  const { stage, state } = await run({
    comparison: {
      comparison: [
        {
          area: "pricing",
          columns,
          rows: [{ attribute: "Classic cut", cells: columns.map(() => ({ value: "£18", from: 99 })) }],
        },
      ],
    },
    battlecard: cleanNarrative,
  });

  const body = buildBody(state);
  const why = hollow(body);

  const unsourced: string[] = [];
  for (const g of body?.grid ?? []) {
    for (const row of g.rows) {
      row.cells.forEach((cell, i) => {
        if (cell.value == null || String(cell.value).trim() === "") return;
        if (!cell.source?.url || !cell.source?.fetchedOn) {
          unsourced.push(`${g.area}/${row.attribute} for ${g.columns[i]} = ${cell.value}`);
        }
      });
    }
  }

  assert.deepEqual(
    unsourced,
    [],
    `stage=${stage} stored=${why === null}. Facts on the page with no source:\n  ` +
      unsourced.join("\n  "),
  );
});

// ---------------------------------------------------------------------------
// A document stored as done has to be the thing that was promised.
// ---------------------------------------------------------------------------

test("breakit: a document stored as done covers every area asked for", async () => {
  /**
   * Only the pricing area comes back with rows. The other calls answer
   * honestly with nothing. The fake is left to do its own per-area filtering
   * here, so this is the product's behaviour and not the fake's.
   */
  const onlyPricing: Recorded = {
    ...recorded,
    grid: (recorded.grid as { area?: string }[]).filter((g) => g.area === "pricing"),
  };

  const { ctx } = fakeContext(onlyPricing, { think: { battlecard: cleanNarrative } });
  let state: RunState = {};
  let stage = "searching" as never;
  for (let i = 0; i < 30; i++) {
    const step = await advance(stage, state, aBusiness(), ctx);
    stage = step.stage as never;
    state = step.state;
    if (stage === "done" || stage === "failed") break;
  }

  const body = buildBody(state);
  const stored = stage === "done" && hollow(body) === null;
  if (!stored) return; // it refused it, which is the right answer

  /**
   * Contract settled by Raj on 2026-09-16, after asking whether a business can
   * genuinely have one competitor: the full set of areas is a target, not a
   * promise, and a shortfall must never be silent.
   *
   * An area is built by its own call and one that fails is dropped rather than
   * taking the others with it, because two tables beat none. What was wrong,
   * and what this now checks, is that the page said nothing: a missing reviews
   * table could equally mean nobody publishes reviews or that our call fell
   * over, and neither the owner nor we could tell which.
   *
   * Measured against GRID_AREAS, not a list written here. An area we never
   * asked for is not a silent shortfall, it is a decision, and the rule is
   * about the ones we did ask for. Written as a fixed four it failed the day
   * the areas were cut to two, complaining that a table nobody had requested
   * was missing.
   */
  const areas = new Set((body?.grid ?? []).map((g) => g.area));

  if (areas.size < GRID_AREAS.length) {
    assert.ok(
      body?.areas,
      `stored with ${areas.size} of ${GRID_AREAS.length} areas and nothing on the document saying so`,
    );
    for (const missing of GRID_AREAS.filter((a) => !areas.has(a))) {
      assert.match(body!.areas!, new RegExp(missing), `"${missing}" is missing and unmentioned`);
    }
    return;
  }

  assert.equal(areas.size, 4, `stored as done with ${areas.size} area(s): ${[...areas].join(", ")}`);
});

test("breakit: a document stored as done has five competitors", async () => {
  // The ranking picked five. The model wrote about one. Nothing objects.
  const { stage, state } = await run({
    comparison: { comparison: recorded.grid },
    battlecard: cleanNarrative,
  });

  const body = buildBody(state);
  const stored = stage === "done" && hollow(body) === null;
  if (!stored) return;

  assert.equal(
    body?.competitors.length,
    5,
    `stored as done with ${body?.competitors.length} competitor(s), ` +
      `after the run had picked ${(state.competitors ?? []).length}`,
  );
});
