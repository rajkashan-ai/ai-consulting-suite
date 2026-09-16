import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { check, moneyIn, onPage, written } from "../tools/competitor-tracker/verify.ts";
import { scrubGrid } from "../tools/competitor-tracker/scrub.ts";
import type { Grid } from "../tools/competitor-tracker/stages.ts";

/**
 * Is that price actually printed on the page it cites?
 *
 * Everything else checks the source: that it exists, that we read it, that it
 * belongs to the business the fact is about. None of it says the number is on
 * the page.
 *
 * On the evidence, nothing has been invented: ten of ten money figures on the
 * one real run are printed on the pages they cite. This keeps it that way.
 */

const recorded = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "shrewsbury.json"), "utf8"),
) as { listing: { text: string }; competitorPage: { text: string }; ownPage: { text: string }; grid: Grid[] };

const REAL_PAGES = [recorded.listing.text, recorded.competitorPage.text, recorded.ownPage.text].join("\n");

// ---------------------------------------------------------------------------
// The trap that made me report an invented price that was not invented.
// ---------------------------------------------------------------------------

test("a price is matched by its number, whatever the page does with the currency", () => {
  /**
   * The listing writes "£15.00 30min". The customer's own page carries no
   * prices at all: it is opening hours, a phone number and a booking link. Two
   * pages in one run, written two different ways, and a check that depends on
   * the pound sign being there is a false alarm on one of them.
   *
   * I got this wrong twice on 2026-09-16 while writing this file, and told Raj
   * a price had been invented when it had not. Both mistakes were reading the
   * page with a regex instead of printing it. This test is both of them.
   */
  assert.ok(REAL_PAGES.includes("£15.00"), "the fixture changed, so this proves nothing");
  assert.ok(onPage("15", REAL_PAGES), "a price printed with a pound sign was missed");
  assert.ok(onPage("15", "Classic cut 15.00"), "a price printed without one was missed");
});

test("an opening time is not a price", () => {
  // "16" inside "Monday 8:45 - 16:00" verified a £16 price. The customer's own
  // page is opening hours and nothing else, which is exactly where that false
  // match would have been believed.
  assert.equal(onPage("16", "Monday ............. 8:45 - 16:00"), false);
  assert.equal(onPage("8", "Saturday 8:30 - 16:00"), false);
  assert.equal(onPage("16", "Skin fade 16.00"), true);
});

test("every price on the real run is printed on the page it cites", () => {
  // The measurement behind "nothing has been invented". If a future change
  // starts inventing prices, this goes red on the run we already have.
  const figures = (recorded.grid ?? []).flatMap((g) =>
    (g.rows ?? []).flatMap((r) => (r.cells ?? []).flatMap((c) => moneyIn(String(c?.value ?? "")))),
  );

  assert.ok(figures.length >= 8, `only ${figures.length} money figures to check`);
  for (const amount of figures) {
    assert.ok(onPage(amount, REAL_PAGES), `£${amount} is on no page we read`);
  }
});

// ---------------------------------------------------------------------------
// The forms one amount takes.
// ---------------------------------------------------------------------------

test("18, 18.0 and 18.00 are one price", () => {
  assert.deepEqual(written("18").sort(), ["18", "18.0", "18.00"]);
  assert.ok(onPage("18", "Haircut 18.00, 40 minutes"));
  assert.ok(onPage("18.00", "Haircut 18"));
});

test("a price is not matched inside a longer number", () => {
  // Without bounds, 18 matches 180, 2018 and 1.8, and the check passes for
  // almost anything, which is worse than not checking at all.
  assert.equal(onPage("18", "Established 2018"), false);
  assert.equal(onPage("18", "Gift cards from 180"), false);
  assert.equal(onPage("2", "Cut 21.00"), false);
});

test("money is found however the cell writes it", () => {
  assert.deepEqual(moneyIn("Classic Cut £15.00"), ["15.00"]);
  assert.deepEqual(moneyIn("£ 15 to £20"), ["15", "20"]);
  assert.deepEqual(moneyIn("Children 12 and under £13.00, 30 minutes"), ["13.00"]);
  assert.deepEqual(moneyIn("5.0 from 607 reviews"), []);
});

// ---------------------------------------------------------------------------
// What is checked, and what is deliberately not.
// ---------------------------------------------------------------------------

test("a price that is not on the page is caught", () => {
  const v = check("Classic Cut £42", "Haircut 18.00 Beard 12.00");
  assert.equal(v.kind, "not there");
  assert.equal((v as { amount: string }).amount, "42");
});

test("a counted theme is not a price and is left alone", () => {
  // "3 of 9 mention waiting" is derived by counting, so the 3 is correctly
  // nowhere on the page. A rule demanding every number be printed would delete
  // the most useful lines we write.
  assert.deepEqual(check("3 of 9 mention waiting", "no numbers here at all"), { kind: "ok" });
  assert.deepEqual(check("4.8 from 607 reviews", "nothing"), { kind: "ok" });
  assert.deepEqual(check("Sunday closed", "nothing"), { kind: "ok" });
});

test("a blank cell is fine", () => {
  assert.deepEqual(check(null, "anything"), { kind: "ok" });
});

test("no text for a page means we cannot say, never that it is wrong", () => {
  // Treating an unknown as a failure would blank good data because of our own
  // bookkeeping, and the page an owner reads would get worse for it.
  assert.deepEqual(check("£18", null), { kind: "no page" });
  assert.deepEqual(check("£18", undefined), { kind: "no page" });
});

// ---------------------------------------------------------------------------
// Through the scrub, which is where it actually runs.
// ---------------------------------------------------------------------------

const gridWith = (value: string): Grid[] => [
  {
    area: "pricing",
    columns: ["NO.1 BARBERS"],
    rows: [
      {
        attribute: "Classic cut",
        cells: [{ value, source: { url: "https://p", fetchedOn: "2026-09-16" } }],
      },
    ],
  } as Grid,
];

test("a price nothing prints is blanked, and says why", () => {
  const { grids, dropped } = scrubGrid(gridWith("£42"), () => "Haircut 18.00");
  assert.equal(grids[0].rows[0].cells[0].value, null);
  assert.match(dropped[0].why, /£42 is not printed on the page it cites/);
});

test("a price the page prints survives", () => {
  const { grids, dropped } = scrubGrid(gridWith("£18"), () => "Haircut 18.00, 40 minutes");
  assert.equal(grids[0].rows[0].cells[0].value, "£18");
  assert.equal(dropped.length, 0);
});

test("with no page text given, the money check simply does not run", () => {
  // Every caller that has the text passes it. One that does not must not have
  // every price deleted.
  const { grids, dropped } = scrubGrid(gridWith("£42"));
  assert.equal(grids[0].rows[0].cells[0].value, "£42");
  assert.equal(dropped.length, 0);
});
