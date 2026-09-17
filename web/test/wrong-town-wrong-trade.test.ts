import test from "node:test";
import assert from "node:assert/strict";
import { rightTrade, tradeFromUrl } from "../tools/competitor-tracker/sift.ts";
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
