import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL, byId, labelFor, matchTrade } from "../tools/categories.ts";

test("every id is unique, or two categories share a playbook", () => {
  const ids = ALL.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("ids are lower case with hyphens, because they are playbook keys", () => {
  for (const c of ALL) assert.match(c.id, /^[a-z][a-z0-9-]*$/, c.id);
});

test("the ways people say the same trade all land on one category", () => {
  // This is the whole reason the dropdown exists. Before it, these were four
  // trades with four playbooks, each learning the same thing at the same cost.
  for (const said of ["barber", "barbershop", "Barbers", "gents hairdresser"]) {
    assert.equal(matchTrade(said), "barber", said);
  }
});

test("written the way a person writes it, not the way code stores it", () => {
  // Both of these failed first time: the input was lowercased and the list was
  // not, so a garage and an agency came back unrecognised.
  assert.equal(matchTrade("MOT centre"), "garage");
  assert.equal(matchTrade("SEO"), "marketing-agency");
  assert.equal(matchTrade("IFA"), "mortgage-broker");
});

test("something we cannot place returns null, never other", () => {
  // "We could not tell" and "it is genuinely something else" are different
  // answers, and only the customer settles which. Guessing "other" would put
  // every unrecognised business into one playbook useless to all of them.
  assert.equal(matchTrade("widget polisher"), null);
  assert.equal(matchTrade(""), null);
  assert.equal(matchTrade(null), null);
});

test("a near miss does not land on the wrong trade", () => {
  assert.equal(matchTrade("car sales"), "car-sales");
  assert.notEqual(matchTrade("car sales"), "carpenter");
});

test("an unknown id reads as not set rather than crashing", () => {
  assert.equal(byId("nonsense"), null);
  assert.equal(labelFor("nonsense"), "Not set");
  assert.equal(labelFor(null), "Not set");
});
