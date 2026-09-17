import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fingerprint, messageOf, note, shapeOf } from "../lib/problems.ts";

/**
 * The recorder. Every rule tested here is from ERROR-HANDLING.md, which cites
 * the standard it came from.
 */

function fakeDb() {
  const calls: Record<string, unknown>[] = [];
  return {
    db: { rpc: async (_fn: string, args: Record<string, unknown>) => { calls.push(args); } },
    calls,
  };
}

// ---------------------------------------------------------------------------
// Rule 5: counting is what answers "is it still happening"
// ---------------------------------------------------------------------------

/**
 * A single record says a fault happened once. Whether it is STILL happening
 * needs the same fault to land on the same row. If the varying parts are not
 * stripped, every occurrence is a new row and the count means nothing, which is
 * the only thing the table is for.
 */
test("the same fault with different numbers and ids is one fingerprint", () => {
  const a = "Run 3f2a8b44-2e5a-4ce8-8a42-b6ebe6901360 failed after 412 seconds";
  const b = "Run 05dc32c5-1cd2-45c1-987d-4f4024397f57 failed after 38 seconds";

  assert.equal(shapeOf(a), shapeOf(b), `"${shapeOf(a)}" vs "${shapeOf(b)}"`);
  assert.equal(fingerprint(a, "run writing", "run"), fingerprint(b, "run writing", "run"));
});

test("two different faults are two fingerprints", () => {
  assert.notEqual(
    fingerprint("Rendered fewer hooks than expected", "/workspace/[tool]", "render"),
    fingerprint("Credit balance is too low", "/api/runs/[id]/step", "route"),
  );
});

test("the same message in two places is two faults", () => {
  // Where it happens is part of what it is: the same message from a render and
  // from a route handler are different bugs with different fixes.
  assert.notEqual(
    fingerprint("Cannot read properties of null", "/workspace/[tool]", "render"),
    fingerprint("Cannot read properties of null", "/welcome", "action"),
  );
});

test("urls and quoted values do not split one fault into many", () => {
  assert.equal(
    shapeOf('Could not read https://booksy.com/en-gb/78530_armando for "ARMANDO Barbershop"'),
    shapeOf('Could not read https://www.mosaichair.co.uk/ for "Mosaic Hair Studio"'),
  );
});

// ---------------------------------------------------------------------------
// Rule 3: what is recorded, and what never is
// ---------------------------------------------------------------------------

/**
 * OWASP's never-log list. These must not reach the table whatever a caller
 * passes, because the caller is code written in a hurry at the moment
 * everything is going wrong.
 */
test("an email address never reaches the record", async () => {
  const { db, calls } = fakeDb();
  await note(db, {
    error: new Error("failed for rajkashan@gmail.com while reading their site"),
    where: "/welcome",
    kind: "action",
  });

  const message = String(calls[0].p_message);
  assert.doesNotMatch(message, /rajkashan@gmail\.com/, `email survived: ${message}`);
  assert.doesNotMatch(message, /@gmail/);
});

test("a phone number never reaches the record", async () => {
  const { db, calls } = fakeDb();
  await note(db, { error: new Error("rang 07700 900123 and got nothing"), where: "x", kind: "run" });
  assert.doesNotMatch(String(calls[0].p_message), /07700\s?900123/);
});

test("no stack trace is kept", async () => {
  /**
   * A stack carries absolute file paths, and on a self-hosted install that is
   * somebody's home directory. The message and the place find anything; if they
   * do not, the fix is a better message, not a bigger record.
   */
  const e = new Error("boom");
  const { db, calls } = fakeDb();
  await note(db, { error: e, where: "run writing", kind: "run" });

  const message = String(calls[0].p_message);
  assert.equal(message, "boom");
  assert.doesNotMatch(message, /at |\.ts:|\/Users\//, "a stack trace was stored");
});

test("a workspace is recorded, a person is not", async () => {
  const { db, calls } = fakeDb();
  await note(db, {
    error: new Error("boom"),
    where: "x",
    kind: "run",
    workspaceId: "05dc32c5-1cd2-45c1-987d-4f4024397f57",
  });

  const args = calls[0];
  assert.equal(args.p_workspace, "05dc32c5-1cd2-45c1-987d-4f4024397f57");
  assert.ok(!("p_user" in args) && !("p_email" in args) && !("p_ip" in args));
});

// ---------------------------------------------------------------------------
// Rule 1, fourth case: the recorder itself may be silent, and only it
// ---------------------------------------------------------------------------

/**
 * This fires when something has already gone wrong. Throwing here would replace
 * a fault we could have recorded with one we cannot, at the worst moment.
 */
test("a recorder that cannot write does not throw", async () => {
  const broken = { rpc: async () => { throw new Error("database is gone"); } };
  const got = await note(broken, { error: new Error("boom"), where: "x", kind: "run" });
  assert.equal(got, null, "it must say it failed, not pretend it worked");
});

test("something thrown that is not an Error is still recorded", async () => {
  const { db, calls } = fakeDb();
  await note(db, { error: { code: 429, why: "slow down" }, where: "x", kind: "route" });
  assert.match(String(calls[0].p_message), /429/);
});

test("something thrown that will not serialise is still recorded", async () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  const { db, calls } = fakeDb();
  const got = await note(db, { error: circular, where: "x", kind: "route" });

  assert.ok(got, "a circular object took the recorder down with it");
  assert.ok(String(calls[0].p_message).length > 0);
});

test("an enormous message is cut, not stored whole", async () => {
  const { db, calls } = fakeDb();
  await note(db, { error: new Error("x".repeat(50_000)), where: "y", kind: "run" });
  assert.ok(String(calls[0].p_message).length <= 2_000);
});

test("the caller is told whether it was recorded", async () => {
  const { db } = fakeDb();
  const got = await note(db, { error: new Error("boom"), where: "x", kind: "run" });
  assert.match(got ?? "", /^[0-9a-f]{32}$/, "a fingerprint is what proves it landed");
});

test("nothing recorded carries our machinery into the customer's view", () => {
  // The record is ours to read, so it may name stages. What it must not do is
  // become the text on the screen: that is `plainly.ts`, and error.tsx writes
  // its own words rather than rendering any of this.
  assert.equal(messageOf(new Error("stage writing failed")), "stage writing failed");
});

// ---------------------------------------------------------------------------
// Severity and release: OWASP's field list, the two gaps worth closing
// ---------------------------------------------------------------------------

/**
 * Without a severity, a failed clipboard copy and a run that died looked
 * identical in the table, and the first question anybody asks of a list of
 * faults is which of them matter.
 */
test("severity is recorded, and defaults to the middle answer", async () => {
  const { db, calls } = fakeDb();

  await note(db, { error: new Error("boom"), where: "x", kind: "run", severity: "stopped" });
  assert.equal(calls[0].p_severity, "stopped");

  await note(db, { error: new Error("boom"), where: "x", kind: "client" });
  assert.equal(calls[1].p_severity, "fault", "an unstated severity must not be the worst one");
});

test("severity is about the customer, not about us", () => {
  // Written down because it is the thing most easily got wrong: it measures
  // what they lost, not how alarming the error looked.
  const body = readFileSync(
    join(import.meta.dirname, "..", "lib", "problems.ts"),
    "utf8",
  );
  const type = body.slice(body.indexOf("export type Severity"));
  assert.match(type.slice(0, 600), /lost what they came for/);
});

test("the build is recorded, so a fix can be told from no fix", async () => {
  // A count rising after a fix cannot be told from one that never moved unless
  // each occurrence says which build it happened on.
  const { db, calls } = fakeDb();
  await note(db, { error: new Error("boom"), where: "x", kind: "run" });
  assert.ok("p_release" in calls[0], "nothing says which build this was");
});
