import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAPS,
  STILL_LIMIT,
  WORKING_MINUTES,
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

/**
 * A run that has spent this many minutes actually working.
 *
 * The deadline used to be wall clock since the run was created, which is the
 * one measurement this product is built to ignore: the pipeline exists so a
 * closed laptop does not lose a run. A run two steps in, left overnight, was
 * killed the moment anybody looked at it. It is working time now, summed from
 * what each stage spent, so the tests below build that instead of a clock.
 */
const worked = (minutes: number, stage = "reading"): Watch => ({
  cost: { [stage]: { seconds: minutes * 60, input: 0, output: 0, pages: 0 } },
});

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
  const v = check(worked(WORKING_MINUTES + 1), { stage: "reading", startedAt: ago(20) });
  assert.match(v?.say ?? "", /took longer/);
  assert.match(v?.why ?? "", /reading/);
});

test("a run a minute inside the deadline is left alone", () => {
  assert.equal(check(worked(WORKING_MINUTES - 1), { stage: "reading", startedAt: ago(20) }), null);
});

test("a run left overnight between steps is not touched", () => {
  // The case the old wall clock got wrong. Two steps of real work, then
  // fourteen hours of nothing because the laptop was shut.
  const watch: Watch = {
    ...worked(2, "searching"),
    spent: { searching: 1, listings: 1 },
  };
  assert.equal(check(watch, { stage: "choosing", startedAt: ago(14 * 60) }), null);
});

test("a run with nothing recorded is not judged on time at all", () => {
  // "We do not know" must not become "too long".
  assert.equal(check({}, { stage: "reading", startedAt: ago(99) }), null);
});

test("it records how long it actually worked, so the limit can be tuned", () => {
  const v = check(worked(30, "writing"), { stage: "writing", startedAt: ago(40) });
  assert.match(v?.why ?? "", /spent 30\.\d minutes working/);
});

test("the stopped message promises nothing about what happens next", () => {
  // It used to say it would carry on from what it already found. Reopening
  // starts a brand new run from nothing, so the one sentence an owner was
  // given about their own work was untrue.
  const v = check(worked(99), { stage: "reading", startedAt: ago(99) });
  assert.ok(v, "a run that worked 99 minutes was not stopped");
  assert.doesNotMatch(v!.say, /carry on from what it already found|pick up where|resume/i, v!.say);
});

test("an unusable start date does not fail every run on sight", () => {
  // Kept from when the deadline read the clock. It reads working time now, so
  // the date cannot fail a run at all, which is a stronger version of the same
  // guarantee rather than a reason to delete the case.
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
  // The first one builds a run that has worked too long, rather than one that
  // is merely old: the deadline reads working time now, so an old run with
  // nothing recorded is correctly left alone and produced no message to screen.
  const said = [
    check(worked(99), { stage: "reading", startedAt: ago(99) }),
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
