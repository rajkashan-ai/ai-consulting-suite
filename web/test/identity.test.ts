import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addTown, asAddress, fetchable, sameSite, sameTown, townKnown } from "../tools/identity.ts";

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

// ---------------------------------------------------------------------------
// What we store is not what we compare
// ---------------------------------------------------------------------------

/**
 * The bug that accounted for five of the eleven substantive run failures, and
 * which I walked past three times calling it "a URL parse failure".
 *
 * `sameSite` is a key for matching, the way `sameTown` is, and this file says
 * so about towns in as many words. On 2026-09-17 the site key was stored as the
 * value, so a workspace held "acutabovestalbans.co.uk" with no protocol,
 * `new URL()` threw on it, and every run created after that change died. The
 * one business created before it kept working, which is what made it look like
 * five separate problems.
 */
test("what we store can always be fetched", () => {
  for (const typed of [
    "acutabovestalbans.co.uk",
    "https://acutabovestalbans.co.uk",
    "www.shrewsburybarber.co.uk",
    "  HTTPS://Example.CO.UK/  ",
    "http://example.co.uk/menu",
  ]) {
    const stored = asAddress(typed);
    assert.ok(stored, `"${typed}" produced nothing storable`);
    assert.doesNotThrow(() => new URL(stored), `"${stored}" cannot be fetched`);
    assert.match(stored, /^https?:\/\//, `"${stored}" has no protocol`);
  }
});

test("what is not an address is refused, not stored broken", () => {
  // Better an honest refusal at the form than a row that fails every run.
  for (const nonsense of ["", "   ", "not a url", "localhost", "just some words"]) {
    assert.equal(asAddress(nonsense), "", `"${nonsense}" was accepted`);
  }
});

test("the stored form and the key still agree about one business", () => {
  /**
   * Both jobs have to keep working: an address typed four ways is one business,
   * and each of the four is storable.
   */
  const ways = [
    "acutabovestalbans.co.uk",
    "https://acutabovestalbans.co.uk",
    "http://www.acutabovestalbans.co.uk/",
    "  ACUTABOVESTALBANS.CO.UK ",
  ];

  assert.equal(new Set(ways.map(sameSite)).size, 1, "still four businesses");
  for (const w of ways) assert.doesNotThrow(() => new URL(asAddress(w)));
});

test("the key is never what gets stored", () => {
  // The exact confusion. A key has no protocol by design; a stored address must.
  const key = sameSite("https://acutabovestalbans.co.uk");
  assert.throws(() => new URL(key), "a key that parses as a url would hide this");
  assert.notEqual(asAddress("acutabovestalbans.co.uk"), key);
});

test("fetchable says null rather than throwing", () => {
  // Callers in the run path use this, so a bad address costs one enrichment
  // rather than the whole run.
  assert.equal(fetchable("not a url"), null);
  assert.equal(fetchable(null), null);
  assert.equal(fetchable("acutabovestalbans.co.uk"), "https://acutabovestalbans.co.uk");
});

test("setup stores the address, not the key", () => {
  /**
   * The line that caused it. `sameSite` and `asAddress` are one character
   * apart at the call site and a day apart in consequence: one is a key with
   * no protocol, the other is something you can fetch.
   *
   * Read as source, because the action imports server-only code.
   */
  const actions = readFileSync(
    join(import.meta.dirname, "..", "app", "welcome", "actions.ts"),
    "utf8",
  );

  assert.match(
    actions,
    /const website = asAddress\(/,
    "setup stores the comparison key, which no run can fetch",
  );
  assert.doesNotMatch(
    actions,
    /const website = sameSite\(/,
    "sameSite is for matching two addresses, never for storing one",
  );
  // And it still matches an address typed four ways to one business.
  assert.match(actions, /sameSite\(w\.website[^)]*\)/, "the dedupe no longer compares on the key");
});
