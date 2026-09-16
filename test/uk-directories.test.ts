import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GENERAL, SPECIALIST, TRADE_GROUP, coverage, sourcesFor } from "../tools/sources/uk-directories.ts";

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

test("only a source that carries prices is marked as carrying prices", () => {
  // Prices are the rare part and the product's whole argument. A directory
  // wrongly marked would send a run looking for something that is not there.
  const withPrices = [...GENERAL, ...SPECIALIST].filter((d) => d.carries.includes("prices"));
  assert.deepEqual(
    withPrices.map((d) => d.name).sort(),
    ["AutoTrader UK", "Booksy", "Fresha", "Treatwell"],
    "the list of sources claiming to carry prices changed",
  );
});

test("the coverage gap is stated rather than hidden", () => {
  // Half the trades have a specialist. Saying so is the point: it is what tells
  // us which half still needs work.
  const c = coverage();
  assert.ok(c.trades > 50, `only ${c.trades} trades are grouped`);
  assert.ok(c.withSpecialist > 0 && c.withSpecialist < c.trades);
  assert.ok(c.fallingBackToSearch.includes("bakery"), "the trade that failed is claimed as covered");
});
