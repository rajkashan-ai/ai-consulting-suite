import { test } from "node:test";
import assert from "node:assert/strict";
import { rank, sameArea, type Found } from "../tools/competitor-tracker/rank.ts";

const one = (p: Partial<Found>): Found => ({
  name: "x", reviews: null, rating: null, reviewedDaysAgo: null,
  area: null, price: null, url: null, ...p,
});

test("near beats far, even with fewer reviews", () => {
  // The whole point. Seventy barbers came back and the first five were kept,
  // which ranked by the platform's sort order and not by who competes.
  const out = rank(
    [
      one({ name: "far", reviews: 2000, area: "Business Park" }),
      one({ name: "near", reviews: 200, area: "Smithfield Road" }),
    ],
    { area: "37 Smithfield Road", price: null },
  );
  assert.equal(out[0].name, "near");
});

test("review volume is log scale, so huge numbers do not swamp everything", () => {
  const out = rank(
    [one({ name: "huge", reviews: 2500 }), one({ name: "big", reviews: 2400 })],
    { area: null, price: null },
  );
  assert.ok(out[0].score - out[1].score < 0.05, "2400 and 2500 are the same answer");
});

test("a missing number scores zero, not an average", () => {
  // Treating a blank as middling is how a business with no data outranks a
  // business with bad data.
  const out = rank(
    [one({ name: "unknown" }), one({ name: "known", reviews: 5 })],
    { area: null, price: null },
  );
  assert.equal(out[0].name, "known");
});

test("someone charging double is selling to somebody else", () => {
  const out = rank(
    [one({ name: "double", price: 30 }), one({ name: "same", price: 16 })],
    { area: null, price: 15 },
  );
  assert.equal(out[0].name, "same");
});

test("rating barely moves it, because everyone is five stars", () => {
  // Measured: all five Shrewsbury barbers sat at 5.0 and it separated nobody.
  const out = rank(
    [one({ name: "five", rating: 5 }), one({ name: "four", rating: 4, reviews: 3 })],
    { area: null, price: null },
  );
  assert.equal(out[0].name, "four", "three real reviews beat a lone perfect score");
});

test("it says why each one is on the list", () => {
  const out = rank(
    [one({ name: "a", reviews: 800, area: "Smithfield Road", reviewedDaysAgo: 4 })],
    { area: "Smithfield Road", price: null },
  );
  assert.match(out[0].because, /near you/);
  assert.match(out[0].because, /800 reviews/);
  assert.match(out[0].because, /reviewed this month/);
});

test("a competitor with nothing published says so rather than pretending", () => {
  const out = rank([one({ name: "quiet" })], { area: null, price: null });
  assert.equal(out[0].because, "nothing published we could compare");
});

test("address words that appear in every address do not count as near", () => {
  assert.equal(sameArea("12 High Road", "88 Mill Road"), false);
  assert.equal(sameArea("37 Smithfield Road", "40 Smithfield Road"), true);
});

test("it returns five, not seventy", () => {
  const many = Array.from({ length: 70 }, (_, i) => one({ name: `b${i}`, reviews: i }));
  assert.equal(rank(many, { area: null, price: null }).length, 5);
  assert.equal(rank(many, { area: null, price: null })[0].name, "b69");
});

test("the town alone must not count as near, or everybody is near", () => {
  // The bug this was written for. Proximity was handed the town, so every
  // barber in Shrewsbury matched "Shrewsbury", the heaviest factor fired for
  // all of them, and it separated nobody while looking like it worked.
  const all = [
    one({ name: "high street", area: "37 Smithfield Road, Shrewsbury", reviews: 100 }),
    one({ name: "business park", area: "Anchorage Avenue, Shrewsbury", reviews: 100 }),
  ];

  const withTownOnly = rank(all, { area: "Shrewsbury", town: "Shrewsbury", price: null });
  assert.equal(
    withTownOnly[0].score,
    withTownOnly[1].score,
    "given only the town, it cannot tell them apart. That is the bug.",
  );

  const withStreet = rank(all, {
    area: "37 Smithfield Road, Shrewsbury",
    town: "Shrewsbury",
    price: null,
  });
  assert.equal(withStreet[0].name, "high street");
  assert.ok(withStreet[0].score > withStreet[1].score);
});

test("price overlap does nothing without your own price, and something with it", () => {
  const all = [one({ name: "cheap", price: 15 }), one({ name: "dear", price: 35 })];
  const blind = rank(all, { area: null, price: null });
  assert.equal(blind[0].score, blind[1].score, "no price of yours, no opinion");

  const seeing = rank(all, { area: null, price: 15 });
  assert.equal(seeing[0].name, "cheap");
});

test("miles beat word matching, which matched nobody", () => {
  // The bug this replaces. Two businesses in a town almost never share a street
  // name, so the heaviest factor in the ranking contributed nothing to any run.
  const all = [
    { ...one({ name: "quarter mile", reviews: 100, area: "Coton Hill" }), miles: 0.25 },
    { ...one({ name: "two miles", reviews: 100, area: "Battlefield" }), miles: 2.0 },
  ];
  const out = rank(all, { area: "Smithfield Road", town: "Shrewsbury", price: null, proximityWeight: 4 });
  assert.equal(out[0].name, "quarter mile");
  assert.match(out[0].because, /0\.3 miles away|next door/);
});

test("no postcode means no distance score, not an assumed middle", () => {
  const all = [
    { ...one({ name: "known", reviews: 10 }), miles: 0.2 },
    { ...one({ name: "unknown", reviews: 10 }), miles: null },
  ];
  const out = rank(all, { area: null, town: null, price: null, proximityWeight: 4 });
  assert.equal(out[0].name, "known");
});

test("past three miles distance stops counting at all", () => {
  const all = [
    { ...one({ name: "far", reviews: 500 }), miles: 5 },
    { ...one({ name: "near", reviews: 500 }), miles: 0 },
  ];
  const out = rank(all, { area: null, town: null, price: null, proximityWeight: 4 });
  assert.ok(out[0].score - out[1].score >= 3.9, "next door is worth the full weight");
});

test("a national business ignores miles entirely", () => {
  const all = [
    { ...one({ name: "next door", reviews: 5 }), miles: 0.1 },
    { ...one({ name: "real rival", reviews: 900 }), miles: 200 },
  ];
  const out = rank(all, { area: null, town: null, price: null, proximityWeight: 0 });
  assert.equal(out[0].name, "real rival");
});

test("a shop on a High Street in the next village is not near you", () => {
  /**
   * Measured on 2026-09-17. A salon at "19 High Street, St. Albans, AL3 4EH"
   * had four of its five suggested competitors pre-ticked on the strength of
   * one shared word, "high", the commonest street name in the country:
   *
   *   19-20 High St, Redbourn        about 5 miles
   *   48A High St, Markyate          about 7 miles
   *   301 High St, London Colney     about 4 miles
   *
   * while Chequer St and Hatfield Rd, actually in the town, scored nothing.
   * The reason shown to the owner said "near you", which was untrue.
   */
  const you = "19 High Street, St. Albans, AL3 4EH";
  const town = ["st albans", "st. albans"];

  for (const village of [
    "19-20 High St, Redbourn, St Albans",
    "48A High St, Markyate, St Albans",
    "301 High St, London Colney, St Albans",
  ]) {
    assert.equal(sameArea(village, you, town), false, village);
  }

  // Same town, no other locality named, so a shared street word still counts.
  assert.equal(sameArea("22 High Oaks, St Albans", you, town), true);
  assert.equal(sameArea("19 High Street, St Albans, AL3 4EH", you, town), true);
});

test("a street with no locality after it is still the same street", () => {
  // The rule is about a village named in their address, not about how many
  // words two addresses share. "Smithfield Road" and "37 Smithfield Road" are
  // the same street and an earlier version of this fix broke that.
  assert.equal(sameArea("Smithfield Road", "37 Smithfield Road"), true);
  assert.equal(sameArea("Business Park", "37 Smithfield Road"), false);
});
