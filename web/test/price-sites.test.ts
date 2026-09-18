/**
 * Finding a competitor's prices when the listing gave us no link.
 *
 * WHAT THIS IS ABOUT, MEASURED RATHER THAN ASSUMED
 * Fresha's listing page for St Albans was fetched on 2026-09-18. Its server
 * HTML is 217KB and carries schema.org JSON-LD: a name and a postal address per
 * business and nothing else. 300 anchors, none pointing at a venue page. The
 * string "price" does not appear in the page at all.
 *
 * So `fetchable()` correctly stores no url for those businesses, and the only
 * route to their prices is their booking profile, which has to be found. The
 * plain search by name is a lottery: for one of the five it returned a Cylex
 * directory that refused us, while a booking profile read cleanly for another.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { hasAPricedSource, sitesThatPublishPrices, tierOf } from "../tools/competitor-tracker/where.ts";
import { searchOnPriceSites } from "../tools/competitor-tracker/naming.ts";

test("the sites come off the registry, not out of this file", () => {
  const sites = sitesThatPublishPrices();
  assert.ok(sites.length > 0, "nothing in the registry is recorded as printing a price");
  /* Every one of them must be a source tierOf already prefers, or the second
     search would go looking somewhere the ranking then pushes to the bottom. */
  for (const host of sites) {
    assert.equal(tierOf(`https://${host}/somewhere`), 1, `${host} is searched for and then not preferred`);
  }
});

test("a blocked platform is never searched for", () => {
  /* Instagram and Facebook both answer "their robots.txt asks us not to read
     this page". Searching for a page we are not allowed to open spends a
     search to learn something we already recorded. */
  const sites = sitesThatPublishPrices();
  for (const blocked of ["instagram.com", "facebook.com"]) {
    assert.ok(!sites.includes(blocked), `${blocked} is blocked and still searched for`);
  }
});

test("the term asks for one business on those sites and nowhere else", () => {
  const term = searchOnPriceSites({ name: "Atelier Salon & Spa", why: "x" }, "St Albans", ["booksy.com", "fresha.com"]);
  assert.equal(term, '"Atelier Salon & Spa" St Albans (site:booksy.com OR site:fresha.com)');
});

test("no sites means no second search, rather than the first one again", () => {
  /* A second search with no site restriction is the first search repeated: the
     same cost and no new answer. */
  assert.equal(searchOnPriceSites({ name: "X", why: "x" }, "St Albans", []), null);
});

test("a search that already found a priced source does not trigger the fallback", () => {
  assert.equal(hasAPricedSource([{ url: "https://booksy.com/en-gb/1_x_barber_2_st-albans" }]), true);
});

test("a search that found only their own site or a directory does trigger it", () => {
  /**
   * Their own website is tier two: it may carry a price and often does not,
   * and for a competitor it is the page least likely to. A Cylex directory and
   * a Facebook page are tier three. None of these is a reason not to look
   * harder.
   */
  assert.equal(hasAPricedSource([{ url: "https://atelier-salon.co.uk/" }]), false);
  assert.equal(hasAPricedSource([{ url: "https://www.facebook.com/atelier" }]), false);
  assert.equal(hasAPricedSource([]), false);
});
