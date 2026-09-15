import { test } from "node:test";
import assert from "node:assert/strict";
import { districtIn, milesBetween, positionsFor, postcodeIn, round, sayMiles } from "../lib/research/distance.ts";

test("a postcode is found inside a real address", () => {
  assert.equal(postcodeIn("37 Smithfield Road, Shrewsbury SY1 1PW"), "SY1 1PW");
  assert.equal(postcodeIn("122 Longdon Coleham, SY37DU"), "SY3 7DU");
  assert.equal(postcodeIn("no postcode here"), null);
  assert.equal(postcodeIn(null), null);
});

test("the district is kept even when the full postcode is not there", () => {
  // A district is a place. A full postcode identifies a household, and for a
  // sole trader working from home that is their home.
  assert.equal(districtIn("37 Smithfield Road, SY1"), "SY1");
  assert.equal(districtIn("37 Smithfield Road, SY1 1PW"), "SY1");
  assert.equal(districtIn("Shrewsbury"), null);
});

test("a position is rounded before anything is stored", () => {
  // Three decimal places is about a hundred metres: enough to say a quarter of
  // a mile, not enough to say which building.
  const r = round({ lat: 52.7098621, lon: -2.7558074 });
  assert.equal(r.lat, 52.71);
  assert.equal(r.lon, -2.756);
});

test("real Shrewsbury distances come out about right", () => {
  const you = { lat: 52.71, lon: -2.756 };      // SY1 1PW, Smithfield Road
  const fadeInn = { lat: 52.704, lon: -2.749 }; // SY3 7DU, Longdon Coleham
  const noOne = { lat: 52.714, lon: -2.752 };   // SY1 2DP, Coton Hill

  const a = milesBetween(you, fadeInn);
  const b = milesBetween(you, noOne);
  assert.ok(a > 0.3 && a < 0.8, `Longdon Coleham came out ${a} miles`);
  assert.ok(b > 0.1 && b < 0.5, `Coton Hill came out ${b} miles`);
  assert.ok(b < a, "Coton Hill is nearer than Longdon Coleham");
});

test("the same place is no distance at all", () => {
  assert.equal(milesBetween({ lat: 52.71, lon: -2.756 }, { lat: 52.71, lon: -2.756 }), 0);
});

test("a lookup that is down does not fail the run", () => {
  // Everyone scores zero for distance, which is what happened before this
  // existed. Never a reason to lose a whole run.
  const dead = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
  return positionsFor(["SY1 1PW"], dead).then((m) => assert.equal(m.size, 0));
});

test("a postcode that does not exist is skipped, not fatal", async () => {
  const fake = (async () =>
    new Response(
      JSON.stringify({
        result: [
          { query: "SY1 1PW", result: { latitude: 52.709862, longitude: -2.755807 } },
          { query: "ZZ9 9ZZ", result: null },
        ],
      }),
      { status: 200 },
    )) as unknown as typeof fetch;

  const out = await positionsFor(["SY1 1PW", "ZZ9 9ZZ"], fake);
  assert.equal(out.size, 1);
  assert.deepEqual(out.get("SY1 1PW"), { lat: 52.71, lon: -2.756 });
});

test("distances are said the way somebody would say them", () => {
  assert.equal(sayMiles(0.05), "next door");
  assert.equal(sayMiles(0.42), "0.4 miles away");
  assert.equal(sayMiles(1.83), "1.8 miles away");
});
