import { test } from "node:test";
import assert from "node:assert/strict";
import { decideRun, sayWhen } from "../tools/cadence.ts";

// The rule itself is tested inside the Competitor Tracker. What is tested here
// is that the workspace calls it and turns the answer into something a customer
// can read, which is the half that lives on this side of the join.

const now = new Date("2026-09-15T09:00:00Z");
const days = (n: number) =>
  new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

test("a first run is always allowed", () => {
  assert.equal(decideRun(null, now).allowed, true);
});

test("inside the week it holds, and says when it will not", () => {
  // Last run 12 September, so the next is the 19th. My first guess at this was
  // the 18th, which is the arithmetic the customer would also get wrong, and
  // is exactly why the date is spelled out on the screen rather than implied.
  const d = decideRun(days(3), now);
  assert.equal(d.allowed, false);
  assert.match(sayWhen(d), /once a week/);
  assert.match(sayWhen(d), /Next check Saturday 19 September/);
});

test("after seven days it runs again", () => {
  assert.equal(decideRun(days(8), now).allowed, true);
  assert.equal(sayWhen(decideRun(days(8), now)), "Ready to run");
});

test("a clock that went backwards does not buy a fresh run, and says so plainly", () => {
  const d = decideRun(new Date(now.getTime() + 60_000).toISOString(), now);
  assert.equal(d.allowed, false);
  // No reason code reaches the customer, and it does not pretend to know a date.
  assert.match(sayWhen(d), /cannot tell when this last ran/);
});
