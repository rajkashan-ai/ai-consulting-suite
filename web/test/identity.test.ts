import { test } from "node:test";
import assert from "node:assert/strict";
import { addTown, sameSite, sameTown, townKnown } from "../tools/identity.ts";

/**
 * One salon was entered twice on 2026-09-16, as "https://acutabovestalbans.co.uk"
 * and "acutabovestalbans.co.uk", and became two businesses. Both read the same
 * website at sign-up, so the same four pages were fetched and paid for twice.
 */
test("the same address typed two ways is one business", () => {
  const ways = [
    "https://acutabovestalbans.co.uk",
    "acutabovestalbans.co.uk",
    "http://www.acutabovestalbans.co.uk/",
    "  HTTPS://AcutAboveStAlbans.co.uk  ",
  ];
  const keys = new Set(ways.map(sameSite));
  assert.equal(keys.size, 1, `still ${keys.size} businesses: ${[...keys].join(", ")}`);
  assert.equal([...keys][0], "acutabovestalbans.co.uk");
});

test("two different businesses stay two", () => {
  assert.notEqual(sameSite("https://studio10hairdressing.co.uk"), sameSite("https://mosaichair.co.uk"));
});

/**
 * A path is not noise. A customer who types a page rather than a homepage has
 * told us something, and two shops inside one directory are two businesses.
 */
test("a page inside a site is not the same as the site", () => {
  assert.notEqual(sameSite("example.co.uk/shop-a"), sameSite("example.co.uk/shop-b"));
});

test("nothing typed is not a business", () => {
  assert.equal(sameSite(null), "");
  assert.equal(sameSite("   "), "");
});

/**
 * A playbook counts distinct towns before it trusts itself. "St Albans" and
 * "St. Albans" would have counted one town as two, so a playbook built entirely
 * in one town could call itself confirmed across three.
 */
test("one town spelled two ways is one town", () => {
  assert.equal(sameTown("St. Albans"), sameTown("St Albans"));
  assert.equal(sameTown("  ST ALBANS "), sameTown("st albans"));
  assert.ok(townKnown(["St Albans"], "St. Albans"));
});

test("two towns stay two", () => {
  assert.notEqual(sameTown("St Albans"), sameTown("Ware"));
  assert.equal(townKnown(["St Albans"], "Shrewsbury"), false);
});

test("adding a town we already have keeps the spelling we had", () => {
  // Never two entries for one place, and never a second spelling appearing in
  // something the owner reads.
  assert.deepEqual(addTown(["St Albans"], "St. Albans"), ["St Albans"]);
  assert.deepEqual(addTown(["St Albans"], "Ware"), ["St Albans", "Ware"]);
  assert.deepEqual(addTown([], "  "), []);
});
