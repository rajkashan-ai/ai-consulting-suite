import { test } from "node:test";
import assert from "node:assert/strict";
import { pricedSourcesFor, sourcesFor } from "../tools/sources/uk-directories.ts";
import { sourceOf } from "./tool-source.ts";

/**
 * Never conclude a price is unpublished until every industry-equivalent
 * platform has been asked.
 *
 * 2026-09-18. A Cut Above's comparison said no competitor publishes a price.
 * Booksy and Fresha had been asked. Treatwell had not, and Treatwell prints a
 * ladies' cut and blow dry for four St Albans salons: Sanrizz from £44, Alley
 * Cats £50, Quadrant from £52, Lee Moran from £40, against A Cut Above's £51
 * to £68. The answer the first two gave was reported as the answer.
 *
 * Two separate faults, and both are pinned here.
 */

test("every price-carrying platform for a trade is searched, not the first two", () => {
  const src = sourceOf("competitor-tracker");
  assert.match(src, /pricedSourcesFor\(business\.trade\)/, "the price platforms are not gathered");
  assert.doesNotMatch(
    src,
    /const targetedHosts = known\.slice\(0, 2\)/,
    "back to two targeted hosts, so the third price platform is never asked",
  );
});

test("a listing path shape we know about is not thrown away", () => {
  // Treatwell's listing is /places/. It matched neither Booksy's /s/ nor
  // Fresha's /lp/ and /in/gb-, so it was discarded before it was fetched.
  const shape = /\/(s|lp|places|search|browse)\//;
  assert.ok(shape.test("https://www.treatwell.co.uk/places/at-hair-salon/in-st-albans-uk/"));
  assert.ok(shape.test("https://booksy.com/en-gb/s/hair-salon/234686_st-albans"));
  assert.match(sourceOf("competitor-tracker"), /\(s\|lp\|places\|search\|browse\)/);
});

test("a platform we have read is not left marked untested", () => {
  // Treatwell sat in the list carrying "prices" and marked untested, which is
  // how a source nobody had tried stayed a source nobody tried.
  const treatwell = sourcesFor("hairdresser").find((d) => d.host === "treatwell.co.uk");
  assert.ok(treatwell, "treatwell is not offered for hairdressers at all");
  assert.equal(treatwell!.reachable.state, "yes");
});

test("the price platforms for hair and beauty are all three, in order", () => {
  assert.deepEqual(
    pricedSourcesFor("hairdresser").map((d) => d.host),
    ["booksy.com", "fresha.com", "treatwell.co.uk"],
  );
  // A trade with none must return none rather than everything.
  assert.deepEqual(pricedSourcesFor("plumber"), []);
});
