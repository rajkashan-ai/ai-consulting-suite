import { test } from "node:test";
import assert from "node:assert/strict";
import { sayMoved, sayStill, whatMoved } from "../tools/competitor-tracker/changed.ts";
import type { Grid } from "../tools/competitor-tracker/stages.ts";

/**
 * "Who are my competitors" is a question an owner can mostly answer themselves,
 * and the answer is the same in December as in September. "Three of them put
 * their cut up in the last fortnight and you did not" is one they cannot answer
 * at all, and it is different every week.
 */

const src = { url: "https://booksy.com/a", fetchedOn: "2026-09-16" };

const grid = (cells: (string | null)[], attribute = "Classic cut"): Grid[] => [
  {
    area: "pricing",
    columns: ["You", "ARMANDO", "Fade Inn"],
    rows: [{ attribute, cells: cells.map((value) => ({ value, source: src })) }],
  },
];

test("a price that went up is reported, with who and what", () => {
  const moves = whatMoved(grid(["£15", "£16", "£18"]), grid(["£15", "£19", "£18"]));

  assert.equal(moves.length, 1);
  assert.deepEqual(
    { who: moves[0].who, what: moves[0].what, from: moves[0].from, to: moves[0].to },
    { who: "ARMANDO", what: "Classic cut", from: "£16", to: "£19" },
  );
  assert.equal(moves[0].source?.url, src.url, "a move must carry the page it was read on");
});

test("nothing moving is nothing reported", () => {
  assert.deepEqual(whatMoved(grid(["£15", "£16"]), grid(["£15", "£16"])), []);
});

/**
 * A figure that has vanished usually means we could not read the page today,
 * which is a fact about us. Saying "they removed their prices" when our own
 * fetch failed would be a lie in the one place an owner would act on it.
 */
test("a value we could not read this week is not reported as a change", () => {
  assert.deepEqual(whatMoved(grid(["£15", "£16"]), grid(["£15", null])), []);
});

test("a business we did not read last week has not started doing anything", () => {
  assert.deepEqual(whatMoved(grid(["£15", null]), grid(["£15", "£16"])), []);
});

test("the same attribute in a different area is a different thing", () => {
  const before = grid(["£15", "£16"]);
  const after = JSON.parse(JSON.stringify(before)) as Grid[];
  after[0].area = "reviews";
  after[0].rows[0].cells[1].value = "£99";

  assert.deepEqual(whatMoved(before, after), [], "areas were compared across each other");
});

test("a row that did not exist last week is not a change", () => {
  assert.deepEqual(whatMoved(grid(["£15", "£16"], "Classic cut"), grid(["£15", "£20"], "Beard trim")), []);
});

test("nothing at all last week means nothing to compare, not everything changed", () => {
  // The first run. Every figure is new and none of it is news.
  assert.deepEqual(whatMoved(undefined, grid(["£15", "£16"])), []);
  assert.deepEqual(whatMoved([], grid(["£15", "£16"])), []);
});

test("one business changing twice is named, because that is worth reading", () => {
  const said = sayMoved(
    [
      { who: "ARMANDO", what: "Cut", from: "£16", to: "£19", area: "pricing", source: null },
      { who: "ARMANDO", what: "Reviews", from: "40", to: "51", area: "reviews", source: null },
    ],
    "9 September",
  );
  assert.equal(said, "ARMANDO changed 2 things since 9 September.");
});

test("several businesses are counted, because a list of eleven is a wall", () => {
  const said = sayMoved(
    [
      { who: "A", what: "Cut", from: "1", to: "2", area: "pricing", source: null },
      { who: "B", what: "Cut", from: "1", to: "2", area: "pricing", source: null },
    ],
    "9 September",
  );
  assert.equal(said, "2 businesses changed 2 things since 9 September.");
});

test("nothing changed is said out loud, not left as a blank space", () => {
  // An owner who reads it has learned they are not behind. A blank teaches them
  // our tool has nothing to say, which is a different message and the wrong one.
  assert.match(sayStill("9 September"), /Nothing we can see has changed since 9 September/);
  assert.equal(sayMoved([], "9 September"), null);
});

test("nothing said to the owner carries our vocabulary", () => {
  const said = [
    sayMoved([{ who: "A", what: "Cut", from: "1", to: "2", area: "pricing", source: null }], null),
    sayStill(null),
  ].join(" ");
  assert.doesNotMatch(said, /grid|cell|row|attribute|run|stage|token|null/i);
});
