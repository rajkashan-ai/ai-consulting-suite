import { test } from "node:test";
import assert from "node:assert/strict";
import { gapFault, gapReads, rankActions } from "../tools/competitor-tracker/rankActions.ts";

/**
 * Which action goes first, and on what evidence.
 *
 * Raj asked what the three suggestions were based on. The honest answer was:
 * evidence for the claim, and opinion for the order. The schema said "strongest
 * first", nothing defined strongest, and nothing checked it.
 *
 * There is no cost, effort or revenue figure available, so we cannot rank on
 * return. What we have off the grid is the size of the hole each action fills:
 * how many of the businesses compared already do this and the owner does not.
 * That is a countable proxy, it comes from the comparison rather than a
 * judgement, and the same card always ranks the same way.
 */

const act = (headline: string, theyDo: number | null, outOf = 5) => ({
  headline,
  gap: theyDo === null ? null : { theyDo, outOf },
});

// ---------------------------------------------------------------------------
// The order is the evidence.
// ---------------------------------------------------------------------------

test("the biggest gap goes first, whatever order the model returned", () => {
  const { actions } = rankActions([act("small", 1), act("biggest", 4), act("middle", 3)], 5);
  assert.deepEqual(actions.map((a) => a.headline), ["biggest", "middle", "small"]);
  assert.deepEqual(actions.map((a) => a.rank), [1, 2, 3]);
});

test("the same card always ranks the same way", () => {
  // The point of moving this out of the model's hands. Two runs over the same
  // facts must not disagree about what matters most.
  const facts = [act("a", 2), act("b", 5), act("c", 2)];
  const once = rankActions(facts, 5).actions.map((a) => a.headline);
  const twice = rankActions([...facts].reverse(), 5).actions.map((a) => a.headline);
  assert.equal(once[0], "b");
  assert.equal(twice[0], "b");
});

test("a tie keeps the order it came in", () => {
  // Nothing left to go on, so at least be stable rather than arbitrary.
  const { actions } = rankActions([act("first", 3), act("second", 3)], 5);
  assert.deepEqual(actions.map((a) => a.headline), ["first", "second"]);
});

// ---------------------------------------------------------------------------
// A count we cannot check is not used.
// ---------------------------------------------------------------------------

test("a gap counted against the wrong number of businesses is refused", () => {
  // The model counting "4 of 7" when five were compared is either a different
  // set or an invention. Either way it cannot rank anything.
  assert.match(gapFault({ theyDo: 4, outOf: 7 }, 5) ?? "", /out of 7 when 5 were compared/);
});

test("a count outside its own total is refused", () => {
  assert.match(gapFault({ theyDo: 6, outOf: 5 }, 5) ?? "", /not a count/);
  assert.match(gapFault({ theyDo: -1, outOf: 5 }, 5) ?? "", /not a count/);
});

test("a missing or fractional count is refused", () => {
  assert.match(gapFault(null, 5) ?? "", /no gap was counted/);
  assert.match(gapFault({ theyDo: 2.5, outOf: 5 }, 5) ?? "", /not whole/);
});

test("a real count is accepted, including none and all", () => {
  for (const n of [0, 1, 5]) assert.equal(gapFault({ theyDo: n, outOf: 5 }, 5), null, String(n));
});

test("an action whose gap fails checking is kept, but ranked last and unmeasured", () => {
  /**
   * Not dropped. The advice may still be good, and three actions is the shape
   * of this product. What it loses is the claim about the hole it fills,
   * because we could not check that, and a number we cannot check is the one
   * thing this page must never print.
   */
  const { actions, dropped } = rankActions(
    [act("unmeasurable", 4, 9), act("measured", 1)],
    5,
  );

  assert.deepEqual(actions.map((a) => a.headline), ["measured", "unmeasurable"]);
  assert.equal(actions[1].gap, undefined, "an unchecked count survived onto the page");
  assert.equal(dropped.length, 1);
  assert.match(dropped[0].why, /out of 9 when 5 were compared/);
});

test("every action still gets a rank of 1, 2, 3", () => {
  // The guards require exactly that, and assigning it ourselves is the only
  // reason it can never be wrong again.
  const { actions } = rankActions([act("a", null), act("b", null), act("c", null)], 5);
  assert.deepEqual(actions.map((a) => a.rank), [1, 2, 3]);
});

// ---------------------------------------------------------------------------
// What the owner reads.
// ---------------------------------------------------------------------------

test("the gap is said as a count, not as an adjective", () => {
  assert.equal(gapReads({ theyDo: 4, outOf: 5 }), "4 of the 5 we compared already do this.");
  assert.equal(gapReads({ theyDo: 0, outOf: 5 }), "None of the 5 we compared does this.");
  assert.equal(gapReads({ theyDo: 5, outOf: 5 }), "All 5 we compared already do this.");
});

test("nothing is said when nothing was counted", () => {
  // Silence beats "we are not sure how many", which is a sentence about us.
  assert.equal(gapReads(undefined), null);
});
