/**
 * The pre-generation gates, asserted as behaviour rather than as source order.
 *
 * `planner-paths.test.ts` already checks the gate sits before the model call in
 * the file. That catches a reordering and nothing else: it would pass happily
 * if the condition itself were wrong. These run the rule.
 *
 * Asked for by Raj on 2026-09-18: prove drafting is blocked when data density
 * is zero.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { tooThinToWrite, type Page } from "../tools/content-social-planner/sources.ts";

const aPage = (url: string): Page => ({ url, fetchedOn: "2026-09-18", what: "your price list" });

/**
 * Nothing in this file loops against a model, but the ceiling is stated and
 * enforced anyway: a mock loop with no cap is how a suite hangs instead of
 * failing, and a hang tells you nothing.
 */
const MOST_TRIES = 3;

test("nothing read means nothing written", () => {
  assert.notEqual(tooThinToWrite([], []), null);
});

test("pages found but none of them readable is still nothing", () => {
  // The site was fetched and every page came back broken. Zero, not some.
  const pages = [aPage("https://example.co.uk/prices")];
  assert.notEqual(tooThinToWrite(pages, [{ ok: false }, { ok: false }]), null);
});

test("pages read but none listed is still nothing", () => {
  assert.notEqual(tooThinToWrite([], [{ ok: true }]), null);
});

test("one readable page is enough to write from", () => {
  assert.equal(tooThinToWrite([aPage("https://example.co.uk/prices")], [{ ok: true }]), null);
});

test("one good page among broken ones is enough", () => {
  const pages = [aPage("https://example.co.uk/prices")];
  assert.equal(tooThinToWrite(pages, [{ ok: false }, { ok: true }, { ok: false }]), null);
});

test("what the owner is told says what to do about it", () => {
  const said = tooThinToWrite([], []) ?? "";
  assert.match(said, /website/i);
  assert.match(said, /planner/i, "the refusal does not say how to fix it");
});

/**
 * The gate's whole purpose: no model call, so no spend.
 *
 * Standing in for the action's writer, and counted. A gate that refuses after
 * the call costs exactly as much as no gate.
 */
test("the writer is never reached when there is nothing to cite", () => {
  let calls = 0;
  const write = () => {
    calls += 1;
    assert.ok(calls <= MOST_TRIES, `the writer ran away: ${calls} calls`);
    return "a post";
  };

  const density: [Page[], { ok: boolean }[]][] = [
    [[], []],
    [[aPage("https://example.co.uk/prices")], [{ ok: false }]],
    [[], [{ ok: true }]],
  ];

  assert.ok(density.length <= MOST_TRIES, "more cases than the ceiling allows");

  for (const [pages, read] of density) {
    const thin = tooThinToWrite(pages, read);
    if (!thin) write();
  }
  assert.equal(calls, 0, "the model was called with nothing to cite");

  // And the same loop does call it once there is something, so the check above
  // is not passing because the writer was never wired up.
  if (!tooThinToWrite([aPage("https://example.co.uk/prices")], [{ ok: true }])) write();
  assert.equal(calls, 1);
});

test("the screen's gate and the rule are the same sentence", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const action = readFileSync(
    join(import.meta.dirname, "..", "app", "workspace", "[tool]", "make-actions.ts"),
    "utf8",
  );
  // Stripped of comments first: three times now a test has fired on a comment
  // that was explaining the very thing it was checking for.
  const code = action.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  assert.match(code, /tooThinToWrite\(/, "the screen has its own copy of the rule again");
  assert.doesNotMatch(
    code,
    /We have not read your website yet/,
    "the refusal is written out in the screen as well as the rule",
  );
});
