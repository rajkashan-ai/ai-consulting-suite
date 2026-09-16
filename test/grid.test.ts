import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { advance, type RunState } from "../tools/competitor-tracker/stages.ts";
import { aBusiness, fakeContext, type Recorded } from "./fake.ts";

/**
 * The comparison grid, tested without spending anything.
 *
 * The grid came back empty from a live run that cost 196,000 tokens and ten
 * minutes. Finding out why by running it again would cost the same again. Every
 * question below is answered against the saved pages in milliseconds.
 */

const recorded = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "shrewsbury.json"), "utf8"),
) as Recorded;

/**
 * A grid shaped the way the model is asked to return one.
 *
 * Every cell is sourced to the town listing page, which is a page the run
 * really reads and which really does cover every business in it. It used to be
 * sourced to "https://booksy.com/x", a url nothing ever read. That passed until
 * 2026-09-16, when a cell sourced to a page belonging to somebody else began to
 * be blanked, and an unknown url counts as somebody else: we cannot say whose
 * it is, and "we do not know" must not read as "yes".
 *
 * The fixture was wrong rather than the rule. In the product a cell's source
 * can only come from expanding a page number, so it is always a page that was
 * read. A helper that invents one is testing a state the product cannot reach.
 */
const LISTING_URL = "https://booksy.com/en-gb/s/barber/1227928_shrewsbury";

/** The five the fixture always picks, in the order the pipeline numbers them. */
const FIVE = [
  "NO.1 BARBERS",
  "ARMANDO Barbershop",
  "Barbering AJ",
  "Fish Street Barbers",
  "The Fade Inn Barbershop",
];

const aGrid = (columns: string[]) => ({
  comparison: [
    {
      area: "pricing",
      columns,
      rows: [
        {
          attribute: "Classic cut",
          cells: columns.map((c, i) => ({
            value: i === 0 ? "£15" : `£${15 + i * 2}`,
            source: { url: LISTING_URL, fetchedOn: "2026-09-15" },
          })),
        },
      ],
      note: "Five of six publish a price.",
    },
  ],
});

/** Run the writing stage with the model answering however a test wants. */
async function write(think: Record<string, unknown>, business = aBusiness()) {
  const { ctx } = fakeContext(recorded, { think });
  let state: RunState = {};
  let stage = "searching" as never;
  for (let i = 0; i < 20; i++) {
    const step = await advance(stage, state, business, ctx);
    stage = step.stage as never;
    state = step.state;
    if (stage === "checking" || stage === "failed" || stage === "done") break;
  }
  return { stage, state };
}

test("a grid the model returns survives into the card", async () => {
  const five = ["The Barber Shop Shrewsbury", "HINCES", "NO.1 BARBERS"];
  const { state } = await write({
    comparison: aGrid(five),
    battlecard: {
      competitors: [{ name: "HINCES", claims: {} }],
      where_you_win: [],
      where_they_win: [],
      actions: [1, 2, 3].map((rank) => ({
        rank, area: "pricing", headline: `Do ${rank}`, why: "Because.",
        evidence: [{ text: "A fact", value: 1, source: { url: "https://x", fetchedOn: "2026-09-15" } }],
      })),
    },
  });

  assert.ok(state.grid, "no grid on the state at all");
  assert.ok(state.grid!.length > 0, "the grid was dropped between the model and the card");
  assert.equal(state.grid![0].rows.length, 1);
});

test("the customer is always the first column, whatever order came back", async () => {
  // The model is asked for the customer first. If it puts them elsewhere the
  // cells must move with them, or the table shows one business's prices under
  // another's name.
  const { state } = await write({
    comparison: {
      comparison: [
        {
          area: "pricing",
          columns: ["HINCES", "The Barber Shop Shrewsbury"],
          rows: [
            {
              attribute: "Classic cut",
              // Sourced to the town listing, which really does cover both.
              // These used to carry `source: null`, and from 2026-09-16 a value
              // with no source behind it is blanked, because an unsourced fact
              // on the page is the thing this product exists not to do. This
              // test is about which column a price lands in, so its input has
              // to be a price that is allowed to be on the page at all.
              cells: [
                { value: "£35", source: { url: LISTING_URL, fetchedOn: "2026-09-15" } },
                { value: "£15", source: { url: LISTING_URL, fetchedOn: "2026-09-15" } },
              ],
            },
          ],
        },
      ],
    },
    battlecard: {
      competitors: [{ name: "HINCES", claims: {} }],
      where_you_win: [], where_they_win: [],
      actions: [1, 2, 3].map((rank) => ({
        rank, area: "pricing", headline: `Do ${rank}`, why: "Because.",
        evidence: [{ text: "A fact", value: 1, source: { url: "https://x", fetchedOn: "2026-09-15" } }],
      })),
    },
  });

  const grid = state.grid?.[0];
  assert.ok(grid, "no grid");
  assert.equal(grid!.columns[0], "The Barber Shop Shrewsbury");
  assert.equal(grid!.rows[0].cells[0].value, "£15", "the customer's own price moved column");
});

test("a grid that does not arrive stops the run and says so", async () => {
  /**
   * This used to assert the opposite: an empty grid, carry on, do not crash.
   * Changed deliberately on 2026-09-15.
   *
   * Carrying on produced exactly the failure that cost 196,000 tokens to find:
   * a card stored with no comparison in it, and a run that said "done" above an
   * empty table. Not crashing was the right instinct and the wrong remedy. The
   * remedy is to stop, with a reason an owner can read.
   *
   * The original point of the test still holds and is still checked: a missing
   * grid must not throw.
   */
  const { state, stage } = await write({
    comparison: {},
    battlecard: {
      competitors: [{ name: "HINCES", claims: {} }],
      where_you_win: [], where_they_win: [],
      actions: [1, 2, 3].map((rank) => ({
        rank, area: "pricing", headline: `Do ${rank}`, why: "Because.",
        evidence: [{ text: "A fact", value: 1, from: 1 }],
      })),
    },
  });

  assert.equal(stage, "failed");
  assert.match(state.reason ?? "", /could not build a comparison/);
  assert.doesNotMatch(state.reason ?? "", /undefined|null|grid|token/i);
});

test("the customer's own prices are put in front of the writing step", async () => {
  // They were read at sign-up and never handed over, so their own column said
  // "Not published" on a business whose prices we had in full.
  const { ctx, calls } = fakeContext(recorded, {});
  let state: RunState = {};
  let stage = "searching" as never;
  for (let i = 0; i < 20; i++) {
    const step = await advance(stage, state, aBusiness(), ctx);
    stage = step.stage as never;
    state = step.state;
    if (stage === "checking" || stage === "failed" || stage === "done") break;
  }
  const writing = calls.think.find((t) => t.shape === "comparison");
  assert.ok(writing, "the grid was never asked for");
  assert.match(writing!.prompt, /Classic cut/, "their own services are not in the prompt");
});

test("an answer that was cut off is not quietly accepted", async () => {
  /**
   * 15 September. A grid call hit its token limit, came back as {}, and the
   * battlecard was built and stored with no comparison in it. The run reported
   * "done". It cost 196,000 tokens and ten minutes to discover, and the only
   * clue was an empty field.
   */
  const engine = readFileSync(join(import.meta.dirname, "..", "lib", "engine.ts"), "utf8");
  assert.match(engine, /stop_reason === "max_tokens"/, "truncation is swallowed again");

  /**
   * Asserted by behaviour, not by wording. This used to match the literal
   * phrases "cut off at" and "Asked for", which were the words shown to the
   * customer. On 2026-09-16 those messages had to change, because they carried
   * a token budget and an internal shape name onto an owner's screen, and this
   * test went red for a fix rather than for a fault. A test that pins the
   * customer's wording stops the wording being corrected.
   */
  assert.match(engine, /throw cutOff\(/, "truncation no longer throws");
  assert.match(engine, /throw wrongForm\(/, "a wrong-shaped answer is swallowed again");
});

test("the narrative is written from the grid, not from every page again", async () => {
  /**
   * Both writing calls carried the whole evidence pile, so a run's input went
   * from 53,000 tokens to 196,000 and its time from two minutes to ten. The
   * grid already holds every fact worth extracting, with its sources.
   */
  const { ctx, calls } = fakeContext(recorded, {});
  let state: RunState = {};
  let stage = "searching" as never;
  for (let i = 0; i < 20; i++) {
    const step = await advance(stage, state, aBusiness(), ctx);
    stage = step.stage as never;
    state = step.state;
    if (stage === "checking" || stage === "failed" || stage === "done") break;
  }

  const gridCall = calls.think.find((t) => t.shape === "comparison");
  const wordsCall = calls.think.find((t) => t.shape === "battlecard");
  assert.ok(gridCall && wordsCall, "both writing calls should have happened");

  // The second call must be much smaller than the first, or nothing was saved.
  assert.ok(
    wordsCall!.prompt.length < gridCall!.prompt.length / 2,
    `the second call is ${wordsCall!.prompt.length} against ${gridCall!.prompt.length}: ` +
      `it is still carrying the pages`,
  );
});

// ---------------------------------------------------------------------------
// The grid is built one area at a time, all at once. Added 2026-09-15.
// ---------------------------------------------------------------------------

/**
 * Why the grid was split.
 *
 * Measured: 223 seconds of a 302 second run went on one call that wrote 26,000
 * output tokens. Output tokens are the runtime, at about a hundred a second.
 * Four areas in one call are written one after another, because that is what
 * generating text is. Four calls are written at the same time.
 *
 * These guard the two ways that can quietly stop being true: the calls going
 * back to being one, and one bad area taking the other three with it.
 */

import { GRID_AREAS } from "../tools/competitor-tracker/stages.ts";

/** Run the pipeline to the end of writing and hand back the calls made. */
async function writingCalls(answers: Record<string, unknown> = {}) {
  const { ctx, calls } = fakeContext(recorded, { think: answers as never });
  let state: RunState = {};
  let stage = "searching" as never;
  for (let i = 0; i < 20; i += 1) {
    const step = await advance(stage, state, aBusiness(), ctx);
    state = step.state;
    stage = step.stage as never;
    if (stage === "checking" || stage === "failed" || stage === "done") break;
  }
  return { state, stage, calls };
}

test("the grid is asked for one area at a time", () => {
  // A plain shape check, so it fails at the schema rather than after a live run.
  // Two areas, not four, since 2026-09-16: every area is a separate call
  // carrying the whole evidence pile, so the count is a multiplier on the
  // largest input cost in the product. Pricing and reviews are what the tool
  // is for; channels and blindspots were the extras.
  const areas = new Set(GRID_AREAS);
  assert.equal(areas.size, 2);
  assert.ok(areas.has("pricing") && areas.has("reviews"));
});

test("four grid calls are made, each pinned to a different area", async () => {
  const { calls } = await writingCalls();

  const gridCalls = calls.think.filter((c) => c.shape === "comparison");
  assert.equal(gridCalls.length, GRID_AREAS.length,
    `${gridCalls.length} grid calls: the split back into one call is the slow version returning`);

  // Each call must name its own area, or four calls all write the same table.
  const named = gridCalls.map((c) => {
    const found = GRID_AREAS.filter((a) => c.prompt.includes(`ONE area only: ${a}`));
    assert.equal(found.length, 1, `a grid call named ${found.length} areas`);
    return found[0];
  });
  assert.deepEqual([...named].sort(), [...GRID_AREAS].sort());
});

test("one area failing does not lose the other three", async () => {
  // Before the split this could not happen, because there was only one call.
  // Now it can, and a thrown area must be dropped rather than thrown on.
  let seen = 0;
  const { ctx } = fakeContext(recorded, {
    think: {
      comparison: undefined as never,
    } as never,
  });

  // Wrap think so the reviews area throws and the rest answer normally.
  const original = ctx.think;
  ctx.think = async (args) => {
    if (args.shape?.name === "comparison" && args.prompt.includes("ONE area only: reviews")) {
      seen += 1;
      throw new Error("that area fell over");
    }
    return original(args);
  };

  let state: RunState = {};
  let stage = "searching" as never;
  for (let i = 0; i < 20; i += 1) {
    const step = await advance(stage, state, aBusiness(), ctx);
    state = step.state;
    stage = step.stage as never;
    if (stage === "checking" || stage === "failed" || stage === "done") break;
  }

  assert.equal(seen, 1, "the reviews area was never asked for");
  assert.notEqual(stage, "failed", "one bad area took the whole run with it");
  assert.ok((state.grid?.length ?? 0) > 0, "the surviving areas were lost");
  assert.ok(!state.grid?.some((g) => g.area === "reviews"), "a failed area was kept");
});

test("every area failing stops the run rather than storing an empty table", async () => {
  const { ctx } = fakeContext(recorded, {});
  const original = ctx.think;
  ctx.think = async (args) => {
    if (args.shape?.name === "comparison") throw new Error("all of them fell over");
    return original(args);
  };

  let state: RunState = {};
  let stage = "searching" as never;
  for (let i = 0; i < 20; i += 1) {
    const step = await advance(stage, state, aBusiness(), ctx);
    state = step.state;
    stage = step.stage as never;
    if (stage === "failed" || stage === "done") break;
  }

  assert.equal(stage, "failed");
  assert.match(state.reason ?? "", /could not build a comparison/);
});

test("the model is never asked to write a url", async () => {
  // Ten thousand output tokens a run, and the thing most likely to be invented.
  // If a url field reappears in either shape, this catches it before a run does.
  const { calls } = await writingCalls();

  const asked = calls.think.filter((c) => c.shape === "comparison" || c.shape === "battlecard");
  // One call per area plus the narrative. Counted off GRID_AREAS rather than
  // written as a number, so changing the areas does not silently leave this
  // test asserting a shape the product no longer has.
  const expected = GRID_AREAS.length + 1;
  assert.ok(
    asked.length >= expected,
    `only ${asked.length} writing calls were recorded, expected ${expected}`,
  );

  for (const call of asked) {
    assert.ok(call.shapeFull, `${call.shape} recorded no schema, so this test proves nothing`);
    const shape = JSON.stringify(call.shapeFull);
    assert.match(shape, /"from"/, `${call.shape} does not cite by page number`);
    assert.doesNotMatch(shape, /"url"/, `${call.shape} still asks for a url`);
    assert.doesNotMatch(shape, /"fetchedOn"/, `${call.shape} still asks for a date`);
  }
});

// ---------------------------------------------------------------------------
// A fact can only be sourced to a page about that business. Added 2026-09-16.
// ---------------------------------------------------------------------------

/**
 * Through the pipeline, not in isolation.
 *
 * `sources.test.ts` tests the rule on its own and passes. That is exactly what
 * was true of the bug it exists to stop: page numbers were tested, the grid was
 * tested, and the join between them was not. Breaking the claims check on
 * purpose on 2026-09-16 changed no test result at all, which is how this gap
 * was found. Anything that runs only inside the pipeline needs a test that runs
 * the pipeline.
 *
 * The numbering, printed from a real run of the fake:
 *   [1] [2] the two town listings   [3] you
 *   [4] NO.1 BARBERS   [5] ARMANDO Barbershop   [6] Barbering AJ
 *   [7] Fish Street Barbers   [8] The Fade Inn Barbershop
 */

test("a claim about one business cited to another's page is dropped", async () => {
  const { state, stage } = await write({
    comparison: aGrid(["The Barber Shop Shrewsbury", ...FIVE]),
    battlecard: {
      competitors: [
        {
          name: "NO.1 BARBERS",
          claims: {
            pricing: [
              // Their own page. Stays.
              { text: "Haircut is £18.", value: "£18", from: 4 },
              // ARMANDO's page, under NO.1's name. A real url, the wrong shop.
              { text: "Gentleman cut is £20.", value: "£20", from: 5 },
              // The town listing, which covers everybody. Stays.
              { text: "A cut here averages £17.", value: "£17", from: 1 },
            ],
          },
        },
      ],
      where_you_win: [],
      where_they_win: [],
      actions: [1, 2, 3].map((rank) => ({
        rank, area: "pricing", headline: `Do ${rank}.`, why: "Because.",
        evidence: [{ text: "A fact.", value: 1, from: 1 }],
      })),
    },
  });

  assert.notEqual(stage, "failed");

  const kept = state.card?.competitors.find((c) => c.name === "NO.1 BARBERS");
  const texts = (kept?.claims.pricing ?? []).map((c) => c.text);

  assert.ok(texts.includes("Haircut is £18."), "their own page was refused");
  assert.ok(texts.includes("A cut here averages £17."), "the town listing was refused");
  assert.ok(
    !texts.includes("Gentleman cut is £20."),
    "a competitor's page sourced a claim about a different business",
  );
});

test("a cell in one column cited to another column's page is blanked", async () => {
  // The same rule for the table, which is the part an owner actually reads
  // across. Column 0 is the customer; page 4 is NO.1 BARBERS.
  /**
   * The prices here are ones actually printed on the fixture pages: 16 on the
   * customer's own site, 19 and 21 on a competitor's. They used to be £15 and
   * £18, which are on neither, and from 2026-09-16 a money figure that is not
   * printed on the page it cites is blanked. The test data was wrong rather
   * than the rule: a price nothing prints is exactly what the check is for.
   */
  const { state, stage } = await write({
    comparison: {
      comparison: [
        {
          area: "pricing",
          columns: ["The Barber Shop Shrewsbury", ...FIVE],
          rows: [
            {
              attribute: "Classic cut",
              cells: [
                { value: "£19", from: 4 },
                ...FIVE.map((_, i) => ({ value: "£19", from: 4 + i })),
              ],
            },
          ],
        },
      ],
    },
    battlecard: recorded.battlecard,
  });

  assert.notEqual(stage, "failed", state.reason ?? "");
  const row = state.grid?.[0]?.rows[0];
  assert.ok(row, "no row");

  assert.equal(row!.cells[0].value, null, "the customer's price kept a competitor's url");
  assert.equal(row!.cells[0].source, null);
  assert.equal(row!.cells[1].value, "£19", "NO.1's own price was blanked");
});

test("the customer's own price, from their own website, survives", async () => {
  /**
   * The rule blanks a cell sourced to somebody else's page. The customer's own
   * page is queued under "you", because that is what the reading step calls it,
   * while their grid column is their real trading name. If those are not
   * reconciled, their own website belongs to a business called "you", matches
   * nothing, and every one of their own prices is silently blanked.
   *
   * That is data loss caused by a safety check, which is the worst kind: the
   * page still looks finished and their column is simply empty. The recorded
   * fixture sources its cells to the town listing, which is market wide and
   * covers everyone, so it could never catch this. Breaking the mapping on
   * purpose on 2026-09-16 changed no test result until this was written.
   *
   * Page [3] is the customer's own site.
   */
  const { state, stage } = await write({
    comparison: {
      comparison: [
        {
          area: "pricing",
          columns: ["The Barber Shop Shrewsbury", ...FIVE],
          rows: [
            {
              attribute: "Classic cut",
              /**
               * £15 is the customer's own stored price, and 19 is on a
               * competitor's page.
               *
               * This said £16 until 2026-09-16 and passed for the wrong reason:
               * "16" matched inside "8:45 - 16:00" on their opening hours. The
               * customer's own page carries no prices at all, so their column
               * is verified against what they told us at sign up, which is
               * honestly where those prices came from.
               */
              cells: [
                { value: "£15", from: 3 },
                ...FIVE.map((_, i) => ({ value: "£19", from: 4 + i })),
              ],
            },
          ],
        },
      ],
    },
    battlecard: recorded.battlecard,
  });

  assert.notEqual(stage, "failed", state.reason ?? "");
  const row = state.grid?.[0]?.rows[0];

  assert.equal(
    row!.cells[0].value,
    "£15",
    "the customer's own price was blanked, sourced to their own website",
  );
  assert.match(row!.cells[0].source?.url ?? "", /shrewsburybarber/);
});
