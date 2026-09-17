import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubGrid, scrubStanding, unsafe, unsafeReview } from "../tools/competitor-tracker/scrub.ts";
import type { Grid, Side } from "../tools/competitor-tracker/stages.ts";

/**
 * Nothing on the page that we cannot stand behind.
 *
 * Eleven guards existed and ran over text built from the battlecard alone. The
 * comparison grid and the two standing columns are built beside the card and
 * stored next to it, so most of what an owner actually reads was checked by
 * nothing at all. A Google ranking, an invented visitor count and a real
 * person's name all reached a stored document.
 *
 * Dropped, never reworded. Mending fixes a sentence that says a true thing
 * badly. There is no rewrite that makes an invented number sourced.
 */

const SRC = { url: "https://booksy.com/no-1", fetchedOn: "2026-09-16" };

const gridOf = (area: string, values: (string | null)[]): Grid[] => [
  {
    area,
    columns: ["The Barber Shop Shrewsbury", "NO.1 BARBERS"],
    rows: [{ attribute: "Reviews", cells: values.map((v) => ({ value: v, source: v ? SRC : null })) }],
  } as Grid,
];

// ---------------------------------------------------------------------------
// The claims we can never make.
// ---------------------------------------------------------------------------

test("a traffic figure is refused, however the period is written", () => {
  // "visitors per month" and "monthly visitors" were fixed phrases, so "4,000
  // visitors a month" walked through and was stored on a real card.
  for (const said of [
    "About 4,000 visitors a month to their site",
    "Roughly 4,000 visitors per month",
    "12,000 unique visitors",
    "2,000 visitors each week",
  ]) {
    assert.ok(unsafe(said), said);
  }
});

test("what anyone spends on advertising is refused", () => {
  // Nothing covered this in any phrasing, although it is on the list of things
  // that must never appear.
  for (const said of [
    "They spend about 300 a month on ads",
    "Their ad spend is around 500",
    "An advertising budget of 200 a month",
  ]) {
    assert.ok(unsafe(said), said);
  }
});

test("a Google ranking is refused", () => {
  assert.ok(unsafe("They rank second on Google for barber Shrewsbury"));
});

test("saying we cannot see something is not itself a violation", () => {
  // The one allowed use. A guard that refuses an honest denial teaches the
  // model to stop making them.
  assert.equal(unsafe("We cannot see how much traffic anyone gets"), null);
});

test("an ordinary fact is left alone", () => {
  for (const said of [
    "Standard men's cut: Classic Cut £15.00",
    "Reviews: 5.0 from 607 reviews on Booksy",
    "Opens: Sunday closed",
    "They publish no prices",
  ]) {
    assert.equal(unsafe(said), null, said);
  }
});

// ---------------------------------------------------------------------------
// Reviews are counts, stars and a source. Raj, 2026-09-16.
// ---------------------------------------------------------------------------

test("a copied review is refused", () => {
  // Refusing the quoted words has no gap. Spotting a reviewer's name does:
  // every name we do not recognise gets through, and the cost of missing one is
  // publishing a real person's words and identity.
  for (const said of [
    'Reviews: "Best fade I have ever had in this town"',
    'Reviews: “Friendly staff and a great cut every time”',
    "Reviews: ‘They always fit me in at short notice’",
  ]) {
    assert.ok(unsafeReview(said), said);
  }
});

test("a count, a rating and a short quoted service name are fine", () => {
  for (const said of [
    "Reviews: 4.8 from 607 reviews",
    "Reviews: 156 five star, none below",
    "Reviews: 3 of 9 mention waiting",
    'Services: "Skin Fade" £20',
  ]) {
    assert.equal(unsafeReview(said), null, said);
  }
});

test("the review rule only applies to the reviews area", () => {
  // A price row may legitimately quote a service name off a menu.
  const priced = scrubGrid(gridOf("pricing", ['"Skin Fade with beard trim" £25', null]));
  assert.equal(priced.dropped.length, 0);

  const reviewed = scrubGrid(gridOf("reviews", ['"Best fade I have ever had here" said one', null]));
  assert.equal(reviewed.dropped.length, 1);
  assert.match(reviewed.dropped[0].why, /actual review/);
});

// ---------------------------------------------------------------------------
// What happens to the offending cell.
// ---------------------------------------------------------------------------

test("an offending cell is blanked and the rest of the row survives", () => {
  // The row compares businesses. Losing one value is not a reason to lose the
  // other five.
  const grids = gridOf("reviews", ["They rank second on Google", "4.8 from 607 reviews"]);
  const { grids: out, dropped } = scrubGrid(grids);

  assert.equal(dropped.length, 1);
  assert.equal(out[0].rows[0].cells[0].value, null);
  assert.equal(out[0].rows[0].cells[0].source, null);
  assert.equal(out[0].rows[0].cells[1].value, "4.8 from 607 reviews");
});

test("a cell with a value and no source is blanked", () => {
  const grids: Grid[] = [
    {
      area: "pricing",
      columns: ["NO.1 BARBERS"],
      rows: [{ attribute: "Cut", cells: [{ value: "£18", source: null }] }],
    } as Grid,
  ];
  const { grids: out, dropped } = scrubGrid(grids);
  assert.equal(dropped.length, 1);
  assert.match(dropped[0].why, /nothing to point at/);
  assert.equal(out[0].rows[0].cells[0].value, null);
});

test("every drop records where it was and why, so it can be read back", () => {
  const { dropped } = scrubGrid(gridOf("reviews", ["They rank second on Google", null]));
  assert.equal(dropped[0].where, "reviews, Reviews, The Barber Shop Shrewsbury");
  assert.match(dropped[0].what, /rank second/);
  assert.match(dropped[0].why, /Google/);
});

// ---------------------------------------------------------------------------
// The two columns at the top, which had no source field at all.
// ---------------------------------------------------------------------------

const side = (point: string, source: typeof SRC | null = SRC): Side =>
  ({ point, detail: "Because of what their page says.", source }) as Side;

test("a standing point with no source is dropped", () => {
  const { standing, dropped } = scrubStanding({
    winning: [side("You open on Sundays"), side("You are cheaper", null)],
    losing: [],
  });

  assert.equal(dropped.length, 1);
  assert.equal(standing.winning.length, 1);
  assert.equal(standing.winning[0].point, "You open on Sundays");
});

test("a standing point making an unprovable claim is dropped", () => {
  const { standing, dropped } = scrubStanding({
    winning: [side("You rank first on Google")],
    losing: [side("NO.1 gets about 4,000 visitors a month")],
  });

  assert.equal(dropped.length, 2);
  assert.equal(standing.winning.length, 0);
  assert.equal(standing.losing.length, 0);
});

test("missing standing columns are two empty lists, not a crash", () => {
  const { standing, dropped } = scrubStanding(undefined);
  assert.deepEqual(standing, { winning: [], losing: [] });
  assert.equal(dropped.length, 0);
});
