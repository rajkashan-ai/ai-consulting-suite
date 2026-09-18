/**
 * A row nobody can be compared on is not a comparison.
 *
 * `AREA_MEANS.pricing` has said "Only services more than one of them publishes"
 * since it was written, and nothing checked it. On 2026-09-17 a pricing grid
 * came back with one row whose only figure was the customer's own, and the
 * screen drew five columns of "Not published" beside it.
 *
 * The real fixture below is that run's row, taken off the stored state.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { onlyComparable, worthComparing } from "../tools/competitor-tracker/shapes.ts";
import { sourceOf } from "./tool-source.ts";

/** Exactly what run 0699ede3 produced: you priced, five competitors null. */
const THE_LONELY_ROW = {
  attribute: "Ladies cut and finish",
  cells: [
    { value: "£51.00", note: "graduate stylist; up to £68.00 creative director" },
    { value: null }, { value: null }, { value: null }, { value: null }, { value: null },
  ],
};

test("the row that started this is refused", () => {
  assert.equal(worthComparing(THE_LONELY_ROW), false);
});

test("you against one competitor is a comparison", () => {
  assert.equal(
    worthComparing({ cells: [{ value: "£51.00" }, { value: "£46.00" }, { value: null }] }),
    true,
  );
});

test("two competitors and no price of your own is still a comparison", () => {
  /* It tells the owner what the town charges, which is worth knowing even
     when we could not read their own price list. */
  assert.equal(
    worthComparing({ cells: [{ value: null }, { value: "£46.00" }, { value: "£60.00" }] }),
    true,
  );
});

test("a blank string is not a figure", () => {
  assert.equal(worthComparing({ cells: [{ value: "£51.00" }, { value: "  " }] }), false);
  assert.equal(worthComparing({ cells: [{ value: "£51.00" }, { value: undefined }] }), false);
});

test("nothing at all is refused rather than thrown", () => {
  assert.equal(worthComparing(null), false);
  assert.equal(worthComparing(undefined), false);
  assert.equal(worthComparing({}), false);
  assert.equal(worthComparing({ cells: [] }), false);
});

test("an area that loses every row keeps its note and its columns", () => {
  /**
   * The screen already has a "nothing on pricing yet" state, and that state
   * with the reason beside it is worth more to an owner than a table of blanks
   * or a run that fails outright. For a salon whose competitors publish
   * nothing, "nobody here prints a price" is the finding.
   */
  const grid = {
    area: "pricing",
    note: "Only A Cut Above St Albans publishes a price.",
    columns: ["A Cut Above", "Atelier", "BARBONE"],
    rows: [THE_LONELY_ROW],
  };
  const out = onlyComparable(grid);
  assert.deepEqual(out.rows, []);
  assert.equal(out.note, grid.note, "the reason was thrown away with the row");
  assert.deepEqual(out.columns, grid.columns, "the columns went with it");
  assert.equal(out.area, "pricing");
});

test("the rows that do compare are kept, in order", () => {
  const keep = { attribute: "Cut", cells: [{ value: "£51" }, { value: "£46" }] };
  const drop = THE_LONELY_ROW;
  const keep2 = { attribute: "Colour", cells: [{ value: null }, { value: "£95" }, { value: "£88" }] };
  const out = onlyComparable({ rows: [keep, drop, keep2] });
  assert.deepEqual(out.rows.map((r) => (r as { attribute?: string }).attribute), ["Cut", "Colour"]);
});

test("the sentence and the check live in the same place", () => {
  /**
   * The whole reason this defect existed: the rule was prose in AREA_MEANS
   * going to a model, and the enforcement was nowhere. Two halves of one
   * question, which is how every fault in this product has started.
   *
   * Read through `sourceOf` rather than by filename, because the tracker's
   * files have been split once already and a test that names one breaks on the
   * next split rather than on the next defect.
   */
  const src = sourceOf("competitor-tracker");
  assert.match(src, /Only services more than one of them publishes/);
  assert.match(src, /export function worthComparing/);
});
