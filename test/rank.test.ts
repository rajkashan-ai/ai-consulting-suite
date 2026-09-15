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
