import { test } from "node:test";
import assert from "node:assert/strict";
import { MACHINERY, plainly } from "../lib/plainly.ts";

/**
 * What an owner is told when something throws.
 *
 * There was one catch around the pipeline and it wrote the exception's own
 * words into the field the screen reads. A barber could be shown
 *
 *     The answer was cut off at 32000 tokens while building "comparison".
 *
 * and, for anything unanticipated, a TypeError or the body of a rate limit
 * response word for word. Two readers, two sentences: theirs says what happened
 * in their terms, ours keeps the real text, because the real text is the only
 * thing that makes the fault findable tomorrow.
 */

test("nothing an owner is shown carries our vocabulary", () => {
  const thrown: unknown[] = [
    new Error("CutOff: the write up came out longer than we can handle in one go"),
    new Error("WrongForm: the write up came back in a form we could not use"),
    new Error("429 rate_limit_error: number of request tokens has exceeded"),
    new Error("Cannot read properties of undefined (reading 'name')"),
    new Error("fetch failed: ECONNRESET"),
    new Error("Invalid URL"),
    new Error("401 authentication_error: invalid x-api-key"),
    "a bare string nobody wrapped",
    { weird: true },
    null,
    undefined,
  ];

  for (const e of thrown) {
    const { say } = plainly(e);
    assert.doesNotMatch(say, MACHINERY, `shown to an owner: ${say}`);
    assert.match(say, /[.!]$/, say);
    assert.ok(say.length > 20, say);
  }
});

test("we always keep enough to find the fault", () => {
  const { why } = plainly(new Error("Cannot read properties of undefined (reading 'name')"));
  assert.match(why, /Cannot read properties/);
  assert.match(why, /^Error:/);
});

test("the machinery on an error's cause is kept and never shown", () => {
  // The size and the part being built are exactly what an owner cannot use and
  // exactly what we need, so they ride on `cause`.
  const e = new Error("CutOff: the write up came out longer than we can handle in one go");
  e.cause = "comparison at 32000";

  const { say, why } = plainly(e);
  assert.match(why, /comparison at 32000/);
  assert.doesNotMatch(say, /32000|comparison/);
});

test("a rate limit says to wait, because that is the useful thing", () => {
  assert.match(plainly(new Error("429 rate_limit_error")).say, /few minutes/);
});

test("a network fault says so rather than blaming them", () => {
  assert.match(plainly(new Error("fetch failed")).say, /could not reach/);
});

test("something we have never seen still gets a usable sentence", () => {
  const { say } = plainly(new Error("kaboom"));
  assert.match(say, /Something went wrong at our end/);
  assert.match(say, /Start it again/);
});

test("an enormous error text is not kept whole", () => {
  // A rate limit body can be a page long. Keeping it all makes the run row
  // large for no benefit.
  const { why } = plainly(new Error("x".repeat(50_000)));
  assert.ok(why.length <= 2100, `kept ${why.length} characters`);
});

test("a step that throws keeps the real reason as well as the plain one", async () => {
  /**
   * A real run failed on 2026-09-16, the owner saw "something went wrong at our
   * end", and there was nothing anywhere saying what. Not in the run row, and
   * not in the server log either, because catching an error is precisely what
   * stops it being logged. I wrote the two readers rule and applied half of it.
   */
  const { advance } = await import("../tools/competitor-tracker/stages.ts");
  const { aBusiness } = await import("./fake.ts");

  const ctx = {
    read: async () => ({ ok: true, url: "x", text: "", title: null, fetchedAt: "", note: "" }),
    think: async () => { throw new TypeError("Cannot read properties of undefined (reading 'name')"); },
    search: async () => { throw new TypeError("Cannot read properties of undefined (reading 'name')"); },
    progress: () => {},
  } as never;

  const step = await advance("searching" as never, {}, aBusiness(), ctx);

  assert.equal(step.stage, "failed");
  assert.match(step.state.reason ?? "", /Something went wrong at our end/);
  assert.match(step.state.watch?.stopped ?? "", /Cannot read properties/, "the real reason was thrown away");
  assert.match(step.state.watch?.stopped ?? "", /^searching:/, "it does not say which step failed");
});
