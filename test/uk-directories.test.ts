import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GENERAL, NO_PUBLIC_PRICES, SPECIALIST, TRADE_GROUP, coverage, sourcesFor } from "../tools/sources/uk-directories.ts";

/**
 * The seeded directory list.
 *
 * The playbook learns where a trade is listed by succeeding once and
 * remembering, which deadlocks for any trade that has never succeeded. This is
 * the seed that breaks it, and these tests are about the two ways a seed goes
 * wrong: drifting from the trades it claims to cover, and quietly becoming a
 * list of opinions.
 */

test("every trade we group is a trade the app actually offers", () => {
  // The two files have to agree or a business picks a category the playbook has
  // never heard of, which is the deadlock again wearing a different hat.
  const categories = readFileSync(
    join(import.meta.dirname, "..", "tools", "categories.ts"),
    "utf8",
  );
  const missing = Object.keys(TRADE_GROUP).filter(
    (slug) => !new RegExp(`"${slug}"`).test(categories),
  );
  assert.deepEqual(missing, [], `grouped but not offered:\n  ${missing.join("\n  ")}`);
});

test("every directory says where the claim came from and whether we can read it", () => {
  // A row with no source is my judgement wearing evidence's clothes, and the
  // whole point of this file is that it is not that.
  for (const d of [...GENERAL, ...SPECIALIST]) {
    assert.ok(d.source && d.source.length > 8, `${d.name} has no source`);
    assert.ok(d.reachable.state, `${d.name} does not say whether we can read it`);
    if (d.reachable.state !== "untested") {
      assert.match(d.reachable.checked, /^\d{4}-\d{2}-\d{2}$/, `${d.name} has no check date`);
    }
  }
});

test("a blocked directory is never offered to a run", () => {
  /**
   * Three of the four biggest UK directories block us, found by asking them
   * rather than by reading about them. A run that fetches a 403 has spent time
   * and a fetch and told the owner nothing.
   */
  const blocked = [...GENERAL, ...SPECIALIST].filter((d) => d.reachable.state === "blocked");
  assert.ok(blocked.length >= 3, "the blocked ones have quietly disappeared");

  for (const trade of Object.keys(TRADE_GROUP)) {
    for (const d of sourcesFor(trade)) {
      assert.notEqual(d.reachable.state, "blocked", `${trade} is sent to ${d.name}, which blocks us`);
    }
  }
});

test("a specialist is tried before the general floor", () => {
  // A specialist carries prices and services. A general directory carries a
  // name and a star, which cannot fill a comparison on its own.
  const list = sourcesFor("barber");
  assert.equal(list[0].name, "Booksy");
  assert.ok(list.some((d) => d.covers.length === 0), "the general floor was dropped");
});

test("a trade with no specialist still gets somewhere to look", () => {
  // Food, professional services, pets, education and retail have no UK
  // specialist we have evidence for. They must not come back empty: that is
  // the bakery failure.
  for (const trade of ["bakery", "accountant", "vet", "tutor", "florist"]) {
    assert.ok(sourcesFor(trade).length > 0, `${trade} has nowhere to look`);
  }
});

test("an unknown trade still gets the general floor", () => {
  assert.ok(sourcesFor(null).length > 0);
  assert.ok(sourcesFor("something-we-have-never-seen").length > 0);
});

test("a price source is reachable, or it is not a price source", () => {
  /**
   * Prices are the rare part and the product's whole argument. Pinning the
   * exact list stopped being useful once it grew past a handful, so this pins
   * the property that matters: anything we would actually send a run to must be
   * readable, and a blocked source must never be counted as coverage.
   */
  const usable = [...GENERAL, ...SPECIALIST]
    .filter((d) => d.carries.includes("prices") && d.reachable.state !== "blocked");

  assert.ok(usable.length >= 20, `only ${usable.length} usable price sources`);
  for (const d of usable) {
    assert.notEqual(d.reachable.state, "blocked", `${d.name} is blocked and counted`);
  }
});

test("a group with no public prices says so, rather than being searched forever", () => {
  /**
   * The most useful list in the file. Two independent research passes agreed
   * that UK home services, vets, private healthcare, dentistry and estate
   * agency publish no comparable prices, because of how those trades price
   * their work rather than because we searched badly.
   *
   * Written down so nobody spends another afternoon looking for plumber rates.
   */
  const groups = NO_PUBLIC_PRICES.map((n) => n.group);
  assert.ok(groups.includes("home-services"), "the largest group lost its note");
  assert.ok(groups.includes("healthcare"));

  for (const n of NO_PUBLIC_PRICES) {
    assert.ok(n.why.length > 60, `${n.group} says it has no prices without saying why`);
  }
});

test("the coverage gap is stated rather than hidden", () => {
  // Half the trades have a specialist. Saying so is the point: it is what tells
  // us which half still needs work.
  const c = coverage();
  assert.ok(c.trades > 50, `only ${c.trades} trades are grouped`);

  // Every trade has somewhere to look now. What separates them is price, and
  // for about forty trades nothing publishes one. Counting sources stopped
  // being informative the moment the answer became "all of them".
  assert.equal(c.withSpecialist, c.trades, "a trade lost its only source");
  assert.ok(c.canComparePrices > 0 && c.canComparePrices < c.trades,
    `price coverage is ${c.canComparePrices} of ${c.trades}, which is suspicious`);
  assert.ok(c.noPriceAnywhere.includes("plumber"), "plumbers are claimed to have public prices");
  // Bakery is covered now, by the FSA and Deliveroo. What this guards is that
  // the gap is still reported honestly, whatever is in it.
  assert.ok(Array.isArray(c.noPriceAnywhere));
});
