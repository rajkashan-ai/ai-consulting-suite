import test from "node:test";
import assert from "node:assert/strict";
import { bestFirst, tierOf } from "../tools/competitor-tracker/where.ts";
import { sourceOf } from "./tool-source.ts";

/**
 * 2026-09-17. Five competitors chosen, two readable. The lookup took a Cylex
 * directory for one, which refused us, and a Facebook page for another, which
 * robots asks us not to read, while a booking profile for a third of the same
 * five read cleanly at 12,000 characters with prices and a rating on it.
 */

const CYLEX = "https://st-albans.cylex-uk.co.uk/company/atelier-salon---spa-20065676.html";
const FACEBOOK = "https://www.facebook.com/jennaloulashes.stalbans/";
const FRESHA = "https://www.fresha.com/a/a-j-studio-st-albans-village-arcade-uk-7-high-street-u7v7v43s";
const OWN_SITE = "https://toniandguy.com/salon/st-albans";
const BOOKSY = "https://booksy.com/en-gb/54777_picasso-cut-coffee_barber_234686_st-albans";
const YELL = "https://www.yell.com/biz/atelier-st-albans";

test("a booking profile beats their own site beats a directory", () => {
  assert.equal(tierOf(FRESHA), 1);
  assert.equal(tierOf(BOOKSY), 1);
  // The case Raj's reviewer raised: a salon on no platform, with a real site of
  // its own, must not be pushed below a directory that happens to list it.
  assert.equal(tierOf(OWN_SITE), 2);
  assert.equal(tierOf(CYLEX), 3);
  assert.equal(tierOf(FACEBOOK), 3);
  // Known, carries ratings, and blocked. Reachability is part of being useful.
  assert.equal(tierOf(YELL), 3);
  // Not a url at all is never preferred.
  assert.equal(tierOf("not a url"), 3);
});

test("the order search happened to return is not the order we read", () => {
  const got = bestFirst([CYLEX, FACEBOOK, FRESHA, OWN_SITE].map((url) => ({ url })));
  assert.deepEqual(got.map((r) => tierOf(r.url)), [1, 2, 3, 3]);
  assert.equal(got[0].url, FRESHA, "it still takes whatever search ranked first");
});

test("equal tiers keep the order search gave them", () => {
  // The only thing left to go on, and at least it is stable.
  const two = bestFirst([{ url: BOOKSY }, { url: FRESHA }]);
  assert.deepEqual(two.map((r) => r.url), [BOOKSY, FRESHA]);
});

test("a directory is still read when nothing better verifies", () => {
  // A ranking, not a gate. A host we have misjudged costs a worse page, never
  // a missing competitor.
  assert.deepEqual(bestFirst([{ url: CYLEX }]).map((r) => r.url), [CYLEX]);
});

test("the lookup ranks before it judges", () => {
  // judge takes the first result that really is this business in this town, so
  // ranking after it would change nothing.
  assert.match(sourceOf("competitor-tracker"), /bestFirst\(seen\[0\]\?\.results \?\? \[\]\)/);
});
