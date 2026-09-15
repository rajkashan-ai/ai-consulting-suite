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

test("a grid that does not arrive is an empty grid, not a crash", async () => {
  const { state, stage } = await write({
    comparison: {},
    battlecard: {
      competitors: [{ name: "HINCES", claims: {} }],
      where_you_win: [], where_they_win: [],
      actions: [1, 2, 3].map((rank) => ({
        rank, area: "pricing", headline: `Do ${rank}`, why: "Because.",
        evidence: [{ text: "A fact", value: 1, source: { url: "https://x", fetchedOn: "2026-09-15" } }],
      })),
    },
  });
  assert.notEqual(stage, "failed");
  assert.deepEqual(state.grid, []);
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
