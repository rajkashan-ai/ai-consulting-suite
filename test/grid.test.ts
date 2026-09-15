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

/** A grid shaped the way the model is asked to return one. */
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
            source: { url: "https://booksy.com/x", fetchedOn: "2026-09-15" },
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
              cells: [
                { value: "£35", source: null },
                { value: "£15", source: null },
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
  assert.match(engine, /cut off at/, "and it does not say so");
  assert.match(engine, /Asked for/, "a wrong-shaped answer is swallowed again");
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
  const areas = new Set(GRID_AREAS);
  assert.equal(areas.size, 4);
  assert.ok(areas.has("pricing") && areas.has("blindspots"));
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
  assert.ok(asked.length >= 5, `only ${asked.length} writing calls were recorded`);

  for (const call of asked) {
    assert.ok(call.shapeFull, `${call.shape} recorded no schema, so this test proves nothing`);
    const shape = JSON.stringify(call.shapeFull);
    assert.match(shape, /"from"/, `${call.shape} does not cite by page number`);
    assert.doesNotMatch(shape, /"url"/, `${call.shape} still asks for a url`);
    assert.doesNotMatch(shape, /"fetchedOn"/, `${call.shape} still asks for a date`);
  }
});
