import { test } from "node:test";
import assert from "node:assert/strict";
import { platformsFrom, proximityWeight, REACH, FOUND_VIA } from "../tools/questions.ts";
import { rank } from "../tools/competitor-tracker/rank.ts";

test("a barber and an agency do not weigh distance the same", () => {
  // The whole reason the question exists. A barber competes within half a mile.
  // An agency competes with anyone in the country.
  assert.ok(proximityWeight("nearby") > proximityWeight("town"));
  assert.ok(proximityWeight("town") > proximityWeight("county"));
  assert.equal(proximityWeight("uk"), 0);
  assert.equal(proximityWeight("world"), 0);
});

test("selling nationally means the shop next door is a coincidence", () => {
  const all = [
    { name: "next door", reviews: 5, rating: null, reviewedDaysAgo: null, area: "Mill Road", price: null, url: null },
    { name: "real rival", reviews: 900, rating: null, reviewedDaysAgo: null, area: "Leeds", price: null, url: null },
  ];
  const local = rank(all, { area: "Mill Road", town: "Shrewsbury", price: null, proximityWeight: 4 });
  assert.equal(local[0].name, "next door");

  const national = rank(all, { area: "Mill Road", town: "Shrewsbury", price: null, proximityWeight: 0 });
  assert.equal(national[0].name, "real rival");
});

test("an unanswered question behaves like the commonest answer", () => {
  assert.equal(proximityWeight(null), proximityWeight("town"));
  assert.equal(proximityWeight("nonsense"), proximityWeight("town"));
});

test("what the owner says turns into places to look", () => {
  assert.deepEqual(platformsFrom(["booking"]), ["booksy.com", "fresha.com", "treatwell.co.uk"]);
  assert.deepEqual(platformsFrom(["trades"]), ["checkatrade.com", "mybuilder.com", "ratedpeople.com"]);
});

test("answers that name no platform add none", () => {
  // "Word of mouth" and "we do not know" are real answers and worth recording,
  // and neither tells us anywhere to go.
  assert.deepEqual(platformsFrom(["word-of-mouth", "unknown", "google"]), []);
  assert.deepEqual(platformsFrom([]), []);
  assert.deepEqual(platformsFrom(null), []);
});

test("two answers naming the same platform do not queue it twice", () => {
  const both = platformsFrom(["booking", "social", "booking"]);
  assert.equal(new Set(both).size, both.length);
});

test("every option has an id and a label, or the form shows a blank", () => {
  for (const r of REACH) assert.ok(r.id && r.label, JSON.stringify(r));
  for (const f of FOUND_VIA) assert.ok(f.id && f.label, JSON.stringify(f));
  assert.equal(new Set(REACH.map((r) => r.id)).size, REACH.length);
  assert.equal(new Set(FOUND_VIA.map((f) => f.id)).size, FOUND_VIA.length);
});
