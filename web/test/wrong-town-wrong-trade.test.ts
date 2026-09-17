import test from "node:test";
import assert from "node:assert/strict";
import { rightTrade, servesTheSamePeople, tradeFromUrl, whoFor } from "../tools/competitor-tracker/sift.ts";
import { fetchable } from "../tools/identity.ts";
import { sourceOf } from "./tool-source.ts";
import { matchTrade } from "../tools/categories.ts";
import { resultCountry } from "../../Agents/Competitor Tracker/src/search-visibility.ts";

/**
 * The two faults that reached a real customer's report on 2026-09-17, pinned
 * with the exact strings that caused them. A women's salon in Hertfordshire was
 * compared against two barbers, a make-up artist and two businesses in
 * Melbourne, and every one of the five was defensible from its name alone.
 */

test("one function says which country a url is for, and it knows both shapes", () => {
  /**
   * Asked of resultCountry itself, not of a copy of its rule written here. The
   * fault was two rules in two places, so a test that restates one of them
   * would pass while the product used the other.
   */
  assert.equal(
    resultCountry("https://www.fresha.com/lp/en/bt/hair-salons/in/au-melbourne/st-albans"),
    "AU",
    "the Melbourne page reads as no country at all again",
  );
  assert.equal(resultCountry("https://booksy.com/en-gb/s/hair-salon/234686_st-albans"), "GB");
  assert.equal(resultCountry("https://www.fresha.com/lp/en/tt/women's-haircuts/in/gb-st-albans"), "GB");
  assert.equal(resultCountry("https://acutabovestalbans.co.uk/"), "GB");
  assert.equal(resultCountry("https://booksy.com/en-us/s/hair-salon/1_shrewsbury"), "US");
  // Nothing in the url says. Null, so the caller keeps it rather than guessing.
  assert.equal(resultCountry("https://example.com/some/page"), null);
});

test("the platform's own url says the trade, and it is believed over the name", () => {
  assert.equal(
    tradeFromUrl("https://booksy.com/en-gb/188243_sofia-shakir-mua_make-up_234686_st-albans#ba_s=sr_1"),
    "beauty-salon",
  );
  assert.equal(
    tradeFromUrl("https://booksy.com/en-gb/54777_picasso-cut-coffee_barber_234686_st-albans#ba_s=sr_1"),
    "barber",
  );
  assert.equal(
    tradeFromUrl("https://booksy.com/en-gb/999_some-salon_hair-salon_234686_st-albans"),
    "hairdresser",
  );
  // Most of the web says nothing. Null, never a guess.
  assert.equal(tradeFromUrl("https://acutabovestalbans.co.uk/"), null);
  assert.equal(tradeFromUrl(null), null);
});

test("a salon is not compared against barbers or a make-up artist", () => {
  const found = [
    { name: "Picasso Cut & Coffee", url: "https://booksy.com/en-gb/54777_picasso-cut-coffee_barber_234686_st-albans" },
    { name: "HOUSE of MISTR.", url: "https://booksy.com/en-gb/145747_house-of-mistr_barber_234686_st-albans" },
    { name: "Sofia Shakir MUA", url: "https://booksy.com/en-gb/188243_sofia-shakir-mua_make-up_234686_st-albans" },
    { name: "Real Salon", url: "https://booksy.com/en-gb/321_real-salon_hair-salon_234686_st-albans" },
    { name: "Unknowable", url: null },
  ];

  const kept = rightTrade(found, "hairdresser").map((r) => r.name);
  assert.deepEqual(kept, ["Real Salon", "Unknowable"]);
});

test("Barbering is barber, which is what the word boundary missed", () => {
  // \bbarbers?\b does not match "Barbering": the boundary fails against the "i".
  for (const name of ["Alternative Barbering St. Albans", "Distinct Barbering", "Mebstar Barbering Salon"]) {
    assert.equal(matchTrade(name), "barber", name);
  }
  assert.equal(matchTrade("A Cut Above Hair Salon"), "hairdresser");
});

/**
 * Raj, 2026-09-17, on two businesses that survived every name and category
 * test: "Barbone are barbers. Evident from their website. Rob's Cuts come up as
 * hairdressers, but only have men / boys as customers." Asked for a sure and
 * fast way to spot it. This is it, and it costs no extra request: the listing
 * already prints what each business sells.
 */
const A_CUT_ABOVE = [
  "Ladies Cut & Finish - Stylist",
  "Restyle & Finish - Top Stylist",
  "Cleanse & Finish (short)",
];

/**
 * Service names copied from what one real St Albans listing printed on
 * 2026-09-17, not written here. The first version of this filter passed every
 * example I invented and refused every real salon, because A Cut Above sells
 * "Ladies Cut & Finish" and Atelier sells "Women's Haircut": the same offer
 * with no word in common.
 */
test("who a price list is written for", () => {
  assert.equal(whoFor(A_CUT_ABOVE), "women");
  assert.equal(whoFor(["Head Shave", "Beard Trim", "Hot Towel Shave"]), "men", "Picasso");
  assert.equal(whoFor(["Head Shave", "Beard Trim", "Men's Haircut"]), "men", "Phoenix Barber Co");
  assert.equal(whoFor(["Women's Haircut", "Hair Weaves", "Hair Coloring"]), "women", "Atelier");
  assert.equal(whoFor(["Balayage", "Highlights", "Blow Dry"]), "women");

  // "women" contains the letters of "men" and must never read as men.
  assert.equal(whoFor(["Women's Haircut"]), "women");

  // Both, and neither, are the same answer: we cannot tell them apart.
  assert.equal(whoFor(["Men's Haircut", "Women's Haircut"]), null, "a unisex salon");
  assert.equal(whoFor(["Standard Cut", "Normal Haircut", "Children's Haircut"]), null);
  assert.equal(whoFor([]), null);
});

test("a men-only price list is not an alternative to a women's salon", () => {
  // The case Raj named: BARBONE passed every name, url and location test.
  assert.equal(
    servesTheSamePeople(["Skin Fade", "Beard Trim", "Haircut & Beard"], A_CUT_ABOVE),
    false,
    "BARBONE",
  );
  // And the one filed as a hairdresser that serves men and boys only.
  assert.equal(
    servesTheSamePeople(["Men's Haircut", "Boys Cut", "Men's Cut & Beard"], A_CUT_ABOVE),
    false,
    "Rob's Cuts",
  );
  assert.equal(
    servesTheSamePeople(["Women's Haircut", "Hair Weaves", "Hair Coloring"], A_CUT_ABOVE),
    true,
    "Atelier Salon & Spa is a real competitor and was refused by the first version",
  );
  // Sells to both, so a customer really could go there instead.
  assert.equal(servesTheSamePeople(["Men's Haircut", "Women's Haircut"], A_CUT_ABOVE), true);
});

test("silence keeps them, because no evidence is not evidence", () => {
  // Most listings print no services. Refusing on silence would empty the
  // comparison for every platform that does not publish them.
  assert.equal(servesTheSamePeople([], A_CUT_ABOVE), true);
  assert.equal(servesTheSamePeople(undefined, A_CUT_ABOVE), true);
  assert.equal(servesTheSamePeople(["Men's Haircut"], []), true);
});

test("a street address is never kept as a web address", () => {
  /**
   * Every competitor's url on the 2026-09-17 run was a street, because the
   * prompt said "address" meaning web address on a page that prints a postal
   * address beside every business. Every fetch failed, so a run reporting five
   * businesses had read nobody's page but the customer's own.
   */
  assert.equal(fetchable("33 High St, St Albans AL3 4EH, United Kingdom"), null);
  assert.equal(fetchable("301 High St, London Colney, St Albans AL2 1EJ"), null);
  assert.equal(fetchable("https://booksy.com/en-gb/54777_picasso"), "https://booksy.com/en-gb/54777_picasso");
});

test("a full stop in the town does not turn every UK listing away", () => {
  /**
   * 2026-09-17, and the cause of everything above it.
   *
   * The listings gate built its town key with `.replace(/\s+/g, "-")`, which
   * takes out whitespace and leaves punctuation. A salon recorded as
   * "St. Albans" produced "st.-albans", and the effect was exactly backwards:
   *
   *   booksy.com/en-gb/s/hair-salon/234686_st-albans            refused
   *   fresha.com/lp/en/tt/womens-haircuts/in/gb-st-albans       refused
   *   fresha.com/lp/en/bt/hair-salons/in/us-new-york/st.-albans accepted
   *
   * Every UK listing turned away, the American one let in, because Fresha's US
   * path writes the stop and ours do not. That workspace could only ever find
   * New York, and the next run after the country fix found four page titles
   * where the same town without the stop yields fifty eight businesses.
   *
   * Asserted against the source, because the key is built inside the listings
   * step and nothing else can reach it.
   */
  const src = sourceOf("competitor-tracker")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ");

  assert.doesNotMatch(
    src,
    /const town = profile\.town \.toLowerCase\(\) \.replace\(\/\\s\+\/g, "-"\);/,
    "the town key leaves punctuation in again",
  );
  assert.match(
    src,
    /const town = profile\.town \.toLowerCase\(\) \.replace\(\/\[\^a-z0-9\]\+\/g, "-"\)/,
    "the town key no longer strips everything that is not a letter or a digit",
  );

  // And the rule itself, on the towns that break it.
  const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  assert.equal(key("St. Albans"), "st-albans");
  assert.equal(key("St Albans"), "st-albans", "both spellings must reach the same listings");
  assert.equal(key("Stoke-on-Trent"), "stoke-on-trent");
  assert.equal(key("Weston-super-Mare"), "weston-super-mare");
  assert.equal(key("Bury St Edmunds"), "bury-st-edmunds");
});
