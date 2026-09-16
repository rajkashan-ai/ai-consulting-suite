import { test } from "node:test";
import assert from "node:assert/strict";
import { playbookKey, seeded, whereToLook, wordsFor } from "../tools/competitor-tracker/where.ts";
import type { Playbook } from "../tools/competitor-tracker/playbook.ts";
import type { Business } from "../tools/types.ts";

const business = (over: Partial<Business> = {}): Business => ({
  id: "b1", website: "https://example.co.uk", name: "Example", trade: "barber",
  town: "Shrewsbury", address: null, headlinePrice: null, services: [],
  oneLiner: null, reach: null, foundVia: [], knownCompetitor: null, ...over,
});

const playbook = (over: Partial<Playbook> = {}): Playbook => ({
  trade: "barber", platforms: [], publishes: [], deadEnds: [], evidence: [],
  timesUsed: 0, builtFrom: null, nothingIn: [], towns: [], ...over,
});

/**
 * The deadlock this exists to break: the playbook is written by successful runs
 * and read by every run, so a trade nobody has done has nowhere to start. A
 * bakery run died in 79 seconds having read no listing at all.
 */
test("a trade nobody has ever run still has somewhere to look", () => {
  const found = whereToLook("barber", null, []);
  assert.ok(found.hosts.length > 0, "no playbook must not mean no hosts");
  assert.equal(found.best, "seeded");
  assert.ok(found.hosts.includes("booksy.com"));
});

test("a trade with no specialist still gets the general floor", () => {
  // Retail has no specialist we have evidence for. It must not come back empty.
  const found = whereToLook("shop", null, []);
  assert.ok(found.hosts.length > 0);
  assert.equal(found.best, "floor");
});

test("an unmatched business gets the floor rather than nothing", () => {
  const found = whereToLook("other", null, []);
  assert.ok(found.hosts.length > 0, "Something else must still run");
  assert.equal(found.best, "floor");
});

test("what a run measured beats what a research pass claimed", () => {
  // Measured beats curated: a platform that actually named seventy barbers in a
  // real town is better evidence than a list saying barbers are on it.
  const found = whereToLook(
    "barber",
    playbook({ platforms: [{ host: "treatwell.co.uk", example: "x", named: 70 }] }),
    [],
  );
  assert.equal(found.hosts[0], "treatwell.co.uk");
  assert.equal(found.from["treatwell.co.uk"], "playbook");
  assert.equal(found.from["booksy.com"], "seeded", "the seed is still there, just later");
});

test("what the owner said beats everything", () => {
  const found = whereToLook(
    "barber",
    playbook({ platforms: [{ host: "treatwell.co.uk", example: "x", named: 70 }] }),
    ["fresha.com"],
  );
  assert.equal(found.hosts[0], "fresha.com");
  assert.equal(found.best, "owner");
});

test("a host is listed once, under its best evidence", () => {
  const found = whereToLook(
    "barber",
    playbook({ platforms: [{ host: "booksy.com", example: "x", named: 70 }] }),
    [],
  );
  assert.equal(found.hosts.filter((h) => h === "booksy.com").length, 1);
  assert.equal(found.from["booksy.com"], "playbook", "the stronger claim wins");
});

test("a blocked source is never offered, at any tier", () => {
  // CLAUDE.md 1.5: never worked around. A run that fetches a 403 has spent time
  // and told the owner nothing.
  for (const trade of ["plumber", "barber", "shop", "other"]) {
    const { hosts } = whereToLook(trade, null, []);
    for (const dead of ["yell.com", "checkatrade.com", "just-eat.co.uk"]) {
      assert.ok(!hosts.includes(dead), `${dead} offered for ${trade}`);
    }
  }
});

test("the seeded specialists and the floor are kept apart", () => {
  const { specialists, floor } = seeded("barber");
  assert.ok(specialists.includes("booksy.com"));
  assert.ok(floor.includes("freeindex.co.uk"));
  assert.ok(!specialists.includes("freeindex.co.uk"), "the floor is not a lead");
});

/**
 * "Something else" is a real choice in the dropdown with the id `other`, so the
 * searches became "other shrewsbury" and "best other shrewsbury". That is not a
 * near miss, it is a search for the word other.
 */
test("an unmatched business is searched for by its own words", () => {
  assert.equal(wordsFor(business({ trade: "barber" })), "barber");
  assert.equal(
    wordsFor(business({ trade: "other", services: [{ name: "Scaffolding hire", price: null }] })),
    "scaffolding hire",
  );
  assert.equal(
    wordsFor(business({ trade: "other", oneLiner: "Wedding cakes, made in Hertfordshire" })),
    "wedding cakes",
  );
  assert.equal(wordsFor(business({ trade: "other" })), null, "nothing to go on means stop");
});

test("a whole sentence is not a search term", () => {
  const long = business({
    trade: "other",
    oneLiner: "We have been proudly serving the people of this county since 1974 with care",
  });
  assert.equal(wordsFor(long), null);
});

/**
 * Every unmatched business in the country would share one `other` row, so a
 * scaffolder would be sent where a wedding cake maker had been.
 */
test("unmatched businesses never share one playbook row", () => {
  const scaffolder = playbookKey(
    business({ trade: "other", services: [{ name: "Scaffolding hire", price: null }] }),
  );
  const baker = playbookKey(
    business({ trade: "other", oneLiner: "Wedding cakes, made in Hertfordshire" }),
  );

  assert.notEqual(scaffolder, baker);
  assert.equal(scaffolder, "other:scaffolding-hire");
  assert.notEqual(scaffolder, "other");
  assert.notEqual(baker, "other");
});

test("a business we cannot name is not filed at all", () => {
  // Better to learn nothing than to learn into a row that mixes trades.
  assert.equal(playbookKey(business({ trade: "other" })), null);
  assert.equal(playbookKey(business({ trade: null })), null);
});

test("a matched trade is filed under its own id, unchanged", () => {
  assert.equal(playbookKey(business({ trade: "plumber" })), "plumber");
});

/**
 * Setup asks for a trade and will not finish without one, so a blank means
 * setup did not finish. Guessing from a marketing sentence there would let a
 * half-finished business run and produce a comparison against the wrong people.
 */
test("no trade at all is a missing answer, not an unmatched one", () => {
  const halfDone = business({ trade: null, oneLiner: "Wedding cakes, made in Hertfordshire" });
  assert.equal(wordsFor(halfDone), null, "a blank trade must stop the run, not be guessed");
  assert.equal(playbookKey(halfDone), null);
});
