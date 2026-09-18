/**
 * The Make screen's pathway selector, checked without a browser.
 *
 * Every transition on that screen is a call to `next`, so a state and an action
 * is the whole test. No render, no click, no DOM. What this covers is the thing
 * a person would click through by hand and then stop checking: which half of the
 * screen is drawn, whether the button is live, and whether a refusal from the
 * last request is still on screen when they start a different one.
 *
 * Asked for by Raj on 2026-09-18, as state-transition checks that run offline.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOT_BUILT,
  START,
  THOUGHT_MIN,
  next,
  readyToAsk,
  showsThoughtBox,
  type MakeState,
} from "../tools/content-social-planner/paths.ts";
import { wrongWithRequest } from "../tools/content-social-planner/paths.ts";

/**
 * Walk a list of actions from the opening state.
 *
 * Three is the ceiling anywhere a loop could run away in these tests. Nothing
 * here is a retry, so the cap is on the walk itself: a test that hangs tells
 * you nothing and costs a run.
 */
const MOST_STEPS = 3;

const walk = (...actions: Parameters<typeof next>[1][]): MakeState => {
  assert.ok(
    actions.length <= MOST_STEPS,
    `a transition walk is capped at ${MOST_STEPS} steps, got ${actions.length}`,
  );
  return actions.reduce(next, START);
};

test("the screen opens on the categories, not the box", () => {
  assert.equal(showsThoughtBox(START), false);
  assert.equal(START.path, "category");
});

test("nothing is asked for until they say what the post is for", () => {
  assert.equal(readyToAsk(START), false);
  assert.equal(readyToAsk(walk({ did: "pick-intent", intent: "prove" })), true);
});

test("choosing the other way round draws the box instead", () => {
  const s = walk({ did: "pick-path", path: "thought" });
  assert.equal(showsThoughtBox(s), true);
  assert.equal(readyToAsk(s), false, "an empty box is not a thought");
});

test("switching how you start clears what you were told last time", () => {
  const s = walk(
    { did: "refused", error: "We have not read your website yet." },
    { did: "pick-path", path: "thought" },
  );
  assert.equal(s.error, null);
});

test("a refusal stays up while they are still on the same request", () => {
  const s = walk({ did: "refused", error: "Choose what the post is for." });
  assert.equal(s.error, "Choose what the post is for.");
});

test("the photo tab cannot become the path, however it is clicked", () => {
  for (const path of NOT_BUILT) {
    const s = next(START, { did: "pick-path", path });
    assert.equal(s.path, "category", `${path} became the path`);
    assert.deepEqual(s, START, `${path} changed the screen`);
  }
});

test("switching to the box does not carry the chosen category into it", () => {
  const s = walk(
    { did: "pick-intent", intent: "promote" },
    { did: "pick-path", path: "thought" },
  );
  assert.equal(readyToAsk(s), false, "an empty box asked with a stale category");
});

test("switching back to the categories keeps the one they chose", () => {
  const s = walk(
    { did: "pick-intent", intent: "educate" },
    { did: "pick-path", path: "thought" },
    { did: "pick-path", path: "category" },
  );
  assert.equal(s.intent, "educate");
  assert.equal(readyToAsk(s), true);
});

test("a written post empties the screen for the next one", () => {
  const s = walk(
    { did: "type", thought: "Bride in at 6am, done before we opened" },
    { did: "written" },
  );
  assert.equal(s.thought, "");
  assert.equal(s.intent, null);
  assert.equal(s.error, null);
});

/**
 * The fault this rule was pulled out of the component to stop.
 *
 * Thirteen characters, so the old button lit. asThought collapses the run of
 * spaces and finds three, and refuses. The button and the guard have to be the
 * same question or the owner gets a live button and a refusal.
 */
test("the button and the guard agree on spaces pretending to be words", () => {
  const typed = "a" + " ".repeat(11) + "b";
  assert.ok(typed.trim().length >= THOUGHT_MIN, "the old rule would have lit the button");

  const s = walk({ did: "pick-path", path: "thought" }, { did: "type", thought: typed });
  assert.equal(readyToAsk(s), false);
  assert.notEqual(wrongWithRequest(s.path, s.intent, s.thought), null);
});

test("the button is never live where the action would refuse", () => {
  const typed = ["", "  ", "ok", "a" + " ".repeat(11) + "b", "Bride in at 6am, done before we opened"];
  for (const thought of typed) {
    for (const path of ["category", "thought"] as const) {
      const s: MakeState = { ...START, path, thought };
      assert.equal(
        readyToAsk(s),
        wrongWithRequest(s.path, s.intent, s.thought) === null,
        `${path} disagreed on ${JSON.stringify(thought)}`,
      );
    }
  }
});
