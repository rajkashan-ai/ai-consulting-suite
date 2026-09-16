import { test } from "node:test";
import assert from "node:assert/strict";
import { KINDS, NEVER_CHECKED, groupNotChecked } from "../tools/competitor-tracker/coverage.ts";
import { findBuildDetail } from "../../Agents/Competitor Tracker/src/guards.ts";
import { MACHINERY } from "../lib/plainly.ts";

/**
 * What we did not check, and why.
 *
 * The page listed the pages that refused us and nothing else, so the things we
 * never look at at all were invisible. An owner could read the whole battlecard
 * and never learn that we do not do traffic, do not do Google rankings and will
 * not copy a review. A gap nobody mentions reads as a gap nobody noticed.
 */

test("every reason is free of anything about how the product is built", () => {
  // UI/CLAUDE.md section 7 rule 7, and the guard that already exists for it.
  // "Not yet built" was asked for as a category and is not used, because it
  // claims a schedule we would then owe the reader. "We cannot see this yet"
  // says the same thing to them and nothing about us.
  for (const row of NEVER_CHECKED) {
    const found = findBuildDetail(`${row.what}. ${row.why}`);
    assert.deepEqual(found, [], `${row.what}: ${found.join(", ")}`);
  }
});

test("no reason carries our own vocabulary", () => {
  for (const row of NEVER_CHECKED) {
    assert.doesNotMatch(row.why, MACHINERY, row.what);
  }
});

test("every claim we ban outright is accounted for here", () => {
  // The list of things the guards refuse and the list of things we tell the
  // owner we do not do have to be the same list. If a guard exists and nothing
  // on the page explains it, the product quietly does less than it appears to.
  const all = NEVER_CHECKED.map((r) => `${r.what} ${r.why}`.toLowerCase()).join(" ");

  for (const banned of ["traffic", "advertising", "google", "review", "login", "robots"]) {
    assert.match(all, new RegExp(banned), `nothing explains why we never do "${banned}"`);
  }
});

test("each reason says why, not just that", () => {
  // "We do not do this" tells an owner nothing. The reason is the whole value:
  // it is what lets them trust the things we do say.
  for (const row of NEVER_CHECKED) {
    // "not yet" is the exception, and deliberately. UI/CLAUDE.md section 7 rule
    // 7 names "we cannot see this yet" as the whole allowed answer for that
    // case: anything longer starts explaining our own work, which is the thing
    // the rule exists to keep off the screen.
    const floor = row.kind === "not yet" ? 15 : 40;
    assert.ok(row.why.length > floor, `${row.what} has no real reason: ${row.why}`);
    assert.match(row.why, /[.!]$/, row.what);
  }
});

test("the three groups are all used, and nothing falls outside them", () => {
  const grouped = groupNotChecked();
  assert.deepEqual(grouped.map((g) => g.kind), KINDS);
  assert.equal(
    grouped.reduce((n, g) => n + g.rows.length, 0),
    NEVER_CHECKED.length,
    "a row was lost between the list and the grouping",
  );
});

test("nothing here blames the owner or apologises", () => {
  for (const row of NEVER_CHECKED) {
    assert.doesNotMatch(row.why, /sorry|unfortunately|your fault|you should have/i, row.what);
  }
});
