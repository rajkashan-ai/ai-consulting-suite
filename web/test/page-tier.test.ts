import test from "node:test";
import assert from "node:assert/strict";
import { bestFirst, tierOf } from "../tools/competitor-tracker/where.ts";
import { sourceOf } from "./tool-source.ts";
import { judge } from "../tools/competitor-tracker/naming.ts";

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

// ---------------------------------------------------------------------------
// Where inside the country, not which country
// ---------------------------------------------------------------------------

const ATELIER = { name: "Atelier Salon & Spa", why: "chosen by the owner" };
const HER_ADDRESS = "19-20 High St, Redbourn, St Albans";
const one = (url: string, title: string) => [{ url, title }];

test("a business's own village counts as the right place", () => {
  /**
   * 2026-09-17. Her own Fresha profile came back top of the search and was
   * refused because the url says Redbourn and we had searched St. Albans:
   *
   *   fresha.com/lvp/atelier-salon-spa-high-street-redbourn-PV1x3b
   *
   * The listing had already told us "19-20 High St, Redbourn, St Albans". We
   * knew where she was and did not use it, and read a Yelp page instead of a
   * profile carrying her prices and her rating.
   */
  const url = "https://www.fresha.com/lvp/atelier-salon-spa-high-street-redbourn-PV1x3b";
  assert.equal(judge(ATELIER, one(url, "Atelier Salon & Spa - Redbourn"), "St. Albans").found, null);
  assert.equal(
    judge(ATELIER, one(url, "Atelier Salon & Spa - Redbourn"), "St. Albans", HER_ADDRESS).found?.url,
    url,
  );
});

test("the town is matched in both spellings a url might use", () => {
  // "St. Albans" squashed is "stalbans" and every platform writes "st-albans".
  // The same fault the listings gate had this morning, in a second place.
  const url = "https://www.fresha.com/a/atelier-st-albans-abc";
  assert.equal(judge(ATELIER, one(url, "Atelier Salon & Spa"), "St. Albans", HER_ADDRESS).found?.url, url);
});

test("loosening the town did not loosen the country", () => {
  /**
   * Raj: keep the country strict. Caught in testing before it ran: judge had
   * its own weaker country patterns and never used resultCountry, so a
   * Melbourne url with a Redbourn title was taken. The place words are matched
   * in the url now, which a platform writes, not the title, which anyone does.
   */
  for (const [url, title] of [
    ["https://www.fresha.com/a/hair-by-tay-melbourne-17-arabin-street-owt9mkgq", "Atelier Salon & Spa Redbourn"],
    ["https://booksy.com/en-us/1_atelier_hair-salon_2_st-albans", "Atelier Salon & Spa"],
    // The same name in another English town is not her either.
    ["https://www.fresha.com/a/atelier-salon-spa-harrogate-xyz", "Atelier Salon & Spa"],
  ] as const) {
    assert.equal(judge(ATELIER, one(url, title), "St. Albans", HER_ADDRESS).found, null, url);
  }
});

test("a street word is too common to place anybody", () => {
  // "high", "road" and "west" appear in half the urls on the web. Five letters
  // keeps Redbourn, Markyate and Colney and drops those.
  const url = "https://www.fresha.com/a/someone-else-high-street-harrogate";
  assert.equal(judge(ATELIER, one(url, "Atelier Salon & Spa"), "St. Albans", HER_ADDRESS).found, null);
});
