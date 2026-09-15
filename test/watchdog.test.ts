import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAPS,
  STILL_LIMIT,
  WHOLE_RUN_MINUTES,
  check,
  note,
  type Watch,
} from "../lib/watchdog.ts";

/**
 * When does a run get stopped?
 *
 * Raj asked the question after watching a run take five and a half minutes with
 * no way to tell, from inside the product, whether that was normal or hung. It
 * was normal. But nothing in the app knew that, and nothing would have stopped
 * it at fifty minutes either.
 *
 * The hard part is not stopping a bad run. It is not stopping a good one. A
 * card that legitimately needs five mend passes looks, to a careless detector,
 * exactly like two stages circling: same stage names, same progress line, over
 * and over. Most of what is below guards that boundary rather than the failures.
 */

/** A run that started this many minutes ago. */
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** Play a list of steps through, the way the engine does. */
const play = (steps: [stage: string, progress: string][]): Watch =>
  steps.reduce<Watch>((w, [stage, progress]) => note(w, stage, progress), {});

// ---------------------------------------------------------------------------
// A run that is going well is never stopped.
// ---------------------------------------------------------------------------

test("the real Shrewsbury run would not have been stopped", () => {
  // These are the stages and the progress lines from the run that worked, in
  // order. If a change to the caps would have killed it, this fails.
  const watch = play([
    ["searching", "Searched 5 of the 5 things a customer would type"],
    ["listings", "Found 32 barbers in Shrewsbury"],
    ["choosing", "Found 5 to look at. Reading their pages"],
    ["reading", "Read 8 pages. Writing it up"],
    ["writing", "Checking it"],
    ["checking", "Done. 5 businesses, 8 pages"],
  ]);

  for (const stage of Object.keys(CAPS)) {
    assert.equal(check(watch, { stage, startedAt: ago(6) }), null, stage);
  }
});

test("every mend pass the tracker is allowed to take is allowed", () => {
  // MAX_MENDS is 5, and each pass is one checking step and one fixing step. If
  // the caps cannot fit that, a card that genuinely needed five repairs gets
  // killed as stuck, which is the exact fault this file exists to prevent.
  const passes: [string, string][] = [];
  for (let i = 0; i < 5; i += 1) {
    passes.push(["checking", "Checking it"]);
    passes.push(["fixing", `Rewording one sentence, ${i + 1} of 5`]);
  }
  const watch = play([["writing", "Writing it up"], ...passes]);

  assert.equal(check(watch, { stage: "checking", startedAt: ago(8) }), null);
  assert.equal(check(watch, { stage: "fixing", startedAt: ago(8) }), null);
});

// ---------------------------------------------------------------------------
// Slow.
// ---------------------------------------------------------------------------

test("a run past the deadline is stopped", () => {
  const v = check({}, { stage: "reading", startedAt: ago(WHOLE_RUN_MINUTES + 1) });
  assert.match(v?.say ?? "", /took longer/);
  assert.match(v?.why ?? "", /reading/);
});

test("a run a minute inside the deadline is left alone", () => {
  assert.equal(check({}, { stage: "reading", startedAt: ago(WHOLE_RUN_MINUTES - 1) }), null);
});

test("it records how long it actually ran, so the limit can be tuned", () => {
  const v = check({}, { stage: "writing", startedAt: ago(30) });
  assert.match(v?.why ?? "", /ran 30\.\d minutes/);
});

test("an unusable start date does not fail every run on sight", () => {
  // A null or malformed started_at becomes new Date(NaN). Every comparison with
  // NaN is false, so the check has to be written to fall through rather than to
  // trip. Written the other way round, this fails every run on its first step,
  // which looks exactly like the product being broken.
  assert.equal(check({}, { stage: "searching", startedAt: "not a date" }), null);
  assert.equal(check({}, { stage: "searching", startedAt: undefined as never }), null);
});

// ---------------------------------------------------------------------------
// Circling.
// ---------------------------------------------------------------------------

test("a stage that has taken more steps than it can need is stopped", () => {
  const v = check({ spent: { reading: CAPS.reading } }, { stage: "reading", startedAt: ago(2) });
  assert.match(v?.say ?? "", /stuck/);
  assert.equal(v?.why, `reading took ${CAPS.reading} steps, the cap is ${CAPS.reading}`);
});

test("stages are counted separately", () => {
  // A lot of reading must not condemn checking.
  assert.equal(check({ spent: { reading: 99 } }, { stage: "checking", startedAt: ago(2) }), null);
});

test("a stage with no cap is not capped", () => {
  // done and failed never reach here. An unknown stage is a bug we should see
  // as a bug, not a silent failure the customer gets blamed for.
  assert.equal(check({ spent: { done: 99 } }, { stage: "done", startedAt: ago(2) }), null);
});

// ---------------------------------------------------------------------------
// Still.
// ---------------------------------------------------------------------------

test("a step that keeps saying the same thing is stopped", () => {
  const watch = play([
    ["checking", "Checking it"],
    ["checking", "Checking it"],
    ["checking", "Checking it"],
  ]);
  assert.equal(watch.saidSame, STILL_LIMIT);

  const v = check(watch, { stage: "checking", startedAt: ago(2) });
  assert.match(v?.say ?? "", /stuck/);
  assert.match(v?.why ?? "", /without moving/);
});

test("a change of stage resets it", () => {
  // This is the one that matters. Checking and fixing alternate during a normal
  // mend, and checking says "Checking it" every single time. Keyed on the
  // progress line alone, a healthy five pass mend is killed at pass two.
  const watch = play([
    ["checking", "Checking it"],
    ["fixing", "Rewording one sentence"],
    ["checking", "Checking it"],
    ["fixing", "Rewording one sentence"],
    ["checking", "Checking it"],
  ]);
  assert.equal(watch.saidSame, 1);
  assert.equal(check(watch, { stage: "checking", startedAt: ago(2) }), null);
});

test("a change of wording in the same stage resets it", () => {
  const watch = play([
    ["reading", "Read 8 pages"],
    ["reading", "Read 8 pages"],
    ["reading", "Read 14 pages"],
  ]);
  assert.equal(watch.saidSame, 1);
});

// ---------------------------------------------------------------------------
// note.
// ---------------------------------------------------------------------------

test("note does not change what it was given", () => {
  const before: Watch = { spent: { reading: 1 }, saidLast: "reading x", saidSame: 1 };
  const after = note(before, "reading", "x");

  assert.deepEqual(before.spent, { reading: 1 });
  assert.equal(before.saidSame, 1);
  assert.deepEqual(after.spent, { reading: 2 });
  assert.equal(after.saidSame, 2);
});

test("note keeps a reason already recorded", () => {
  assert.equal(note({ stopped: "earlier" }, "reading", "x").stopped, "earlier");
});

// ---------------------------------------------------------------------------
// What the customer is told, and what we keep for ourselves.
// ---------------------------------------------------------------------------

test("nothing said to the customer mentions a stage, a step or a limit", () => {
  // UI/CLAUDE.md section 7, rule 7: nothing about how the product is built. A
  // stage name in a failure message is our machinery on their screen.
  const said = [
    check({}, { stage: "reading", startedAt: ago(99) }),
    check({ spent: { reading: 99 } }, { stage: "reading", startedAt: ago(1) }),
    check({ saidSame: 9 }, { stage: "checking", startedAt: ago(1) }),
  ].map((v) => v?.say ?? "");

  assert.equal(said.filter(Boolean).length, 3);
  for (const line of said) {
    assert.doesNotMatch(
      line,
      /stage|step|searching|listings|choosing|reading|writing|checking|fixing|minute|token|cap/i,
      line,
    );
    assert.match(line, /[.!]$/, line);
  }
});

test("everything we keep tells us enough to find the fault", () => {
  const v = check({ spent: { writing: 99 } }, { stage: "writing", startedAt: ago(1) });
  assert.match(v?.why ?? "", /writing/);
  assert.match(v?.why ?? "", /99/);
});
