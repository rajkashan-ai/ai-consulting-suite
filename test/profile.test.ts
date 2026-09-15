import { test } from "node:test";
import assert from "node:assert/strict";
import { isProfile, profileFor } from "../tools/competitor-tracker/profile.ts";
import type { Business } from "../tools/types.ts";

const business = (p: Partial<Business>): Business => ({
  id: "1", website: "https://x.co.uk", name: "The Barber Shop", trade: "barber",
  town: "Shrewsbury", address: null, headlinePrice: null, oneLiner: null,
  reach: null, foundVia: [], knownCompetitor: null, ...p,
});

test("no trade means stop, because everything downstream turns on it", () => {
  const out = profileFor(business({ trade: null }));
  assert.ok(!isProfile(out));
  assert.deepEqual((out as { missing: string[] }).missing, ["what they do"]);
});

test("no town means stop too", () => {
  const out = profileFor(business({ town: null }));
  assert.deepEqual((out as { missing: string[] }).missing, ["what town they are in"]);
});

test("both missing are both named, so one fix is not two visits", () => {
  const out = profileFor(business({ trade: null, town: null }));
  assert.equal((out as { missing: string[] }).missing.length, 2);
});

test("the country is always set, or the search finds the wrong Shrewsbury", () => {
  // Measured: run without a country, "barber Shrewsbury" returns Pennsylvania
  // and Massachusetts ahead of Shropshire.
  const out = profileFor(business({}));
  assert.ok(isProfile(out));
  if (isProfile(out)) {
    assert.equal(out.country, "GB");
    assert.equal(out.timezone, "Europe/London");
  }
});

test("a business with no name falls back to its website, never to blank", () => {
  const out = profileFor(business({ name: null }));
  assert.ok(isProfile(out));
  if (isProfile(out)) assert.equal(out.name, "https://x.co.uk");
});
